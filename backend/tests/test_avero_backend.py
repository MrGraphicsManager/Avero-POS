"""
Avero backend E2E test suite.
Covers: auth, onboarding, pricing/admin, orders/kot/bill, CRUD, inventory, reports,
dashboard, data isolation between businesses.
"""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://avero-pos-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "peanplays.2006@gmail.com"
ADMIN_PASSWORD = "Avero@2026"

VALID_GST = "27ABCDE1234F1Z5"
INVALID_GST = "INVALIDGST123"


def _uniq(prefix="test"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _register(name, email, password="Passw0rd!"):
    r = requests.post(f"{API}/auth/register", json={"name": name, "email": email, "password": password})
    return r


def _login(email, password="Passw0rd!"):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ----------------- Fixtures -----------------
@pytest.fixture(scope="module")
def cafe_owner():
    email = _uniq("cafe")
    r = _register("Cafe Owner", email)
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    # onboard as cafe
    ob = requests.post(f"{API}/onboarding", headers=_auth_headers(token), json={
        "business_name": "Test Cafe", "business_type": "cafe",
        "referral_source": "friend", "manager_name": "Alice",
        "gst_registered": False, "onboarding_completed": True
    })
    assert ob.status_code == 200, ob.text
    return {"email": email, "token": token, "business": ob.json()}


@pytest.fixture(scope="module")
def restaurant_owner():
    email = _uniq("rest")
    r = _register("Rest Owner", email)
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    ob = requests.post(f"{API}/onboarding", headers=_auth_headers(token), json={
        "business_name": "Test Restaurant", "business_type": "restaurant",
        "referral_source": "google", "manager_name": "Bob",
        "gst_registered": True, "gst_number": VALID_GST,
        "fssai_number": "12345678901234", "onboarding_completed": True
    })
    assert ob.status_code == 200, ob.text
    return {"email": email, "token": token, "business": ob.json()}


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ----------------- Auth tests -----------------
class TestAuth:
    def test_register_login_me_logout(self):
        email = _uniq("auth")
        r = _register("Auth User", email)
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["user"]["email"] == email.lower()
        email = email.lower()

        # duplicate registration
        r2 = _register("Auth User", email)
        assert r2.status_code == 400

        # login
        r3 = _login(email)
        assert r3.status_code == 200
        token = r3.json()["access_token"]

        # /me
        r4 = requests.get(f"{API}/auth/me", headers=_auth_headers(token))
        assert r4.status_code == 200
        body = r4.json()
        assert body["user"]["email"] == email
        assert body["business"] is None  # not onboarded

        # logout
        r5 = requests.post(f"{API}/auth/logout", headers=_auth_headers(token))
        assert r5.status_code == 200

    def test_login_invalid(self):
        r = _login("nosuchuser_xyz@example.com", "wrong")
        assert r.status_code in (401, 429)

    def test_forgot_password_identical_response(self):
        # registered vs unregistered should return identical body
        email = _uniq("forgot")
        _register("Forgot User", email)
        r1 = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        r2 = requests.post(f"{API}/auth/forgot-password", json={"email": "definitely_not_registered_xyz@example.com"})
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json()

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "invalid_token_xyz", "password": "NewPass123!"})
        assert r.status_code == 400


# ----------------- Onboarding -----------------
class TestOnboarding:
    def test_invalid_gst_rejected(self):
        email = _uniq("gst")
        r = _register("GST User", email)
        token = r.json()["access_token"]
        r2 = requests.post(f"{API}/onboarding", headers=_auth_headers(token), json={
            "business_name": "Bad GST", "business_type": "cafe",
            "gst_registered": True, "gst_number": INVALID_GST,
            "onboarding_completed": True
        })
        assert r2.status_code == 400

    def test_onboarding_persists(self, cafe_owner):
        r = requests.get(f"{API}/auth/me", headers=_auth_headers(cafe_owner["token"]))
        assert r.status_code == 200
        biz = r.json()["business"]
        assert biz is not None
        assert biz["onboarding_completed"] is True
        assert biz["business_type"] == "cafe"


# ----------------- Pricing / Admin -----------------
class TestPricingAdmin:
    def test_public_pricing(self):
        r = requests.get(f"{API}/pricing")
        assert r.status_code == 200
        body = r.json()
        assert "config" in body and "launch_active" in body
        assert body["launch_active"] is True

    def test_admin_pricing_and_stats(self, admin_token):
        r = requests.get(f"{API}/admin/pricing", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        r2 = requests.patch(f"{API}/admin/pricing", headers=_auth_headers(admin_token),
                            json={"announcement": "TEST_updated announcement"})
        assert r2.status_code == 200
        assert r2.json()["announcement"] == "TEST_updated announcement"
        r3 = requests.get(f"{API}/admin/stats", headers=_auth_headers(admin_token))
        assert r3.status_code == 200
        assert "total_businesses" in r3.json()
        assert "referrals" in r3.json()

    def test_non_admin_forbidden(self, cafe_owner):
        r = requests.get(f"{API}/admin/pricing", headers=_auth_headers(cafe_owner["token"]))
        assert r.status_code == 403
        r2 = requests.get(f"{API}/admin/stats", headers=_auth_headers(cafe_owner["token"]))
        assert r2.status_code == 403


# ----------------- Orders / KOT / Bill -----------------
class TestOrdersFlowRestaurant:
    def test_full_order_billing_flow(self, restaurant_owner):
        h = _auth_headers(restaurant_owner["token"])
        # menu category
        r = requests.post(f"{API}/menu-categories", headers=h, json={"name": "Mains"})
        assert r.status_code == 200
        # menu item
        r = requests.post(f"{API}/menu-items", headers=h, json={"name": "Pasta", "price": 200, "category": "Mains"})
        assert r.status_code == 200
        item = r.json()
        # table
        r = requests.post(f"{API}/tables", headers=h, json={"table_number": "T1", "capacity": 4, "status": "available"})
        assert r.status_code == 200
        table = r.json()
        # customer
        r = requests.post(f"{API}/customers", headers=h, json={"name": "TEST_Cust", "phone": "9999900000"})
        cust = r.json()
        # order
        payload = {
            "order_type": "dine-in", "table_id": table["id"], "table_number": table["table_number"],
            "customer_id": cust["id"], "customer_name": cust["name"],
            "items": [{"name": item["name"], "price": item["price"], "qty": 2}],
            "discount": 50, "tax_rate": 5
        }
        r = requests.post(f"{API}/orders", headers=h, json=payload)
        assert r.status_code == 200
        order = r.json()
        # subtotal = 400, taxable=350, tax=17.5, total=367.5
        assert order["subtotal"] == 400
        assert order["tax"] == 17.5
        assert order["total"] == 367.5
        assert order["order_number"].startswith("ORD-")

        # table now occupied
        tables = requests.get(f"{API}/tables", headers=h).json()
        this_table = [t for t in tables if t["id"] == table["id"]][0]
        assert this_table["status"] == "occupied"

        # KOT auto-created for restaurant
        kots = requests.get(f"{API}/kot", headers=h).json()
        kot = next((k for k in kots if k["order_id"] == order["id"]), None)
        assert kot is not None
        assert kot["status"] == "new"

        # advance KOT
        for status in ["accepted", "preparing", "ready", "served"]:
            r = requests.put(f"{API}/kot/{kot['id']}", headers=h, json={"status": status})
            assert r.status_code == 200
            assert r.json()["status"] == status

        # verify order status synced (should be served or completed after bill)
        # bill
        r = requests.post(f"{API}/orders/{order['id']}/bill", headers=h, json={"method": "card"})
        assert r.status_code == 200
        pay = r.json()
        assert pay["amount"] == order["total"]
        assert pay["method"] == "card"

        # order now completed
        got = requests.get(f"{API}/orders", headers=h).json()
        this_order = [o for o in got if o["id"] == order["id"]][0]
        assert this_order["status"] == "completed"
        assert this_order["bill_status"] == "paid"

        # table cleaning
        tables2 = requests.get(f"{API}/tables", headers=h).json()
        this_table2 = [t for t in tables2 if t["id"] == table["id"]][0]
        assert this_table2["status"] == "cleaning"

        # payments list
        pays = requests.get(f"{API}/payments", headers=h).json()
        assert any(p["id"] == pay["id"] for p in pays)

        # customer stats updated
        custs = requests.get(f"{API}/customers", headers=h).json()
        c = [c for c in custs if c["id"] == cust["id"]][0]
        assert c["total_orders"] == 1
        assert abs(c["total_spending"] - order["total"]) < 0.01


class TestOrdersFlowCafe:
    def test_cafe_no_kot(self, cafe_owner):
        h = _auth_headers(cafe_owner["token"])
        r = requests.post(f"{API}/menu-items", headers=h, json={"name": "Coffee", "price": 100})
        item = r.json()
        r = requests.post(f"{API}/orders", headers=h, json={
            "order_type": "takeaway",
            "items": [{"name": item["name"], "price": 100, "qty": 1}],
            "tax_rate": 5, "discount": 0
        })
        assert r.status_code == 200
        order = r.json()
        assert order["total"] == 105
        kots = requests.get(f"{API}/kot", headers=h).json()
        assert not any(k.get("order_id") == order["id"] for k in kots)


# ----------------- Inventory adjust -----------------
class TestInventory:
    def test_inventory_adjust(self, cafe_owner):
        h = _auth_headers(cafe_owner["token"])
        r = requests.post(f"{API}/inventory", headers=h, json={
            "name": "TEST_Beans", "stock_quantity": 10, "unit": "kg", "low_stock_threshold": 2
        })
        item = r.json()
        r = requests.post(f"{API}/inventory/{item['id']}/adjust", headers=h,
                          json={"delta": -3, "type": "consume", "note": "Test consume"})
        assert r.status_code == 200
        assert r.json()["stock_quantity"] == 7
        txs = requests.get(f"{API}/inventory-transactions", headers=h).json()
        assert any(t["inventory_id"] == item["id"] for t in txs)


# ----------------- Reports / Dashboard -----------------
class TestReportsDashboard:
    def test_dashboard(self, restaurant_owner):
        r = requests.get(f"{API}/dashboard", headers=_auth_headers(restaurant_owner["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["business_type"] == "restaurant"
        assert "metrics" in body and "revenue_series" in body
        assert len(body["revenue_series"]) == 7
        assert "table_status" in body and "kot_status" in body

    def test_reports_ranges(self, restaurant_owner):
        for rng in ["today", "week", "month", "all"]:
            r = requests.get(f"{API}/reports?range={rng}", headers=_auth_headers(restaurant_owner["token"]))
            assert r.status_code == 200
            body = r.json()
            assert body["range"] == rng
            assert set(["revenue", "orders", "expenses", "profit",
                        "payment_methods", "expense_categories", "best_selling"]).issubset(body.keys())


# ----------------- CRUD sanity for staff/expenses -----------------
class TestCRUD:
    def test_staff_expenses(self, cafe_owner):
        h = _auth_headers(cafe_owner["token"])
        r = requests.post(f"{API}/staff", headers=h, json={"name": "TEST_Staff", "role": "waiter"})
        assert r.status_code == 200
        s = r.json()
        r = requests.put(f"{API}/staff/{s['id']}", headers=h, json={"role": "manager"})
        assert r.status_code == 200
        assert r.json()["role"] == "manager"
        r = requests.delete(f"{API}/staff/{s['id']}", headers=h)
        assert r.status_code == 200
        # expenses
        r = requests.post(f"{API}/expenses", headers=h, json={"category": "Utilities", "amount": 500, "note": "TEST"})
        assert r.status_code == 200
        e = r.json()
        r = requests.delete(f"{API}/expenses/{e['id']}", headers=h)
        assert r.status_code == 200


# ----------------- DATA ISOLATION (critical) -----------------
class TestDataIsolation:
    def test_business_cannot_see_others(self, cafe_owner, restaurant_owner):
        hc = _auth_headers(cafe_owner["token"])
        hr = _auth_headers(restaurant_owner["token"])

        # create resource in restaurant
        r = requests.post(f"{API}/customers", headers=hr, json={"name": "TEST_RestCust", "phone": "8888800000"})
        assert r.status_code == 200
        rc = r.json()

        # cafe should NOT see it in list
        cafe_custs = requests.get(f"{API}/customers", headers=hc).json()
        assert not any(c["id"] == rc["id"] for c in cafe_custs), "ISOLATION BREACH: cafe sees restaurant customer"

        # cafe cannot update/delete restaurant's customer
        r2 = requests.put(f"{API}/customers/{rc['id']}", headers=hc, json={"name": "hacked"})
        assert r2.status_code == 404
        r3 = requests.delete(f"{API}/customers/{rc['id']}", headers=hc)
        assert r3.status_code == 404

        # menu items isolation
        r = requests.post(f"{API}/menu-items", headers=hr, json={"name": "TEST_RestItem", "price": 100})
        ri = r.json()
        cafe_items = requests.get(f"{API}/menu-items", headers=hc).json()
        assert not any(i["id"] == ri["id"] for i in cafe_items)
        assert requests.put(f"{API}/menu-items/{ri['id']}", headers=hc, json={"price": 999}).status_code == 404
        assert requests.delete(f"{API}/menu-items/{ri['id']}", headers=hc).status_code == 404

        # tables isolation
        r = requests.post(f"{API}/tables", headers=hr, json={"table_number": "RT99", "capacity": 2})
        rt = r.json()
        cafe_tables = requests.get(f"{API}/tables", headers=hc).json()
        assert not any(t["id"] == rt["id"] for t in cafe_tables)
        assert requests.put(f"{API}/tables/{rt['id']}", headers=hc, json={"capacity": 8}).status_code == 404
        assert requests.delete(f"{API}/tables/{rt['id']}", headers=hc).status_code == 404

        # inventory isolation
        r = requests.post(f"{API}/inventory", headers=hr, json={"name": "TEST_RestInv", "stock_quantity": 5})
        ri2 = r.json()
        cafe_inv = requests.get(f"{API}/inventory", headers=hc).json()
        assert not any(i["id"] == ri2["id"] for i in cafe_inv)
        assert requests.post(f"{API}/inventory/{ri2['id']}/adjust", headers=hc, json={"delta": -1}).status_code == 404

        # orders isolation - restaurant orders should not be visible to cafe
        rest_orders = requests.get(f"{API}/orders", headers=hr).json()
        if rest_orders:
            cafe_orders_view = requests.get(f"{API}/orders", headers=hc).json()
            rest_order_ids = {o["id"] for o in rest_orders}
            cafe_order_ids = {o["id"] for o in cafe_orders_view}
            assert rest_order_ids.isdisjoint(cafe_order_ids), "ISOLATION BREACH: order overlap"
            # cross id PUT/DELETE
            some_rest_order = rest_orders[0]["id"]
            assert requests.put(f"{API}/orders/{some_rest_order}", headers=hc, json={"status": "cancelled"}).status_code == 404
            assert requests.delete(f"{API}/orders/{some_rest_order}", headers=hc).status_code == 404

        # kot isolation - cafe fetch should be empty of restaurant kots
        rest_kots = requests.get(f"{API}/kot", headers=hr).json()
        cafe_kots = requests.get(f"{API}/kot", headers=hc).json()
        rest_kot_ids = {k["id"] for k in rest_kots}
        cafe_kot_ids = {k["id"] for k in cafe_kots}
        assert rest_kot_ids.isdisjoint(cafe_kot_ids)
        if rest_kots:
            assert requests.put(f"{API}/kot/{rest_kots[0]['id']}", headers=hc,
                                json={"status": "accepted"}).status_code == 404

        # payments isolation
        rest_pays = requests.get(f"{API}/payments", headers=hr).json()
        cafe_pays = requests.get(f"{API}/payments", headers=hc).json()
        assert {p["id"] for p in rest_pays}.isdisjoint({p["id"] for p in cafe_pays})

        # expenses & staff
        r = requests.post(f"{API}/expenses", headers=hr, json={"category": "TEST_iso", "amount": 10})
        re_ = r.json()
        assert requests.delete(f"{API}/expenses/{re_['id']}", headers=hc).status_code == 404
