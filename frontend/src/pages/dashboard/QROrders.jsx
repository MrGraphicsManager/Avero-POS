import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { StatusBadge, SearchBox, StatCard, Card } from "@/components/kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, timeAgo, formatTime } from "@/lib/format";
import { QrCode, IndianRupee, ShoppingBag, Clock } from "lucide-react";

const QROrders = () => {
  const { business } = useAuth();
  const [orders, setOrders] = useState(null);
  const [q, setQ] = useState("");
  const [payFilter, setPayFilter] = useState("all");

  const load = () => api.get("/qr-orders").then((r) => setOrders(r.data)).catch(() => setOrders([]));
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const filtered = useMemo(() => (orders || []).filter((o) =>
    (payFilter === "all" || o.payment_status === payFilter) &&
    (o.order_number.toLowerCase().includes(q.toLowerCase()) || (o.customer_name || "").toLowerCase().includes(q.toLowerCase()) || String(o.table_number || "").includes(q))
  ), [orders, q, payFilter]);

  const paid = (orders || []).filter((o) => o.payment_status === "paid");
  const revenue = paid.reduce((s, o) => s + o.total, 0);

  // group by table
  const byTable = useMemo(() => {
    const m = {};
    filtered.forEach((o) => { const k = o.table_number || "—"; (m[k] = m[k] || []).push(o); });
    return m;
  }, [filtered]);

  return (
    <div>
      <PageHeader title="QR Orders" subtitle="Prepaid orders placed by customers via Table QR." />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="QR Revenue" value={inr(revenue)} icon={IndianRupee} accent />
        <StatCard label="Paid Orders" value={paid.length} icon={ShoppingBag} />
        <StatCard label="Awaiting Payment" value={(orders || []).filter((o) => o.payment_status !== "paid").length} icon={Clock} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <SearchBox value={q} onChange={setQ} placeholder="Search order #, customer or table" className="sm:w-80" />
        <Select value={payFilter} onValueChange={setPayFilter}>
          <SelectTrigger className="sm:w-44" data-testid="qr-pay-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!orders ? <Loader /> : filtered.length === 0 ? (
        <Card><EmptyState icon={QrCode} title="No QR orders yet" description="Generate table QRs and print them. Customer orders will appear here after payment." /></Card>
      ) : (
        <div className="space-y-6" data-testid="qr-orders-list">
          {Object.entries(byTable).map(([table, list]) => (
            <div key={table}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono font-bold text-sm bg-[#08090C] text-white px-2.5 py-1 rounded-md">Table {table}</span>
                <span className="text-xs text-muted-foreground">{list.length} order{list.length > 1 ? "s" : ""}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((o) => (
                  <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-4" data-testid={`qr-order-${o.order_number}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{o.order_number}</span>
                          <span className="text-[9px] font-mono font-bold bg-[#B8FF00] text-[#08090C] px-1.5 py-0.5 rounded">QR</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{o.customer_name} · {timeAgo(o.created_at)}</div>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{o.items?.map((it) => `${it.qty}× ${it.name}`).join(", ")}</div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                      <StatusBadge status={o.payment_status} tone={o.payment_status === "paid" ? "green" : "amber"} />
                      <span className="font-mono font-bold">{inr(o.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QROrders;
