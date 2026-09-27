from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import secrets
import hashlib
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

import io
import base64
import hmac
import qrcode
import razorpay
import jwt
import bcrypt
import httpx
from fastapi.responses import StreamingResponse
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from html import escape
from urllib.parse import urlparse

# ---------------------------------------------------------------- Setup
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Avero API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("avero")

JWT_ALGORITHM = "HS256"
LAUNCH_OFFER_END = "2027-01-15T23:59:59+05:30"

# ---------------------------------------------------------------- Auth helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "email": email, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

def clean_user(user: dict) -> dict:
    user["id"] = str(user["_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Session expired")
        return clean_user(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def get_business_for_user(user: dict) -> Optional[dict]:
    biz = await db.businesses.find_one({"owner_id": user["id"]}, {"_id": 0})
    if not biz:
        member = await db.business_members.find_one({"user_id": user["id"]})
        if member:
            biz = await db.businesses.find_one({"id": member["business_id"]}, {"_id": 0})
    return biz

async def require_business(user: dict = Depends(get_current_user)) -> dict:
    biz = await get_business_for_user(user)
    if not biz:
        raise HTTPException(status_code=404, detail="No business found. Complete onboarding first.")
    return biz

# ---------------------------------------------------------------- Email
EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "Avero"

async def send_password_reset_email(to_email: str, token: str) -> bool:
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    link = f"{base}/reset-password?token={token}"
    if not EMAIL_KEY or EMAIL_KEY.startswith("{") or not base.startswith("https://"):
        if urlparse(base).hostname in ("localhost", "127.0.0.1", "::1"):
            logger.warning("Email not configured; password reset link: %s", link)
        else:
            logger.error("Password reset email not configured (EMERGENT_EMAIL_KEY / FRONTEND_URL)")
        return False
    brand = escape(EMAIL_FROM_NAME)
    html = (
        f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
        f'<p>We received a request to reset your {brand} password.</p>'
        f'<p><a href="{escape(link)}">Reset your password</a></p>'
        f'<p>This link expires in 1 hour and can be used once. If you did not request it, ignore this email.</p>'
        f'<p style="font-size:12px;color:#888">Sent by {brand}. We never ask for your password by email.</p>'
        f'</td></tr></table>'
    )
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                headers={"X-Email-Key": EMAIL_KEY},
                                json={"to": [to_email], "subject": f"Reset your {EMAIL_FROM_NAME} password",
                                      "html": html, "from_name": EMAIL_FROM_NAME})
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
        return False

# ---------------------------------------------------------------- Brute force
async def is_locked(ip: str, email: str) -> bool:
    identifier = f"{ip}:{email}"
    since = datetime.now(timezone.utc) - timedelta(minutes=15)
    count = await db.login_attempts.count_documents(
        {"identifier": identifier, "ts": {"$gt": since.isoformat()}})
    return count >= 5

async def record_fail(ip: str, email: str):
    await db.login_attempts.insert_one(
        {"identifier": f"{ip}:{email}", "email": email, "ts": datetime.now(timezone.utc).isoformat()})

async def clear_attempts(ip: str, email: str):
    await db.login_attempts.delete_many({"email": email})

# ---------------------------------------------------------------- Models
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotIn(BaseModel):
    email: EmailStr

class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)

# ---------------------------------------------------------------- Auth routes
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {"email": email, "password_hash": hash_password(body.password), "name": body.name,
           "role": "owner", "token_version": 0, "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    access = create_access_token(uid, email, 0)
    refresh = create_refresh_token(uid, 0)
    set_auth_cookies(response, access, refresh)
    return {"user": {"id": uid, "email": email, "name": body.name, "role": "owner"}, "access_token": access}

@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    if await is_locked(ip, email):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await record_fail(ip, email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_attempts(ip, email)
    uid = str(user["_id"])
    ver = user.get("token_version", 0)
    access = create_access_token(uid, email, ver)
    refresh = create_refresh_token(uid, ver)
    set_auth_cookies(response, access, refresh)
    return {"user": clean_user(user), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    biz = await get_business_for_user(user)
    return {"user": user, "business": biz}

@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Session expired")
        access = create_access_token(str(user["_id"]), user["email"], user.get("token_version", 0))
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
        return {"access_token": access}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

GENERIC_RESET_MSG = {"message": "If that email is registered, a reset link has been sent."}

@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn, background_tasks: BackgroundTasks):
    email = body.email.lower()
    now = datetime.now(timezone.utc)
    await db.password_reset_requests.insert_one({"email": email, "created_at": now.isoformat()})
    since = now - timedelta(minutes=15)
    recent = await db.password_reset_requests.count_documents({"email": email, "created_at": {"$gt": since.isoformat()}})
    if recent > 5:
        return GENERIC_RESET_MSG
    user = await db.users.find_one({"email": email})
    if not user:
        return GENERIC_RESET_MSG
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    await db.password_reset_tokens.insert_one({
        "token_hash": token_hash, "user_id": str(user["_id"]), "email": email,
        "expires_at": (now + timedelta(hours=1)), "used": False})
    background_tasks.add_task(send_password_reset_email, user["email"], token)
    return GENERIC_RESET_MSG

@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    h = hashlib.sha256(body.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    doc = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": h, "used": False, "expires_at": {"$gt": now}}, {"$set": {"used": True}})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    await db.users.update_one({"_id": ObjectId(doc["user_id"])},
                              {"$set": {"password_hash": hash_password(body.password)},
                               "$inc": {"token_version": 1}})
    await db.password_reset_tokens.delete_many({"user_id": doc["user_id"], "used": False})
    await db.login_attempts.delete_many({"email": doc["email"]})
    return {"message": "Password reset successful"}

# ---------------------------------------------------------------- Onboarding / Business
GST_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")

@api.post("/onboarding")
async def save_onboarding(payload: dict, user: dict = Depends(get_current_user)):
    biz = await db.businesses.find_one({"owner_id": user["id"]})
    allowed = {"business_name", "business_type", "referral_source", "referral_source_other",
               "manager_name", "owner_is_manager", "gst_registered", "gst_number",
               "fssai_number", "onboarding_completed", "dashboard_tour_completed"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    if updates.get("gst_registered") and updates.get("gst_number"):
        if not GST_RE.match(str(updates["gst_number"]).upper()):
            raise HTTPException(status_code=400, detail="Invalid GST number format")
        updates["gst_number"] = str(updates["gst_number"]).upper()
    now = datetime.now(timezone.utc).isoformat()
    if not biz:
        doc = {"id": str(uuid.uuid4()), "owner_id": user["id"], "owner_name": user["name"],
               "business_name": "", "business_type": "cafe", "referral_source": None,
               "referral_source_other": None, "manager_name": None, "owner_is_manager": False,
               "gst_registered": False, "gst_number": None, "fssai_number": None,
               "onboarding_completed": False, "dashboard_tour_completed": False,
               "created_at": now, "updated_at": now}
        doc.update(updates)
        await db.businesses.insert_one(doc)
        await db.staff.insert_one({"id": str(uuid.uuid4()), "business_id": doc["id"], "name": user["name"],
                                   "role": "Owner", "phone": "", "status": "active",
                                   "joining_date": now, "created_at": now})
        biz = doc
    else:
        updates["updated_at"] = now
        await db.businesses.update_one({"owner_id": user["id"]}, {"$set": updates})
        biz = await db.businesses.find_one({"owner_id": user["id"]})
    # ensure a subscription exists
    if not await db.subscriptions.find_one({"business_id": biz["id"]}):
        await db.subscriptions.insert_one({
            "id": str(uuid.uuid4()), "business_id": biz["id"], "plan": "launch_free",
            "status": "active", "start_date": now, "end_date": LAUNCH_OFFER_END,
            "created_at": now, "updated_at": now})
    biz.pop("_id", None)
    return biz

@api.get("/business/me")
async def business_me(user: dict = Depends(get_current_user)):
    return await get_business_for_user(user)

@api.patch("/business")
async def update_business(payload: dict, biz: dict = Depends(require_business)):
    allowed = {"business_name", "business_type", "manager_name", "gst_registered",
               "gst_number", "fssai_number", "owner_name"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.businesses.update_one({"id": biz["id"]}, {"$set": updates})
    return await db.businesses.find_one({"id": biz["id"]}, {"_id": 0})

# ---------------------------------------------------------------- Pricing config
def launch_active_now() -> bool:
    end = datetime.fromisoformat(LAUNCH_OFFER_END)
    return datetime.now(timezone.utc) < end.astimezone(timezone.utc)

async def get_pricing_config() -> dict:
    cfg = await db.pricing_config.find_one({"id": "singleton"}, {"_id": 0})
    if not cfg:
        cfg = {"id": "singleton", "launchOfferEnd": LAUNCH_OFFER_END,
               "announcement": "Free for Cafes & Restaurants until 15 January 2027",
               "monthly": 49, "threeMonth": 149, "sixMonth": 249, "yearly": 449}
        await db.pricing_config.insert_one(dict(cfg))
    return cfg

@api.get("/pricing")
async def pricing():
    cfg = await get_pricing_config()
    end = datetime.fromisoformat(cfg["launchOfferEnd"])
    active = datetime.now(timezone.utc) < end.astimezone(timezone.utc)
    return {"config": cfg, "launch_active": active,
            "server_time": datetime.now(timezone.utc).isoformat(),
            "launch_end_iso": end.astimezone(timezone.utc).isoformat()}

@api.get("/admin/pricing")
async def admin_get_pricing(admin: dict = Depends(require_admin)):
    return await get_pricing_config()

@api.patch("/admin/pricing")
async def admin_update_pricing(payload: dict, admin: dict = Depends(require_admin)):
    allowed = {"launchOfferEnd", "announcement", "monthly", "threeMonth", "sixMonth", "yearly"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    await db.pricing_config.update_one({"id": "singleton"}, {"$set": updates}, upsert=True)
    return await db.pricing_config.find_one({"id": "singleton"}, {"_id": 0})

@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    total_biz = await db.businesses.count_documents({})
    cafes = await db.businesses.count_documents({"business_type": "cafe"})
    restaurants = await db.businesses.count_documents({"business_type": "restaurant"})
    users = await db.users.count_documents({})
    referrals = await db.businesses.aggregate([
        {"$group": {"_id": "$referral_source", "count": {"$sum": 1}}}]).to_list(50)
    return {"total_businesses": total_biz, "cafes": cafes, "restaurants": restaurants,
            "users": users, "referrals": [{"source": r["_id"] or "Unknown", "count": r["count"]} for r in referrals]}

@api.get("/subscription")
async def get_subscription(biz: dict = Depends(require_business)):
    sub = await db.subscriptions.find_one({"business_id": biz["id"]}, {"_id": 0})
    return {"subscription": sub, "launch_active": launch_active_now()}

# ---------------------------------------------------------------- Generic CRUD factory
def register_crud(path: str, coll: str):
    @api.get(f"/{path}", name=f"list_{path}")
    async def _list(biz: dict = Depends(require_business)):
        return await db[coll].find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)

    @api.post(f"/{path}", name=f"create_{path}")
    async def _create(payload: dict, biz: dict = Depends(require_business)):
        now = datetime.now(timezone.utc).isoformat()
        payload.pop("id", None); payload.pop("_id", None)
        doc = {**payload, "id": str(uuid.uuid4()), "business_id": biz["id"],
               "created_at": now, "updated_at": now}
        await db[coll].insert_one(doc)
        doc.pop("_id", None)
        return doc

    @api.put(f"/{path}/{{item_id}}", name=f"update_{path}")
    async def _update(item_id: str, payload: dict, biz: dict = Depends(require_business)):
        payload.pop("id", None); payload.pop("_id", None); payload.pop("business_id", None)
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        r = await db[coll].update_one({"id": item_id, "business_id": biz["id"]}, {"$set": payload})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return await db[coll].find_one({"id": item_id}, {"_id": 0})

    @api.delete(f"/{path}/{{item_id}}", name=f"delete_{path}")
    async def _delete(item_id: str, biz: dict = Depends(require_business)):
        r = await db[coll].delete_one({"id": item_id, "business_id": biz["id"]})
        if r.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"message": "Deleted"}

for _p, _c in [("customers", "customers"), ("menu-categories", "menu_categories"),
               ("menu-items", "menu_items"), ("tables", "tables"),
               ("inventory", "inventory"), ("expenses", "expenses"), ("staff", "staff")]:
    register_crud(_p, _c)

# ---------------------------------------------------------------- Inventory transactions
@api.post("/inventory/{item_id}/adjust")
async def adjust_inventory(item_id: str, payload: dict, biz: dict = Depends(require_business)):
    item = await db.inventory.find_one({"id": item_id, "business_id": biz["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    delta = float(payload.get("delta", 0))
    new_qty = float(item.get("stock_quantity", 0)) + delta
    now = datetime.now(timezone.utc).isoformat()
    await db.inventory.update_one({"id": item_id}, {"$set": {"stock_quantity": new_qty, "updated_at": now}})
    await db.inventory_transactions.insert_one({
        "id": str(uuid.uuid4()), "business_id": biz["id"], "inventory_id": item_id,
        "item_name": item.get("name"), "delta": delta, "type": payload.get("type", "adjust"),
        "note": payload.get("note", ""), "resulting_qty": new_qty, "created_at": now})
    return await db.inventory.find_one({"id": item_id}, {"_id": 0})

@api.get("/inventory-transactions")
async def inventory_transactions(biz: dict = Depends(require_business)):
    return await db.inventory_transactions.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)

# ---------------------------------------------------------------- Orders
async def next_order_number(business_id: str) -> str:
    count = await db.orders.count_documents({"business_id": business_id})
    return f"ORD-{count + 1:04d}"

def compute_totals(items, discount, tax_rate):
    subtotal = sum(float(i.get("price", 0)) * int(i.get("qty", 1)) for i in items)
    discount = float(discount or 0)
    taxable = max(subtotal - discount, 0)
    tax = round(taxable * float(tax_rate or 0) / 100, 2)
    total = round(taxable + tax, 2)
    return round(subtotal, 2), round(tax, 2), total

@api.get("/orders")
async def list_orders(biz: dict = Depends(require_business)):
    return await db.orders.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api.post("/orders")
async def create_order(payload: dict, biz: dict = Depends(require_business)):
    now = datetime.now(timezone.utc).isoformat()
    items = payload.get("items", [])
    subtotal, tax, total = compute_totals(items, payload.get("discount", 0), payload.get("tax_rate", 0))
    order = {
        "id": str(uuid.uuid4()), "business_id": biz["id"],
        "order_number": await next_order_number(biz["id"]),
        "order_type": payload.get("order_type", "dine-in"),
        "table_id": payload.get("table_id"), "table_number": payload.get("table_number"),
        "customer_id": payload.get("customer_id"), "customer_name": payload.get("customer_name"),
        "items": items, "notes": payload.get("notes", ""),
        "discount": float(payload.get("discount", 0)), "tax_rate": float(payload.get("tax_rate", 0)),
        "subtotal": subtotal, "tax": tax, "total": total,
        "status": payload.get("status", "new"), "bill_status": "pending",
        "created_at": now, "updated_at": now}
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)
    # mark table occupied
    if order["table_id"]:
        await db.tables.update_one({"id": order["table_id"], "business_id": biz["id"]},
                                   {"$set": {"status": "occupied", "current_order_id": order["id"],
                                             "updated_at": now}})
    # restaurant -> auto create KOT
    if biz.get("business_type") == "restaurant":
        await db.kot_orders.insert_one({
            "id": str(uuid.uuid4()), "business_id": biz["id"], "order_id": order["id"],
            "order_number": order["order_number"], "table_number": order.get("table_number"),
            "order_type": order["order_type"], "items": items, "notes": order["notes"],
            "status": "new", "created_at": now, "updated_at": now})
    return order

@api.put("/orders/{order_id}")
async def update_order(order_id: str, payload: dict, biz: dict = Depends(require_business)):
    order = await db.orders.find_one({"id": order_id, "business_id": biz["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    now = datetime.now(timezone.utc).isoformat()
    updates = {}
    for k in ("status", "notes", "customer_id", "customer_name", "order_type", "table_id", "table_number"):
        if k in payload:
            updates[k] = payload[k]
    if "items" in payload or "discount" in payload or "tax_rate" in payload:
        items = payload.get("items", order.get("items", []))
        disc = payload.get("discount", order.get("discount", 0))
        tr = payload.get("tax_rate", order.get("tax_rate", 0))
        subtotal, tax, total = compute_totals(items, disc, tr)
        updates.update({"items": items, "discount": float(disc), "tax_rate": float(tr),
                        "subtotal": subtotal, "tax": tax, "total": total})
        if biz.get("business_type") == "restaurant":
            await db.kot_orders.update_one({"order_id": order_id, "business_id": biz["id"]},
                                           {"$set": {"items": items, "updated_at": now}})
    updates["updated_at"] = now
    await db.orders.update_one({"id": order_id}, {"$set": updates})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

@api.delete("/orders/{order_id}")
async def delete_order(order_id: str, biz: dict = Depends(require_business)):
    order = await db.orders.find_one({"id": order_id, "business_id": biz["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    await db.orders.delete_one({"id": order_id})
    await db.kot_orders.delete_many({"order_id": order_id})
    if order.get("table_id"):
        await db.tables.update_one({"id": order["table_id"]},
                                   {"$set": {"status": "available", "current_order_id": None}})
    return {"message": "Deleted"}

@api.post("/orders/{order_id}/bill")
async def bill_order(order_id: str, payload: dict, biz: dict = Depends(require_business)):
    order = await db.orders.find_one({"id": order_id, "business_id": biz["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    now = datetime.now(timezone.utc).isoformat()
    method = payload.get("method", "cash")
    payment = {
        "id": str(uuid.uuid4()), "business_id": biz["id"], "order_id": order_id,
        "order_number": order["order_number"], "amount": order["total"], "method": method,
        "status": "paid", "customer_name": order.get("customer_name"), "created_at": now}
    await db.payments.insert_one(dict(payment))
    payment.pop("_id", None)
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "completed", "bill_status": "paid",
                                                           "payment_method": method, "updated_at": now}})
    if order.get("table_id"):
        await db.tables.update_one({"id": order["table_id"]},
                                   {"$set": {"status": "cleaning", "current_order_id": None, "updated_at": now}})
    if biz.get("business_type") == "restaurant":
        await db.kot_orders.update_one({"order_id": order_id}, {"$set": {"status": "served", "updated_at": now}})
    # update customer stats
    if order.get("customer_id"):
        cust = await db.customers.find_one({"id": order["customer_id"], "business_id": biz["id"]})
        if cust:
            await db.customers.update_one({"id": order["customer_id"]}, {"$set": {
                "total_orders": int(cust.get("total_orders", 0)) + 1,
                "total_spending": round(float(cust.get("total_spending", 0)) + order["total"], 2),
                "last_visit": now, "updated_at": now}})
    return payment

@api.get("/payments")
async def list_payments(biz: dict = Depends(require_business)):
    return await db.payments.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)

# ---------------------------------------------------------------- KOT
@api.get("/kot")
async def list_kot(biz: dict = Depends(require_business)):
    return await db.kot_orders.find({"business_id": biz["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api.put("/kot/{kot_id}")
async def update_kot(kot_id: str, payload: dict, biz: dict = Depends(require_business)):
    now = datetime.now(timezone.utc).isoformat()
    updates = {"updated_at": now}
    if "status" in payload:
        updates["status"] = payload["status"]
    r = await db.kot_orders.update_one({"id": kot_id, "business_id": biz["id"]}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="KOT not found")
    kot = await db.kot_orders.find_one({"id": kot_id}, {"_id": 0})
    # sync order status
    if payload.get("status") in ("accepted", "preparing", "ready", "served"):
        map_status = {"accepted": "preparing", "preparing": "preparing", "ready": "ready", "served": "served"}
        await db.orders.update_one({"id": kot["order_id"]},
                                   {"$set": {"status": map_status[payload["status"]], "updated_at": now}})
    return kot

# ---------------------------------------------------------------- Dashboard & Reports
def _is_today(iso: str) -> bool:
    try:
        d = datetime.fromisoformat(iso)
        return d.date() == datetime.now(timezone.utc).date()
    except Exception:
        return False

@api.get("/dashboard")
async def dashboard(biz: dict = Depends(require_business)):
    bid = biz["id"]
    orders = await db.orders.find({"business_id": bid}, {"_id": 0}).to_list(5000)
    payments = await db.payments.find({"business_id": bid}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find({"business_id": bid}, {"_id": 0}).to_list(5000)
    tables = await db.tables.find({"business_id": bid}, {"_id": 0}).to_list(500)
    customers_count = await db.customers.count_documents({"business_id": bid})
    kots = await db.kot_orders.find({"business_id": bid}, {"_id": 0}).to_list(1000)
    inventory = await db.inventory.find({"business_id": bid}, {"_id": 0}).to_list(1000)

    today_pay = [p for p in payments if _is_today(p.get("created_at", ""))]
    today_orders = [o for o in orders if _is_today(o.get("created_at", ""))]
    today_exp = [e for e in expenses if _is_today(e.get("created_at", ""))]
    today_sales = round(sum(p["amount"] for p in today_pay), 2)
    today_expense_total = round(sum(float(e.get("amount", 0)) for e in today_exp), 2)
    aov = round(today_sales / len(today_pay), 2) if today_pay else 0

    # revenue chart: last 7 days
    series = []
    for i in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        day_total = sum(p["amount"] for p in payments
                        if p.get("created_at") and datetime.fromisoformat(p["created_at"]).date() == day)
        series.append({"date": day.strftime("%d %b"), "revenue": round(day_total, 2)})

    # best selling
    item_counts = {}
    for o in orders:
        for it in o.get("items", []):
            item_counts[it.get("name", "?")] = item_counts.get(it.get("name", "?"), 0) + int(it.get("qty", 1))
    best = sorted(item_counts.items(), key=lambda x: -x[1])[:5]
    best_selling = [{"name": n, "qty": q} for n, q in best]

    low_stock = [i for i in inventory
                 if float(i.get("stock_quantity", 0)) <= float(i.get("low_stock_threshold", 0))]

    table_status = {"available": 0, "occupied": 0, "reserved": 0, "cleaning": 0}
    for t in tables:
        s = t.get("status", "available")
        table_status[s] = table_status.get(s, 0) + 1

    return {
        "business_type": biz.get("business_type"),
        "metrics": {
            "today_sales": today_sales,
            "today_orders": len(today_orders),
            "avg_order_value": aov,
            "customers": customers_count,
            "expenses": today_expense_total,
            "net_sales": round(today_sales - today_expense_total, 2),
            "active_tables": table_status["occupied"],
            "pending_kots": len([k for k in kots if k.get("status") in ("new", "accepted", "preparing")]),
        },
        "revenue_series": series,
        "recent_orders": sorted(orders, key=lambda o: o.get("created_at", ""), reverse=True)[:6],
        "recent_payments": sorted(payments, key=lambda p: p.get("created_at", ""), reverse=True)[:6],
        "best_selling": best_selling,
        "low_stock": low_stock[:6],
        "table_status": table_status,
        "kot_status": {s: len([k for k in kots if k.get("status") == s])
                       for s in ["new", "accepted", "preparing", "ready", "served"]},
        "live_kots": [k for k in kots if k.get("status") in ("new", "accepted", "preparing", "ready")][:6],
    }

@api.get("/reports")
async def reports(range: str = "today", biz: dict = Depends(require_business)):
    bid = biz["id"]
    now = datetime.now(timezone.utc)
    if range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range == "yesterday":
        start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        now = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range == "week":
        start = now - timedelta(days=7)
    elif range == "month":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=3650)

    def in_range(iso):
        try:
            d = datetime.fromisoformat(iso)
            return start <= d <= now if range == "yesterday" else d >= start
        except Exception:
            return False

    if range == "all":
        cq = {"business_id": bid}
    elif range == "yesterday":
        cq = {"business_id": bid, "created_at": {"$gte": start.isoformat(), "$lte": now.isoformat()}}
    else:
        cq = {"business_id": bid, "created_at": {"$gte": start.isoformat()}}
    payments = await db.payments.find(cq, {"_id": 0}).to_list(20000)
    orders = await db.orders.find(cq, {"_id": 0}).to_list(20000)
    expenses = await db.expenses.find(cq, {"_id": 0}).to_list(20000)

    revenue = round(sum(p["amount"] for p in payments), 2)
    expense_total = round(sum(float(e.get("amount", 0)) for e in expenses), 2)
    by_method = {}
    for p in payments:
        by_method[p.get("method", "other")] = round(by_method.get(p.get("method", "other"), 0) + p["amount"], 2)
    cat = {}
    for e in expenses:
        cat[e.get("category", "Other")] = round(cat.get(e.get("category", "Other"), 0) + float(e.get("amount", 0)), 2)
    item_counts = {}
    for o in orders:
        for it in o.get("items", []):
            item_counts[it.get("name", "?")] = item_counts.get(it.get("name", "?"), 0) + int(it.get("qty", 1))
    best = [{"name": n, "qty": q} for n, q in sorted(item_counts.items(), key=lambda x: -x[1])[:8]]
    return {
        "range": range,
        "revenue": revenue, "orders": len(orders), "expenses": expense_total,
        "profit": round(revenue - expense_total, 2),
        "avg_order_value": round(revenue / len(payments), 2) if payments else 0,
        "payment_methods": [{"method": k, "amount": v} for k, v in by_method.items()],
        "expense_categories": [{"category": k, "amount": v} for k, v in cat.items()],
        "best_selling": best,
    }

# ================================================================ QR ORDERING
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")

def sha(x: str) -> str:
    return hashlib.sha256(x.encode()).hexdigest()

# ---------------- Customer auth (separate namespace) ----------------
def create_customer_token(cid: str, email: str) -> str:
    payload = {"sub": cid, "email": email, "type": "customer",
               "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_customer(request: Request) -> dict:
    token = request.cookies.get("customer_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Customer authentication required")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "customer":
            raise HTTPException(status_code=401, detail="Not a customer token")
        cust = await db.customer_accounts.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not cust:
            raise HTTPException(status_code=401, detail="Customer not found")
        return cust
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

class CustomerRegister(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: Optional[str] = None

class CustomerLogin(BaseModel):
    email: EmailStr
    password: str

def set_customer_cookie(response: Response, token: str):
    response.set_cookie("customer_token", token, httponly=True, secure=True, samesite="none", max_age=2592000, path="/")

@api.post("/customer/register")
async def customer_register(body: CustomerRegister, response: Response):
    email = body.email.lower()
    if await db.customer_accounts.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": str(uuid.uuid4()), "name": body.name, "email": email,
           "password_hash": hash_password(body.password), "phone": body.phone or "",
           "created_at": now, "updated_at": now}
    await db.customer_accounts.insert_one(dict(doc))
    token = create_customer_token(doc["id"], email)
    set_customer_cookie(response, token)
    return {"customer": {"id": doc["id"], "name": doc["name"], "email": email, "phone": doc["phone"]}, "token": token}

@api.post("/customer/login")
async def customer_login(body: CustomerLogin, response: Response):
    email = body.email.lower()
    cust = await db.customer_accounts.find_one({"email": email})
    if not cust or not verify_password(body.password, cust["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_customer_token(cust["id"], email)
    set_customer_cookie(response, token)
    return {"customer": {"id": cust["id"], "name": cust["name"], "email": email, "phone": cust.get("phone", "")}, "token": token}

@api.post("/customer/logout")
async def customer_logout(response: Response):
    response.delete_cookie("customer_token", path="/")
    return {"message": "Logged out"}

@api.get("/customer/me")
async def customer_me(cust: dict = Depends(get_current_customer)):
    return cust

@api.get("/customer/orders")
async def customer_orders(cust: dict = Depends(get_current_customer)):
    orders = await db.orders.find({"customer_account_id": cust["id"], "source": "qr"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for o in orders:
        biz = await db.businesses.find_one({"id": o["business_id"]}, {"_id": 0, "business_name": 1})
        o["business_name"] = biz["business_name"] if biz else "—"
    return orders

@api.get("/customer/orders/{order_id}")
async def customer_order_detail(order_id: str, cust: dict = Depends(get_current_customer)):
    o = await db.orders.find_one({"id": order_id, "customer_account_id": cust["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    biz = await db.businesses.find_one({"id": o["business_id"]}, {"_id": 0, "business_name": 1})
    o["business_name"] = biz["business_name"] if biz else "—"
    return o

# ---------------- Merchant: payment settings ----------------
@api.get("/business/payment-settings")
async def get_payment_settings(biz: dict = Depends(require_business)):
    b = await db.businesses.find_one({"id": biz["id"]}, {"_id": 0})
    kid = b.get("razorpay_key_id") or ""
    return {"razorpay_key_id": kid, "razorpay_configured": bool(kid and b.get("razorpay_key_secret")),
            "webhook_configured": bool(b.get("razorpay_webhook_secret")),
            "webhook_url": f"{FRONTEND_URL}/api/qr/webhook/{biz['id']}",
            "payment_mode": b.get("payment_mode", "test")}

@api.patch("/business/payment-settings")
async def set_payment_settings(payload: dict, biz: dict = Depends(require_business)):
    updates = {}
    for k in ("razorpay_key_id", "razorpay_key_secret", "razorpay_webhook_secret"):
        if k in payload and payload[k] is not None:
            updates[k] = str(payload[k]).strip()
    has_keys = bool((updates.get("razorpay_key_id") or biz.get("razorpay_key_id")) and
                    (updates.get("razorpay_key_secret") or biz.get("razorpay_key_secret")))
    updates["payment_mode"] = "razorpay" if has_keys else "test"
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.businesses.update_one({"id": biz["id"]}, {"$set": updates})
    return await get_payment_settings(biz)

def get_rzp_client(biz: dict):
    kid = biz.get("razorpay_key_id")
    ksecret = biz.get("razorpay_key_secret")
    if kid and ksecret:
        return razorpay.Client(auth=(kid, ksecret))
    return None

# ---------------- Merchant: Table QR management ----------------
async def _qr_for_table(business_id: str, table_id: str):
    return await db.table_qr_codes.find_one({"business_id": business_id, "table_id": table_id}, {"_id": 0})

def _public_qr(qr, table):
    if not qr:
        return None
    return {"table_id": qr["table_id"], "table_number": table.get("number") if table else None,
            "status": qr["status"], "token": qr.get("token"),
            "created_at": qr["created_at"], "updated_at": qr["updated_at"],
            "order_url": f"{FRONTEND_URL}/order/{qr.get('token')}"}

@api.get("/tables/{table_id}/qr")
async def get_table_qr(table_id: str, biz: dict = Depends(require_business)):
    table = await db.tables.find_one({"id": table_id, "business_id": biz["id"]}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    qr = await _qr_for_table(biz["id"], table_id)
    return _public_qr(qr, table)

@api.post("/tables/{table_id}/qr/generate")
async def generate_table_qr(table_id: str, biz: dict = Depends(require_business)):
    table = await db.tables.find_one({"id": table_id, "business_id": biz["id"]}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    token = secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc).isoformat()
    existing = await _qr_for_table(biz["id"], table_id)
    if existing:
        await db.table_qr_codes.update_one(
            {"id": existing["id"]},
            {"$set": {"token": token, "token_hash": sha(token), "status": "active", "updated_at": now, "revoked_at": None}})
    else:
        await db.table_qr_codes.insert_one({
            "id": str(uuid.uuid4()), "business_id": biz["id"], "table_id": table_id,
            "token": token, "token_hash": sha(token), "status": "active",
            "created_at": now, "updated_at": now, "revoked_at": None})
    qr = await _qr_for_table(biz["id"], table_id)
    return _public_qr(qr, table)

@api.patch("/tables/{table_id}/qr/status")
async def toggle_table_qr(table_id: str, payload: dict, biz: dict = Depends(require_business)):
    status = payload.get("status")
    if status not in ("active", "disabled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    now = datetime.now(timezone.utc).isoformat()
    r = await db.table_qr_codes.update_one(
        {"business_id": biz["id"], "table_id": table_id},
        {"$set": {"status": status, "updated_at": now}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="QR not found")
    table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    return _public_qr(await _qr_for_table(biz["id"], table_id), table)

@api.get("/tables/{table_id}/qr/image.png")
async def table_qr_image(table_id: str, biz: dict = Depends(require_business)):
    qr = await _qr_for_table(biz["id"], table_id)
    if not qr:
        raise HTTPException(status_code=404, detail="Generate a QR first")
    img = qrcode.make(f"{FRONTEND_URL}/order/{qr['token']}", box_size=12, border=2)
    buf = io.BytesIO(); img.save(buf, format="PNG"); buf.seek(0)
    return StreamingResponse(buf, media_type="image/png",
                             headers={"Content-Disposition": f"inline; filename=avero-table-qr.png"})

# ---------------- Public: resolve token ----------------
async def resolve_token(token: str):
    qr = await db.table_qr_codes.find_one({"token_hash": sha(token)}, {"_id": 0})
    if not qr:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    if qr["status"] != "active":
        raise HTTPException(status_code=403, detail="This table ordering QR is currently unavailable.")
    biz = await db.businesses.find_one({"id": qr["business_id"]}, {"_id": 0})
    table = await db.tables.find_one({"id": qr["table_id"]}, {"_id": 0})
    if not biz or not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    return qr, biz, table

@api.get("/order/resolve/{token}")
async def order_resolve(token: str):
    qr, biz, table = await resolve_token(token)
    return {"business_name": biz["business_name"], "business_type": biz["business_type"],
            "table_number": table["number"], "table_id": table["id"],
            "online_payments": biz.get("payment_mode") == "razorpay"}

@api.get("/order/{token}/menu")
async def order_menu(token: str, cust: dict = Depends(get_current_customer)):
    qr, biz, table = await resolve_token(token)
    cats = await db.menu_categories.find({"business_id": biz["id"]}, {"_id": 0}).to_list(200)
    items = await db.menu_items.find({"business_id": biz["id"]}, {"_id": 0}).to_list(1000)
    return {"business_name": biz["business_name"], "business_type": biz["business_type"],
            "table_number": table["number"], "categories": [c["name"] for c in cats],
            "items": [i for i in items if i.get("available", True) is not False]}

# ---------------- Customer: checkout & payment ----------------
def compute_qr_totals(menu_items_by_id, req_items):
    line = []
    subtotal = 0.0; tax = 0.0
    for ri in req_items:
        mi = menu_items_by_id.get(ri.get("item_id"))
        if not mi:
            raise HTTPException(status_code=400, detail="Invalid menu item in cart")
        qty = max(1, int(ri.get("qty", 1)))
        price = float(mi.get("price", 0))
        tr = float(mi.get("tax_rate", 0) or 0)
        subtotal += price * qty
        tax += price * qty * tr / 100
        line.append({"item_id": mi["id"], "name": mi["name"], "price": price, "qty": qty})
    return line, round(subtotal, 2), round(tax, 2), round(subtotal + tax, 2)

@api.post("/order/{token}/checkout")
async def order_checkout(token: str, payload: dict, cust: dict = Depends(get_current_customer)):
    qr, biz, table = await resolve_token(token)
    req_items = payload.get("items", [])
    if not req_items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    menu = await db.menu_items.find({"business_id": biz["id"]}, {"_id": 0}).to_list(1000)
    mbyid = {m["id"]: m for m in menu}
    items, subtotal, tax, total = compute_qr_totals(mbyid, req_items)
    now = datetime.now(timezone.utc).isoformat()

    # idempotency: reuse an existing awaiting_payment order for this customer+table
    existing = await db.orders.find_one({
        "business_id": biz["id"], "table_id": table["id"], "customer_account_id": cust["id"],
        "source": "qr", "payment_status": {"$in": ["pending", "processing"]}})
    if existing:
        await db.orders.update_one({"id": existing["id"]}, {"$set": {
            "items": items, "subtotal": subtotal, "tax": tax, "total": total, "updated_at": now}})
        order = await db.orders.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        order = {
            "id": str(uuid.uuid4()), "business_id": biz["id"], "source": "qr",
            "order_number": await next_order_number(biz["id"]),
            "order_type": "dine-in", "table_id": table["id"], "table_number": table["number"],
            "customer_account_id": cust["id"], "customer_name": cust["name"], "customer_email": cust["email"],
            "items": items, "discount": 0, "tax_rate": 0, "subtotal": subtotal, "tax": tax, "total": total,
            "status": "awaiting_payment", "payment_status": "pending", "bill_status": "pending",
            "created_at": now, "updated_at": now}
        await db.orders.insert_one(dict(order))
        order.pop("_id", None)

    mode = biz.get("payment_mode", "test")
    rzp = get_rzp_client(biz)
    if mode == "razorpay" and rzp:
        amount_paise = int(round(total * 100))
        rzp_order = rzp.order.create({"amount": amount_paise, "currency": "INR",
                                      "payment_capture": 1, "receipt": order["order_number"][:40],
                                      "notes": {"business_id": biz["id"], "order_id": order["id"]}})
        await db.orders.update_one({"id": order["id"]}, {"$set": {
            "razorpay_order_id": rzp_order["id"], "payment_status": "processing", "updated_at": now}})
        return {"mode": "razorpay", "order_id": order["id"], "order_number": order["order_number"],
                "razorpay_order_id": rzp_order["id"], "key_id": biz.get("razorpay_key_id"),
                "amount": amount_paise, "currency": "INR",
                "customer": {"name": cust["name"], "email": cust["email"], "phone": cust.get("phone", "")},
                "total": total}
    # test mode (Razorpay not configured by merchant)
    return {"mode": "test", "order_id": order["id"], "order_number": order["order_number"],
            "amount": int(round(total * 100)), "total": total}

async def _confirm_paid(order, payment_id, method="upi"):
    now = datetime.now(timezone.utc).isoformat()
    if order.get("payment_status") == "paid":
        return  # idempotent
    biz = await db.businesses.find_one({"id": order["business_id"]}, {"_id": 0})
    await db.orders.update_one({"id": order["id"]}, {"$set": {
        "payment_status": "paid", "status": "confirmed", "bill_status": "paid",
        "payment_method": "upi", "razorpay_payment_id": payment_id, "updated_at": now}})
    # payment record
    await db.payments.insert_one({
        "id": str(uuid.uuid4()), "business_id": order["business_id"], "order_id": order["id"],
        "order_number": order["order_number"], "amount": order["total"], "method": "upi",
        "status": "paid", "source": "qr", "razorpay_payment_id": payment_id,
        "customer_name": order.get("customer_name"), "created_at": now})
    # table occupied
    if order.get("table_id"):
        await db.tables.update_one({"id": order["table_id"]},
                                   {"$set": {"status": "occupied", "updated_at": now}})
    # KOT after verified payment
    if not await db.kot_orders.find_one({"order_id": order["id"]}):
        await db.kot_orders.insert_one({
            "id": str(uuid.uuid4()), "business_id": order["business_id"], "order_id": order["id"],
            "order_number": order["order_number"], "table_number": order.get("table_number"),
            "order_type": order.get("order_type", "dine-in"), "items": order.get("items", []),
            "notes": "QR ORDER", "source": "qr", "status": "new", "created_at": now, "updated_at": now})

@api.post("/order/{token}/verify")
async def order_verify(token: str, payload: dict, cust: dict = Depends(get_current_customer)):
    qr, biz, table = await resolve_token(token)
    order = await db.orders.find_one({"id": payload.get("order_id"), "customer_account_id": cust["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        return {"status": "paid", "order_id": order["id"], "order_number": order["order_number"]}
    rzp = get_rzp_client(biz)
    if biz.get("payment_mode") == "razorpay" and rzp:
        params = {"razorpay_order_id": payload.get("razorpay_order_id"),
                  "razorpay_payment_id": payload.get("razorpay_payment_id"),
                  "razorpay_signature": payload.get("razorpay_signature")}
        if not all(params.values()):
            raise HTTPException(status_code=400, detail="Missing payment parameters")
        try:
            rzp.utility.verify_payment_signature(params)
        except Exception:
            await db.orders.update_one({"id": order["id"]}, {"$set": {"payment_status": "failed"}})
            raise HTTPException(status_code=400, detail="Payment verification failed")
        # verify amount + order match server-side
        if params["razorpay_order_id"] != order.get("razorpay_order_id"):
            raise HTTPException(status_code=400, detail="Order mismatch")
        rzp_order = rzp.order.fetch(params["razorpay_order_id"])
        if int(rzp_order.get("amount", 0)) != int(round(order["total"] * 100)):
            raise HTTPException(status_code=400, detail="Amount mismatch")
        await _confirm_paid(order, params["razorpay_payment_id"])
        return {"status": "paid", "order_id": order["id"], "order_number": order["order_number"]}
    # TEST MODE (no real gateway configured) — MOCK confirmation, server-side only
    await _confirm_paid(order, f"test_{secrets.token_hex(8)}")
    return {"status": "paid", "mode": "test", "order_id": order["id"], "order_number": order["order_number"]}

@api.get("/order/{token}/status")
async def order_status(token: str, order_id: str, cust: dict = Depends(get_current_customer)):
    order = await db.orders.find_one({"id": order_id, "customer_account_id": cust["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"order_number": order["order_number"], "payment_status": order.get("payment_status"),
            "status": order.get("status"), "table_number": order.get("table_number"),
            "items": order.get("items", []), "total": order.get("total")}

# ---------------- Razorpay webhook (merchant-configured) ----------------
@api.post("/qr/webhook/{business_id}")
async def qr_webhook(business_id: str, request: Request):
    biz = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not biz or not biz.get("razorpay_webhook_secret"):
        raise HTTPException(status_code=404, detail="Webhook not configured")
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(biz["razorpay_webhook_secret"].encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")
    import json as _json
    event = _json.loads(body.decode())
    if event.get("event") in ("payment.captured", "order.paid"):
        entity = event.get("payload", {}).get("payment", {}).get("entity", {})
        rzp_order_id = entity.get("order_id")
        payment_id = entity.get("id")
        if rzp_order_id:
            order = await db.orders.find_one({"razorpay_order_id": rzp_order_id, "business_id": business_id}, {"_id": 0})
            if order:
                await _confirm_paid(order, payment_id)
    return {"status": "ok"}

# ---------------- Merchant: QR orders view ----------------
@api.get("/qr-orders")
async def qr_orders(biz: dict = Depends(require_business)):
    return await db.orders.find({"business_id": biz["id"], "source": "qr"}, {"_id": 0}).sort("created_at", -1).to_list(1000)


# ================================================================ BRANDING
class BrandingIn(BaseModel):
    image_base64: str
    content_type: Optional[str] = "image/png"

@api.get("/branding")
async def get_branding():
    b = await db.branding.find_one({"id": "singleton"}, {"_id": 0})
    if not b:
        return {"has_custom_logo": False, "logo_version": 0}
    return {"has_custom_logo": bool(b.get("logo_data")), "logo_version": b.get("logo_version", 0)}

@api.get("/branding/logo")
async def branding_logo():
    b = await db.branding.find_one({"id": "singleton"})
    if not b or not b.get("logo_data"):
        raise HTTPException(status_code=404, detail="No custom logo")
    try:
        data = base64.b64decode(b["logo_data"])
    except Exception:
        raise HTTPException(status_code=404, detail="Invalid logo data")
    return StreamingResponse(io.BytesIO(data), media_type=b.get("logo_content_type", "image/png"),
                             headers={"Cache-Control": "public, max-age=30"})

@api.post("/admin/branding/logo")
async def set_branding(body: BrandingIn, admin: dict = Depends(require_admin)):
    raw = body.image_base64 or ""
    ctype = body.content_type or "image/png"
    if raw.strip().startswith("data:") and "," in raw:
        header, raw = raw.split(",", 1)
        if ";" in header and ":" in header:
            ctype = header.split(":", 1)[1].split(";", 1)[0] or ctype
    raw = raw.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="No image provided")
    if len(raw) > 4_000_000:
        raise HTTPException(status_code=400, detail="Image too large (max ~3MB)")
    try:
        base64.b64decode(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image encoding")
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.branding.find_one({"id": "singleton"})
    ver = (existing.get("logo_version", 0) if existing else 0) + 1
    await db.branding.update_one({"id": "singleton"}, {"$set": {
        "id": "singleton", "logo_data": raw, "logo_content_type": ctype,
        "logo_version": ver, "updated_at": now}}, upsert=True)
    return {"has_custom_logo": True, "logo_version": ver}

@api.delete("/admin/branding/logo")
async def reset_branding(admin: dict = Depends(require_admin)):
    existing = await db.branding.find_one({"id": "singleton"})
    ver = (existing.get("logo_version", 0) if existing else 0) + 1
    await db.branding.update_one({"id": "singleton"},
                                 {"$set": {"logo_data": None, "logo_version": ver}}, upsert=True)
    return {"has_custom_logo": False, "logo_version": ver}

# ---------------------------------------------------------------- Startup
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index("identifier")
    await db.password_reset_requests.create_index("email")
    await db.password_reset_requests.create_index("created_at", expireAfterSeconds=900)
    await db.customer_accounts.create_index("email", unique=True)
    await db.table_qr_codes.create_index("token_hash")
    await db.table_qr_codes.create_index([("business_id", 1), ("table_id", 1)])
    for _c in ("orders", "payments", "expenses"):
        await db[_c].create_index([("business_id", 1), ("created_at", -1)])
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password),
                                   "name": "Avero Admin", "role": "admin", "token_version": 0,
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    await get_pricing_config()
    logger.info("Avero startup complete")

@api.get("/")
async def root():
    return {"message": "Avero API", "launch_active": launch_active_now()}

app.include_router(api)
_cors = os.environ.get("CORS_ORIGINS", "*").strip()
if _cors == "*":
    app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origin_regex=".*",
                       allow_methods=["*"], allow_headers=["*"])
else:
    app.add_middleware(CORSMiddleware, allow_credentials=True,
                       allow_origins=[o.strip() for o in _cors.split(",") if o.strip()],
                       allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown():
    client.close()
