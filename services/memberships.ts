import type { MembershipFilters, MembershipListResponse } from '@/types/memberships';
import { request } from './http';

function buildQuery(filters: MembershipFilters): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.status) params.set('status', filters.status);
  if (filters.level) params.set('level', filters.level);
  if (filters.cellId) params.set('cellId', filters.cellId);
  if (filters.designationId) params.set('designationId', filters.designationId);
  if (filters.hrcCountryId) params.set('hrcCountryId', filters.hrcCountryId);
  if (filters.hrcStateId) params.set('hrcStateId', filters.hrcStateId);
  if (filters.hrcDistrictId) {
    if (Array.isArray(filters.hrcDistrictId)) params.set('hrcDistrictId', filters.hrcDistrictId.join(','));
    else params.set('hrcDistrictId', String(filters.hrcDistrictId));
  }
  if (filters.hrcMandalId) params.set('hrcMandalId', filters.hrcMandalId);
  const search = (filters.search || '').trim();
  if (search) {
    // Some backends support generic `search`, others only `mobileNumber`.
    // Send both when the input is numeric to keep search working for mobile.
    params.set('search', search);
    if (/^\d+$/.test(search)) params.set('mobileNumber', search);
  }
  params.set('limit', String(filters.limit ?? 20));
  if (filters.cursor) params.set('cursor', filters.cursor);
  return params.toString();
}

export async function fetchMemberships(filters: MembershipFilters = {}): Promise<MembershipListResponse> {
  const qs = buildQuery(filters);
  return request<MembershipListResponse>(`/memberships/admin?${qs}`);
}
