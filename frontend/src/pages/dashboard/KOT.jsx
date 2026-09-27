import React, { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChefHat, Clock } from "lucide-react";
import { timeAgo } from "@/lib/format";

const FLOW = { new: "accepted", accepted: "preparing", preparing: "ready", ready: "served" };
const LABEL = { new: "Accept", accepted: "Start Preparing", preparing: "Mark Ready", ready: "Mark Served" };
const COLS = [
  { key: "new", title: "New", style: "border-amber-300 bg-amber-50/60" },
  { key: "accepted", title: "Accepted", style: "border-blue-300 bg-blue-50/60" },
  { key: "preparing", title: "Preparing", style: "border-blue-400 bg-blue-50/60" },
  { key: "ready", title: "Ready", style: "border-emerald-300 bg-emerald-50/60" },
];

const KOT = () => {
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/kot"); setKots(data); } catch { /* noop */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const advance = async (k) => {
    const next = FLOW[k.status];
    if (!next) return;
    await api.put(`/kot/${k.id}`, { status: next });
    toast.success(`KOT ${k.order_number} → ${next}`);
    load();
  };
  const cancel = async (k) => { await api.put(`/kot/${k.id}`, { status: "cancelled" }); toast("KOT cancelled"); load(); };

  const active = kots.filter((k) => !["served", "cancelled"].includes(k.status));

  return (
    <div>
      <PageHeader title="Kitchen Order Tickets" subtitle="Live kitchen board. Auto-refreshes every few seconds." />
      {loading ? <Loader /> : active.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl"><EmptyState icon={ChefHat} title="No active tickets" description="New restaurant orders will appear here as KOTs." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kot-board">
          {COLS.map((col) => {
            const list = active.filter((k) => k.status === col.key);
            return (
              <div key={col.key} className="min-w-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="font-semibold text-sm">{col.title}</span>
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded-full">{list.length}</span>
                </div>
                <div className="space-y-3">
                  {list.map((k) => (
                    <div key={k.id} className={`rounded-xl border-2 p-3.5 bg-white ${col.style}`} data-testid={`kot-card-${k.order_number}`}>
                      <div className="flex items-center justify-between font-mono font-bold border-b border-slate-200 pb-2">
                        <span>{k.order_number}</span>
                        <span className="text-xs flex items-center gap-1 font-sans text-muted-foreground"><Clock className="h-3 w-3" />{timeAgo(k.created_at)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 capitalize">{k.table_number ? `Table ${k.table_number}` : k.order_type}</div>
                      <div className="mt-2 space-y-1">
                        {k.items?.map((it, i) => (
                          <div key={i} className="flex justify-between text-sm"><span className="font-medium">{it.qty}× {it.name}</span></div>
                        ))}
                      </div>
                      {k.notes && <div className="text-xs italic text-amber-700 mt-2">Note: {k.notes}</div>}
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="flex-1 h-8 text-xs bg-[#08090C] text-white" onClick={() => advance(k)} data-testid={`kot-advance-${k.order_number}`}>{LABEL[k.status]}</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs text-rose-600" onClick={() => cancel(k)}>Cancel</Button>
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-xl">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KOT;
