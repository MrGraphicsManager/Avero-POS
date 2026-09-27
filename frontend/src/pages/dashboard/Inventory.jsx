import React, { useState, useMemo } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/useCollection";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { SearchBox, StatusBadge } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Boxes, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { inr } from "@/lib/format";

const Inventory = () => {
  const { business } = useAuth();
  const isResto = business?.business_type === "restaurant";
  const { items, loading, create, update, remove, reload } = useCollection("inventory");
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [adjust, setAdjust] = useState(null);
  const [editing, setEditing] = useState(null);
  const empty = { name: "", category: "", unit: isResto ? "kg" : "pcs", stock_quantity: 0, low_stock_threshold: 5, purchase_price: "", selling_price: "" };
  const [form, setForm] = useState(empty);

  const filtered = useMemo(() => items.filter((it) => {
    const low = Number(it.stock_quantity) <= Number(it.low_stock_threshold);
    if (stockFilter === "low" && !low) return false;
    if (stockFilter === "ok" && low) return false;
    return it.name.toLowerCase().includes(q.toLowerCase());
  }), [items, q, stockFilter]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (it) => { setEditing(it); setForm({ ...empty, ...it }); setOpen(true); };
  const save = async () => {
    if (!form.name) return toast.error("Name required.");
    const body = { ...form, stock_quantity: Number(form.stock_quantity), low_stock_threshold: Number(form.low_stock_threshold), purchase_price: Number(form.purchase_price || 0), selling_price: Number(form.selling_price || 0) };
    if (editing) { await update(editing.id, body); toast.success("Inventory updated successfully."); }
    else { await create(body); toast.success("Item added to inventory."); }
    setOpen(false);
  };
  const doAdjust = async (delta, note) => {
    await api.post(`/inventory/${adjust.id}/adjust`, { delta: Number(delta), note, type: delta >= 0 ? "restock" : "usage" });
    toast.success("Stock adjusted.");
    setAdjust(null); reload();
  };

  return (
    <div>
      <PageHeader title="Inventory" subtitle={isResto ? "Track ingredients and receive low-stock alerts." : "Track menu-item stock and low-stock alerts."}
        action={<Button className="bg-[#08090C] text-white rounded-full" onClick={openNew} data-testid="add-inventory-btn"><Plus className="h-4 w-4 mr-1.5" /> Add Item</Button>} />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <SearchBox value={q} onChange={setQ} placeholder="Search inventory" className="sm:w-72" />
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="sm:w-40" data-testid="stock-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All stock</SelectItem><SelectItem value="low">Low stock</SelectItem><SelectItem value="ok">Healthy</SelectItem></SelectContent>
        </Select>
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl"><EmptyState icon={Boxes} title="No inventory items" description="Add stock items to track quantities and get alerts." action={<Button onClick={openNew} className="bg-[#08090C] text-white">Add item</Button>} /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <Table data-testid="inventory-table">
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Buy</TableHead><TableHead className="text-right">Sell</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((it) => {
                const low = Number(it.stock_quantity) <= Number(it.low_stock_threshold);
                return (
                  <TableRow key={it.id} data-testid={`inventory-row-${it.id}`}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell className="text-muted-foreground">{it.category || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{it.stock_quantity} {it.unit}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{inr(it.purchase_price)}</TableCell>
                    <TableCell className="text-right font-mono">{inr(it.selling_price)}</TableCell>
                    <TableCell><StatusBadge status={low ? "low" : "ok"} tone={low ? "red" : "green"} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setAdjust(it)} className="p-1.5 text-slate-500 hover:text-[#08090C]" data-testid={`inv-adjust-${it.id}`}><ArrowUpDown className="h-4 w-4" /></button>
                        <button onClick={() => openEdit(it)} className="p-1.5 text-slate-500 hover:text-[#08090C]"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { remove(it.id); toast.success("Deleted."); }} className="p-1.5 text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="inventory-dialog">
          <DialogHeader><DialogTitle>{editing ? "Edit item" : "Add inventory item"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="inv-name-input" /></div>
            <div><Label>Category</Label><Input className="mt-1.5" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>Unit</Label><Input className="mt-1.5" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg / L / pcs" /></div>
            <div><Label>Stock qty</Label><Input type="number" className="mt-1.5" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} data-testid="inv-stock-input" /></div>
            <div><Label>Low-stock threshold</Label><Input type="number" className="mt-1.5" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
            <div><Label>Purchase price</Label><Input type="number" className="mt-1.5" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></div>
            <div><Label>Selling price</Label><Input type="number" className="mt-1.5" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="bg-[#08090C] text-white" data-testid="inv-save-btn">{editing ? "Save" : "Add"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjust} onOpenChange={(o) => !o && setAdjust(null)}>
        <DialogContent data-testid="adjust-dialog">
          <DialogHeader><DialogTitle>Adjust stock · {adjust?.name}</DialogTitle></DialogHeader>
          <AdjustForm current={adjust?.stock_quantity} unit={adjust?.unit} onSubmit={doAdjust} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdjustForm = ({ current, unit, onSubmit }) => {
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Current: <span className="font-mono font-semibold">{current} {unit}</span></p>
      <div><Label>Change (+ to add, - to reduce)</Label><Input type="number" className="mt-1.5 font-mono" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 10 or -3" data-testid="adjust-delta-input" /></div>
      <div><Label>Note</Label><Input className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Restock / wastage" /></div>
      <DialogFooter><Button onClick={() => onSubmit(delta, note)} disabled={!delta} className="bg-[#08090C] text-white" data-testid="adjust-submit-btn">Apply</Button></DialogFooter>
    </div>
  );
};

export default Inventory;
