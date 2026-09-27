import React from "react";
import { useBranding } from "@/context/BrandingContext";

// Official Avero lockups (transparent PNG/WebP). Light = black wordmark, Dark = white wordmark.
// Admins can override these site-wide from the admin panel.
const LIGHT_SRC = "/avero-logo-light.webp";
const DARK_SRC = "/avero-logo-dark.webp";

export const LogoMark = ({ size = 34, className = "" }) => {
  const { hasCustom, logoUrl } = useBranding();
  const src = hasCustom && logoUrl ? logoUrl : LIGHT_SRC;
  return (
    <span className={`inline-flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }} aria-hidden>
      <img src={src} alt="" style={{ height: size, width: "auto", display: "block", objectPosition: "left" }} />
    </span>
  );
};

export const Wordmark = ({ dark = false, className = "" }) => (
  <span className={`font-extrabold tracking-tight ${className}`} style={{ color: dark ? "#FFFFFF" : "#08090C", letterSpacing: "-0.03em" }}>
    Avero
  </span>
);

export const BrandLogo = ({ size = 34, dark = false, className = "" }) => {
  const { hasCustom, logoUrl } = useBranding();
  const src = hasCustom && logoUrl ? logoUrl : (dark ? DARK_SRC : LIGHT_SRC);
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img src={src} alt="Avero" style={{ height: Math.round(size * 1.35), width: "auto", maxWidth: 210, objectFit: "contain" }} className="select-none" />
    </span>
  );
};

export const Logo = BrandLogo;
export default BrandLogo;
