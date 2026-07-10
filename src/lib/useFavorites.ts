import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

export interface Favorite {
  id: number;
  date: string;
  section: string;
  content: string;
  created_at: number;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [todayFaved, setTodayFaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, todayRes] = await Promise.all([
        api.listFavorites(100),
        api.todayFavorites(),
      ]);
      setFavorites(listRes.favorites || []);
      setTodayFaved(new Set(todayRes.sections || []));
    } catch (err) {
      console.warn('useFavorites refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(async (date: string, section: string, content: string) => {
    const res = await api.toggleFavorite(date, section, content);
    // Optimistic update
    setTodayFaved(prev => {
      const next = new Set(prev);
      if (res.action === 'added') next.add(section);
      else next.delete(section);
      return next;
    });
    await refresh();
    return res;
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await api.deleteFavorite(id);
    await refresh();
  }, [refresh]);

  const isFavorited = useCallback((section: string) => todayFaved.has(section), [todayFaved]);

  return { favorites, todayFaved, loading, refresh, toggle, remove, isFavorited };
}