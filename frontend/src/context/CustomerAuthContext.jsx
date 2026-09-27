import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import customerApi from "@/lib/customerApi";

const CustomerAuthContext = createContext(null);

export const CustomerAuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null); // null=checking, false=guest
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("avero_customer_token");
    if (!token) { setCustomer(false); setLoading(false); return; }
    try {
      const { data } = await customerApi.get("/customer/me");
      setCustomer(data);
    } catch { setCustomer(false); localStorage.removeItem("avero_customer_token"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { data } = await customerApi.post("/customer/login", { email, password });
    localStorage.setItem("avero_customer_token", data.token);
    setCustomer(data.customer);
    return data.customer;
  };
  const register = async (body) => {
    const { data } = await customerApi.post("/customer/register", body);
    localStorage.setItem("avero_customer_token", data.token);
    setCustomer(data.customer);
    return data.customer;
  };
  const logout = async () => {
    try { await customerApi.post("/customer/logout"); } catch { /* noop */ }
    localStorage.removeItem("avero_customer_token");
    setCustomer(false);
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, login, register, logout, refresh }}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => useContext(CustomerAuthContext);
