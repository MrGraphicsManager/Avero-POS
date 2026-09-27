import React, { useState, useMemo } from "react";
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
import { Plus, UserCog, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";

const ROLES = ["Owner", "Manager", "Cashier", "Waiter", "Kitchen Staff"];

const Staff = () => {
  const { items, loading, create, update, remove } = useCollection("staff");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Waiter", phone: "", status: "active" });

  const filtered = useMemo(() => items.filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()) || s.role.toLowerCase().includes(q.toLowerCase())), [items, q]);

  const save = async () => {
    if (!form.name) return toast.error("Name required.");
    await create({ ...form, joining_date: new Date().toISOString() });
    toast.success("Staff member added.");
    setOpen(false); setForm({ name: "", role: "Waiter", phone: "", status: "active" });
  };

  return (
    <div>
      <PageHeader title="Staff" subtitle="Manage your team and their roles."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-[#08090C] text-white rounded-full" data-testid="add-staff-btn"><Plus className="h-4 w-4 mr-1.5" /> Add Staff</Button></DialogTrigger>
            <DialogContent data-testid="staff-dialog">
              <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="staff-name-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger className="mt-1.5" data-testid="staff-role-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Phone</Label><Input className="mt-1.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={save} className="bg-[#08090C] text-white" data-testid="staff-save-btn">Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      <SearchBox value={q} onChange={setQ} placeholder="Search staff" className="mb-5 sm:max-w-xs" />
      {loading ? <Loader /> : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl"><EmptyState icon={UserCog} title="No staff yet" description="Add your team members and assign roles." /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <Table data-testid="staff-table">
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Phone</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} data-testid={`staff-row-${s.id}`}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><StatusBadge status={s.role} tone="slate" /></TableCell>
                  <TableCell className="font-mono">{s.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(s.joining_date)}</TableCell>
                  <TableCell>
                    <button onClick={() => update(s.id, { status: s.status === "active" ? "inactive" : "active" })} data-testid={`staff-status-${s.id}`}>
                      <StatusBadge status={s.status} tone={s.status === "active" ? "green" : "slate"} />
                    </button>
                  </TableCell>
                  <TableCell>{s.role !== "Owner" && <button onClick={() => { remove(s.id); toast.success("Removed."); }} className="p-1.5 text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Staff;
