import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const customerApi = axios.create({ baseURL: API, withCredentials: true });

customerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("avero_customer_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default customerApi;

export const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
