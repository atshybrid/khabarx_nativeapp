import { fetchMemberships } from '@/services/memberships';
import type { MembershipRecord } from '@/types/memberships';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface MembershipFilters {
  status?: string;
  level?: string;
  designationId?: string;
  cellId?: string;
  userId?: string;
  hrcCountryId?: string;
  hrcStateId?: string;
  hrcDistrictId?: string;
  hrcMandalId?: string;
  search?: string;
}

interface UseAdminMembershipsOptions {
  initialFilters?: MembershipFilters;
  pageSize?: number;
  autoLoad?: boolean;
  debounceMs?: number;
}

interface UseAdminMembershipsResult {
  data: MembershipRecord[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  hasMore: boolean;
  filters: MembershipFilters;
  setFilters: (updater: (prev: MembershipFilters) => MembershipFilters) => void;
  resetFilters: () => void;
  loadMore: () => void;
  refresh: () => void;
  reload: () => void;
}

// Simple debounce hook (local to reduce dependencies). If we add more, can reuse existing one.
function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useAdminMemberships(options: UseAdminMembershipsOptions = {}): UseAdminMembershipsResult {
  const { initialFilters, pageSize = 20, autoLoad = true, debounceMs = 300 } = options;
  const [filters, setFiltersState] = useState<MembershipFilters>(initialFilters || { status: 'ACTIVE' });
  const [data, setData] = useState<MembershipRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Debounce search separately to avoid reloading on each key stroke.
  const debouncedSearch = useDebouncedValue(filters.search, debounceMs);

  const effectiveFilters = { ...filters, search: debouncedSearch };

  const fetchPage = useCallback(async (reset: boolean) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMemberships({
        status: effectiveFilters.status || undefined,
        level: effectiveFilters.level || undefined,
        designationId: effectiveFilters.designationId || undefined,
        cellId: effectiveFilters.cellId || undefined,
        userId: effectiveFilters.userId || undefined,
        hrcCountryId: effectiveFilters.hrcCountryId || undefined,
        hrcStateId: effectiveFilters.hrcStateId || undefined,
        hrcDistrictId: effectiveFilters.hrcDistrictId || undefined,
        hrcMandalId: effectiveFilters.hrcMandalId || undefined,
        search: effectiveFilters.search || undefined,
        limit: pageSize,
        cursor: reset ? undefined : cursor || undefined,
      });
      if (!mountedRef.current) return;
      setData(prev => {
        const merged = reset ? payload.data : [...prev, ...payload.data];
        const seen = new Set<string>();
        return merged.filter(item => {
          const id = (item as any).id;
          if (!id) return true; // keep items without id (shouldn't happen)
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      });
      setCursor(payload.nextCursor || null);
      setHasMore(Boolean(payload.nextCursor));
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || 'Failed to load memberships');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        if (reset) setRefreshing(false);
      }
    }
  }, [effectiveFilters.status, effectiveFilters.level, effectiveFilters.designationId, effectiveFilters.cellId, effectiveFilters.userId, effectiveFilters.hrcCountryId, effectiveFilters.hrcStateId, effectiveFilters.hrcDistrictId, effectiveFilters.hrcMandalId, effectiveFilters.search, pageSize, cursor, loading]);

  // Auto initial load
  // Initial load (respect autoLoad). fetchPage is stable but include dependencies per lint.
  useEffect(() => { if (autoLoad) fetchPage(true); }, [autoLoad, fetchPage]);

  // React to filter changes (excluding cursor)
  // Reload when effective (debounced) filters change.
  useEffect(() => { fetchPage(true); }, [fetchPage, effectiveFilters.status, effectiveFilters.level, effectiveFilters.designationId, effectiveFilters.cellId, effectiveFilters.userId, effectiveFilters.hrcCountryId, effectiveFilters.hrcStateId, effectiveFilters.hrcDistrictId, effectiveFilters.hrcMandalId, effectiveFilters.search]);

  const setFilters = useCallback((updater: (prev: MembershipFilters) => MembershipFilters) => {
    setFiltersState(prev => updater({ ...prev }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({ status: '', level: '', designationId: '', cellId: '', userId: '', hrcCountryId: '', hrcStateId: '', hrcDistrictId: '', hrcMandalId: '', search: '' });
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchPage(false);
  }, [hasMore, loading, fetchPage]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchPage(true);
  }, [fetchPage]);

  const reload = useCallback(() => fetchPage(true), [fetchPage]);

  return {
    data,
    loading,
    error,
    refreshing,
    hasMore,
    filters: filters,
    setFilters,
    resetFilters,
    loadMore,
    refresh,
    reload,
  };
}
