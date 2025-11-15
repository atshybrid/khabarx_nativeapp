import { request } from '@/services/http';

// Types for meta lists
export interface LevelMeta { id: string; code: string; name: string; }
export interface CellMeta { id: string; name: string; code?: string; level?: string; }
export interface DesignationMeta { id: string; name: string; code?: string; level?: string; }
export interface LocationMeta { id: string; name: string; type?: string; parentId?: string | null; }

// Each function attempts API call and falls back to static sample if fails.

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const data = await request<{ success?: boolean; data?: T }>(path);
    // Accept either wrapped {data} or raw
    const payload: any = (data as any);
    if (Array.isArray(payload)) return payload as T;
    return (payload?.data as T) || fallback;
  } catch (e) {
    return fallback;
  }
}

export async function fetchLevels(): Promise<LevelMeta[]> {
  return safeFetch('/memberships/meta/levels', [
    { id: 'NATIONAL', code: 'NAT', name: 'National' },
    { id: 'STATE', code: 'STA', name: 'State' },
    { id: 'DISTRICT', code: 'DST', name: 'District' },
    { id: 'ZONE', code: 'ZON', name: 'Zone' },
  ]);
}

export async function fetchCells(level?: string): Promise<CellMeta[]> {
  const qs = level ? `?level=${encodeURIComponent(level)}` : '';
  return safeFetch(`/memberships/meta/cells${qs}`, []);
}

export async function fetchDesignations(level?: string): Promise<DesignationMeta[]> {
  const qs = level ? `?level=${encodeURIComponent(level)}` : '';
  return safeFetch(`/memberships/meta/designations${qs}`, []);
}

export async function fetchLocations(level?: string): Promise<LocationMeta[]> {
  const qs = level ? `?level=${encodeURIComponent(level)}` : '';
  return safeFetch(`/memberships/meta/locations${qs}`, []);
}

// Hierarchical location endpoints (assumed). If actual endpoints differ, adjust paths.
export interface CountryMeta { id: string; name: string; code?: string }
export interface StateMeta { id: string; name: string; countryId: string }
export interface DistrictMeta { id: string; name: string; stateId: string }
export interface MandalMeta { id: string; name: string; districtId: string }

export async function fetchCountries(): Promise<CountryMeta[]> {
  return safeFetch('/hrc/countries', []);
}

export async function fetchStates(countryId?: string): Promise<StateMeta[]> {
  if (!countryId) return [];
  return safeFetch(`/hrc/states?countryId=${encodeURIComponent(countryId)}`, []);
}

export async function fetchDistricts(stateId?: string): Promise<DistrictMeta[]> {
  if (!stateId) return [];
  return safeFetch(`/hrc/districts?stateId=${encodeURIComponent(stateId)}`, []);
}

export async function fetchMandals(districtId?: string): Promise<MandalMeta[]> {
  if (!districtId) return [];
  return safeFetch(`/hrc/mandals?districtId=${encodeURIComponent(districtId)}`, []);
}
