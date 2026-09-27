import React, { useState, useMemo } from "react";
import { useCollection } from "@/hooks/useCollection";
import { PageHeader, EmptyState, Loader } from "@/components/PageHeader";
import { StatusBadge, SearchBox, StatCard } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inr, formatDate, formatTime } from "@/lib/format";
import { ReceiptText, Printer, Download, IndianRupee, TrendingUp } from "lucide-react";
import { BrandLogo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const Billing = () => {
  const { business } = useAuth();
  const { items: payments, loading } = useCollection("payments");
  const { items: orders } = useCollection("orders");
  const [q, setQ] = useState("");
  const [receipt, setReceipt] = useState(null);

  const filtered = useMemo(() => payments.filter((p) =>
    p.order_number.toLowerCase().includes(q.toLowerCase()) || (p.customer_name || "").toLowerCase().includes(q.toLowerCase())
  ), [payments, q]);

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const today = payments.filter((p) => new Date(p.created_at).toDateString() === new Date().toDateString());

  const openReceipt = (p) => {
    const order = orders.find((o) => o.id === p.order_id);
    setReceipt({ ...p, order });
  };

  return (
    <div>
      <PageHeader title="Billing & Payments" subtitle="Every bill generated in your workspace." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Collected" value={inr(total)} icon={IndianRupee} accent />
        <StatCard label="Bills Today" value={today.length} icon={ReceiptText} />
        <StatCard label="Today's Revenue" value={inr(today.reduce((s, p) => s + p.amount, 0))} icon={TrendingUp} />
      </div>

      <SearchBox value={q} onChange={setQ} placeholder="Search bill # or customer" className="mb-5 sm:max-w-xs" />

      {loading ? <Loader /> : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl"><EmptyState icon={ReceiptText} title="No bills yet" description="Generate a bill from the Orders page and it will appear here." /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <Table data-testid="billing-table">
            <TableHeader><TableRow>
              <TableHead>Bill #</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead>
              <TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} data-testid={`bill-row-${p.order_number}`}>
                  <TableCell className="font-mono font-medium">{p.order_number}</TableCell>
                  <TableCell>{p.customer_name || "Walk-in"}</TableCell>
                  <TableCell><StatusBadge status={p.method} tone="slate" /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(p.created_at)} · {formatTime(p.created_at)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{inr(p.amount)}</TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => openReceipt(p)} data-testid={`view-receipt-${p.order_number}`}>Receipt</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm" data-testid="receipt-dialog">
          <DialogHeader><DialogTitle className="sr-only">Receipt</DialogTitle></DialogHeader>
          {receipt && (
            <div className="font-mono text-sm">
              <div className="text-center mb-4"><BrandLogo size={28} textClass="text-base" />
                <div className="font-sans font-semibold mt-2">{business?.business_name}</div>
                <div className="text-xs text-muted-foreground font-sans">Tax Invoice</div>
              </div>
              <div className="flex justify-between text-xs"><span>Bill: {receipt.order_number}</span><span>{formatDate(receipt.created_at)}</span></div>
              <div className="border-t border-dashed my-2" />
              {receipt.order?.items?.map((it, i) => (
                <div key={i} className="flex justify-between text-xs py-0.5"><span>{it.qty}× {it.name}</span><span>{inr(it.price * it.qty)}</span></div>
              ))}
              <div className="border-t border-dashed my-2" />
              {receipt.order && <>
                <Row l="Subtotal" v={inr(receipt.order.subtotal)} />
                {receipt.order.discount > 0 && <Row l="Discount" v={`- ${inr(receipt.order.discount)}`} />}
                <Row l={`Tax (${receipt.order.tax_rate}%)`} v={inr(receipt.order.tax)} />
              </>}
              <div className="flex justify-between font-bold text-base mt-1"><span>TOTAL</span><span>{inr(receipt.amount)}</span></div>
              <div className="text-xs text-center text-muted-foreground mt-2 font-sans">Paid via {receipt.method}</div>
              <div className="border-t border-dashed my-2" />
              <div className="text-center text-xs text-muted-foreground font-sans">Thank you! Powered by Avero</div>
              <div className="flex gap-2 mt-4">
                <Button className="flex-1 bg-[#08090C] text-white" onClick={() => window.print()} data-testid="receipt-print"><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
                <Button variant="outline" className="flex-1" onClick={() => window.print()}><Download className="h-4 w-4 mr-1.5" /> Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
const Row = ({ l, v }) => <div className="flex justify-between text-xs py-0.5"><span>{l}</span><span>{v}</span></div>;

export default Billing;
