import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import customerApi from "@/lib/customerApi";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { BrandLogo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/kit";
import { Loader, EmptyState } from "@/components/PageHeader";
import { inr, formatDate, formatTime } from "@/lib/format";
import { ShoppingBag, ArrowLeft } from "lucide-react";

const MyOrders = () => {
  const { customer, loading, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    if (customer === false) { navigate("/"); return; }
    if (customer) customerApi.get("/customer/orders").then((r) => setOrders(r.data)).catch(() => setOrders([]));
  }, [customer, navigate]);

  if (loading || customer === null) return <div className="min-h-screen flex items-center justify-center"><Loader /></div>;

  return (
    <div className="min-h-screen bg-[#F5F6F7]">
      <header className="bg-[#08090C] text-white px-4 py-3 flex items-center justify-between">
        <BrandLogo size={26} dark textClass="text-base" />
        <button onClick={() => { logout(); navigate("/"); }} className="text-xs text-slate-300">Logout</button>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">My Orders</h1>
        <p className="text-sm text-muted-foreground mb-5">Hi {customer?.name}, here are your past orders.</p>
        {!orders ? <Loader /> : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200"><EmptyState icon={ShoppingBag} title="No orders yet" description="Scan a table QR to place your first order." /></div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4" data-testid={`myorder-${o.order_number}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{o.business_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{o.order_number} · Table {o.table_number}</div>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-2 text-sm text-muted-foreground">{o.items?.map((it) => `${it.qty}× ${it.name}`).join(", ")}</div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-muted-foreground">{formatDate(o.created_at)} · {formatTime(o.created_at)}</span>
                  <span className="flex items-center gap-2"><StatusBadge status={o.payment_status} tone={o.payment_status === "paid" ? "green" : "amber"} /><span className="font-mono font-bold">{inr(o.total)}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyOrders;
