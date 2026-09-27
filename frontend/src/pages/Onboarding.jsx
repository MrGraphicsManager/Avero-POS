import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { usePricing } from "@/lib/pricing";
import { BrandLogo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Coffee, UtensilsCrossed, Check, ArrowRight, ArrowLeft, Instagram, Youtube,
  Search, Users, MessageCircle, Facebook, Megaphone, GraduationCap, MoreHorizontal, ShieldCheck,
} from "lucide-react";

const REFERRALS = [
  ["Instagram", Instagram], ["YouTube", Youtube], ["Google", Search], ["Friend / Family", Users],
  ["WhatsApp", MessageCircle], ["Facebook", Facebook], ["Advertisement", Megaphone],
  ["College / Community", GraduationCap], ["Other", MoreHorizontal],
];

const FEATURES = ["Orders", "Tables", "Billing", "Menu", "Inventory", "Customers", "Staff", "Expenses", "Reports", "Analytics"];
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const Onboarding = () => {
  const { user, business, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const pricing = usePricing();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    referral_source: "", referral_source_other: "",
    business_type: "", business_name: "", manager_name: "", owner_is_manager: false,
    gst_registered: null, gst_number: "", fssai_number: "", no_fssai: false,
  });

  // Resume: if already onboarded, go to dashboard
  useEffect(() => {
    if (business?.onboarding_completed) navigate("/app");
    if (business) {
      setData((d) => ({ ...d, business_type: business.business_type || "", business_name: business.business_name || "" }));
    }
  }, [business, navigate]);

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const totalSteps = 7;

  const save = async (patch) => {
    const { data: biz } = await api.post("/onboarding", patch);
    await refresh();
    return biz;
  };

  const businessLabel = data.business_type === "restaurant" ? "Restaurant" : "Cafe";

  const next = async () => {
    setSaving(true);
    try {
      if (step === 2) await save({ referral_source: data.referral_source, referral_source_other: data.referral_source_other });
      if (step === 3) await save({ business_type: data.business_type });
      if (step === 5) await save({
        business_name: data.business_name,
        manager_name: data.owner_is_manager ? user?.name : data.manager_name,
        owner_is_manager: data.owner_is_manager,
      });
      if (step === 6) {
        const gstReg = data.gst_registered === true;
        if (gstReg && data.gst_number && !GST_RE.test(data.gst_number.toUpperCase())) {
          toast.error("Please enter a valid GST number or choose 'No'.");
          setSaving(false); return;
        }
        await save({
          gst_registered: gstReg, gst_number: gstReg ? data.gst_number.toUpperCase() : null,
          fssai_number: data.no_fssai ? null : (data.fssai_number || null),
        });
      }
      setStep((s) => s + 1);
    } catch (e) {
      toast.error("Could not save. Please try again.");
    } finally { setSaving(false); }
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      await save({ onboarding_completed: true });
      toast.success("Welcome to Avero!");
      navigate("/app?tour=1");
    } catch { toast.error("Something went wrong."); }
    finally { setSaving(false); }
  };

  const canNext = () => {
    if (step === 2) return !!data.referral_source && (data.referral_source !== "Other" || true);
    if (step === 3) return !!data.business_type;
    if (step === 5) return !!data.business_name.trim();
    return true;
  };

  return (
    <div className="min-h-screen bg-[#F5F6F7] flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <BrandLogo size={30} textClass="text-lg" />
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-[#08090C]" data-testid="onboarding-logout">Log out</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          {/* progress */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Step {step} of {totalSteps}</span>
              <span>{Math.round((step / totalSteps) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-[#B8FF00] transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm animate-fade-up" data-testid={`onboarding-step-${step}`}>
            {/* Step 1 welcome */}
            {step === 1 && (
              <Center title={`Welcome, ${user?.name?.split(" ")[0] || "there"}! 👋`} sub="Let's set up your Avero workspace in a few quick steps.">
                <div className="grid grid-cols-2 gap-3 my-6">
                  {["Choose your business", "Add business details", "Confirm free plan", "Enter dashboard"].map((t, i) => (
                    <div key={t} className="flex items-center gap-2 text-sm text-slate-700 bg-[#F5F6F7] rounded-lg px-3 py-2.5">
                      <span className="h-5 w-5 rounded-full bg-[#B8FF00] text-[#08090C] text-xs font-bold flex items-center justify-center">{i + 1}</span>{t}
                    </div>
                  ))}
                </div>
              </Center>
            )}

            {/* Step 2 referral */}
            {step === 2 && (
              <>
                <StepTitle title="How did you hear about Avero?" sub="This helps us understand what's working. Pick one." />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-6">
                  {REFERRALS.map(([label, Icon]) => (
                    <button key={label} onClick={() => set("referral_source", label)} data-testid={`referral-${label.split(" ")[0].toLowerCase()}`}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm text-left transition-all ${data.referral_source === label ? "border-[#08090C] bg-[#08090C] text-white" : "border-slate-200 hover:border-slate-400"}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${data.referral_source === label ? "text-[#B8FF00]" : "text-slate-500"}`} /> {label}
                    </button>
                  ))}
                </div>
                {data.referral_source === "Other" && (
                  <Input className="mt-4" placeholder="Tell us more (optional)" value={data.referral_source_other} onChange={(e) => set("referral_source_other", e.target.value)} data-testid="referral-other-input" />
                )}
              </>
            )}

            {/* Step 3 business type */}
            {step === 3 && (
              <>
                <StepTitle title="What type of business do you run?" sub="Your workspace is tailored to your choice." />
                <div className="grid sm:grid-cols-2 gap-4 mt-6">
                  <TypeCard selected={data.business_type === "cafe"} onClick={() => set("business_type", "cafe")}
                    icon={Coffee} tone="amber" title="Cafe" desc="Manage tables, orders, billing, menu and daily cafe operations." testid="business-type-cafe" />
                  <TypeCard selected={data.business_type === "restaurant"} onClick={() => set("business_type", "restaurant")}
                    icon={UtensilsCrossed} tone="emerald" title="Restaurant" desc="Manage tables, orders, KOT, kitchen, billing and restaurant operations." testid="business-type-restaurant" />
                </div>
              </>
            )}

            {/* Step 4 subscription */}
            {step === 4 && (
              <>
                <StepTitle title="Your Avero subscription" sub="Everything is free during our launch period." />
                <div className="rounded-2xl border-2 border-[#B8FF00] bg-[#F5F6F7] p-6 mt-6 text-center">
                  <span className="text-xs font-bold font-mono bg-[#B8FF00] text-[#08090C] px-3 py-1 rounded-full">LAUNCH OFFER</span>
                  <div className="text-5xl font-extrabold font-mono mt-4">₹0</div>
                  <p className="text-slate-600 mt-1">Free until 15 January 2027</p>
                  <p className="text-sm text-slate-500 mt-3 max-w-md mx-auto">You get access to all of Avero's merchant features during the launch period.</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left text-sm mt-6 max-w-sm mx-auto">
                    {FEATURES.map((f) => <div key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#08090C]" /> {f}</div>)}
                  </div>
                </div>
              </>
            )}

            {/* Step 5 business info */}
            {step === 5 && (
              <>
                <StepTitle title="Business information" sub="Tell us about your business." />
                <div className="space-y-4 mt-6">
                  <div>
                    <Label>Owner name</Label>
                    <Input className="mt-1.5 bg-slate-50" value={user?.name || ""} disabled data-testid="info-owner-name" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="ownmgr" checked={data.owner_is_manager} onCheckedChange={(v) => set("owner_is_manager", !!v)} data-testid="info-owner-is-manager" />
                    <Label htmlFor="ownmgr" className="cursor-pointer font-normal">I'm the owner and manager</Label>
                  </div>
                  {!data.owner_is_manager && (
                    <div>
                      <Label>Manager name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input className="mt-1.5" value={data.manager_name} onChange={(e) => set("manager_name", e.target.value)} placeholder="Manager's name" data-testid="info-manager-name" />
                    </div>
                  )}
                  <div>
                    <Label>{businessLabel} name</Label>
                    <Input className="mt-1.5" value={data.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder={`Your ${businessLabel.toLowerCase()} name`} data-testid="info-business-name" />
                  </div>
                </div>
              </>
            )}

            {/* Step 6 compliance */}
            {step === 6 && (
              <>
                <StepTitle title="Business compliance" sub="Add these if you have them — none are required to continue." />
                <div className="space-y-6 mt-6">
                  <div>
                    <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#08090C]" /> Do you have a GST number?</Label>
                    <div className="flex gap-2 mt-2">
                      <Button type="button" variant={data.gst_registered === true ? "default" : "outline"} className={data.gst_registered === true ? "bg-[#08090C] text-white" : ""} onClick={() => set("gst_registered", true)} data-testid="gst-yes">Yes</Button>
                      <Button type="button" variant={data.gst_registered === false ? "default" : "outline"} className={data.gst_registered === false ? "bg-[#08090C] text-white" : ""} onClick={() => set("gst_registered", false)} data-testid="gst-no">No</Button>
                    </div>
                    {data.gst_registered === true && (
                      <Input className="mt-3 font-mono uppercase" placeholder="22AAAAA0000A1Z5" value={data.gst_number} onChange={(e) => set("gst_number", e.target.value.toUpperCase())} maxLength={15} data-testid="gst-number-input" />
                    )}
                  </div>
                  <div>
                    <Label>FSSAI Number <span className="text-muted-foreground font-normal">(for food businesses)</span></Label>
                    <Input className="mt-1.5 font-mono" placeholder="14-digit FSSAI number" value={data.fssai_number} disabled={data.no_fssai} onChange={(e) => set("fssai_number", e.target.value)} data-testid="fssai-input" />
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox id="nofssai" checked={data.no_fssai} onCheckedChange={(v) => { set("no_fssai", !!v); if (v) set("fssai_number", ""); }} data-testid="fssai-none" />
                      <Label htmlFor="nofssai" className="cursor-pointer font-normal text-sm text-muted-foreground">I don't have this right now</Label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 7 summary */}
            {step === 7 && (
              <>
                <StepTitle title="Review & confirm" sub="Everything look right? You can edit any step." />
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 mt-6" data-testid="onboarding-summary">
                  <Row label="Owner" value={user?.name} onEdit={() => setStep(5)} />
                  <Row label="Manager" value={data.owner_is_manager ? user?.name : (data.manager_name || "—")} onEdit={() => setStep(5)} />
                  <Row label="Business" value={data.business_name || "—"} onEdit={() => setStep(5)} />
                  <Row label="Business Type" value={businessLabel} onEdit={() => setStep(3)} />
                  <Row label="GST" value={data.gst_registered ? `Registered · ${data.gst_number}` : "Not registered"} onEdit={() => setStep(6)} />
                  <Row label="FSSAI" value={data.no_fssai || !data.fssai_number ? "Not provided" : `Provided · ${data.fssai_number}`} onEdit={() => setStep(6)} />
                  <Row label="Subscription" value="Free until 15 January 2027" badge />
                </div>
              </>
            )}

            {/* nav buttons */}
            <div className="flex items-center justify-between mt-8 pt-2">
              {step > 1 ? (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving} data-testid="onboarding-back-btn">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                </Button>
              ) : <span />}
              {step < totalSteps ? (
                <Button onClick={next} disabled={!canNext() || saving} className="bg-[#08090C] text-white rounded-full px-6" data-testid="onboarding-next-btn">
                  {saving ? "Saving…" : (step === 4 ? "Continue" : "Next")} <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              ) : (
                <Button onClick={finishOnboarding} disabled={saving} className="bg-[#B8FF00] hover:bg-[#a5e600] text-[#08090C] font-semibold rounded-full px-6" data-testid="onboarding-finish-btn">
                  {saving ? "Finishing…" : "Continue to Avero"} <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepTitle = ({ title, sub }) => (
  <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>{sub && <p className="text-sm text-muted-foreground mt-1.5">{sub}</p>}</div>
);
const Center = ({ title, sub, children }) => (
  <div className="text-center"><h2 className="text-2xl font-bold tracking-tight">{title}</h2><p className="text-sm text-muted-foreground mt-2">{sub}</p>{children}</div>
);
const TypeCard = ({ selected, onClick, icon: Icon, title, desc, tone, testid }) => {
  const tones = { amber: "text-amber-600 bg-amber-50", emerald: "text-emerald-600 bg-emerald-50" };
  return (
    <button onClick={onClick} data-testid={testid}
      className={`text-left rounded-2xl border-2 p-5 transition-all ${selected ? "border-[#08090C] shadow-md" : "border-slate-200 hover:border-slate-400"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
        {selected && <span className="h-6 w-6 rounded-full bg-[#B8FF00] flex items-center justify-center"><Check className="h-4 w-4 text-[#08090C]" /></span>}
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{desc}</p>
    </button>
  );
};
const Row = ({ label, value, onEdit, badge }) => (
  <div className="flex items-center justify-between px-4 py-3">
    <div><div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{badge ? <span className="text-[#08090C] font-semibold">{value}</span> : value}</div></div>
    {onEdit && <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-[#08090C]">Edit</button>}
  </div>
);

export default Onboarding;
