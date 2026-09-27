import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import api from "@/lib/api";
import { formatApiError } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reset! Please log in.");
      navigate("/login");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password for your account."
      footer={<Link to="/login" className="font-semibold text-[#08090C] hover:underline">Back to sign in</Link>}>
      {!token ? (
        <p className="text-sm text-destructive" data-testid="reset-invalid">Invalid or missing reset link. Please request a new one.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="mt-1.5" data-testid="reset-password-input" />
          </div>
          {error && <p className="text-sm text-destructive" data-testid="reset-error">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-[#08090C] text-white h-11 rounded-lg" data-testid="reset-submit-btn">
            {loading ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
