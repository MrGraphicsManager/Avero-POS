import React from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/Logo";

// Split-screen auth shell: dark brand panel + form.
export const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen grid lg:grid-cols-2 bg-white">
    <div className="hidden lg:flex flex-col justify-between bg-[#08090C] text-white p-12 relative overflow-hidden avero-grain">
      <Link to="/"><BrandLogo size={34} dark textClass="text-xl" /></Link>
      <div className="relative z-10">
        <div className="h-1.5 w-16 bg-[#B8FF00] rounded-full mb-6" />
        <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight max-w-md">
          The operating system for modern cafes & restaurants.
        </h2>
        <p className="text-slate-400 mt-4 max-w-sm leading-relaxed">
          Orders, tables, billing, KOT, inventory and reports — all in one clean workspace built for your floor.
        </p>
        <div className="flex flex-wrap gap-2 mt-8">
          {["Orders", "KOT", "Billing", "Inventory", "Analytics"].map((t) => (
            <span key={t} className="text-xs font-mono px-3 py-1.5 rounded-full border border-slate-700 text-slate-300">{t}</span>
          ))}
        </div>
      </div>
      <div className="text-xs text-slate-500 relative z-10">© 2026 Avero. Free for cafes & restaurants until 15 Jan 2027.</div>
    </div>

    <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12">
      <div className="w-full max-w-sm mx-auto">
        <div className="lg:hidden mb-8"><Link to="/"><BrandLogo size={32} textClass="text-lg" /></Link></div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-sm text-center text-muted-foreground">{footer}</div>}
      </div>
    </div>
  </div>
);

export default AuthShell;
