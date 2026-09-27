import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import api from "@/lib/api";
import { formatApiError } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post("/auth/forgot-password", { email }); } catch { /* generic */ }
    setSent(true); setLoading(false);
  };

  return (
    <AuthShell title="Forgot password?" subtitle="We'll send a reset link to your email."
      footer={<Link to="/login" className="font-semibold text-[#08090C] hover:underline">Back to sign in</Link>}>
      {sent ? (
        <div className="rounded-xl border border-slate-200 bg-[#F5F6F7] p-6 text-sm text-slate-700" data-testid="forgot-success">
          If that email is registered, a reset link has been sent. Please check your inbox.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" className="mt-1.5" data-testid="forgot-email-input" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#08090C] text-white h-11 rounded-lg" data-testid="forgot-submit-btn">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPassword;
