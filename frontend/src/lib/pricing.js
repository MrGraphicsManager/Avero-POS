import { useEffect, useState } from "react";
import api from "@/lib/api";

// Server-authoritative pricing + launch status. Never trusts browser clock for the flag.
export const usePricing = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/pricing").then((r) => setData(r.data)).catch(() => setData(null));
  }, []);
  return data;
};
