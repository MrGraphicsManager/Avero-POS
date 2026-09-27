import React from "react";
import { inr } from "@/lib/format";
import { TrendingUp, ShoppingBag, Users, Wallet } from "lucide-react";

// A realistic Avero product preview (not a stock template).
export const DashboardPreview = () => {
  const bars = [42, 65, 38, 80, 55, 92, 70];
  const metrics = [
    { label: "Today's Sales", value: inr(48250), icon: TrendingUp, accent: true },
    { label: "Orders", value: "126", icon: ShoppingBag },
    { label: "Customers", value: "98", icon: Users },
    { label: "Net Sales", value: inr(41100), icon: Wallet },
  ];
  const orders = [
    { id: "ORD-0182", t: "T-04", amt: 640, st: "Preparing" },
    { id: "ORD-0181", t: "T-11", amt: 1280, st: "Served" },
    { id: "ORD-0180", t: "Takeaway", amt: 320, st: "Completed" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-20px_rgba(8,9,12,0.35)] overflow-hidden select-none">
      <div className="flex">
        {/* mini sidebar */}
        <div className="hidden sm:flex flex-col gap-1 w-40 bg-[#08090C] p-3">
          <div className="flex items-center gap-2 px-1 pb-3">
            <span className="h-6 w-6 rounded-md bg-[#B8FF00]" />
            <span className="text-white font-bold text-sm tracking-tight">Avero</span>
          </div>
          {["Overview", "Orders", "Tables", "Billing", "Menu", "Inventory"].map((x, i) => (
            <div key={x} className={`text-xs px-2.5 py-2 rounded-md ${i === 0 ? "bg-[#B8FF00] text-[#08090C] font-semibold" : "text-slate-400"}`}>{x}</div>
          ))}
        </div>
        <div className="flex-1 p-4 sm:p-5 bg-[#F5F6F7]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] text-slate-500">Good morning, Aarav</div>
              <div className="text-sm font-bold tracking-tight">Cafe Overview</div>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#B8FF00] text-[#08090C] font-bold">LIVE</div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
            {metrics.map((m) => (
              <div key={m.label} className={`rounded-xl p-3 border ${m.accent ? "bg-[#08090C] border-[#08090C] text-white" : "bg-white border-slate-200"}`}>
                <m.icon className={`h-3.5 w-3.5 mb-2 ${m.accent ? "text-[#B8FF00]" : "text-slate-400"}`} />
                <div className={`text-sm font-bold font-mono ${m.accent ? "text-white" : "text-slate-900"}`}>{m.value}</div>
                <div className={`text-[10px] ${m.accent ? "text-slate-400" : "text-slate-500"}`}>{m.label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-semibold mb-3">Revenue · last 7 days</div>
              <div className="flex items-end gap-2 h-20">
                {bars.map((b, i) => (
                  <div key={i} className="flex-1 rounded-t bg-[#B8FF00]" style={{ height: `${b}%`, opacity: 0.55 + i * 0.06 }} />
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-semibold mb-2">Today's Orders</div>
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-slate-600">{o.id}</span>
                    <span className="font-mono font-semibold">{inr(o.amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPreview;
