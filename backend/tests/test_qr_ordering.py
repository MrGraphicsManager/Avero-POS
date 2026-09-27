"""
Avero backend - QR Ordering module E2E tests.
Covers: customer auth namespace, QR generate/regen/toggle, token resolve, customer menu,
checkout amount recomputation (anti-manipulation), verify test-mode payment + idempotency,
KOT auto-create after payment, /qr-orders visibility, business isolation, multi-customer,
customer/merchant privilege separation, POS regression.
"""
import os, uuid, requests, pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://avero-pos-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _uniq(p="qr"):
    return f"TEST_{p}_{uuid.uuid4().hex[:8]}@example.com"


def _hd(t):
    return {"Authorization": f"Bearer {t}"}


# -------- Merchant helpers --------
def _new_restaurant(name="TEST_QR Rest"):
    email = _uniq("mrest")
    r = requests.post(f"{API}/auth/register", json={"name": "M", "email": email, "password": "Passw0rd!"})
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    ob = requests.post(f"{API}/onboarding", headers=_hd(tok), json={
        "business_name": name, "business_type": "restaurant",
        "referral_source": "google", "manager_name": "Bob",
        "gst_registered": False, "onboarding_completed": True
    })
    assert ob.status_code == 200, ob.text
    return {"email": email, "token": tok, "biz": ob.json()}


def _new_customer(name="TEST Cust"):
    email = _uniq("cust")
    r = requests.post(f"{API}/customer/register",
                      json={"name": name, "email": email, "password": "Passw0rd!"})
    assert r.status_code == 200, r.text
    return {"email": email, "token": r.json()["token"], "id": r.json()["customer"]["id"]}


# -------- Module fixtures --------
@pytest.fixture(scope="module")
def merchantA():
    m = _new_restaurant("TEST_QR RestA")
    h = _hd(m["token"])
    # menu category + items
    requests.post(f"{API}/menu-categories", headers=h, json={"name": "Mains"})
    it1 = requests.post(f"{API}/menu-items", headers=h,
                        json={"name": "Pasta", "price": 200, "category": "Mains",
                              "tax_rate": 5, "available": True}).json()
    it2 = requests.post(f"{API}/menu-items", headers=h,
                        json={"name": "Salad", "price": 100, "category": "Mains",
                              "tax_rate": 5, "available": True}).json()
    unavailable = requests.post(f"{API}/menu-items", headers=h,
                                json={"name": "Soup", "price": 50, "category": "Mains",
                                      "tax_rate": 5, "available": False}).json()
    t1 = requests.post(f"{API}/tables", headers=h,
                       json={"number": "5", "capacity": 4, "status": "available"}).json()
    m.update({"items": [it1, it2], "unavailable": unavailable, "table": t1})
    return m


@pytest.fixture(scope="module")
def merchantB():
    m = _new_restaurant("TEST_QR RestB")
    h = _hd(m["token"])
    requests.post(f"{API}/menu-items", headers=h,
                  json={"name": "BurgerB", "price": 150, "tax_rate": 5, "available": True}).json()
    t = requests.post(f"{API}/tables", headers=h,
                      json={"number": "9", "capacity": 2, "status": "available"}).json()
    m.update({"table": t})
    return m


@pytest.fixture(scope="module")
def qr_tokenA(merchantA):
    h = _hd(merchantA["token"])
    r = requests.post(f"{API}/tables/{merchantA['table']['id']}/qr/generate", headers=h)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def _regen_state(merchantA, qr_tokenA):
    """Ensures regeneration has happened and stores the current active token in merchantA."""
    if merchantA.get("current_token"):
        return merchantA["current_token"]
    # sanity: old token resolvable
    assert requests.get(f"{API}/order/resolve/{qr_tokenA}").status_code == 200
    r = requests.post(f"{API}/tables/{merchantA['table']['id']}/qr/generate",
                      headers=_hd(merchantA["token"]))
    assert r.status_code == 200
    merchantA["current_token"] = r.json()["token"]
    return merchantA["current_token"]


@pytest.fixture(scope="module")
def paid_order(merchantA, customer1, _regen_state):
    """Places, verifies (pays) an order for customer1 and returns the order_id (idempotent)."""
    if customer1.get("order_id"):
        return customer1["order_id"]
    tok = _regen_state
    pasta = merchantA["items"][0]
    salad = merchantA["items"][1]
    r = requests.post(f"{API}/order/{tok}/checkout", headers=_hd(customer1["token"]),
                      json={"items": [{"item_id": pasta["id"], "qty": 2, "price": 1},
                                       {"item_id": salad["id"], "qty": 1, "price": 1}]})
    assert r.status_code == 200, r.text
    oid = r.json()["order_id"]
    rv = requests.post(f"{API}/order/{tok}/verify", headers=_hd(customer1["token"]),
                       json={"order_id": oid})
    assert rv.status_code == 200
    customer1["order_id"] = oid
    return oid


@pytest.fixture(scope="module")
def customer1():
    return _new_customer("TEST Cust1")


@pytest.fixture(scope="module")
def customer2():
    return _new_customer("TEST Cust2")


# ============= 1. Customer auth namespace =============
class TestCustomerAuth:
    def test_register_login_me(self):
        email = _uniq("cauth")
        r = requests.post(f"{API}/customer/register",
                          json={"name": "TEST C", "email": email, "password": "Passw0rd!", "phone": "9999911111"})
        assert r.status_code == 200
        assert "token" in r.json()
        # duplicate
        r2 = requests.post(f"{API}/customer/register",
                           json={"name": "x", "email": email, "password": "Passw0rd!"})
        assert r2.status_code == 400
        # login
        r3 = requests.post(f"{API}/customer/login", json={"email": email, "password": "Passw0rd!"})
        assert r3.status_code == 200
        tok = r3.json()["token"]
        # /me
        r4 = requests.get(f"{API}/customer/me", headers=_hd(tok))
        assert r4.status_code == 200
        assert r4.json()["email"] == email.lower()

    def test_customer_login_invalid(self):
        r = requests.post(f"{API}/customer/login",
                         json={"email": "nonexistent_xyz@example.com", "password": "bad"})
        assert r.status_code == 401

    def test_merchant_token_cannot_access_customer_endpoints(self, merchantA):
        r = requests.get(f"{API}/customer/me", headers=_hd(merchantA["token"]))
        assert r.status_code == 401

    def test_customer_token_cannot_access_merchant_endpoints(self, customer1):
        # merchant endpoints require business context; customer JWT type != user
        r = requests.get(f"{API}/qr-orders", headers=_hd(customer1["token"]))
        assert r.status_code in (401, 403)
        r2 = requests.get(f"{API}/dashboard", headers=_hd(customer1["token"]))
        assert r2.status_code in (401, 403)
        r3 = requests.get(f"{API}/orders", headers=_hd(customer1["token"]))
        assert r3.status_code in (401, 403)


# ============= 2. QR generation / regen / status =============
class TestQRManagement:
    def test_generate_and_get(self, merchantA, qr_tokenA):
        h = _hd(merchantA["token"])
        r = requests.get(f"{API}/tables/{merchantA['table']['id']}/qr", headers=h)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "active"
        assert body["token"] == qr_tokenA
        assert body["table_number"] == "5"

    def test_regenerate_invalidates_old_token(self, merchantA, qr_tokenA, _regen_state):
        # _regen_state ensures regeneration happened (idempotent)
        new_token = _regen_state
        assert new_token != qr_tokenA
        # old should now be invalid
        r_old = requests.get(f"{API}/order/resolve/{qr_tokenA}")
        assert r_old.status_code == 404
        # new works
        r_new = requests.get(f"{API}/order/resolve/{new_token}")
        assert r_new.status_code == 200

    def test_disable_enable(self, merchantA, _regen_state):
        tok = _regen_state
        h = _hd(merchantA["token"])
        # disable
        r = requests.patch(f"{API}/tables/{merchantA['table']['id']}/qr/status",
                          headers=h, json={"status": "disabled"})
        assert r.status_code == 200
        r2 = requests.get(f"{API}/order/resolve/{tok}")
        assert r2.status_code == 403
        assert "unavailable" in r2.json().get("detail", "").lower()
        # re-enable
        r3 = requests.patch(f"{API}/tables/{merchantA['table']['id']}/qr/status",
                           headers=h, json={"status": "active"})
        assert r3.status_code == 200
        r4 = requests.get(f"{API}/order/resolve/{tok}")
        assert r4.status_code == 200

    def test_qr_png(self, merchantA):
        r = requests.get(f"{API}/tables/{merchantA['table']['id']}/qr/image.png",
                        headers=_hd(merchantA["token"]))
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"


# ============= 3. Token resolution + customer menu auth =============
class TestResolveAndMenu:
    def test_resolve_public_no_auth(self, merchantA, _regen_state):
        tok = _regen_state
        r = requests.get(f"{API}/order/resolve/{tok}")
        assert r.status_code == 200
        b = r.json()
        assert b["business_name"] == "TEST_QR RestA"
        assert b["table_number"] == "5"
        assert b["business_type"] == "restaurant"
        assert b["online_payments"] is False  # no razorpay keys

    def test_resolve_invalid_token(self):
        r = requests.get(f"{API}/order/resolve/invalidnonexistenttoken123")
        assert r.status_code == 404

    def test_menu_requires_customer_auth(self, merchantA, _regen_state):
        tok = _regen_state
        r = requests.get(f"{API}/order/{tok}/menu")
        assert r.status_code == 401

    def test_menu_returns_only_available(self, merchantA, customer1, _regen_state):
        tok = _regen_state
        r = requests.get(f"{API}/order/{tok}/menu", headers=_hd(customer1["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["business_name"] == "TEST_QR RestA"
        assert body["table_number"] == "5"
        names = [i["name"] for i in body["items"]]
        assert "Pasta" in names and "Salad" in names
        assert "Soup" not in names  # unavailable filtered


# ============= 4. Checkout + amount anti-manipulation =============
class TestCheckoutAndAmount:
    def test_checkout_ignores_client_price(self, merchantA, customer1, _regen_state):
        tok = _regen_state
        pasta = merchantA["items"][0]  # 200, 5%
        salad = merchantA["items"][1]  # 100, 5%
        # send fake low prices - server must ignore them
        payload = {"items": [
            {"item_id": pasta["id"], "qty": 2, "price": 1},   # fake price
            {"item_id": salad["id"], "qty": 1, "price": 1}
        ]}
        r = requests.post(f"{API}/order/{tok}/checkout", headers=_hd(customer1["token"]),
                          json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mode"] == "test"
        # expected: subtotal 200*2+100=500; tax 5% = 25; total 525
        assert abs(body["total"] - 525.0) < 0.01, f"got {body['total']}"
        assert body["amount"] == 52500  # paise
        customer1["order_id"] = body["order_id"]

    def test_checkout_invalid_item(self, merchantA, customer1, _regen_state):
        tok = _regen_state
        r = requests.post(f"{API}/order/{tok}/checkout", headers=_hd(customer1["token"]),
                          json={"items": [{"item_id": "does-not-exist", "qty": 1}]})
        assert r.status_code == 400

    def test_checkout_empty_cart(self, merchantA, customer1, _regen_state):
        tok = _regen_state
        r = requests.post(f"{API}/order/{tok}/checkout", headers=_hd(customer1["token"]),
                          json={"items": []})
        assert r.status_code == 400

    def test_checkout_requires_customer_auth(self, merchantA, _regen_state):
        tok = _regen_state
        r = requests.post(f"{API}/order/{tok}/checkout", json={"items": []})
        assert r.status_code == 401


# ============= 5. Verify (test mode) + idempotency + KOT =============
class TestVerifyIdempotencyKOT:
    def test_verify_marks_paid_and_creates_kot(self, merchantA, customer1, _regen_state, paid_order):
        tok = _regen_state
        order_id = paid_order
        # re-verify (idempotent, still 200 paid)
        r = requests.post(f"{API}/order/{tok}/verify", headers=_hd(customer1["token"]),
                          json={"order_id": order_id})
        assert r.status_code == 200
        assert r.json()["status"] == "paid"
        # kot list has QR ORDER
        kots = requests.get(f"{API}/kot", headers=_hd(merchantA["token"])).json()
        matching = [k for k in kots if k.get("order_id") == order_id]
        assert len(matching) == 1
        assert matching[0].get("notes") == "QR ORDER"
        assert matching[0].get("source") == "qr"

    def test_verify_idempotent(self, merchantA, customer1, _regen_state, paid_order):
        tok = _regen_state
        order_id = paid_order
        # call twice more
        for _ in range(2):
            r = requests.post(f"{API}/order/{tok}/verify", headers=_hd(customer1["token"]),
                              json={"order_id": order_id})
            assert r.status_code == 200
            assert r.json()["status"] == "paid"
        # Only one KOT, one payment
        kots = requests.get(f"{API}/kot", headers=_hd(merchantA["token"])).json()
        assert len([k for k in kots if k.get("order_id") == order_id]) == 1
        pays = requests.get(f"{API}/payments", headers=_hd(merchantA["token"])).json()
        assert len([p for p in pays if p.get("order_id") == order_id]) == 1
        # Still one order
        qro = requests.get(f"{API}/qr-orders", headers=_hd(merchantA["token"])).json()
        assert len([o for o in qro if o["id"] == order_id]) == 1

    def test_qr_order_visible_in_qr_orders(self, merchantA, paid_order):
        r = requests.get(f"{API}/qr-orders", headers=_hd(merchantA["token"]))
        assert r.status_code == 200
        order_ids = [o["id"] for o in r.json()]
        assert paid_order in order_ids
        o = next(o for o in r.json() if o["id"] == paid_order)
        assert o["payment_status"] == "paid"
        assert o["status"] == "confirmed"
        assert o["source"] == "qr"


# ============= 6. Customer order history + privacy =============
class TestCustomerHistoryPrivacy:
    def test_customer_sees_own_orders(self, customer1, paid_order):
        r = requests.get(f"{API}/customer/orders", headers=_hd(customer1["token"]))
        assert r.status_code == 200
        orders = r.json()
        assert any(o["id"] == customer1["order_id"] for o in orders)
        # business_name populated
        o = next(o for o in orders if o["id"] == customer1["order_id"])
        assert o.get("business_name") == "TEST_QR RestA"

    def test_customer_cannot_see_other_customer_order(self, customer1, customer2, paid_order):
        r = requests.get(f"{API}/customer/orders/{paid_order}",
                        headers=_hd(customer2["token"]))
        assert r.status_code == 404

    def test_customer_detail_ok_for_owner(self, customer1, paid_order):
        r = requests.get(f"{API}/customer/orders/{paid_order}",
                        headers=_hd(customer1["token"]))
        assert r.status_code == 200
        assert r.json()["id"] == paid_order


# ============= 7. Multiple customers same table =============
class TestMultipleCustomersOneTable:
    def test_two_customers_two_orders(self, merchantA, customer2, _regen_state, paid_order):
        tok = _regen_state
        pasta = merchantA["items"][0]
        r = requests.post(f"{API}/order/{tok}/checkout", headers=_hd(customer2["token"]),
                         json={"items": [{"item_id": pasta["id"], "qty": 1}]})
        assert r.status_code == 200
        oid2 = r.json()["order_id"]
        assert abs(r.json()["total"] - 210.0) < 0.01  # 200 + 5% = 210
        rv = requests.post(f"{API}/order/{tok}/verify", headers=_hd(customer2["token"]),
                          json={"order_id": oid2})
        assert rv.status_code == 200
        # merchant sees both
        qro = requests.get(f"{API}/qr-orders", headers=_hd(merchantA["token"])).json()
        table_orders = [o for o in qro if o.get("table_id") == merchantA["table"]["id"]]
        assert len(table_orders) >= 2
        customer2["order_id"] = oid2


# ============= 8. Business isolation =============
class TestBusinessIsolation:
    def test_merchantB_cannot_see_merchantA_qr_orders(self, merchantA, merchantB):
        r = requests.get(f"{API}/qr-orders", headers=_hd(merchantB["token"]))
        assert r.status_code == 200
        for o in r.json():
            assert o["business_id"] != merchantA["biz"]["id"]

    def test_merchantB_cannot_toggle_merchantA_qr(self, merchantA, merchantB):
        r = requests.patch(f"{API}/tables/{merchantA['table']['id']}/qr/status",
                          headers=_hd(merchantB["token"]), json={"status": "disabled"})
        assert r.status_code in (404, 403)

    def test_token_resolves_only_its_business(self, merchantA, merchantB, _regen_state):
        tok = _regen_state
        r = requests.get(f"{API}/order/resolve/{tok}")
        assert r.json()["business_name"] == "TEST_QR RestA"
        # menu is scoped
        cust = _new_customer()
        menu = requests.get(f"{API}/order/{tok}/menu", headers=_hd(cust["token"])).json()
        names = [i["name"] for i in menu["items"]]
        assert "BurgerB" not in names


# ============= 9. POS regression =============
class TestPOSRegression:
    def test_pos_order_not_in_qr_orders(self, merchantA):
        h = _hd(merchantA["token"])
        r = requests.post(f"{API}/orders", headers=h, json={
            "order_type": "takeaway",
            "items": [{"name": "Pasta", "price": 200, "qty": 1}],
            "tax_rate": 5, "discount": 0
        })
        assert r.status_code == 200
        pos_id = r.json()["id"]
        qro = requests.get(f"{API}/qr-orders", headers=h).json()
        assert not any(o["id"] == pos_id for o in qro)


# ============= 10. Payment settings =============
class TestPaymentSettings:
    def test_default_test_mode(self, merchantA):
        r = requests.get(f"{API}/business/payment-settings", headers=_hd(merchantA["token"]))
        assert r.status_code == 200
        b = r.json()
        assert b["payment_mode"] == "test"
        assert b["razorpay_configured"] is False

    def test_set_keys_flips_to_razorpay_mode(self, merchantA):
        r = requests.patch(f"{API}/business/payment-settings", headers=_hd(merchantA["token"]),
                          json={"razorpay_key_id": "rzp_test_dummy", "razorpay_key_secret": "dummy_secret"})
        assert r.status_code == 200
        assert r.json()["payment_mode"] == "razorpay"
        assert r.json()["razorpay_configured"] is True
        # revert so downstream test-mode assumption holds (clear by setting empty)
        requests.patch(f"{API}/business/payment-settings", headers=_hd(merchantA["token"]),
                      json={"razorpay_key_id": "", "razorpay_key_secret": ""})
