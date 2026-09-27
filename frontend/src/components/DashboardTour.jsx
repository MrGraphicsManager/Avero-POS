import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, ShoppingBag, Table2, ReceiptText, Boxes, Users, FileBarChart, Settings, ChefHat,
} from "lucide-react";

const STEPS = [
  { icon: LayoutDashboard, title: "Dashboard", desc: "See your business performance at a glance." },
  { icon: ShoppingBag, title: "Orders", desc: "Create and manage customer orders." },
  { icon: Table2, title: "Tables", desc: "Manage available, occupied and reserved tables." },
  { icon: ChefHat, title: "KOT", desc: "Send tickets to the kitchen and track every dish.", restaurantOnly: true },
  { icon: ReceiptText, title: "Billing", desc: "Create bills and record payments." },
  { icon: Boxes, title: "Inventory", desc: "Track stock and receive low-stock alerts." },
  { icon: Users, title: "Customers", desc: "Manage customer information and order history." },
  { icon: FileBarChart, title: "Reports", desc: "Understand sales, expenses and business performance." },
  { icon: Settings, title: "Settings", desc: "Manage your business, staff and preferences." },
];

export const DashboardTour = ({ onClose }) => {
  const { business, refresh } = useAuth();
  const steps = STEPS.filter((s) => !s.restaurantOnly || business?.business_type === "restaurant");
  const [i, setI] = useState(0);
  const last = i === steps.length - 1;
  const s = steps[i];

  const complete = async (finished) => {
    try { await api.post("/onboarding", { dashboard_tour_completed: finished }); await refresh(); } catch { /* noop */ }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="dashboard-tour">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 animate-fade-up">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-muted-foreground">Step {i + 1} of {steps.length}</span>
          <button onClick={() => complete(false)} className="text-xs text-muted-foreground hover:text-[#08090C]" data-testid="tour-skip-btn">Skip tour</button>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-6">
          <div className="h-full bg-[#B8FF00] transition-all duration-300" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="h-14 w-14 rounded-2xl bg-[#08090C] flex items-center justify-center mb-4"><s.icon className="h-7 w-7 text-[#B8FF00]" /></div>
        <h3 className="text-xl font-bold tracking-tight" data-testid="tour-step-title">{s.title}</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.desc}</p>
        <div className="flex items-center justify-between mt-7">
          <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
          {last ? (
            <Button className="bg-[#B8FF00] hover:bg-[#a5e600] text-[#08090C] font-semibold rounded-full px-6" onClick={() => complete(true)} data-testid="tour-finish-btn">Finish</Button>
          ) : (
            <Button className="bg-[#08090C] text-white rounded-full px-6" onClick={() => setI(i + 1)} data-testid="tour-next-btn">Next</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardTour;
