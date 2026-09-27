import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, Loader } from "@/components/PageHeader";
import { StatCard, Card } from "@/components/kit";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";
import { IndianRupee, ShoppingBag, Wallet, TrendingUp } from "lucide-react";

const RANGES = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "This Week"], ["month", "This Month"], ["all", "All Time"]];

const Reports = () => {
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/reports?range=${range}`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [range]);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, expenses and profit at a glance." />
      <Tabs value={range} onValueChange={setRange} className="mb-6">
        <TabsList className="flex-wrap h-auto" data-testid="reports-range-tabs">
          {RANGES.map(([v, l]) => <TabsTrigger key={v} value={v} data-testid={`range-${v}`}>{l}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {!data ? <Loader /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Revenue" value={inr(data.revenue)} icon={IndianRupee} accent />
            <StatCard label="Orders" value={data.orders} icon={ShoppingBag} />
            <StatCard label="Expenses" value={inr(data.expenses)} icon={Wallet} />
            <StatCard label="Net Profit" value={inr(data.profit)} icon={TrendingUp} hint={`AOV ${inr(data.avg_order_value)}`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Payment Methods">
              {data.payment_methods.length === 0 ? <p className="text-sm text-muted-foreground py-6">No payments in this period.</p> : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.payment_methods} margin={{ left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
                      <XAxis dataKey="method" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="capitalize" />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => inr(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#B8FF00" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card title="Expenses by Category">
              {data.expense_categories.length === 0 ? <p className="text-sm text-muted-foreground py-6">No expenses in this period.</p> : (
                <div className="space-y-3">
                  {data.expense_categories.map((c) => {
                    const max = Math.max(...data.expense_categories.map((x) => x.amount));
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between text-sm mb-1"><span>{c.category}</span><span className="font-mono">{inr(c.amount)}</span></div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#08090C]" style={{ width: `${(c.amount / max) * 100}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <Card title="Best-selling Items" className="mt-6">
            {data.best_selling.length === 0 ? <p className="text-sm text-muted-foreground py-6">No sales data.</p> : (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                {data.best_selling.map((b, i) => (
                  <div key={b.name} className="flex justify-between text-sm py-1 border-b border-slate-50">
                    <span><span className="font-mono text-muted-foreground mr-2">{i + 1}.</span>{b.name}</span><span className="font-mono font-semibold">{b.qty} sold</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
