import React, { useEffect, useState } from "react";

// Countdown to a fixed IST end instant. Always computed from a target ISO string.
const useCountdown = (targetIso) => {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, ended: diff <= 0 };
};

const pad = (n) => String(n).padStart(2, "0");

export const CountdownTimer = ({ targetIso, variant = "desktop", className = "" }) => {
  const { days, hours, minutes, seconds, ended } = useCountdown(targetIso);
  if (ended) return null;

  if (variant === "mobile") {
    return (
      <span className={`font-mono font-semibold tabular-nums ${className}`} data-testid="countdown-mobile">
        {pad(days)}d {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
      </span>
    );
  }

  const Block = ({ v, label }) => (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-mono font-bold tabular-nums">{pad(v)}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
    </span>
  );

  return (
    <span className={`inline-flex items-center gap-2 font-mono ${className}`} data-testid="countdown-desktop">
      <Block v={days} label="Days" /> <span className="opacity-40">:</span>
      <Block v={hours} label="Hrs" /> <span className="opacity-40">:</span>
      <Block v={minutes} label="Min" /> <span className="opacity-40">:</span>
      <Block v={seconds} label="Sec" />
    </span>
  );
};

export default CountdownTimer;
