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
import { Plus, Table2, Users, QrCode, Download, Printer, RefreshCw, Power } from "lucide-react";
import { inr } from "@/lib/format";
import api from "@/lib/api";
import { API } from "@/lib/api";

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
  const [qrTable, setQrTable] = useState(null);
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
              <button onClick={() => setQrTable(t)} className="w-full mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium bg-white/80 rounded-md py-1.5 hover:bg-white" data-testid={`table-qr-${t.number}`}>
                <QrCode className="h-3.5 w-3.5" /> Table QR
              </button>
              <button onClick={() => remove(t.id)} className="text-[11px] text-rose-600/70 hover:text-rose-600 mt-1.5 w-full text-center">Remove</button>
            </div>
          ))}
        </div>
      )}

      <TableQRDialog table={qrTable} onClose={() => setQrTable(null)} />
    </div>
  );
};

const TableQRDialog = ({ table, onClose }) => {
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("avero_token");
  const imgUrl = table ? `${API}/tables/${table.id}/qr/image.png?t=${qr?.updated_at || ""}` : "";

  React.useEffect(() => {
    if (!table) { setQr(null); return; }
    setLoading(true);
    api.get(`/tables/${table.id}/qr`).then((r) => setQr(r.data)).catch(() => setQr(null)).finally(() => setLoading(false));
  }, [table]);

  const generate = async () => {
    const { data } = await api.post(`/tables/${table.id}/qr/generate`);
    setQr(data); toast.success(qr ? "QR regenerated — old QR is now invalid." : "QR generated.");
  };
  const toggle = async () => {
    const next = qr.status === "active" ? "disabled" : "active";
    const { data } = await api.patch(`/tables/${table.id}/qr/status`, { status: next });
    setQr(data); toast.success(next === "active" ? "QR enabled." : "QR disabled.");
  };
  const download = async () => {
    try {
      const res = await api.get(`/tables/${table.id}/qr/image.png`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `avero-table-${table.number}-qr.png`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Generate the QR first."); }
  };
  const printCard = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Avero Table ${table.number} QR</title>
      <style>@page{margin:0}body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
      .card{width:320px;border:3px solid #08090C;border-radius:24px;padding:28px;text-align:center}
      .brand{font-weight:800;font-size:28px;letter-spacing:-1px;color:#08090C}.dot{color:#B8FF00}
      .tbl{font-size:22px;font-weight:700;margin:8px 0 4px}.sub{color:#555;font-size:14px;margin-bottom:16px}
      img{width:220px;height:220px}.foot{margin-top:16px;font-size:13px;font-weight:600}.upi{margin-top:6px;font-size:12px;color:#08090C;background:#B8FF00;display:inline-block;padding:4px 12px;border-radius:99px;font-weight:700}</style></head>
      <body><div class="card"><div class="brand">Aver<span class="dot">o</span></div>
      <div class="tbl">TABLE ${table.number}</div><div class="sub">Scan to view menu &amp; order</div>
      <img src="${imgUrl}" crossorigin="anonymous"/><div class="foot">Scan • Order • Pay</div>
      <div class="upi">UPI Payment Required</div></div>
      <script>setTimeout(()=>window.print(),600)</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="table-qr-dialog">
        <DialogHeader><DialogTitle>Table {table?.number} — QR Ordering</DialogTitle></DialogHeader>
        {loading ? <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div> : !qr ? (
          <div className="text-center py-8">
            <QrCode className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No QR yet for this table. Generate one to let customers scan, order and pay.</p>
            <Button onClick={generate} className="bg-[#08090C] text-white" data-testid="qr-generate-btn"><QrCode className="h-4 w-4 mr-1.5" /> Generate QR</Button>
          </div>
        ) : (
          <div>
            <div className="bg-[#F5F6F7] rounded-xl p-5 flex flex-col items-center">
              <div className="text-lg font-extrabold tracking-tight">Aver<span className="text-[#B8FF00]" style={{ WebkitTextStroke: "0.5px #08090C" }}>o</span></div>
              <div className="text-sm font-bold mt-1">TABLE {table?.number}</div>
              <div className="text-xs text-muted-foreground mb-3">Scan to view menu &amp; order</div>
              <img src={imgUrl || undefined} alt="Table QR" className={`w-44 h-44 bg-white rounded-lg ${qr.status !== "active" ? "opacity-30" : ""}`} data-testid="qr-image" />
              <div className="text-xs font-semibold mt-3">Scan • Order • Pay</div>
              <span className="text-[10px] font-bold mt-1.5 bg-[#B8FF00] text-[#08090C] px-2.5 py-0.5 rounded-full">UPI PAYMENT REQUIRED</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 px-1">
              <span>Status: <b className={qr.status === "active" ? "text-emerald-600" : "text-rose-600"}>{qr.status}</b></span>
              <span>Updated {new Date(qr.updated_at).toLocaleDateString("en-IN")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" onClick={download} data-testid="qr-download-btn"><Download className="h-4 w-4 mr-1.5" /> Download</Button>
              <Button variant="outline" onClick={printCard} data-testid="qr-print-btn"><Printer className="h-4 w-4 mr-1.5" /> Print card</Button>
              <Button variant="outline" onClick={generate} data-testid="qr-regenerate-btn"><RefreshCw className="h-4 w-4 mr-1.5" /> Regenerate</Button>
              <Button variant="outline" onClick={toggle} className={qr.status === "active" ? "text-rose-600" : "text-emerald-600"} data-testid="qr-toggle-btn">
                <Power className="h-4 w-4 mr-1.5" /> {qr.status === "active" ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Tables;
