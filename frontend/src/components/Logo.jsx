import React from "react";
import { useBranding } from "@/context/BrandingContext";

// Default supplied Avero logo asset. Admins can override this site-wide from the admin panel.
const LOGO_SRC = "/avero-logo.webp";

export const LogoMark = ({ size = 34, className = "" }) => {
  const { hasCustom, logoUrl } = useBranding();
  if (hasCustom && logoUrl) {
    return (
      <span className={`inline-flex items-center justify-center overflow-hidden shrink-0 bg-white ${className}`}
        style={{ width: size, height: size, borderRadius: size * 0.22 }} aria-hidden>
        <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: size * 0.08 }} />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.26, background: "#08090C" }} aria-hidden>
      <img src={LOGO_SRC} alt="" style={{ height: size, width: "auto", display: "block", objectPosition: "left" }} />
    </span>
  );
};

export const Wordmark = ({ dark = false, className = "" }) => (
  <span className={`font-extrabold tracking-tight ${className}`} style={{ color: dark ? "#FFFFFF" : "#08090C", letterSpacing: "-0.03em" }}>
    Avero
  </span>
);

export const BrandLogo = ({ size = 34, dark = false, className = "", textClass = "text-xl" }) => {
  const { hasCustom, logoUrl } = useBranding();
  if (hasCustom && logoUrl) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <img src={logoUrl} alt="Logo" style={{ height: Math.round(size * 1.15), width: "auto", maxWidth: 200, objectFit: "contain" }} className="select-none" />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <Wordmark dark={dark} className={textClass} />
    </span>
  );
};

export const Logo = BrandLogo;
export default BrandLogo;
