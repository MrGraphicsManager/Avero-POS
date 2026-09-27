import React, { useState } from "react";
import { useCollection } from "@/hooks/useCollection";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { StatusBadge, Card } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Table2, Users } from "lucide-react";
import { inr } from "@/lib/format";

const STATUSES = ["available", "occupied", "reserved", "cleaning"];
const STATUS_STYLE = {
  available: "bg-emerald-50 border-emerald-300 text-emerald-800",
  occupied: "bg-rose-50 border-rose-300 text-rose-800",
  reserved: "bg-amber-50 border-amber-300 text-amber-800",
  cleaning: "bg-purple-50 border-purple-300 text-purple-800",
};

const Tables = () => {
  const { items, loading, create, update, remove } = useCollection("tables");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number: "", seats: 4, area: "Main" });

  const addTable = async () => {
    if (!form.number) return toast.error("Enter a table number.");
    await create({ number: form.number, seats: Number(form.seats), area: form.area, status: "available" });
    toast.success("Table added.");
    setOpen(false); setForm({ number: "", seats: 4, area: "Main" });
  };

  const cycle = async (t, status) => { await update(t.id, { status }); toast.success(`Table ${t.number} → ${status}`); };

  return (
    <div>
      <PageHeader title="Tables" subtitle="Manage your floor: available, occupied, reserved and cleaning."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-[#08090C] text-white rounded-full" data-testid="add-table-btn"><Plus className="h-4 w-4 mr-1.5" /> Add Table</Button></DialogTrigger>
            <DialogContent data-testid="add-table-dialog">
              <DialogHeader><DialogTitle>Add Table</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Table number</Label><Input className="mt-1.5" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="e.g. 12" data-testid="table-number-input" /></div>
                <div><Label>Seats</Label><Input type="number" className="mt-1.5" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
                <div><Label>Area</Label><Input className="mt-1.5" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Main / Outdoor / AC" /></div>
              </div>
              <DialogFooter><Button onClick={addTable} className="bg-[#08090C] text-white" data-testid="table-save-btn">Add Table</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      <div className="flex flex-wrap gap-3 mb-5">
        {STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-2 text-sm">
            <span className={`h-3 w-3 rounded-sm border ${STATUS_STYLE[s]}`} /><span className="capitalize text-muted-foreground">{s}</span>
            <span className="font-mono font-semibold">{items.filter((t) => t.status === s).length}</span>
          </div>
        ))}
      </div>

      {loading ? <Loader /> : items.length === 0 ? (
        <Card><EmptyState icon={Table2} title="No tables yet" description="Add your first table to build your floor layout." /></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="tables-grid">
          {items.map((t) => (
            <div key={t.id} className={`rounded-xl border-2 p-4 ${STATUS_STYLE[t.status] || STATUS_STYLE.available}`} data-testid={`table-${t.number}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-lg">T-{t.number}</span>
                <span className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />{t.seats}</span>
              </div>
              <div className="text-[11px] mt-0.5 opacity-70">{t.area}</div>
              <Select value={t.status} onValueChange={(v) => cycle(t, v)}>
                <SelectTrigger className="h-7 text-xs mt-3 bg-white/70" data-testid={`table-status-${t.number}`}><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
              <button onClick={() => remove(t.id)} className="text-[11px] text-rose-600/70 hover:text-rose-600 mt-2 w-full text-center">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tables;
