import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signup(form.name, form.email, form.password);
      toast.success("Account created! Let's set up your business.");
      navigate("/onboarding");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start free — no card required during launch."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-[#08090C] hover:underline">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <div>
          <Label htmlFor="name">Owner name</Label>
          <Input id="name" required value={form.name} onChange={set("name")} placeholder="Aarav Sharma" className="mt-1.5" data-testid="signup-name-input" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={set("email")} placeholder="you@business.com" className="mt-1.5" data-testid="signup-email-input" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={6} value={form.password} onChange={set("password")} placeholder="At least 6 characters" className="mt-1.5" data-testid="signup-password-input" />
        </div>
        {error && <p className="text-sm text-destructive" data-testid="signup-error">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full bg-[#B8FF00] hover:bg-[#a5e600] text-[#08090C] font-semibold h-11 rounded-lg" data-testid="signup-submit-btn">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default Signup;
