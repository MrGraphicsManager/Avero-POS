import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await login(email, password);
      toast.success("Welcome back!");
      navigate(user.role === "admin" ? "/admin" : "/app");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your Avero workspace."
      footer={<>Don't have an account? <Link to="/signup" className="font-semibold text-[#08090C] hover:underline">Get Started</Link></>}>
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" className="mt-1.5" data-testid="login-email-input" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-[#08090C]" data-testid="forgot-password-link">Forgot password?</Link>
          </div>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5" data-testid="login-password-input" />
        </div>
        {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full bg-[#08090C] text-white h-11 rounded-lg" data-testid="login-submit-btn">
          {loading ? "Signing in…" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default Login;
