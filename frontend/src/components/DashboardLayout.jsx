import React, { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { BrandLogo, LogoMark } from "@/components/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, ShoppingBag, Table2, BookOpen, ReceiptText, ChefHat, Boxes,
  Users, UserCog, Wallet, FileBarChart, LineChart, Settings, LogOut, Menu, MoreHorizontal,
} from "lucide-react";

const NAV = {
  common: [
    { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/app/orders", label: "Orders", icon: ShoppingBag },
    { to: "/app/tables", label: "Tables", icon: Table2 },
    { to: "/app/menu", label: "Menu", icon: BookOpen },
  ],
  restaurantOnly: [{ to: "/app/kot", label: "KOT", icon: ChefHat }],
  rest: [
    { to: "/app/billing", label: "Billing", icon: ReceiptText },
    { to: "/app/inventory", label: "Inventory", icon: Boxes },
    { to: "/app/customers", label: "Customers", icon: Users },
    { to: "/app/staff", label: "Staff", icon: UserCog },
    { to: "/app/expenses", label: "Expenses", icon: Wallet },
    { to: "/app/reports", label: "Reports", icon: FileBarChart },
    { to: "/app/analytics", label: "Analytics", icon: LineChart },
    { to: "/app/settings", label: "Settings", icon: Settings },
  ],
};

const buildNav = (type) => {
  const menu = [...NAV.common];
  // KOT sits after Menu for restaurant
  if (type === "restaurant") menu.push(...NAV.restaurantOnly);
  return [...menu, ...NAV.rest];
};

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-all ${
    isActive
      ? "bg-[#B8FF00] text-[#08090C] font-semibold shadow-[0_0_15px_rgba(184,255,0,0.25)]"
      : "text-slate-400 hover:text-white hover:bg-white/5"
  }`;

const NavList = ({ items, onNav }) => (
  <nav className="flex flex-col gap-1">
    {items.map((it) => (
      <NavLink key={it.to} to={it.to} end={it.end} className={linkClass} onClick={onNav} data-testid={`nav-${it.label.toLowerCase()}`}>
        <it.icon className="h-[18px] w-[18px] shrink-0" /> {it.label}
      </NavLink>
    ))}
  </nav>
);

const MOBILE = {
  cafe: [
    { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/app/orders", label: "Orders", icon: ShoppingBag },
    { to: "/app/tables", label: "Tables", icon: Table2 },
    { to: "/app/billing", label: "Billing", icon: ReceiptText },
  ],
  restaurant: [
    { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/app/orders", label: "Orders", icon: ShoppingBag },
    { to: "/app/kot", label: "KOT", icon: ChefHat },
    { to: "/app/tables", label: "Tables", icon: Table2 },
  ],
};

export const DashboardLayout = () => {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const type = business?.business_type || "cafe";
  const items = buildNav(type);
  const initials = (user?.name || "A").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const typeBadge = type === "restaurant"
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : "bg-amber-500/15 text-amber-300 border-amber-500/30";

  const SidebarInner = ({ onNav }) => (
    <div className="flex flex-col h-full bg-[#08090C] text-white">
      <div className="p-4 border-b border-white/5">
        <BrandLogo size={30} dark textClass="text-lg" />
        <div className="mt-3 flex items-center gap-2">
          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-md border ${typeBadge}`} data-testid="workspace-type-badge">
            {type === "restaurant" ? "Restaurant" : "Cafe"} workspace
          </span>
        </div>
        <div className="mt-3 text-sm font-semibold truncate">{business?.business_name || "Your business"}</div>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar p-3">
        <NavList items={items} onNav={onNav} />
      </div>
      <div className="p-3 border-t border-white/5">
        <button onClick={logout} className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/5 w-full" data-testid="sidebar-logout">
          <LogOut className="h-[18px] w-[18px]" /> Log out
        </button>
      </div>
    </div>
  );

  const moreItems = items.filter((i) => !MOBILE[type].some((m) => m.to === i.to));

  return (
    <div className="min-h-screen bg-[#F5F6F7] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0"><SidebarInner /></aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <button className="lg:hidden p-2 -ml-2" data-testid="mobile-sidebar-trigger"><Menu className="h-5 w-5" /></button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 border-0"><SidebarInner onNav={() => {}} /></SheetContent>
            </Sheet>
            <div className="lg:hidden"><LogoMark size={28} /></div>
            <div className="hidden sm:block">
              <div className="text-xs text-muted-foreground">Welcome back</div>
              <div className="text-sm font-semibold">{user?.name}</div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2" data-testid="user-menu-trigger">
                <Avatar className="h-9 w-9"><AvatarFallback className="bg-[#08090C] text-[#B8FF00] text-xs font-bold">{initials}</AvatarFallback></Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="font-semibold">{user?.name}</div>
                <div className="text-xs text-muted-foreground font-normal truncate">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/app/settings")} data-testid="menu-settings">
                <Settings className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                <LogOut className="h-4 w-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#08090C] border-t border-white/10 grid grid-cols-5" data-testid="mobile-bottom-nav">
        {MOBILE[type].map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[10px] ${isActive ? "text-[#B8FF00]" : "text-slate-400"}`}
            data-testid={`bottomnav-${it.label.toLowerCase()}`}>
            <it.icon className="h-5 w-5" /> {it.label}
          </NavLink>
        ))}
        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-slate-400" data-testid="bottomnav-more"><MoreHorizontal className="h-5 w-5" /> More</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="mb-2 w-48">
            {moreItems.map((it) => (
              <DropdownMenuItem key={it.to} onClick={() => { navigate(it.to); setMoreOpen(false); }}>
                <it.icon className="h-4 w-4 mr-2" /> {it.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default DashboardLayout;
