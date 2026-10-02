import React, { useState } from "react";
import { BrandLogo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Check, Menu as MenuIcon, X, MonitorSmartphone,
  Code2, Settings2, Send, Mail, Phone, Cpu, Store, UtensilsCrossed,
} from "lucide-react";

const CONTACT_EMAIL = "hello@avero.live";

const FEATURES = [
  {
    icon: MonitorSmartphone,
    title: "Built for your hardware",
    desc: "We design the software around your exact POS terminal, customer display or business device.",
  },
  {
    icon: Code2,
    title: "Custom software",
    desc: "Your workflow, your screens and your requirements — not a generic one-size-fits-all product.",
  },
  {
    icon: Settings2,
    title: "Custom setup",
    desc: "We handle the interface, device behaviour and deployment requirements for your setup.",
  },
  {
    icon: Cpu,
    title: "Hardware-focused",
    desc: "From customer displays to POS terminals, Avero solutions are designed for real hardware.",
  },
];

const STEPS = [
  ["01", "Tell us what you need", "Share your business, hardware and the workflow you want to build."],
  ["02", "We design the solution", "Avero creates the software experience around your exact requirements."],
  ["03", "We deliver your solution", "You receive a custom-built solution designed for your hardware and use case."],
];

const Landing = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const subject = `Avero Custom Order — ${form.get("business") || "New enquiry"}`;
    const body = [
      `Name: ${form.get("name") || ""}`,
      `Business: ${form.get("business") || ""}`,
      `Email: ${form.get("email") || ""}`,
      `Phone: ${form.get("phone") || ""}`,
      `Device / Hardware: ${form.get("hardware") || ""}`,
      "",
      "Requirements:",
      form.get("requirements") || "",
    ].join("\n");

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-[#08090C]">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <nav className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <a href="#top" aria-label="Avero home">
            <BrandLogo size={32} textClass="text-lg" />
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <button onClick={() => scrollTo("solutions")} className="hover:text-[#08090C]">Solutions</button>
            <button onClick={() => scrollTo("process")} className="hover:text-[#08090C]">How it works</button>
            <button onClick={() => scrollTo("about")} className="hover:text-[#08090C]">About</button>
          </div>

          <Button
            onClick={() => scrollTo("custom-order")}
            className="hidden md:inline-flex bg-[#08090C] hover:bg-[#08090C]/90 text-white rounded-full px-5"
          >
            Custom Order <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>

          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </nav>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 px-5 py-4 space-y-3 bg-white">
            <button onClick={() => scrollTo("solutions")} className="block w-full text-left text-sm font-medium text-slate-700">Solutions</button>
            <button onClick={() => scrollTo("process")} className="block w-full text-left text-sm font-medium text-slate-700">How it works</button>
            <button onClick={() => scrollTo("about")} className="block w-full text-left text-sm font-medium text-slate-700">About</button>
            <Button onClick={() => scrollTo("custom-order")} className="w-full bg-[#08090C] text-white rounded-full">
              Custom Order
            </Button>
          </div>
        )}
      </header>

      {/* Hero */}
      <main id="top">
        <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-20 sm:pt-28 pb-20">
          <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.16em] uppercase bg-slate-100 px-3 py-2 rounded-full">
                Custom software for real hardware
              </span>

              <h1 className="mt-7 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.04em] leading-[0.98]">
                Software built
                <br />
                <span className="text-[#B8FF00]">around your device.</span>
              </h1>

              <p className="mt-7 text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
                Avero creates custom POS and customer-display software for businesses
                that need a solution made for their exact hardware and workflow.
              </p>

              <div className="flex flex-wrap gap-3 mt-9">
                <Button
                  onClick={() => scrollTo("custom-order")}
                  className="bg-[#08090C] hover:bg-[#08090C]/90 text-white rounded-full px-7 h-12 text-base"
                >
                  Request a Custom Order <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => scrollTo("solutions")}
                  className="rounded-full px-7 h-12 text-base border-slate-300"
                >
                  See what we build
                </Button>
              </div>
            </div>

            <div className="rounded-[2rem] bg-[#08090C] p-6 sm:p-8 shadow-2xl">
              <div className="rounded-2xl bg-white overflow-hidden">
                <div className="h-10 border-b border-slate-200 flex items-center px-4 gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="ml-auto text-[10px] font-mono text-slate-400">AVERO CUSTOM SOLUTION</span>
                </div>
                <div className="p-7 sm:p-9">
                  <div className="text-xs uppercase tracking-widest text-slate-400">Customer Display</div>
                  <div className="mt-3 text-3xl font-bold">Your order</div>
                  <div className="mt-7 space-y-4">
                    {[
                      ["Cappuccino × 2", "₹360"],
                      ["Veg Sandwich × 1", "₹220"],
                      ["French Fries × 1", "₹140"],
                    ].map(([name, price]) => (
                      <div key={name} className="flex justify-between text-sm">
                        <span>{name}</span>
                        <span className="font-semibold">{price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 pt-5 border-t border-slate-200 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-extrabold">₹720</span>
                  </div>
                  <div className="mt-6 rounded-xl bg-[#B8FF00] text-center py-3 font-semibold">
                    Please pay ₹720
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solutions */}
        <section id="solutions" className="border-y border-slate-100 bg-[#F7F7F5]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">What Avero builds</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
                One solution, designed around your requirements.
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                You provide the hardware and the business requirement. Avero builds the
                software experience around it.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="h-11 w-11 rounded-xl bg-[#08090C] flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-[#B8FF00]" />
                  </div>
                  <h3 className="mt-5 font-bold text-lg">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid md:grid-cols-2 gap-5">
              <div className="rounded-2xl bg-[#08090C] text-white p-7">
                <MonitorSmartphone className="h-7 w-7 text-[#B8FF00]" />
                <h3 className="mt-5 text-xl font-bold">POS & customer displays</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Custom interfaces for terminals, secondary displays and customer-facing screens.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-7">
                <Store className="h-7 w-7" />
                <h3 className="mt-5 text-xl font-bold">Business-specific workflows</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Cafe, restaurant, retail or another use case — the software follows your workflow.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Example */}
        <section id="about" className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Example</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
                Have a specific device? We can design for it.
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed">
                For example, Avero can create a dedicated customer-facing experience
                for a 10.1-inch POS display. The final software is designed around the
                device's screen, touch interaction and the business's order flow.
              </p>

              <div className="mt-7 space-y-3">
                {[
                  "Device-specific screen layout",
                  "Custom order and payment screens",
                  "Business branding",
                  "Custom workflow and integrations",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-medium">
                    <span className="h-6 w-6 rounded-full bg-[#B8FF00] flex items-center justify-center">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-[#F7F7F5] p-8">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-[#08090C] flex items-center justify-center">
                  <MonitorSmartphone className="h-7 w-7 text-[#B8FF00]" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-400">Avero solution</div>
                  <div className="text-xl font-bold mt-1">Custom Customer Display</div>
                </div>
              </div>
              <div className="mt-8 aspect-[16/10] rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <div className="text-center px-6">
                  <div className="text-xs text-slate-400 uppercase tracking-widest">Designed for your hardware</div>
                  <div className="mt-3 text-2xl font-bold">Your brand. Your workflow.</div>
                  <div className="mt-2 text-sm text-slate-500">Built by Avero.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Process */}
        <section id="process" className="bg-[#08090C] text-white">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Simple process</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">From requirement to software.</h2>

            <div className="grid md:grid-cols-3 gap-8 mt-12">
              {STEPS.map(([number, title, desc]) => (
                <div key={number} className="border-t border-slate-700 pt-6">
                  <div className="text-[#B8FF00] font-mono font-bold text-2xl">{number}</div>
                  <h3 className="mt-4 text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Custom Order */}
        <section id="custom-order" className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20">
          <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Start a project</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Request a custom order.</h2>
              <p className="mt-5 text-slate-600 leading-relaxed">
                Tell us about your device and what you want the software to do.
                There are no fixed plans here — every project is quoted according to its requirements.
              </p>

              <div className="mt-8 space-y-4 text-sm">
                <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 hover:underline">
                  <span className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center"><Mail className="h-4 w-4" /></span>
                  {CONTACT_EMAIL}
                </a>
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center"><Phone className="h-4 w-4" /></span>
                  Contact details can be provided directly with your enquiry.
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 p-6 sm:p-8 bg-white shadow-sm">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Your name" name="name" required />
                <Field label="Business name" name="business" required />
                <Field label="Email" name="email" type="email" required />
                <Field label="Phone" name="phone" type="tel" />
              </div>
              <Field label="Device / hardware" name="hardware" placeholder="e.g. HP ElitePOS 10.1 Customer Display" required />
              <label className="block mt-4">
                <span className="text-sm font-medium">What do you need?</span>
                <textarea
                  name="requirements"
                  required
                  rows={6}
                  placeholder="Tell us about the software, screens, workflow, integrations or other requirements."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#B8FF00] resize-none"
                />
              </label>

              <Button type="submit" className="w-full mt-5 h-12 rounded-full bg-[#08090C] text-white">
                <Send className="h-4 w-4 mr-2" />
                Send Custom Order
              </Button>

              {submitted && (
                <p className="mt-3 text-center text-sm text-slate-500">
                  Your email app should open with the enquiry prepared. Send it to complete the request.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-[#F7F7F5]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo size={30} textClass="text-lg" />
          <p className="text-xs text-slate-500">© 2026 Avero. Custom software solutions.</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm font-medium hover:underline">{CONTACT_EMAIL}</a>
        </div>
      </footer>
    </div>
  );
};

const Field = ({ label, name, type = "text", placeholder, required = false }) => (
  <label className="block mt-4 first:mt-0">
    <span className="text-sm font-medium">{label}{required ? " *" : ""}</span>
    <input
      name={name}
      type={type}
      required={required}
      placeholder={placeholder}
      className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-[#B8FF00]"
    />
  </label>
);

export default Landing;
