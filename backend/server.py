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

import jwt
import bcrypt
import httpx
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

    payments = [p for p in await db.payments.find({"business_id": bid}, {"_id": 0}).to_list(9000) if in_range(p.get("created_at", ""))]
    orders = [o for o in await db.orders.find({"business_id": bid}, {"_id": 0}).to_list(9000) if in_range(o.get("created_at", ""))]
    expenses = [e for e in await db.expenses.find({"business_id": bid}, {"_id": 0}).to_list(9000) if in_range(e.get("created_at", ""))]

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
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
                   allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown():
    client.close()
