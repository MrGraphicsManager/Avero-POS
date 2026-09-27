import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import api from "@/lib/api";
import { BrandLogo } from "@/components/Logo";
import { StatCard, Card } from "@/components/kit";
import { Loader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Coffee, UtensilsCrossed, Users, LogOut, Save, ImageUp, Trash2, Upload } from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";

const Admin = () => {
  const { user, logout } = useAuth();
  const { hasCustom, logoUrl, version, reload: reloadBranding } = useBranding();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [preview, setPreview] = useState(null); // {dataUrl, base64, type}
  const fileRef = React.useRef(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (f.size > 3 * 1024 * 1024) return toast.error("Image too large (max 3MB).");
    const reader = new FileReader();
    reader.onload = () => setPreview({ dataUrl: reader.result, base64: reader.result, type: f.type });
    reader.readAsDataURL(f);
  };

  const uploadLogo = async () => {
    if (!preview) return;
    setLogoBusy(true);
    try {
      await api.post("/admin/branding/logo", { image_base64: preview.base64, content_type: preview.type });
      await reloadBranding();
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Logo updated across the website.");
    } catch { toast.error("Could not upload logo."); }
    finally { setLogoBusy(false); }
  };

  const resetLogo = async () => {
    setLogoBusy(true);
    try {
      await api.delete("/admin/branding/logo");
      await reloadBranding();
      setPreview(null);
      toast.success("Reverted to the default Avero logo.");
    } catch { toast.error("Could not reset logo."); }
    finally { setLogoBusy(false); }
  };

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

        <Card title="Website Branding" className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">Upload your logo to replace it everywhere on the website — landing page, navbar, login, dashboards, mobile nav and favicon. Use a transparent PNG/SVG for best results on dark backgrounds.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <Label className="text-xs">Current logo</Label>
              <div className="mt-2 flex items-center gap-6 flex-wrap">
                <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-center min-w-[160px] h-20">
                  <BrandLogo size={32} textClass="text-lg" />
                </div>
                <div className="rounded-xl border border-slate-200 bg-[#08090C] p-4 flex items-center justify-center min-w-[160px] h-20">
                  <BrandLogo size={32} dark textClass="text-lg" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">{hasCustom ? "Using a custom uploaded logo." : "Using the default Avero logo."}</div>
            </div>
            <div>
              <Label className="text-xs">Upload new logo</Label>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" data-testid="logo-file-input" />
              <div className="mt-2 rounded-xl border-2 border-dashed border-slate-300 p-5 flex flex-col items-center justify-center text-center">
                {preview ? (
                  <img src={preview.dataUrl} alt="preview" className="max-h-16 object-contain mb-3" data-testid="logo-preview" />
                ) : (
                  <ImageUp className="h-8 w-8 text-slate-400 mb-2" />
                )}
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="logo-choose-btn">
                  <Upload className="h-4 w-4 mr-1.5" /> {preview ? "Choose another" : "Choose image"}
                </Button>
                <span className="text-[11px] text-muted-foreground mt-2">PNG, SVG, JPG or WEBP · max 3MB</span>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={uploadLogo} disabled={!preview || logoBusy} className="bg-[#08090C] text-white" data-testid="logo-save-btn">
                  <Save className="h-4 w-4 mr-1.5" /> {logoBusy ? "Saving…" : "Apply logo site-wide"}
                </Button>
                {hasCustom && (
                  <Button variant="outline" onClick={resetLogo} disabled={logoBusy} className="text-rose-600" data-testid="logo-reset-btn">
                    <Trash2 className="h-4 w-4 mr-1.5" /> Reset to default
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
