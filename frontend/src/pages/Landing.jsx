import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/Logo";
import { CountdownTimer } from "@/components/CountdownTimer";
import { DashboardPreview } from "@/components/DashboardPreview";
import { usePricing } from "@/lib/pricing";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Coffee, UtensilsCrossed, ArrowRight, Check, Menu as MenuIcon, X,
  LayoutGrid, ReceiptText, Boxes, Users, BarChart3, ChefHat, Table2, Sparkles,
} from "lucide-react";

const NAV = ["Product", "Solutions", "Features", "Pricing", "Resources"];

const FEATURES = [
  { icon: LayoutGrid, title: "Orders & Tables", desc: "Take orders, manage table status and turn tables faster with a live floor view." },
  { icon: ReceiptText, title: "Billing & Payments", desc: "Generate GST-ready bills, accept Cash / UPI / Card and print or download receipts." },
  { icon: ChefHat, title: "KOT & Kitchen", desc: "Send tickets straight to the kitchen and track every dish from fire to served." },
  { icon: Boxes, title: "Inventory", desc: "Track stock, set low-stock alerts and keep ingredients and menu items in sync." },
  { icon: Users, title: "Customers & Staff", desc: "Build customer history, manage staff roles and control who can do what." },
  { icon: BarChart3, title: "Reports & Analytics", desc: "See sales, expenses and net profit with clean, decision-ready charts." },
];

const FAQS = [
  ["What is Avero?", "Avero is an all-in-one hospitality operating system that helps cafes and restaurants manage orders, tables, billing, menu, inventory, customers, staff and reports from one place."],
  ["Is Avero free during launch?", "Yes. Every cafe and restaurant gets full access to all merchant features for free until 15 January 2027."],
  ["Which businesses can use Avero?", "Avero is built for cafes and restaurants. You choose your business type during onboarding and get a workspace tailored to it."],
  ["What is the difference between Cafe and Restaurant mode?", "Cafe mode is optimised for fast service, quick billing and everyday cafe operations. Restaurant mode adds a dedicated KOT and kitchen workflow for dine-in, takeaway and delivery."],
  ["When does the free offer end?", "The launch offer ends on 15 January 2027 at 23:59:59 IST."],
  ["What happens after 15 January 2027?", "Avero automatically switches to regular pricing. There's nothing you need to do — the transition is handled server-side."],
  ["Can I change my business type?", "Yes. You can switch between Cafe and Restaurant from Settings. Changing type asks for confirmation because it changes your workspace."],
  ["Can multiple staff members use Avero?", "Absolutely. Add your team with roles like Manager, Cashier, Waiter and Kitchen Staff, each with the right permissions."],
];

const Section = ({ id, children, className = "" }) => (
  <section id={id} className={`px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto ${className}`}>{children}</section>
);

const Landing = () => {
  const navigate = useNavigate();
  const pricing = usePricing();
  const [menuOpen, setMenuOpen] = useState(false);
  const launchActive = pricing?.launch_active;
  const cfg = pricing?.config;
  const endIso = pricing?.launch_end_iso;

  const plans = cfg ? [
    { name: "Monthly", price: cfg.monthly, period: "/month" },
    { name: "3 Months", price: cfg.threeMonth, period: "/3 months" },
    { name: "6 Months", price: cfg.sixMonth, period: "/6 months" },
    { name: "Yearly", price: cfg.yearly, period: "/year", badge: "Best Value" },
  ] : [];

  return (
    <div className="min-h-screen bg-white text-[#08090C]">
      {/* Announcement bar */}
      {launchActive && endIso && (
        <div className="bg-[#08090C] text-white text-center text-xs sm:text-sm py-2 px-4" data-testid="announcement-bar">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            <span className="hidden sm:inline">🎉 {cfg?.announcement}</span>
            <span className="sm:hidden font-medium">Free until 15 Jan 2027</span>
            <span className="opacity-50 hidden sm:inline">·</span>
            <span className="opacity-70 hidden md:inline">Ends in:</span>
            <span className="hidden sm:inline"><CountdownTimer targetIso={endIso} variant="desktop" className="text-[#B8FF00]" /></span>
            <span className="sm:hidden"><CountdownTimer targetIso={endIso} variant="mobile" className="text-[#B8FF00]" /></span>
          </div>
        </div>
      )}

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-100">
        <nav className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <BrandLogo size={32} textClass="text-lg" />
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            {NAV.map((n) => (
              <a key={n} href={`#${n.toLowerCase()}`} className="hover:text-[#08090C] transition-colors" data-testid={`nav-${n.toLowerCase()}`}>{n}</a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/login")} data-testid="nav-login-btn">Login</Button>
            <Button className="bg-[#08090C] hover:bg-[#08090C]/90 text-white rounded-full px-5" onClick={() => navigate("/signup")} data-testid="nav-get-started-btn">Get Started</Button>
          </div>
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} data-testid="mobile-menu-btn" aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </nav>
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 px-5 py-4 space-y-3 bg-white" data-testid="mobile-menu">
            {NAV.map((n) => <a key={n} href={`#${n.toLowerCase()}`} onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-slate-700">{n}</a>)}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/login")}>Login</Button>
              <Button className="flex-1 bg-[#08090C] text-white" onClick={() => navigate("/signup")}>Get Started</Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <Section className="pt-14 sm:pt-20 pb-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-up">
            {launchActive && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold font-mono bg-[#B8FF00] text-[#08090C] px-3 py-1.5 rounded-full mb-6" data-testid="hero-launch-badge">
                <Sparkles className="h-3.5 w-3.5" /> FREE UNTIL 15 JANUARY 2027
              </span>
            )}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Run your cafe or restaurant, <span className="text-transparent bg-clip-text" style={{ WebkitTextStroke: "0px", backgroundImage: "linear-gradient(90deg,#08090C,#08090C)" }}>your way.</span>
            </h1>
            <span className="block h-1 w-24 bg-[#B8FF00] rounded-full mt-4" />
            <p className="text-base sm:text-lg text-slate-600 mt-6 max-w-xl leading-relaxed">
              Avero gives your business the tools to manage orders, billing, tables, inventory, customers and daily operations from one simple platform.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Button className="bg-[#B8FF00] hover:bg-[#a5e600] text-[#08090C] font-semibold rounded-full px-7 h-12 text-base" onClick={() => navigate("/signup")} data-testid="hero-start-free-btn">
                Start Free <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
              <Button variant="outline" className="rounded-full px-7 h-12 text-base border-slate-300" onClick={() => document.getElementById("features")?.scrollIntoView()} data-testid="hero-explore-btn">
                Explore Avero
              </Button>
            </div>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <DashboardPreview />
          </div>
        </div>
      </Section>

      {/* Business types */}
      <Section id="solutions" className="py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Built for your business.</h2>
          <p className="text-slate-600 mt-2">Two dedicated workspaces. One platform.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <BusinessCard
            icon={Coffee} tone="amber" title="Cafe"
            desc="Built for fast service, tables, orders and everyday cafe operations."
            features={["Quick billing", "Table & order flow", "Menu & add-ons", "Inventory alerts"]}
            onClick={() => navigate("/signup")}
          />
          <BusinessCard
            icon={UtensilsCrossed} tone="emerald" title="Restaurant"
            desc="Built for orders, KOT, kitchen operations and restaurant management."
            features={["KOT & kitchen board", "Dine-in / Takeaway / Delivery", "Table occupancy", "Ingredient inventory"]}
            onClick={() => navigate("/signup")}
          />
        </div>
      </Section>

      {/* Features */}
      <Section id="features" className="py-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Everything you need to run the floor.</h2>
          <p className="text-slate-600 mt-2">From the first order to the closing report — Avero keeps your day organised.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow bg-white" data-testid={`feature-${f.title.split(" ")[0].toLowerCase()}`}>
              <div className="h-11 w-11 rounded-xl bg-[#08090C] flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-[#B8FF00]" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section id="product" className="py-16">
        <div className="rounded-3xl bg-[#08090C] text-white p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-8">How Avero works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              ["01", "Sign up & choose", "Create your account and pick Cafe or Restaurant. We tailor the workspace to you."],
              ["02", "Set up in minutes", "Add your menu, tables and staff. Import as you go — no long setup required."],
              ["03", "Run your day", "Take orders, bill customers, track stock and watch your numbers in real time."],
            ].map(([n, t, d]) => (
              <div key={n}>
                <div className="text-[#B8FF00] font-mono font-bold text-2xl mb-2">{n}</div>
                <h3 className="font-semibold text-lg">{t}</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing" className="py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Simple, honest pricing.</h2>
          <p className="text-slate-600 mt-2">{launchActive ? "Everything is free during our launch period." : "Choose the plan that fits your business."}</p>
        </div>

        {launchActive ? (
          <div className="max-w-lg mx-auto rounded-3xl border-2 border-[#B8FF00] bg-white p-8 text-center shadow-lg" data-testid="pricing-launch-card">
            <span className="text-xs font-bold font-mono bg-[#B8FF00] text-[#08090C] px-3 py-1 rounded-full">LAUNCH OFFER</span>
            <div className="text-6xl font-extrabold font-mono mt-6">₹0</div>
            <p className="text-slate-600 mt-2">Free until 15 January 2027</p>
            {endIso && <div className="mt-4 text-sm"><CountdownTimer targetIso={endIso} variant="desktop" /></div>}
            <div className="grid grid-cols-2 gap-2 text-left text-sm mt-6">
              {["Orders", "Tables", "Billing", "Menu", "Inventory", "Customers", "Staff", "Expenses", "Reports", "Analytics"].map((f) => (
                <div key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#08090C]" /> {f}</div>
              ))}
            </div>
            <Button className="w-full mt-7 bg-[#08090C] text-white rounded-full h-12" onClick={() => navigate("/signup")} data-testid="pricing-start-free-btn">Start Free</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" data-testid="pricing-regular-grid">
            {plans.map((p) => (
              <div key={p.name} className={`rounded-2xl border p-6 bg-white relative ${p.badge ? "border-[#B8FF00] border-2 shadow-lg" : "border-slate-200"}`}>
                {p.badge && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold font-mono bg-[#B8FF00] text-[#08090C] px-3 py-1 rounded-full">{p.badge}</span>}
                <div className="text-sm font-semibold text-slate-500">{p.name}</div>
                <div className="text-3xl font-extrabold font-mono mt-2">{inr(p.price)}</div>
                <div className="text-xs text-slate-500">{p.period}</div>
                <Button className="w-full mt-5 bg-[#08090C] text-white rounded-full" onClick={() => navigate("/signup")}>Choose {p.name}</Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* FAQ */}
      <Section id="resources" className="py-16 max-w-3xl">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-center mb-10">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map(([q, a], i) => (
            <AccordionItem key={i} value={`item-${i}`} data-testid={`faq-${i}`}>
              <AccordionTrigger className="text-left font-semibold">{q}</AccordionTrigger>
              <AccordionContent className="text-slate-600 leading-relaxed">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      {/* Final CTA */}
      <Section className="py-16">
        <div className="rounded-3xl bg-[#B8FF00] p-10 sm:p-14 text-center relative overflow-hidden">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#08090C]">Ready to run your business, your way?</h2>
          <p className="text-[#08090C]/70 mt-3 max-w-xl mx-auto">Join Avero free during launch. Set up your cafe or restaurant in minutes.</p>
          <Button className="mt-7 bg-[#08090C] text-white rounded-full h-12 px-8 text-base" onClick={() => navigate("/signup")} data-testid="cta-start-free-btn">
            Start Free <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-[#F5F6F7]">
        <Section className="py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2">
              <BrandLogo size={30} textClass="text-lg" />
              <p className="text-sm text-slate-500 mt-3 max-w-xs">The all-in-one hospitality operating system for cafes and restaurants.</p>
            </div>
            <FooterCol title="Product" items={["Features", "Pricing", "Solutions"]} />
            <FooterCol title="Company" items={["About", "Contact"]} />
            <FooterCol title="Resources" items={["Help", "Documentation", "FAQ"]} />
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500">
            <span>© 2026 Avero. All rights reserved.</span>
            <div className="flex gap-5">
              <a href="#" className="hover:text-[#08090C]">Privacy</a>
              <a href="#" className="hover:text-[#08090C]">Terms</a>
            </div>
          </div>
        </Section>
      </footer>
    </div>
  );
};

const BusinessCard = ({ icon: Icon, title, desc, features, tone, onClick }) => {
  const tones = { amber: "text-amber-600 bg-amber-50", emerald: "text-emerald-600 bg-emerald-50" };
  return (
    <div className="rounded-2xl border border-slate-200 p-7 bg-white hover:shadow-lg transition-shadow group" data-testid={`business-card-${title.toLowerCase()}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${tones[tone]}`}><Icon className="h-6 w-6" /></div>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      </div>
      <p className="text-slate-600 leading-relaxed">{desc}</p>
      <div className="grid grid-cols-2 gap-2 mt-5 text-sm">
        {features.map((f) => <div key={f} className="flex items-center gap-2 text-slate-700"><Check className="h-4 w-4 text-[#08090C]" /> {f}</div>)}
      </div>
      <Button variant="outline" className="mt-6 rounded-full border-slate-300 group-hover:border-[#08090C]" onClick={onClick}>
        Start with {title} <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
};

const FooterCol = ({ title, items }) => (
  <div>
    <div className="text-sm font-semibold mb-3">{title}</div>
    <ul className="space-y-2 text-sm text-slate-500">
      {items.map((i) => <li key={i}><a href="#" className="hover:text-[#08090C]">{i}</a></li>)}
    </ul>
  </div>
);

export default Landing;
