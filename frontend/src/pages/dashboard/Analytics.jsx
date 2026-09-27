import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Loader } from "@/components/PageHeader";
import { StatCard, Card } from "@/components/kit";
import { inr } from "@/lib/format";
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { TrendingUp, ShoppingBag, IndianRupee, Wallet } from "lucide-react";

const COLORS = ["#B8FF00", "#08090C", "#10b981", "#f59e0b", "#8b5cf6", "#3b82f6"];

const Analytics = () => {
  const [dash, setDash] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setDash(r.data)).catch(() => {});
    api.get("/reports?range=all").then((r) => setReport(r.data)).catch(() => {});
  }, []);

  if (!dash || !report) return <Loader />;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Deeper insight into your business performance." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={inr(report.revenue)} icon={IndianRupee} accent />
        <StatCard label="Total Orders" value={report.orders} icon={ShoppingBag} />
        <StatCard label="Avg Order Value" value={inr(report.avg_order_value)} icon={TrendingUp} />
        <StatCard label="Net Sales" value={inr(report.profit)} icon={Wallet} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card title="Revenue Trend" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dash.revenue_series} margin={{ left: -18, right: 8 }}>
                <defs><linearGradient id="a1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#08090C" stopOpacity={0.15} /><stop offset="100%" stopColor="#08090C" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => inr(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#08090C" strokeWidth={2.5} fill="url(#a1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Payment Mix">
          {report.payment_methods.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={report.payment_methods} dataKey="amount" nameKey="method" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {report.payment_methods.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => inr(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Category Performance (Best-sellers)">
          {report.best_selling.length === 0 ? <p className="text-sm text-muted-foreground py-6">No sales data.</p> : (
            <div className="space-y-3">
              {report.best_selling.slice(0, 6).map((b, i) => {
                const max = report.best_selling[0].qty || 1;
                return (
                  <div key={b.name}>
                    <div className="flex justify-between text-sm mb-1"><span>{b.name}</span><span className="font-mono">{b.qty}</span></div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(b.qty / max) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card title="Expenses vs Revenue">
          <div className="flex flex-col gap-4 justify-center h-full py-4">
            <Bar label="Revenue" value={report.revenue} max={Math.max(report.revenue, report.expenses)} color="#B8FF00" />
            <Bar label="Expenses" value={report.expenses} max={Math.max(report.revenue, report.expenses)} color="#08090C" />
            <div className="flex justify-between text-sm pt-3 border-t border-slate-100"><span className="font-semibold">Net Sales</span><span className="font-mono font-bold">{inr(report.profit)}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const Bar = ({ label, value, max, color }) => (
  <div>
    <div className="flex justify-between text-sm mb-1.5"><span>{label}</span><span className="font-mono font-semibold">{inr(value)}</span></div>
    <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }} /></div>
  </div>
);

export default Analytics;
