import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Coffee, UtensilsCrossed, PlayCircle, Save } from "lucide-react";

const Settings = () => {
  const { user, business, refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    business_name: business?.business_name || "", owner_name: business?.owner_name || user?.name || "",
    manager_name: business?.manager_name || "", gst_number: business?.gst_number || "", fssai_number: business?.fssai_number || "",
  });
  const [saving, setSaving] = useState(false);
  const isResto = business?.business_type === "restaurant";

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/business", { ...form, gst_registered: !!form.gst_number });
      await refresh();
      toast.success("Business details updated.");
    } catch { toast.error("Could not save."); }
    finally { setSaving(false); }
  };

  const switchType = async () => {
    const newType = isResto ? "cafe" : "restaurant";
    await api.patch("/business", { business_type: newType });
    await refresh();
    toast.success(`Switched to ${newType} workspace.`);
    navigate("/app");
  };

  const retakeTour = async () => {
    await api.post("/onboarding", { dashboard_tour_completed: false });
    await refresh();
    navigate("/app?tour=1");
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your business, workspace and preferences." />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Business Information" className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>{isResto ? "Restaurant" : "Cafe"} name</Label><Input className="mt-1.5" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} data-testid="settings-business-name" /></div>
            <div><Label>Owner name</Label><Input className="mt-1.5" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
            <div><Label>Manager name</Label><Input className="mt-1.5" value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></div>
            <div><Label>GST number</Label><Input className="mt-1.5 font-mono uppercase" value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })} maxLength={15} /></div>
            <div><Label>FSSAI number</Label><Input className="mt-1.5 font-mono" value={form.fssai_number} onChange={(e) => setForm({ ...form, fssai_number: e.target.value })} /></div>
          </div>
          <Button onClick={save} disabled={saving} className="mt-5 bg-[#08090C] text-white" data-testid="settings-save-btn"><Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save changes"}</Button>
        </Card>

        <div className="space-y-6">
          <Card title="Subscription">
            <span className="text-xs font-bold font-mono bg-[#B8FF00] text-[#08090C] px-2.5 py-1 rounded-md">LAUNCH FREE</span>
            <div className="text-3xl font-extrabold font-mono mt-3">₹0</div>
            <p className="text-sm text-muted-foreground">Free until 15 January 2027</p>
          </Card>

          <Card title="Workspace">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isResto ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                {isResto ? <UtensilsCrossed className="h-5 w-5" /> : <Coffee className="h-5 w-5" />}
              </div>
              <div><div className="font-semibold capitalize">{business?.business_type} mode</div><div className="text-xs text-muted-foreground">Your current workspace</div></div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" className="w-full" data-testid="switch-type-btn">Switch to {isResto ? "Cafe" : "Restaurant"}</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Change business type?</AlertDialogTitle>
                  <AlertDialogDescription>This switches your entire workspace to {isResto ? "Cafe" : "Restaurant"} mode. Your data stays intact, but the layout and features will change.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={switchType} className="bg-[#08090C]" data-testid="confirm-switch-btn">Yes, switch</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>

          <Card title="Help">
            <Button variant="outline" className="w-full" onClick={retakeTour} data-testid="retake-tour-btn"><PlayCircle className="h-4 w-4 mr-1.5" /> Take a tour again</Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
