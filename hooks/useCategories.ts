import { CategoryItem, getCategories, getMockMode } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCategoriesResult {
  categories: CategoryItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastLoadedAt: number | null;
}

const CACHE_KEY = 'categories_cache_last_used_list';

export function useCategories(languageId?: string): UseCategoriesResult {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError(null);
    try {
      // Use cached categories if present for instant paint
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw && !categories.length) {
          const parsed = JSON.parse(raw) as CategoryItem[];
          if (Array.isArray(parsed)) setCategories(parsed);
        }
      } catch {}
      const list = await getCategories(languageId);
      if (list?.length) {
        setCategories(list);
        try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch {}
      } else if (!list?.length && (await getMockMode())) {
        // Provide mock placeholders if nothing returned in mock mode
        const mockList: CategoryItem[] = [
          { id: 'general', name: 'General' },
          { id: 'tech', name: 'Technology' },
          { id: 'sports', name: 'Sports' },
          { id: 'business', name: 'Business' },
        ];
        setCategories(mockList);
      }
      setLastLoadedAt(Date.now());
      console.log('[CATEGORIES] loaded', list?.length || 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load categories');
      console.warn('[CATEGORIES] load failed', e);
    } finally {
      inFlight.current = false; setLoading(false);
    }
  }, [languageId, categories.length]);

  useEffect(() => { load(); }, [load]);

  return {
    categories,
    loading,
    error,
    refresh: load,
    lastLoadedAt,
  };
}
