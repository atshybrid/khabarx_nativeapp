import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTokens } from './auth';
import { HttpError, request } from './http';

// Base prefix for HRCI cases API
const BASE = '/hrci/cases';

export type HrciCasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type HrciCaseStatus = 'NEW' | 'TRIAGED' | 'IN_PROGRESS' | 'LEGAL_REVIEW' | 'ACTION_TAKEN' | 'RESOLVED' | 'REJECTED' | 'CLOSED' | 'ESCALATED';

export interface HrciCasesListParams {
  status?: HrciCaseStatus;
  priority?: HrciCasePriority;
  limit?: number;
  cursor?: string;
}

export interface HrciCasesListResponse {
  success?: boolean;
  count: number;
  nextCursor: string | null;
  data: HrciCaseSummary[];
  counts: Record<HrciCaseStatus, number>;
  scope: 'MINE' | 'ALL' | string;
}

export interface CreateHrciCasePayload {
  title: string;
  description: string;
  incidentAt: string; // ISO timestamp
  latitude: number;
  longitude: number;
  address: string;
  category: string; // category code
  priority: HrciCasePriority;
}

export interface HrciCaseSummary {
  id: string;
  caseNumber: string;
  title: string;
  status: HrciCaseStatus;
  priority: HrciCasePriority | string;
  createdAt: string;
}

export interface HrciCaseDetails extends HrciCaseSummary {
  description?: string;
  incidentAt?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  category?: string;
  visibility?: 'PRIVATE' | 'PUBLIC' | string;
}

// Legal advice types
export type HrciLegalStatus = 'REQUIRED' | 'NOT_REQUIRED' | 'REVIEW' | 'FOLLOW_UP' | 'REFERRED' | string;
export interface HrciCaseLegalUpdatePayload {
  legalStatus: HrciLegalStatus;
  legalSuggestion: string; // up to 5000 chars
}

export interface HrciCaseCategoryNode {
  code: string;
  name: string;
  children?: HrciCaseCategoryNode[];
}

export interface HrciCaseTimelineEntry<T = any> {
  id: string;
  type: string;
  data?: T;
  actorUserId?: string;
  createdAt: string;
}

// Summary response for dashboard counts
export type HrciCasesSummary = {
  open?: number;
  pending?: number;
  closed?: number;
  rejected?: number;
  total: number;
  breakdown: Record<string, number>; // keys like NEW, IN_PROGRESS, etc.
};

export async function canCreateHrciCase(): Promise<{ allowed: boolean; reason?: string } > {
  try {
    const t = await loadTokens();
    const roleUC = (t?.user?.role || '').toString().trim().toUpperCase();
    if (!t?.jwt) return { allowed: false, reason: 'Not authenticated' };
    const ok = roleUC === 'MEMBER' || roleUC === 'HRCI_ADMIN';
    return ok ? { allowed: true } : { allowed: false, reason: 'Only Member or HRCI Admin can create cases' };
  } catch {
    return { allowed: false, reason: 'Auth check failed' };
  }
}

export async function createHrciCase(payload: CreateHrciCasePayload): Promise<HrciCaseDetails> {
  // POST /hrci/cases -> 201 { success, data: {...} }
  try {
    const res = await request<{ success?: boolean; data: any }>(`${BASE}`, { method: 'POST', body: payload });
    const data = (res as any)?.data ?? res;
    if (!data) throw new Error('Invalid create case response');
    return normalizeCaseDetails(data);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const status = err instanceof HttpError ? err.status : 0;
    const looksPending = msg.includes('pending') || msg.includes('not implemented') || status === 501;
    if (looksPending) {
      // Graceful fallback: synthesize a local case record so UI can proceed in dev/staging
      const mock = buildLocalMockCase(payload);
      await persistLocalCase(mock);
      return mockToDetails(mock);
    }
    throw err;
  }
}

export async function getMyHrciCases(): Promise<HrciCaseSummary[]> {
  // GET /hrci/cases/me -> { success, data: CaseSummary[] }
  const res = await request<{ success?: boolean; data?: any[] }>(`${BASE}/me`, { method: 'GET' });
  const items = ((res as any)?.data ?? []) as any[];
  const serverList = items.map(normalizeCaseSummary);
  const locals = await loadLocalCases();
  const localSummaries: HrciCaseSummary[] = locals.map(l => ({
    id: l.id,
    caseNumber: l.caseNumber,
    title: l.title,
    status: l.status as HrciCaseStatus,
    priority: l.priority as HrciCasePriority,
    createdAt: l.createdAt,
  }));
  // Merge local first so user sees immediate feedback
  return [...localSummaries, ...serverList];
}

export async function getHrciCasesPaginated(params: HrciCasesListParams = {}): Promise<HrciCasesListResponse> {
  // GET /hrci/cases/me with pagination
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.cursor) searchParams.set('cursor', params.cursor);
  
  const url = `${BASE}/me${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await request<HrciCasesListResponse>(url, { method: 'GET' });
  
  return {
    success: res.success ?? true,
    count: res.count || 0,
    nextCursor: res.nextCursor || null,
    data: (res.data || []).map(normalizeCaseSummary),
    counts: res.counts || {} as Record<HrciCaseStatus, number>,
    scope: res.scope || 'MINE',
  };
}

// GET /hrci/cases/legal -> paginated legal cases for LEGAL_SECRETARY (or admin scope)
export interface HrciLegalCasesListParams {
  status?: HrciCaseStatus;
  priority?: HrciCasePriority;
  search?: string;
  hrcStateId?: string;
  hrcDistrictId?: string;
  hrcMandalId?: string;
  limit?: number;
  cursor?: string;
}
export async function getLegalCasesPaginated(params: HrciLegalCasesListParams = {}): Promise<HrciCasesListResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.search) searchParams.set('search', params.search);
  if (params.hrcStateId) searchParams.set('hrcStateId', params.hrcStateId);
  if (params.hrcDistrictId) searchParams.set('hrcDistrictId', params.hrcDistrictId);
  if (params.hrcMandalId) searchParams.set('hrcMandalId', params.hrcMandalId);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.cursor) searchParams.set('cursor', params.cursor);

  const url = `${BASE}/legal${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await request<HrciCasesListResponse>(url, { method: 'GET' });
  return {
    success: res.success ?? true,
    count: res.count || 0,
    nextCursor: res.nextCursor || null,
    data: (res.data || []).map(normalizeCaseSummary),
    counts: res.counts || {} as Record<HrciCaseStatus, number>,
    scope: res.scope || 'ALL',
  };
}

// GET /hrci/cases/:id -> case details
export async function getHrciCaseById(id: string): Promise<HrciCaseDetails> {
  const res = await request<{ success?: boolean; data?: any }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'GET' });
  const data = (res as any)?.data ?? res;
  return normalizeCaseDetails(data);
}

// PATCH /hrci/cases/:id/legal -> update legal advice
export interface HrciCaseLegalUpdateResponse {
  id: string;
  caseNumber: string;
  legalStatus?: HrciLegalStatus;
  legalSuggestion?: string;
  updatedAt?: string;
}
export async function updateHrciCaseLegalAdvice(id: string, payload: HrciCaseLegalUpdatePayload): Promise<HrciCaseLegalUpdateResponse> {
  const res = await request<{ success?: boolean; data?: any }>(`${BASE}/${encodeURIComponent(id)}/legal`, {
    method: 'PATCH',
    body: payload as any,
  });
  const data = (res as any)?.data ?? res;
  return {
    id: String(data?.id || id),
    caseNumber: String(data?.caseNumber || ''),
    legalStatus: data?.legalStatus,
    legalSuggestion: data?.legalSuggestion,
    updatedAt: data?.updatedAt,
  };
}

export async function getHrciCaseCategories(): Promise<HrciCaseCategoryNode[]> {
  // GET /hrci/cases/categories -> { success, data: CategoryTree[] }
  const res = await request<{ success?: boolean; data?: any[] }>(`${BASE}/categories`, { method: 'GET' });
  const arr = ((res as any)?.data ?? []) as any[];
  return arr.map(normalizeCategoryNode);
}

export async function getHrciCaseTimeline(caseId: string): Promise<HrciCaseTimelineEntry[]> {
  const res = await request<{ success?: boolean; data?: any[] }>(`${BASE}/${encodeURIComponent(caseId)}/timeline`, { method: 'GET' });
  const arr = ((res as any)?.data ?? []) as any[];
  return arr.map((x) => ({
    id: String(x?.id || x?._id || ''),
    type: String(x?.type || ''),
    data: x?.data,
    actorUserId: x?.actorUserId || x?.userId,
    createdAt: String(x?.createdAt || new Date().toISOString()),
  }));
}

// GET /hrci/cases/summary -> { success, data: { open, pending, closed, rejected, total, breakdown: { NEW, IN_PROGRESS, ... } } }
export async function getHrciCasesSummary(): Promise<HrciCasesSummary> {
  const res = await request<{ success?: boolean; data?: any }>(`${BASE}/summary`, { method: 'GET' });
  const payload: any = (res as any)?.data ?? res;
  const breakdown: Record<string, number> = {};
  const src = payload?.breakdown && typeof payload.breakdown === 'object' ? payload.breakdown : {};
  for (const k of Object.keys(src)) {
    const key = String(k).toUpperCase();
    const val = Number((src as any)[k] ?? 0);
    breakdown[key] = isFinite(val) ? val : 0;
  }
  // Normalize top-level counters
  const toNum = (v: any) => { const n = Number(v ?? 0); return isFinite(n) ? n : 0; };
  const total: number = toNum(payload?.total);
  const out: HrciCasesSummary = {
    open: toNum(payload?.open),
    pending: toNum(payload?.pending),
    closed: toNum(payload?.closed),
    rejected: toNum(payload?.rejected),
    total: isFinite(total) && total >= 0 ? total : Object.values(breakdown).reduce((a, b) => a + (isFinite(b) ? b : 0), 0),
    breakdown,
  };
  return out;
}

export type HrciAttachment = {
  id: string;
  caseId: string;
  mediaId?: string;
  fileName: string;
  mime: string;
  size?: number;
  createdAt: string;
  url: string;
};

export async function uploadHrciCaseAttachment(
  caseId: string,
  file: { uri: string; name?: string; mime?: string },
  opts?: { mediaId?: string }
): Promise<HrciAttachment> {
  // POST /hrci/cases/:id/attachments  Content-Type: multipart/form-data
  // Body: file, mediaId (optional)
  const form = new FormData();
  const name = file.name || file.uri.split('/').pop() || `file_${Date.now()}`;
  const type = file.mime || 'application/octet-stream';
  (form as any).append('file', { uri: file.uri, name, type } as any);
  if (opts?.mediaId) (form as any).append('mediaId', opts.mediaId);
  const res = await request<{ success?: boolean; data?: any }>(`${BASE}/${encodeURIComponent(caseId)}/attachments`, {
    method: 'POST',
    body: form as any,
    headers: {},
  });
  const data = (res as any)?.data ?? res;
  // Normalize to HrciAttachment
  const out: HrciAttachment = {
    id: String(data?.id || ''),
    caseId: String(data?.caseId || caseId),
    mediaId: data?.mediaId ? String(data.mediaId) : undefined,
    fileName: String(data?.fileName || name),
    mime: String(data?.mime || type),
    size: typeof data?.size === 'number' ? data.size : undefined,
    createdAt: String(data?.createdAt || new Date().toISOString()),
    url: String(data?.url || ''),
  };
  return out;
}

function normalizeCaseSummary(x: any): HrciCaseSummary {
  return {
    id: String(x?.id || x?._id || ''),
    caseNumber: String(x?.caseNumber || ''),
    title: String(x?.title || ''),
    status: String(x?.status || 'NEW') as HrciCaseStatus,
    priority: String(x?.priority || 'MEDIUM') as HrciCasePriority,
    createdAt: String(x?.createdAt || new Date().toISOString()),
  };
}

function normalizeCaseDetails(x: any): HrciCaseDetails {
  const base = normalizeCaseSummary(x);
  return {
    ...base,
    description: x?.description,
    incidentAt: x?.incidentAt,
    latitude: toNum(x?.latitude),
    longitude: toNum(x?.longitude),
    address: x?.address,
    category: x?.category,
    visibility: x?.visibility || 'PRIVATE',
  };
}

function normalizeCategoryNode(x: any): HrciCaseCategoryNode {
  return {
    code: String(x?.code || x?.id || ''),
    name: String(x?.name || x?.title || ''),
    children: Array.isArray(x?.children) ? x.children.map(normalizeCategoryNode) : [],
  };
}

function toNum(v: any): number | undefined {
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

// ---------- Local mock helpers (dev fallback when create API is pending) ----------
type LocalCase = CreateHrciCasePayload & {
  id: string;
  caseNumber: string;
  createdAt: string;
  status: HrciCaseStatus;
};

const LOCAL_CASES_KEY = 'hrci:local:cases';

function buildLocalMockCase(p: CreateHrciCasePayload): LocalCase {
  const ts = Date.now();
  const id = `local_${ts}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  const caseNumber = `L-${new Date(ts).getFullYear()}-${rand}`;
  return {
    ...p,
    id,
    caseNumber,
    createdAt: new Date(ts).toISOString(),
    status: 'NEW',
  };
}

async function loadLocalCases(): Promise<LocalCase[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_CASES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function persistLocalCase(c: LocalCase): Promise<void> {
  const list = await loadLocalCases();
  list.unshift(c);
  try { await AsyncStorage.setItem(LOCAL_CASES_KEY, JSON.stringify(list)); } catch {}
}

function mockToDetails(c: LocalCase): HrciCaseDetails {
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    title: c.title,
    status: c.status,
    priority: c.priority,
    createdAt: c.createdAt,
    description: c.description,
    incidentAt: c.incidentAt,
    latitude: c.latitude,
    longitude: c.longitude,
    address: c.address,
    category: c.category,
    visibility: 'PRIVATE',
  };
}
