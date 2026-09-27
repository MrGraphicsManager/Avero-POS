import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { BrandLogo } from "@/components/Logo";
import { StatCard, Card } from "@/components/kit";
import { Loader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Coffee, UtensilsCrossed, Users, LogOut, Save } from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";

const Admin = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => setStats(null));
    api.get("/admin/pricing").then((r) => setCfg(r.data)).catch(() => setCfg(null));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/admin/pricing", {
        launchOfferEnd: cfg.launchOfferEnd, announcement: cfg.announcement,
        monthly: Number(cfg.monthly), threeMonth: Number(cfg.threeMonth),
        sixMonth: Number(cfg.sixMonth), yearly: Number(cfg.yearly),
      });
      toast.success("Pricing configuration saved.");
    } catch { toast.error("Could not save."); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F7]">
      <header className="bg-[#08090C] text-white">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size={30} dark textClass="text-lg" />
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-md bg-[#B8FF00] text-[#08090C] font-bold">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300 hidden sm:inline">{user?.email}</span>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={logout} data-testid="admin-logout"><LogOut className="h-4 w-4 mr-1.5" /> Log out</Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Avero Admin</h1>
        <p className="text-sm text-muted-foreground mb-6">Platform overview and configuration.</p>

        {!stats ? <Loader /> : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Businesses" value={stats.total_businesses} icon={Building2} accent />
            <StatCard label="Cafes" value={stats.cafes} icon={Coffee} />
            <StatCard label="Restaurants" value={stats.restaurants} icon={UtensilsCrossed} />
            <StatCard label="Users" value={stats.users} icon={Users} />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {cfg && (
            <Card title="Launch & Pricing Configuration" className="lg:col-span-2">
              <div className="space-y-4">
                <div>
                  <Label>Announcement text</Label>
                  <Input className="mt-1.5" value={cfg.announcement} onChange={(e) => setCfg({ ...cfg, announcement: e.target.value })} data-testid="admin-announcement" />
                </div>
                <div>
                  <Label>Launch offer end (ISO with timezone)</Label>
                  <Input className="mt-1.5 font-mono text-sm" value={cfg.launchOfferEnd} onChange={(e) => setCfg({ ...cfg, launchOfferEnd: e.target.value })} data-testid="admin-launch-end" />
                  <div className="text-xs text-muted-foreground mt-1">Countdown preview: <CountdownTimer targetIso={new Date(cfg.launchOfferEnd).toISOString()} variant="mobile" /></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[["monthly", "Monthly ₹"], ["threeMonth", "3 Months ₹"], ["sixMonth", "6 Months ₹"], ["yearly", "Yearly ₹"]].map(([k, l]) => (
                    <div key={k}><Label className="text-xs">{l}</Label><Input type="number" className="mt-1.5 font-mono" value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} data-testid={`admin-price-${k}`} /></div>
                  ))}
                </div>
                <Button onClick={save} disabled={saving} className="bg-[#08090C] text-white" data-testid="admin-save-btn"><Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save configuration"}</Button>
              </div>
            </Card>
          )}

          {stats && (
            <Card title="Referral Sources">
              {stats.referrals.length === 0 ? <p className="text-sm text-muted-foreground py-4">No data yet.</p> : (
                <div className="space-y-2.5">
                  {stats.referrals.sort((a, b) => b.count - a.count).map((r) => (
                    <div key={r.source} className="flex justify-between text-sm"><span>{r.source}</span><span className="font-mono font-semibold">{r.count}</span></div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
