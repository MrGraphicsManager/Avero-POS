import React from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const TONE = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  lime: "bg-[#B8FF00] text-[#08090C] border-[#B8FF00]",
};

const STATUS_TONE = {
  available: "green", vacant: "green", paid: "green", completed: "green", ready: "green", active: "green", served: "blue",
  occupied: "red", cancelled: "red", pending: "amber", reserved: "amber", new: "amber", preparing: "blue", accepted: "blue",
  cleaning: "purple", served_kot: "purple", inactive: "slate",
};

export const StatusBadge = ({ status, tone }) => {
  const key = (status || "").toLowerCase();
  const t = tone || STATUS_TONE[key] || "slate";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${TONE[t]}`} data-testid={`status-${key}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{status}
    </span>
  );
};

export const StatCard = ({ label, value, icon: Icon, accent, hint }) => (
  <div className={`rounded-xl p-5 border transition-shadow hover:shadow-md ${accent ? "bg-[#08090C] border-[#08090C] text-white" : "bg-white border-slate-200"}`} data-testid={`stat-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
    <div className="flex items-center justify-between">
      <span className={`text-xs font-medium ${accent ? "text-slate-400" : "text-muted-foreground"}`}>{label}</span>
      {Icon && <Icon className={`h-4 w-4 ${accent ? "text-[#B8FF00]" : "text-slate-400"}`} />}
    </div>
    <div className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight mt-2 ${accent ? "text-white" : "text-slate-900"}`}>{value}</div>
    {hint && <div className={`text-xs mt-1 ${accent ? "text-slate-500" : "text-muted-foreground"}`}>{hint}</div>}
  </div>
);

export const SearchBox = ({ value, onChange, placeholder = "Search…", className = "" }) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" data-testid="search-input" />
  </div>
);

export const Card = ({ title, action, children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4">
        {title && <h3 className="font-semibold tracking-tight">{title}</h3>}
        {action}
      </div>
    )}
    {children}
  </div>
);
