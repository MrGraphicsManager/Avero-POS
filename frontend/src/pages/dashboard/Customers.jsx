import React, { useState, useMemo } from "react";
import { useCollection } from "@/hooks/useCollection";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { SearchBox } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, Trash2 } from "lucide-react";
import { inr, formatDate } from "@/lib/format";

const Customers = () => {
  const { items, loading, create, remove } = useCollection("customers");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const filtered = useMemo(() => items.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone || "").includes(q)), [items, q]);

  const save = async () => {
    if (!form.name) return toast.error("Name required.");
    await create({ ...form, total_orders: 0, total_spending: 0 });
    toast.success("Customer added.");
    setOpen(false); setForm({ name: "", phone: "", email: "", notes: "" });
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle="Your customer directory with spending history."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-[#08090C] text-white rounded-full" data-testid="add-customer-btn"><Plus className="h-4 w-4 mr-1.5" /> Add Customer</Button></DialogTrigger>
            <DialogContent data-testid="customer-dialog">
              <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="cust-name-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input className="mt-1.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="cust-phone-input" /></div>
                  <div><Label>Email</Label><Input className="mt-1.5" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea className="mt-1.5" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save} className="bg-[#08090C] text-white" data-testid="cust-save-btn">Add customer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      <SearchBox value={q} onChange={setQ} placeholder="Search name or phone" className="mb-5 sm:max-w-xs" />

      {loading ? <Loader /> : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl"><EmptyState icon={Users} title="No customers yet" description="Add customers to track their orders and spending." /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <Table data-testid="customers-table">
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Spending</TableHead><TableHead>Last visit</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} data-testid={`customer-row-${c.id}`}>
                  <TableCell className="font-medium">{c.name}<div className="text-xs text-muted-foreground">{c.email}</div></TableCell>
                  <TableCell className="font-mono">{c.phone || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{c.total_orders || 0}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{inr(c.total_spending || 0)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.last_visit ? formatDate(c.last_visit) : "—"}</TableCell>
                  <TableCell><button onClick={() => { remove(c.id); toast.success("Deleted."); }} className="p-1.5 text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Customers;
