import React, { useState, useMemo } from "react";
import { useCollection } from "@/hooks/useCollection";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { SearchBox, Card } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, BookOpen, Pencil, Trash2 } from "lucide-react";
import { inr } from "@/lib/format";

const Menu = () => {
  const { items, loading, create, update, remove } = useCollection("menu-items");
  const { items: cats, create: createCat } = useCollection("menu-categories");
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", category: "", tax_rate: 5, available: true });
  const [newCat, setNewCat] = useState("");

  const categories = cats.map((c) => c.name);
  const filtered = useMemo(() => items.filter((m) =>
    (catFilter === "all" || m.category === catFilter) && m.name.toLowerCase().includes(q.toLowerCase())
  ), [items, q, catFilter]);

  const openNew = () => { setEditing(null); setForm({ name: "", price: "", category: categories[0] || "", tax_rate: 5, available: true }); setOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ name: m.name, price: m.price, category: m.category || "", tax_rate: m.tax_rate ?? 5, available: m.available !== false }); setOpen(true); };

  const save = async () => {
    if (!form.name || form.price === "") return toast.error("Name and price are required.");
    const body = { ...form, price: Number(form.price), tax_rate: Number(form.tax_rate) };
    if (editing) { await update(editing.id, body); toast.success("Item updated."); }
    else { await create(body); toast.success("Item added."); }
    setOpen(false);
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    await createCat({ name: newCat.trim() }); setNewCat(""); toast.success("Category added.");
  };

  return (
    <div>
      <PageHeader title="Menu" subtitle="Manage categories, items, prices and availability."
        action={<Button className="bg-[#08090C] text-white rounded-full" onClick={openNew} data-testid="add-menu-item-btn"><Plus className="h-4 w-4 mr-1.5" /> Add Item</Button>} />

      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-2 flex-1">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category (e.g. Beverages)" className="max-w-xs" data-testid="new-category-input" />
            <Button variant="outline" onClick={addCategory} data-testid="add-category-btn">Add Category</Button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setCatFilter("all")} className={`text-xs px-3 py-1.5 rounded-full border ${catFilter === "all" ? "bg-[#08090C] text-white" : "border-slate-200"}`}>All</button>
            {categories.map((c) => <button key={c} onClick={() => setCatFilter(c)} className={`text-xs px-3 py-1.5 rounded-full border ${catFilter === c ? "bg-[#08090C] text-white" : "border-slate-200"}`}>{c}</button>)}
          </div>
        </div>
      </Card>

      <SearchBox value={q} onChange={setQ} placeholder="Search items" className="mb-5 sm:max-w-xs" />

      {loading ? <Loader /> : filtered.length === 0 ? (
        <Card><EmptyState icon={BookOpen} title="No menu items" description="Add categories and items to build your menu." action={<Button onClick={openNew} className="bg-[#08090C] text-white">Add your first item</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="menu-grid">
          {filtered.map((m) => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between" data-testid={`menu-item-${m.id}`}>
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.category || "Uncategorised"} · {m.available !== false ? "Available" : "Unavailable"}</div>
                <div className="font-mono font-semibold mt-1">{inr(m.price)}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch checked={m.available !== false} onCheckedChange={(v) => update(m.id, { available: v })} data-testid={`menu-toggle-${m.id}`} />
                <div className="flex gap-1">
                  <button onClick={() => openEdit(m)} className="p-1.5 text-slate-500 hover:text-[#08090C]" data-testid={`menu-edit-${m.id}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { remove(m.id); toast.success("Item deleted."); }} className="p-1.5 text-slate-500 hover:text-rose-600" data-testid={`menu-delete-${m.id}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="menu-item-dialog">
          <DialogHeader><DialogTitle>{editing ? "Edit item" : "Add item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="menu-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price ₹</Label><Input type="number" className="mt-1.5" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="menu-price-input" /></div>
              <div><Label>Tax %</Label><Input type="number" className="mt-1.5" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
            </div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1.5" data-testid="menu-category-select"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} /><Label className="font-normal">Available</Label></div>
          </div>
          <DialogFooter><Button onClick={save} className="bg-[#08090C] text-white" data-testid="menu-save-btn">{editing ? "Save changes" : "Add item"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Menu;
