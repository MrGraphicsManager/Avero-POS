import React from "react";

// Exact supplied Avero logo asset. The symbol is cropped from the official lockup; do not redesign.
const LOGO_SRC = "/avero-logo.webp";

export const LogoMark = ({ size = 34, className = "" }) => (
  <span
    className={`inline-flex items-center justify-center overflow-hidden shrink-0 ${className}`}
    style={{ width: size, height: size, borderRadius: size * 0.26, background: "#08090C" }}
    aria-hidden
  >
    <img src={LOGO_SRC} alt="" style={{ height: size, width: "auto", display: "block", objectPosition: "left" }} />
  </span>
);

export const Wordmark = ({ dark = false, className = "" }) => (
  <span
    className={`font-extrabold tracking-tight ${className}`}
    style={{ color: dark ? "#FFFFFF" : "#08090C", letterSpacing: "-0.03em" }}
  >
    Avero
  </span>
);

export const BrandLogo = ({ size = 34, dark = false, className = "", textClass = "text-xl" }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark size={size} />
    <Wordmark dark={dark} className={textClass} />
  </span>
);

export const Logo = BrandLogo;
export default BrandLogo;
