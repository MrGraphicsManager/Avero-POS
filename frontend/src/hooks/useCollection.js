import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

// Lightweight CRUD hook for a business-scoped collection.
export const useCollection = (path) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get(`/${path}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e);
    } finally { setLoading(false); }
  }, [path]);

  useEffect(() => { load(); }, [load]);

  const create = async (body) => {
    const { data } = await api.post(`/${path}`, body);
    await load();
    return data;
  };
  const update = async (id, body) => {
    const { data } = await api.put(`/${path}/${id}`, body);
    await load();
    return data;
  };
  const remove = async (id) => {
    await api.delete(`/${path}/${id}`);
    await load();
  };

  return { items, loading, error, reload: load, create, update, remove };
};
