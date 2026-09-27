import React, { useState, useMemo } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/useCollection";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { StatusBadge, SearchBox, Card } from "@/components/kit";
import { inr, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Minus, Trash2, ShoppingBag, Receipt, X } from "lucide-react";

const STATUS_FLOW = ["new", "preparing", "ready", "served", "completed", "cancelled"];

const Orders = () => {
  const { business } = useAuth();
  const isResto = business?.business_type === "restaurant";
  const { items: orders, loading, reload, create, update } = useCollection("orders");
  const { items: menu } = useCollection("menu-items");
  const { items: tables } = useCollection("tables");
  const { items: customers } = useCollection("customers");
  const [tab, setTab] = useState("active");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = orders;
    if (tab === "active") list = list.filter((o) => !["completed", "cancelled"].includes(o.status));
    if (tab === "completed") list = list.filter((o) => ["completed", "cancelled"].includes(o.status));
    if (q) list = list.filter((o) => o.order_number.toLowerCase().includes(q.toLowerCase()) || (o.customer_name || "").toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [orders, tab, q]);

  const changeStatus = async (o, status) => {
    await update(o.id, { status });
    toast.success(`Order ${o.order_number} → ${status}`);
  };

  const bill = async (o) => {
    try {
      await api.post(`/orders/${o.id}/bill`, { method: "cash" });
      toast.success("Bill generated successfully.");
      reload();
    } catch { toast.error("Could not generate bill."); }
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle={`Manage ${isResto ? "dine-in, takeaway and delivery" : "cafe"} orders.`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#08090C] text-white rounded-full" data-testid="new-order-btn"><Plus className="h-4 w-4 mr-1.5" /> New Order</Button>
            </DialogTrigger>
            <NewOrderDialog menu={menu} tables={tables} customers={customers} isResto={isResto}
              onCreated={() => { setOpen(false); reload(); }} onCreate={create} />
          </Dialog>
        } />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList data-testid="orders-tabs">
            <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchBox value={q} onChange={setQ} placeholder="Search order # or customer" className="sm:ml-auto sm:w-72" />
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <Card><EmptyState icon={ShoppingBag} title="No orders here" description="Create a new order to get started." /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="orders-grid">
          {filtered.map((o) => (
            <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-4" data-testid={`order-card-${o.order_number}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono font-semibold">{o.order_number}</div>
                  <div className="text-xs text-muted-foreground capitalize">{o.table_number ? `Table ${o.table_number}` : o.order_type} · {timeAgo(o.created_at)}</div>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-3 space-y-1 text-sm max-h-28 overflow-y-auto no-scrollbar">
                {o.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between"><span>{it.qty}× {it.name}</span><span className="font-mono text-muted-foreground">{inr(it.price * it.qty)}</span></div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="font-mono font-bold">{inr(o.total)}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {!["completed", "cancelled"].includes(o.status) && (
                  <>
                    <Select onValueChange={(v) => changeStatus(o, v)}>
                      <SelectTrigger className="h-8 text-xs flex-1" data-testid={`order-status-${o.order_number}`}><SelectValue placeholder="Update status" /></SelectTrigger>
                      <SelectContent>{STATUS_FLOW.filter((s) => s !== "completed").map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 bg-[#B8FF00] text-[#08090C] hover:bg-[#a5e600] text-xs font-semibold" onClick={() => bill(o)} data-testid={`order-bill-${o.order_number}`}>
                      <Receipt className="h-3.5 w-3.5 mr-1" /> Bill
                    </Button>
                  </>
                )}
                {o.bill_status === "paid" && <span className="text-xs text-emerald-600 font-medium">Paid · {o.payment_method}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const NewOrderDialog = ({ menu, tables, customers, isResto, onCreate, onCreated }) => {
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState("dine-in");
  const [tableId, setTableId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(5);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState("all");

  const cats = ["all", ...new Set(menu.map((m) => m.category).filter(Boolean))];
  const shown = catFilter === "all" ? menu : menu.filter((m) => m.category === catFilter);

  const add = (item) => {
    setCart((c) => {
      const ex = c.find((x) => x.item_id === item.id);
      if (ex) return c.map((x) => x.item_id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { item_id: item.id, name: item.name, price: Number(item.price), qty: 1 }];
    });
  };
  const setQty = (id, d) => setCart((c) => c.map((x) => x.item_id === id ? { ...x, qty: Math.max(1, x.qty + d) } : x));
  const rm = (id) => setCart((c) => c.filter((x) => x.item_id !== id));

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = +(taxable * taxRate / 100).toFixed(2);
  const total = +(taxable + tax).toFixed(2);

  const submit = async () => {
    if (cart.length === 0) return toast.error("Add at least one item.");
    setSaving(true);
    try {
      const table = tables.find((t) => t.id === tableId);
      const cust = customers.find((c) => c.id === customerId);
      await onCreate({
        order_type: orderType, table_id: tableId || null, table_number: table?.number || null,
        customer_id: customerId || null, customer_name: cust?.name || null,
        items: cart, discount: Number(discount), tax_rate: Number(taxRate), notes, status: "new",
      });
      toast.success("Order created successfully.");
      onCreated();
    } catch { toast.error("Could not create order."); }
    finally { setSaving(false); }
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="new-order-dialog">
      <DialogHeader><DialogTitle>New Order</DialogTitle></DialogHeader>
      <div className="grid md:grid-cols-2 gap-4 overflow-hidden flex-1 min-h-0">
        {/* menu picker */}
        <div className="flex flex-col min-h-0">
          <div className="flex gap-1.5 flex-wrap mb-2">
            {cats.map((c) => (
              <button key={c} onClick={() => setCatFilter(c)} className={`text-xs px-2.5 py-1 rounded-full border capitalize ${catFilter === c ? "bg-[#08090C] text-white border-[#08090C]" : "border-slate-200"}`}>{c}</button>
            ))}
          </div>
          <div className="overflow-y-auto no-scrollbar grid grid-cols-2 gap-2 pr-1">
            {menu.length === 0 && <p className="text-sm text-muted-foreground col-span-2 py-6 text-center">Add menu items first.</p>}
            {shown.filter((m) => m.available !== false).map((m) => (
              <button key={m.id} onClick={() => add(m)} className="text-left rounded-lg border border-slate-200 p-2.5 hover:border-[#08090C] transition-colors" data-testid={`menu-pick-${m.id}`}>
                <div className="text-sm font-medium truncate">{m.name}</div>
                <div className="text-xs font-mono text-muted-foreground">{inr(m.price)}</div>
              </button>
            ))}
          </div>
        </div>
        {/* cart */}
        <div className="flex flex-col min-h-0 border-l border-slate-100 pl-0 md:pl-4">
          <div className="grid grid-cols-2 gap-2 mb-2">
            {isResto && (
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger className="h-9 text-xs" data-testid="order-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>{["dine-in", "takeaway", "delivery"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger className="h-9 text-xs" data-testid="order-table-select"><SelectValue placeholder="Table" /></SelectTrigger>
              <SelectContent>{tables.map((t) => <SelectItem key={t.id} value={t.id}>Table {t.number}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-9 text-xs" data-testid="order-customer-select"><SelectValue placeholder="Customer" /></SelectTrigger>
              <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 min-h-[80px]">
            {cart.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Tap items to add.</p> : cart.map((x) => (
              <div key={x.item_id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{x.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(x.item_id, -1)} className="h-6 w-6 rounded border flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                  <span className="w-5 text-center font-mono">{x.qty}</span>
                  <button onClick={() => setQty(x.item_id, 1)} className="h-6 w-6 rounded border flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                </div>
                <span className="w-16 text-right font-mono">{inr(x.price * x.qty)}</span>
                <button onClick={() => rm(x.item_id)} className="text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-2 mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{inr(subtotal)}</span></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Discount ₹</span>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-7 w-24 text-right font-mono" data-testid="order-discount" /></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Tax %</span>
              <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="h-7 w-24 text-right font-mono" data-testid="order-tax" /></div>
            <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">{inr(total)}</span></div>
          </div>
        </div>
      </div>
      <DialogFooter className="mt-2">
        <Button onClick={submit} disabled={saving} className="bg-[#08090C] text-white w-full sm:w-auto" data-testid="order-submit-btn">{saving ? "Creating…" : `Create Order · ${inr(total)}`}</Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default Orders;
