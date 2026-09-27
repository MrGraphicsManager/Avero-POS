import React, { useState, useMemo } from "react";
import { useCollection } from "@/hooks/useCollection";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { SearchBox, StatCard, StatusBadge } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Wallet, Trash2 } from "lucide-react";
import { inr, formatDate } from "@/lib/format";

const CATEGORIES = ["Rent", "Utilities", "Salary", "Supplies", "Maintenance", "Marketing", "Other"];
const METHODS = ["Cash", "UPI", "Card", "Other"];

const Expenses = () => {
  const { items, loading, create, remove } = useCollection("expenses");
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Supplies", amount: "", method: "Cash", notes: "" });

  const filtered = useMemo(() => items.filter((e) =>
    (catFilter === "all" || e.category === catFilter) &&
    ((e.title || "").toLowerCase().includes(q.toLowerCase()) || e.category.toLowerCase().includes(q.toLowerCase()))), [items, q, catFilter]);

  const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);

  const save = async () => {
    if (!form.amount) return toast.error("Amount required.");
    await create({ ...form, amount: Number(form.amount) });
    toast.success("Expense added.");
    setOpen(false); setForm({ title: "", category: "Supplies", amount: "", method: "Cash", notes: "" });
  };

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Track where your money goes."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-[#08090C] text-white rounded-full" data-testid="add-expense-btn"><Plus className="h-4 w-4 mr-1.5" /> Add Expense</Button></DialogTrigger>
            <DialogContent data-testid="expense-dialog">
              <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title</Label><Input className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Milk supplier" data-testid="exp-title-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="mt-1.5" data-testid="exp-category-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount ₹</Label><Input type="number" className="mt-1.5" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="exp-amount-input" /></div>
                </div>
                <div><Label>Payment method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Notes</Label><Textarea className="mt-1.5" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save} className="bg-[#08090C] text-white" data-testid="exp-save-btn">Add expense</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total (filtered)" value={inr(total)} icon={Wallet} accent />
        <StatCard label="Entries" value={filtered.length} icon={Wallet} />
        <StatCard label="Categories" value={new Set(items.map((e) => e.category)).size} icon={Wallet} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <SearchBox value={q} onChange={setQ} placeholder="Search expenses" className="sm:w-72" />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="sm:w-44" data-testid="exp-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl"><EmptyState icon={Wallet} title="No expenses" description="Record your first expense to track spending." /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <Table data-testid="expenses-table">
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                  <TableCell className="font-medium">{e.title || "—"}</TableCell>
                  <TableCell><StatusBadge status={e.category} tone="slate" /></TableCell>
                  <TableCell className="text-muted-foreground">{e.method}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(e.created_at)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{inr(e.amount)}</TableCell>
                  <TableCell><button onClick={() => { remove(e.id); toast.success("Deleted."); }} className="p-1.5 text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Expenses;
