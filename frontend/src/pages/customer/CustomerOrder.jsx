import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import customerApi, { loadRazorpay } from "@/lib/customerApi";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { BrandLogo, LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/PageHeader";
import { inr, formatApiError } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Minus, ShoppingCart, ArrowLeft, Check, Clock, ShieldCheck, X, Utensils, CircleAlert } from "lucide-react";

const CustomerOrder = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { customer, loading: authLoading, login, register, logout } = useCustomerAuth();
  const [resolved, setResolved] = useState(undefined); // undefined=loading, null=error
  const [errorMsg, setErrorMsg] = useState("");
  const [menu, setMenu] = useState(null);
  const [cart, setCart] = useState({});
  const [view, setView] = useState("menu"); // menu | review | confirmed
  const [confirmed, setConfirmed] = useState(null);
  const [paying, setPaying] = useState(false);
  const cartKey = `avero_cart_${token}`;

  useEffect(() => {
    customerApi.get(`/order/resolve/${token}`).then((r) => setResolved(r.data))
      .catch((e) => { setResolved(null); setErrorMsg(formatApiError(e.response?.data?.detail) || "Invalid QR"); });
  }, [token]);

  useEffect(() => { const c = localStorage.getItem(cartKey); if (c) setCart(JSON.parse(c)); }, [cartKey]);
  useEffect(() => { localStorage.setItem(cartKey, JSON.stringify(cart)); }, [cart, cartKey]);

  const loadMenu = useCallback(() => {
    if (!customer || !resolved) return;
    customerApi.get(`/order/${token}/menu`).then((r) => setMenu(r.data)).catch(() => setMenu(null));
  }, [customer, resolved, token]);
  useEffect(() => { loadMenu(); }, [loadMenu]);

  if (resolved === undefined || authLoading) return <div className="min-h-screen bg-[#F5F6F7] flex items-center justify-center"><Loader label="Loading…" /></div>;
  if (resolved === null) return <QrError message={errorMsg} />;

  // AUTH gate
  if (!customer) return <CustomerAuthPanel resolved={resolved} login={login} register={register} />;

  const items = menu?.items || [];
  const categories = ["Popular", ...(menu?.categories || [])];
  const cartLines = Object.values(cart);
  const cartCount = cartLines.reduce((s, x) => s + x.qty, 0);
  const subtotal = cartLines.reduce((s, x) => s + x.price * x.qty, 0);
  const tax = cartLines.reduce((s, x) => s + x.price * x.qty * (x.tax_rate || 0) / 100, 0);
  const total = subtotal + tax;

  const addItem = (it) => setCart((c) => ({ ...c, [it.id]: { item_id: it.id, name: it.name, price: it.price, tax_rate: it.tax_rate || 0, qty: (c[it.id]?.qty || 0) + 1 } }));
  const decItem = (id) => setCart((c) => { const q = (c[id]?.qty || 0) - 1; const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = { ...n[id], qty: q }; return n; });

  const pay = async () => {
    setPaying(true);
    try {
      const { data } = await customerApi.post(`/order/${token}/checkout`, { items: cartLines.map((x) => ({ item_id: x.item_id, qty: x.qty })) });
      if (data.mode === "razorpay") {
        const ok = await loadRazorpay();
        if (!ok) { toast.error("Could not load payment. Check your connection."); setPaying(false); return; }
        const rzp = new window.Razorpay({
          key: data.key_id, amount: data.amount, currency: data.currency, order_id: data.razorpay_order_id,
          name: resolved.business_name, description: `Table ${resolved.table_number} order`,
          prefill: { name: data.customer.name, email: data.customer.email, contact: data.customer.phone },
          theme: { color: "#08090C" },
          handler: async (res) => {
            try {
              const v = await customerApi.post(`/order/${token}/verify`, {
                order_id: data.order_id, razorpay_order_id: res.razorpay_order_id,
                razorpay_payment_id: res.razorpay_payment_id, razorpay_signature: res.razorpay_signature });
              onPaid(v.data);
            } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || "Verification failed"); setPaying(false); }
          },
          modal: { ondismiss: () => { setPaying(false); toast("Payment cancelled"); } },
        });
        rzp.on("payment.failed", () => { toast.error("Payment failed. Please try again."); setPaying(false); });
        rzp.open();
      } else {
        // test mode (merchant has not configured Razorpay yet)
        const v = await customerApi.post(`/order/${token}/verify`, { order_id: data.order_id });
        onPaid(v.data);
      }
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || "Could not start payment"); setPaying(false); }
  };

  const onPaid = (data) => {
    setConfirmed(data);
    setCart({}); localStorage.removeItem(cartKey);
    setView("confirmed"); setPaying(false);
    toast.success("Payment confirmed!");
  };

  return (
    <div className="min-h-screen bg-[#F5F6F7] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#08090C] text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <BrandLogo size={26} dark textClass="text-base" />
          <button onClick={logout} className="text-xs text-slate-300">{customer.name?.split(" ")[0]} · Logout</button>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-300">
          <Utensils className="h-3.5 w-3.5 text-[#B8FF00]" /> {resolved.business_name}
          <span className="ml-auto font-mono px-2 py-0.5 rounded-md bg-[#B8FF00] text-[#08090C] font-bold">Table {resolved.table_number}</span>
        </div>
      </header>

      {view === "confirmed" && confirmed ? (
        <Confirmation token={token} confirmed={confirmed} resolved={resolved} onNew={() => setView("menu")} />
      ) : view === "review" ? (
        <ReviewView resolved={resolved} customer={customer} cartLines={cartLines} subtotal={subtotal} tax={tax} total={total}
          onBack={() => setView("menu")} onPay={pay} paying={paying} online={resolved.online_payments} />
      ) : (
        <>
          <main className="flex-1 px-4 py-4 pb-28">
            {!menu ? <Loader /> : (
              <>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 sticky top-[68px] z-10">
                  {categories.map((c) => <a key={c} href={`#cat-${c}`} className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-slate-200">{c}</a>)}
                </div>
                {items.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm">This business hasn't added menu items yet.</div>
                ) : (
                  <div className="space-y-3">
                    {items.map((it) => (
                      <div key={it.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3" data-testid={`cust-item-${it.id}`}>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{it.name}</div>
                          {it.description && <div className="text-xs text-muted-foreground line-clamp-2">{it.description}</div>}
                          <div className="text-xs text-muted-foreground">{it.category}</div>
                          <div className="font-mono font-semibold mt-1">{inr(it.price)}</div>
                        </div>
                        {cart[it.id] ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => decItem(it.id)} className="h-8 w-8 rounded-lg bg-[#08090C] text-white flex items-center justify-center" data-testid={`cust-dec-${it.id}`}><Minus className="h-4 w-4" /></button>
                            <span className="w-5 text-center font-mono font-semibold">{cart[it.id].qty}</span>
                            <button onClick={() => addItem(it)} className="h-8 w-8 rounded-lg bg-[#08090C] text-white flex items-center justify-center" data-testid={`cust-inc-${it.id}`}><Plus className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <Button size="sm" className="shrink-0 bg-[#B8FF00] text-[#08090C] hover:bg-[#a5e600] font-semibold rounded-lg" onClick={() => addItem(it)} data-testid={`cust-add-${it.id}`}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>

          {cartCount > 0 && (
            <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-[#F5F6F7] via-[#F5F6F7] to-transparent">
              <Button className="w-full h-13 py-4 bg-[#08090C] text-white rounded-xl flex items-center justify-between px-5 shadow-lg" onClick={() => setView("review")} data-testid="cust-view-cart-btn">
                <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> {cartCount} item{cartCount > 1 ? "s" : ""}</span>
                <span className="font-mono font-bold">{inr(total)} · Review</span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ReviewView = ({ resolved, customer, cartLines, subtotal, tax, total, onBack, onPay, paying, online }) => (
  <main className="flex-1 px-4 py-4 pb-28">
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back to menu</button>
    <h2 className="text-xl font-bold tracking-tight mb-3">Review your order</h2>
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
      {cartLines.map((x) => (
        <div key={x.item_id} className="flex justify-between text-sm"><span>{x.qty}× {x.name}</span><span className="font-mono">{inr(x.price * x.qty)}</span></div>
      ))}
      <div className="border-t border-dashed my-2" />
      <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="font-mono">{inr(subtotal)}</span></div>
      <div className="flex justify-between text-sm text-muted-foreground"><span>Tax</span><span className="font-mono">{inr(tax)}</span></div>
      <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="font-mono">{inr(total)}</span></div>
    </div>
    <div className="bg-white rounded-xl border border-slate-200 p-4 mt-3 text-sm">
      <div className="text-xs text-muted-foreground mb-1">Ordering as</div>
      <div className="font-medium">{customer.name}</div>
      <div className="text-muted-foreground">{customer.email}</div>
    </div>
    <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
      <ShieldCheck className="h-4 w-4 text-emerald-600" /> {online ? "Secure UPI payment · verified by Razorpay" : "Test payment (merchant has not enabled live UPI yet)"}
    </div>
    <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-[#F5F6F7] via-[#F5F6F7] to-transparent">
      <Button className="w-full h-13 py-4 bg-[#B8FF00] text-[#08090C] font-semibold rounded-xl shadow-lg" onClick={onPay} disabled={paying} data-testid="cust-pay-btn">
        {paying ? "Processing…" : `Proceed to UPI Payment · ${inr(total)}`}
      </Button>
    </div>
  </main>
);

const STEPS = [["Order placed", true], ["Payment confirmed", true], ["Accepted", "confirmed"], ["Preparing", "preparing"], ["Ready", "ready"], ["Served", "served"]];

const Confirmation = ({ token, confirmed, resolved, onNew }) => {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    const load = () => customerApi.get(`/order/${token}/status?order_id=${confirmed.order_id}`).then((r) => setStatus(r.data)).catch(() => {});
    load(); const t = setInterval(load, 6000); return () => clearInterval(t);
  }, [token, confirmed]);
  const ostatus = status?.status || "confirmed";
  const reached = (key) => {
    if (key === true) return true;
    const order = ["confirmed", "preparing", "ready", "served", "completed"];
    return order.indexOf(ostatus) >= order.indexOf(key);
  };
  return (
    <main className="flex-1 px-4 py-8 flex flex-col items-center">
      <div className="h-16 w-16 rounded-full bg-[#B8FF00] flex items-center justify-center mb-4"><Check className="h-8 w-8 text-[#08090C]" strokeWidth={3} /></div>
      <h2 className="text-2xl font-bold tracking-tight" data-testid="cust-confirmed">Order Confirmed</h2>
      <p className="text-sm text-muted-foreground mt-1">Table {resolved.table_number} · {resolved.business_name}</p>
      <div className="font-mono text-sm mt-1">Order {confirmed.order_number} · <span className="text-emerald-600 font-semibold">UPI Paid</span></div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm mt-6">
        {STEPS.map(([label, key], i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${reached(key) ? "bg-[#B8FF00] text-[#08090C]" : "bg-slate-100 text-slate-400"}`}>
              {reached(key) ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Clock className="h-3 w-3" />}
            </span>
            <span className={`text-sm ${reached(key) ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
          </div>
        ))}
      </div>
      {status && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 w-full max-w-sm mt-3 text-sm">
          {status.items?.map((it, i) => <div key={i} className="flex justify-between py-0.5"><span>{it.qty}× {it.name}</span><span className="font-mono">{inr(it.price * it.qty)}</span></div>)}
          <div className="flex justify-between font-bold mt-1 pt-1 border-t"><span>Total</span><span className="font-mono">{inr(status.total)}</span></div>
        </div>
      )}
      <div className="flex gap-2 mt-6 w-full max-w-sm">
        <Button variant="outline" className="flex-1" onClick={onNew} data-testid="cust-order-more">Order more</Button>
        <Link to="/customer/orders" className="flex-1"><Button className="w-full bg-[#08090C] text-white">My Orders</Button></Link>
      </div>
    </main>
  );
};

const CustomerAuthPanel = ({ resolved, login, register }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register({ name: form.name, email: form.email, password: form.password, phone: form.phone });
    } catch (err) { setError(formatApiError(err.response?.data?.detail) || err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#08090C] text-white flex flex-col">
      <div className="px-5 pt-10 pb-6 text-center">
        <div className="flex justify-center"><LogoMark size={44} /></div>
        <h1 className="text-2xl font-bold tracking-tight mt-4">Welcome to {resolved.business_name}</h1>
        <p className="text-slate-400 text-sm mt-1">Table {resolved.table_number} · Login to view menu & order</p>
      </div>
      <div className="flex-1 bg-white text-[#08090C] rounded-t-3xl px-6 pt-6 pb-10">
        <div className="flex gap-2 mb-6 bg-slate-100 rounded-full p-1">
          <button onClick={() => setMode("login")} className={`flex-1 text-sm py-2 rounded-full font-medium ${mode === "login" ? "bg-white shadow" : "text-slate-500"}`} data-testid="cust-tab-login">Login</button>
          <button onClick={() => setMode("signup")} className={`flex-1 text-sm py-2 rounded-full font-medium ${mode === "signup" ? "bg-white shadow" : "text-slate-500"}`} data-testid="cust-tab-signup">Create Account</button>
        </div>
        <form onSubmit={submit} className="space-y-4" data-testid="cust-auth-form">
          {mode === "signup" && <div><Label>Name</Label><Input className="mt-1.5" required value={form.name} onChange={set("name")} data-testid="cust-name" /></div>}
          <div><Label>Email</Label><Input type="email" className="mt-1.5" required value={form.email} onChange={set("email")} data-testid="cust-email" /></div>
          <div><Label>Password</Label><Input type="password" className="mt-1.5" required minLength={6} value={form.password} onChange={set("password")} data-testid="cust-password" /></div>
          {mode === "signup" && <div><Label>Phone <span className="text-muted-foreground font-normal">(optional)</span></Label><Input className="mt-1.5" value={form.phone} onChange={set("phone")} data-testid="cust-phone" /></div>}
          {error && <p className="text-sm text-destructive" data-testid="cust-auth-error">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full h-11 bg-[#08090C] text-white rounded-lg" data-testid="cust-auth-submit">{busy ? "Please wait…" : (mode === "login" ? "Login & Continue" : "Create Account & Continue")}</Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-4">Your table session is preserved — you won't need to scan again.</p>
      </div>
    </div>
  );
};

const QrError = ({ message }) => (
  <div className="min-h-screen bg-[#F5F6F7] flex flex-col items-center justify-center px-6 text-center">
    <div className="h-14 w-14 rounded-2xl bg-rose-100 flex items-center justify-center mb-4"><CircleAlert className="h-7 w-7 text-rose-600" /></div>
    <h1 className="text-xl font-bold">Ordering unavailable</h1>
    <p className="text-sm text-muted-foreground mt-2 max-w-xs" data-testid="qr-error">{message || "This table ordering QR is currently unavailable."}</p>
    <Link to="/" className="mt-6"><Button variant="outline">Go to Avero</Button></Link>
  </div>
);

export default CustomerOrder;
