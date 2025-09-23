import { getNews } from '@/services/api';
import {
    fetchPreferences,
    getCachedPreferences,
    LocationPreference,
    PreferenceRecord,
    updateLanguage as svcUpdateLanguage,
    updateLocation as svcUpdateLocation,
    updatePushToken as svcUpdatePushToken,
    updateAll,
} from '@/services/preferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook to manage preferences lifecycle
 * - Loads cached then remote
 * - Provides targeted update helpers
 * - Triggers optional news cache refresh on successful changes
 */
export function usePreferences() {
  const [prefs, setPrefs] = useState<PreferenceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Initial load (cache first, then remote)
  useEffect(() => {
    (async () => {
      const cached = await getCachedPreferences();
      if (cached) setPrefs(cached);
      try {
        const fresh = await fetchPreferences();
        if (fresh) setPrefs(fresh);
      } catch (e: any) {
        setError(e?.message || 'Failed to fetch preferences');
      }
    })();
  }, []);

  const refreshNewsCache = useCallback(async (languageId?: string | null) => {
    try {
      // Re-fetch first page to refresh local offline news cache logic (uses its own key)
      const lang = languageId || prefs?.languageId || 'en';
      await getNews(lang);
    } catch {}
  }, [prefs?.languageId]);

  const safeRun = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setLoading(true); setError(null);
    try {
      const res = await fn();
      return res;
    } catch (e: any) {
      setError(e?.message || 'Update failed');
      return null;
    } finally {
      inFlight.current = false; setLoading(false);
    }
  }, []);

  const updatePushToken = useCallback(async (pushToken: string | null) => {
    const res = await safeRun(() => svcUpdatePushToken(pushToken));
    if (res) setPrefs(res);
    return res;
  }, [safeRun]);

  const updateLanguage = useCallback(async (languageId: string | null) => {
    const res = await safeRun(() => svcUpdateLanguage(languageId));
    if (res) {
      setPrefs(res);
      await refreshNewsCache(languageId); // refresh news cache after language change
      await AsyncStorage.setItem('selectedLanguage', JSON.stringify({ id: languageId }));
    }
    return res;
  }, [safeRun, refreshNewsCache]);

  const updateLocation = useCallback(async (location: LocationPreference | null) => {
    const res = await safeRun(() => svcUpdateLocation(location));
    if (res) setPrefs(res);
    return res;
  }, [safeRun]);

  const updateMultiple = useCallback(async (opts: { pushToken?: string | null; languageId?: string | null; location?: LocationPreference | null }) => {
    const res = await safeRun(() => updateAll(opts));
    if (res) {
      setPrefs(res);
      if (opts.languageId) await refreshNewsCache(opts.languageId);
      if (opts.languageId) await AsyncStorage.setItem('selectedLanguage', JSON.stringify({ id: opts.languageId }));
    }
    return res;
  }, [safeRun, refreshNewsCache]);

  return {
    prefs,
    loading,
    error,
    updatePushToken,
    updateLanguage,
    updateLocation,
    updateMultiple,
    refetch: async () => {
      const fresh = await fetchPreferences();
      if (fresh) setPrefs(fresh);
      return fresh;
    },
  };
}

export type { LocationPreference, PreferenceRecord };

