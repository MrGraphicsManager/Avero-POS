import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);       // null=checking, false=guest, obj=user
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setBusiness(data.business || null);
    } catch {
      setUser(false);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.access_token) localStorage.setItem("avero_token", data.access_token);
    await refresh();
    return data.user;
  };

  const signup = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    if (data.access_token) localStorage.setItem("avero_token", data.access_token);
    await refresh();
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    localStorage.removeItem("avero_token");
    setUser(false);
    setBusiness(null);
  };

  const setBiz = (b) => setBusiness(b);

  return (
    <AuthContext.Provider value={{ user, business, loading, login, signup, logout, refresh, setBusiness: setBiz }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
