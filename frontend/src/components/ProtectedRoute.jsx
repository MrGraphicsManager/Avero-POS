import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogoMark } from "@/components/Logo";

const FullLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background" data-testid="app-loader">
    <div className="animate-pulse"><LogoMark size={48} /></div>
    <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
      <div className="h-full w-1/2 bg-[#B8FF00] animate-[fade-up_1s_ease-in-out_infinite]" />
    </div>
  </div>
);

export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, business, loading } = useAuth();
  const location = useLocation();

  if (loading || user === null) return <FullLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly) {
    if (user.role !== "admin") return <Navigate to="/app" replace />;
    return children;
  }
  // merchant routes: require completed onboarding
  const onDashboard = location.pathname.startsWith("/app");
  if (onDashboard && (!business || !business.onboarding_completed)) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
};

export default ProtectedRoute;
