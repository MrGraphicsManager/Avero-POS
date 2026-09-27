import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatCard, StatusBadge, Card } from "@/components/kit";
import { Loader, EmptyState } from "@/components/PageHeader";
import { DashboardTour } from "@/components/DashboardTour";
import { inr, timeAgo } from "@/lib/format";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import {
  TrendingUp, ShoppingBag, Wallet, Users, Table2, ChefHat, Receipt, Package, IndianRupee, BarChartIcon,
} from "lucide-react";

const Overview = () => {
  const { user, business } = useAuth();
  const [data, setData] = useState(null);
  const [params, setParams] = useSearchParams();
  const [showTour, setShowTour] = useState(false);
  const isResto = business?.business_type === "restaurant";

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  useEffect(() => {
    if (params.get("tour") === "1" && !business?.dashboard_tour_completed) setShowTour(true);
  }, [params, business]);

  const closeTour = () => { setShowTour(false); params.delete("tour"); setParams(params, { replace: true }); };

  if (!data) return <Loader label="Loading your dashboard…" />;
  const m = data.metrics;

  const cafeMetrics = [
    { label: "Today's Sales", value: inr(m.today_sales), icon: TrendingUp, accent: true },
    { label: "Today's Orders", value: m.today_orders, icon: ShoppingBag },
    { label: "Avg Order Value", value: inr(m.avg_order_value), icon: IndianRupee },
    { label: "Customers", value: m.customers, icon: Users },
    { label: "Expenses", value: inr(m.expenses), icon: Wallet },
    { label: "Net Sales", value: inr(m.net_sales), icon: TrendingUp },
  ];
  const restoMetrics = [
    { label: "Today's Revenue", value: inr(m.today_sales), icon: TrendingUp, accent: true },
    { label: "Orders", value: m.today_orders, icon: ShoppingBag },
    { label: "Average Bill", value: inr(m.avg_order_value), icon: IndianRupee },
    { label: "Active Tables", value: m.active_tables, icon: Table2 },
    { label: "Pending KOTs", value: m.pending_kots, icon: ChefHat },
    { label: "Net Sales", value: inr(m.net_sales), icon: Wallet },
  ];
  const metrics = isResto ? restoMetrics : cafeMetrics;

  return (
    <div>
      {showTour && <DashboardTour onClose={closeTour} />}

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isResto ? "Restaurant" : "Cafe"} Overview
          </h1>
          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md ${isResto ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{business?.business_name}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Here's how {business?.business_name || "your business"} is doing today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        {metrics.map((mt) => <StatCard key={mt.label} {...mt} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <Card title="Revenue · last 7 days" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenue_series} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B8FF00" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#B8FF00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => inr(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#08090C" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {isResto ? (
          <Card title="KOT Status">
            <div className="space-y-3">
              {Object.entries(data.kot_status).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <StatusBadge status={k} />
                  <span className="font-mono font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card title="Table Status">
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(data.table_status).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-200 p-3">
                  <div className="text-2xl font-bold font-mono">{v}</div>
                  <StatusBadge status={k} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <Card title={isResto ? "Live Orders" : "Today's Orders"} className="lg:col-span-2">
          {data.recent_orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" description="Orders will show up here as they come in." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recent_orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-mono text-sm font-medium">{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">{o.table_number ? `Table ${o.table_number}` : o.order_type} · {timeAgo(o.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-sm">{inr(o.total)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4 sm:space-y-6">
          <Card title="Best-selling Items">
            {data.best_selling.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No sales data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {data.best_selling.map((b, i) => (
                  <div key={b.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground w-4">{i + 1}</span>{b.name}</span>
                    <span className="font-mono font-semibold">{b.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title={isResto ? "Low Stock Ingredients" : "Low Stock"}>
            {data.low_stock.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">All stock levels are healthy. ✅</p>
            ) : (
              <div className="space-y-2.5">
                {data.low_stock.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><Package className="h-4 w-4 text-amber-500" />{s.name}</span>
                    <span className="font-mono text-rose-600 font-semibold">{s.stock_quantity} {s.unit || ""}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Overview;
