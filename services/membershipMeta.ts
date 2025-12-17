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
  // Use HRCI cells endpoint (limit to 50 active cells). The backend currently
  // doesn't accept level as a query param for this route, so ignore `level`.
  return safeFetch(`/hrci/cells?isActive=true&limit=50`, []);
}

export async function fetchDesignations(level?: string): Promise<DesignationMeta[]> {
  // Fetch designations via HRCI endpoint (limit to 100). Level-specific filtering
  // may be applied client-side if needed later.
  return safeFetch(`/hrci/designations?limit=100`, []);
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
  // Keep in sync with services/hrciGeo.ts
  return safeFetch('/hrci/geo/countries', []);
}

export async function fetchStates(countryId?: string): Promise<StateMeta[]> {
  if (!countryId) return [];
  return safeFetch(`/hrci/geo/states?countryId=${encodeURIComponent(countryId)}`, []);
}

export async function fetchDistricts(stateId?: string): Promise<DistrictMeta[]> {
  if (!stateId) return [];
  return safeFetch(`/hrci/geo/districts?stateId=${encodeURIComponent(stateId)}`, []);
}

export async function fetchMandals(districtId?: string): Promise<MandalMeta[]> {
  if (!districtId) return [];
  return safeFetch(`/hrci/geo/mandals?districtId=${encodeURIComponent(districtId)}`, []);
}
