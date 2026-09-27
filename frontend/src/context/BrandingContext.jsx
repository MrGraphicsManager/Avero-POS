import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BrandingContext = createContext({ hasCustom: false, version: 0, logoUrl: null, reload: () => {} });

export const BrandingProvider = ({ children }) => {
  const [state, setState] = useState({ hasCustom: false, version: 0, logoUrl: null });

  const reload = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/branding`);
      const hasCustom = !!data.has_custom_logo;
      const version = data.logo_version || 0;
      setState({ hasCustom, version, logoUrl: hasCustom ? `${API}/branding/logo?v=${version}` : null });
    } catch {
      setState({ hasCustom: false, version: 0, logoUrl: null });
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // keep favicon in sync with custom logo
  useEffect(() => {
    if (!state.hasCustom || !state.logoUrl) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = state.logoUrl;
  }, [state.hasCustom, state.logoUrl]);

  return <BrandingContext.Provider value={{ ...state, reload }}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);
