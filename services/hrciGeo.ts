import { request } from '@/services/http';

export type HrcCountry = { id: string; name: string; code?: string };
export type HrcState = { id: string; name: string; code?: string; countryId?: string };
export type HrcDistrict = { id: string; name: string; stateId?: string };
export type HrcMandal = { id: string; name: string; districtId?: string };

export async function getCountries(): Promise<HrcCountry[]> {
  const res = await request<any>(`/hrci/geo/countries`);
  const data = Array.isArray(res) ? res : (res?.data || []);
  return (data || []).map((x: any) => ({ id: x.id, name: x.name, code: x.code })) as HrcCountry[];
}

export async function getStates(countryId: string): Promise<HrcState[]> {
  const res = await request<any>(`/hrci/geo/states?countryId=${encodeURIComponent(countryId)}`);
  const data = Array.isArray(res) ? res : (res?.data || []);
  return (data || []).map((x: any) => ({ id: x.id, name: x.name, code: x.code, countryId })) as HrcState[];
}

export async function getDistricts(stateId: string): Promise<HrcDistrict[]> {
  const res = await request<any>(`/hrci/geo/districts?stateId=${encodeURIComponent(stateId)}`);
  const data = Array.isArray(res) ? res : (res?.data || []);
  return (data || []).map((x: any) => ({ id: x.id, name: x.name, stateId })) as HrcDistrict[];
}

export async function getMandals(districtId: string): Promise<HrcMandal[]> {
  const res = await request<any>(`/hrci/geo/mandals?districtId=${encodeURIComponent(districtId)}`);
  const data = Array.isArray(res) ? res : (res?.data || []);
  return (data || []).map((x: any) => ({ id: x.id, name: x.name, districtId })) as HrcMandal[];
}

export async function createAdminMandal(payload: { districtId: string; name: string }): Promise<HrcMandal> {
  const res = await request<any>(`/hrci/geo/admin/mandals`, { method: 'POST', body: payload });
  const data = (res?.data ?? res) as any;
  return { id: data.id, name: data.name, districtId: data.districtId } as HrcMandal;
}
