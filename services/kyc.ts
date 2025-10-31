import { uploadMedia } from './api';
import { request } from './http';

// Debug flag for verbose KYC logs
const DEBUG_KYC = (() => {
  const raw = String(process.env.EXPO_PUBLIC_KYC_DEBUG ?? process.env.EXPO_PUBLIC_HTTP_DEBUG ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();

// Helpers to safely log without exposing sensitive info
function maskAadhaar(v?: string) {
  if (!v) return v;
  const digits = v.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const tail = digits.slice(-4);
  return `****-****-${tail}`;
}
function maskPAN(v?: string) {
  if (!v) return v;
  const s = v.toUpperCase();
  if (s.length < 5) return '*****';
  return `${s.slice(0,3)}**${s.slice(-1)}`;
}
function fileNameFromUrl(u?: string) {
  if (!u) return u;
  try {
    const url = new URL(u);
    const p = url.pathname || '';
    const name = p.split('/')?.pop();
    return name || u;
  } catch {
    const i = u.lastIndexOf('/');
    return i >= 0 ? u.slice(i + 1) : u;
  }
}

export type KYCStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NOT_STARTED';

export type KYCData = {
  id?: string;
  membershipId: string;
  aadhaarNumber: string;
  aadhaarFrontUrl: string;
  aadhaarBackUrl: string;
  panNumber: string;
  panCardUrl: string;
  status?: KYCStatus;
  submittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
};

// Server may return a full KYC record at /memberships/kyc/me
export type KYCRecord = {
  id: string;
  membershipId: string;
  aadhaarNumber?: string;
  aadhaarFrontUrl?: string;
  aadhaarBackUrl?: string;
  panNumber?: string;
  panCardUrl?: string;
  llbRegistrationNumber?: string;
  llbSupportDocUrl?: string;
  status?: string; // backend may return APPROVED/REJECTED/PENDING etc.
  createdAt?: string;
  updatedAt?: string;
};

export type KYCStatusResponse = {
  success: boolean;
  data: {
    kycCompleted: boolean;
    status: KYCStatus;
    kycData?: KYCData | KYCRecord;
  };
};

export type KYCSubmissionResponse = {
  success: boolean;
  data: {
    id: string;
    status: KYCStatus;
    message: string;
  };
};

// Include optional legal secretary fields in submission payload
// Client-side submission payload for /memberships/kyc/me (membership inferred from auth)
export type KYCSubmissionPayload = {
  aadhaarNumber: string;
  aadhaarFrontUrl: string;
  aadhaarBackUrl: string;
  panNumber: string;
  panCardUrl: string;
  llbRegistrationNumber?: string;
  llbSupportDocUrl?: string;
};

/**
 * Get KYC status for the current member
 */
export async function getKYCStatus(): Promise<KYCStatusResponse['data']> {
  if (DEBUG_KYC) {
    try { console.log('[KYC][GET] /memberships/kyc/me – fetching status'); } catch {}
  }
  // New contract: GET /memberships/kyc/me returns full record or 404 if not started
  try {
    const res = await request<{ success?: boolean; data?: KYCRecord } & { status?: any; hasKyc?: boolean }>('/memberships/kyc/me' as any, {
      method: 'GET'
    });
    const outer = res as any; // may contain { success, data, status, hasKyc }
    const innerOrOuter = outer?.data ?? outer; // inner record if present, else raw
    const raw = innerOrOuter?.data ?? innerOrOuter; // normalize nested data shapes
    // Helper to normalize server status values
    const normalize = (s: any): KYCStatus => {
      const st = String(s || '').toUpperCase();
      if (st === 'APPROVED' || st === 'VERIFIED') return 'VERIFIED';
      if (st === 'REJECTED') return 'REJECTED';
      if (st === 'PENDING' || st === 'SUBMITTED') return 'PENDING';
      if (st === 'NOT_SUBMITTED' || st === 'NOT_STARTED' || st === 'NONE' || st === 'FALSE') return 'NOT_STARTED';
      return 'NOT_STARTED';
    };
    const topStatusNorm = normalize((outer as any)?.status);
    const hasKyc = Boolean((outer as any)?.hasKyc);
    // If API returns success with data: null at outer level, prefer top-level status
    if ((outer as any)?.success === true && (outer as any)?.data === null) {
      if (DEBUG_KYC) { try { console.log('[KYC][GET] status (top-level only):', topStatusNorm); } catch {} }
      return { kycCompleted: topStatusNorm === 'VERIFIED', status: topStatusNorm };
    }
    if (!raw || !raw.id) {
      // If the server sent a top-level status even without a record id, respect it
      if (DEBUG_KYC) { try { console.log('[KYC][GET] status (no record id):', topStatusNorm); } catch {} }
      return { kycCompleted: topStatusNorm === 'VERIFIED', status: topStatusNorm };
    }
    const rawStatus = (raw as any)?.status;
    let mapped = rawStatus ? normalize(rawStatus) : (topStatusNorm || (hasKyc ? 'PENDING' as KYCStatus : 'NOT_STARTED' as KYCStatus));
    // If raw maps to NOT_STARTED but top-level indicates progress or hasKyc=true, prefer the more informative state
    if (mapped === 'NOT_STARTED') {
      if (topStatusNorm && topStatusNorm !== 'NOT_STARTED') mapped = topStatusNorm;
      else if (hasKyc) mapped = 'PENDING';
    }
    if (DEBUG_KYC) {
      try {
        console.log('[KYC][GET] status (record):', {
          id: raw?.id,
          statusRaw: (raw as any)?.status,
          statusTop: (outer as any)?.status,
          chosen: mapped,
          updatedAt: (raw as any)?.updatedAt
        });
      } catch {}
    }
    return {
      kycCompleted: mapped === 'VERIFIED',
      status: mapped,
      kycData: raw,
    };
  } catch (e: any) {
    const status = e?.status || e?.response?.status;
    if (DEBUG_KYC) {
      try { console.warn('[KYC][GET] failed:', status, e?.message || e); } catch {}
    }
    // Treat 404 as no KYC started yet
    if (String(status) === '404') {
      return { kycCompleted: false, status: 'NOT_STARTED' };
    }
    throw e;
  }
}

/**
 * Submit KYC documents for verification
 */
export async function submitKYC(payload: KYCSubmissionPayload): Promise<KYCSubmissionResponse['data']> {
  // Correct endpoint: submit for the current member
  if (DEBUG_KYC) {
    try {
      console.log('[KYC][POST] /memberships/kyc/me – payload', {
        aadhaarNumber: maskAadhaar(payload?.aadhaarNumber),
        aadhaarFront: fileNameFromUrl(payload?.aadhaarFrontUrl),
        aadhaarBack: fileNameFromUrl(payload?.aadhaarBackUrl),
        panNumber: maskPAN(payload?.panNumber),
        panCard: fileNameFromUrl(payload?.panCardUrl),
        hasLLB: Boolean(payload?.llbRegistrationNumber || payload?.llbSupportDocUrl),
      });
    } catch {}
  }
  const res = await request<KYCSubmissionResponse>('/memberships/kyc/me' as any, {
    method: 'POST',
    body: payload
  });
  const out = (res as any).data || (res as any);
  if (DEBUG_KYC) {
    try { console.log('[KYC][POST] response:', { status: out?.status, id: out?.id || out?.data?.id }); } catch {}
  }
  return out;
}

/**
 * Upload document image
 */
export async function uploadKYCDocument(
  file: { uri: string; type?: string; name?: string },
  documentType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'llb_support'
): Promise<{ url: string }> {
  if (DEBUG_KYC) {
    try { console.log('[KYC][UPLOAD] start', { documentType, name: file?.name, uri: file?.uri?.slice(0, 60) + '...' }); } catch {}
  }
  // Use the central media upload API, then return the URL for inclusion in /memberships/kyc payload
  const uploaded = await uploadMedia({ uri: file.uri, type: 'image', name: file.name || `${documentType}_${Date.now()}.jpg`, folder: 'kyc' });
  if (DEBUG_KYC) {
    try { console.log('[KYC][UPLOAD] done', { documentType, url: fileNameFromUrl(uploaded?.url) }); } catch {}
  }
  return { url: uploaded.url };
}

// Convenience: upload all KYC docs via media API and submit in one shot
export async function submitKYCWithMedia(input: {
  aadhaarNumber: string;
  aadhaarFront: { uri: string; name?: string };
  aadhaarBack: { uri: string; name?: string };
  panNumber: string;
  panCard: { uri: string; name?: string };
  llbRegistrationNumber?: string;
  llbSupportDoc?: { uri: string; name?: string };
}) {
  if (DEBUG_KYC) {
    try {
      console.log('[KYC][PIPELINE] submitKYCWithMedia → uploading all', {
        aadhaarNumber: maskAadhaar(input?.aadhaarNumber),
        panNumber: maskPAN(input?.panNumber),
        hasLLB: Boolean(input?.llbRegistrationNumber || input?.llbSupportDoc),
      });
    } catch {}
  }
  const [front, back, pan, llb] = await Promise.all([
    uploadMedia({ uri: input.aadhaarFront.uri, type: 'image', name: input.aadhaarFront.name || `aadhaar_front_${Date.now()}.jpg`, folder: 'kyc' }),
    uploadMedia({ uri: input.aadhaarBack.uri, type: 'image', name: input.aadhaarBack.name || `aadhaar_back_${Date.now()}.jpg`, folder: 'kyc' }),
    uploadMedia({ uri: input.panCard.uri, type: 'image', name: input.panCard.name || `pan_card_${Date.now()}.jpg`, folder: 'kyc' }),
    input.llbSupportDoc ? uploadMedia({ uri: input.llbSupportDoc.uri, type: 'image', name: input.llbSupportDoc.name || `llb_doc_${Date.now()}.jpg`, folder: 'kyc' }) : Promise.resolve(null as any),
  ]);

  const payload: KYCSubmissionPayload = {
    // Keep Aadhaar formatting (server sample shows hyphenated value)
    aadhaarNumber: input.aadhaarNumber,
    aadhaarFrontUrl: front.url,
    aadhaarBackUrl: back.url,
    panNumber: input.panNumber,
    panCardUrl: pan.url,
    ...(input.llbRegistrationNumber ? { llbRegistrationNumber: input.llbRegistrationNumber } : {}),
    ...(llb ? { llbSupportDocUrl: llb.url } : {}),
  };

  const res = await submitKYC(payload);
  if (DEBUG_KYC) {
    try { console.log('[KYC][PIPELINE] completed with status:', res?.status); } catch {}
  }
  return res;
}

// =============================
// Admin KYC APIs
// =============================

export type AdminKycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AdminKycItem = {
  id: string;
  membershipId: string;
  aadhaarNumber?: string | null;
  aadhaarFrontUrl?: string | null;
  aadhaarBackUrl?: string | null;
  panNumber?: string | null;
  panCardUrl?: string | null;
  llbRegistrationNumber?: string | null;
  llbSupportDocUrl?: string | null;
  status: AdminKycStatus | string;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
  membership?: {
    id: string;
    userId?: string;
    level?: string;
    zone?: string | null;
    hrcCountryId?: string | null;
    hrcStateId?: string | null;
    hrcDistrictId?: string | null;
    hrcMandalId?: string | null;
    createdAt?: string;
    updatedAt?: string;
    cell?: { id: string; name: string; code: string } | null;
    designation?: { id: string; name: string; code: string } | null;
  };
};

export async function listAdminKycByStatus(status: AdminKycStatus, limit = 50, offset = 0): Promise<{ data: AdminKycItem[]; total?: number; count?: number; limit?: number; offset?: number }>{
  const usp = new URLSearchParams();
  usp.set('status', status);
  usp.set('limit', String(limit));
  usp.set('offset', String(offset));
  // Per server contract, the path uses '/pending' but filtered by status
  const res = await request<any>(`/memberships/kyc/pending?${usp.toString()}` as any, { method: 'GET' });
  const payload = (res as any) ?? {};
  const data = payload.data ?? payload.items ?? payload.results ?? [];
  const meta = payload.meta ?? {};
  return { data: data as AdminKycItem[], total: meta.total, count: meta.count, limit: meta.limit, offset: meta.offset };
}

export async function getAdminKycByMembershipId(membershipId: string): Promise<AdminKycItem | null> {
  // Try canonical detail endpoint first
  try {
    const res = await request<any>(`/memberships/kyc/${encodeURIComponent(membershipId)}` as any, { method: 'GET' });
    const payload = (res as any)?.data ?? (res as any);
    return payload as AdminKycItem;
  } catch {
    // Fallback: scan across statuses if detail endpoint is not available
    const statuses: AdminKycStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
    for (const st of statuses) {
      try {
        const { data } = await listAdminKycByStatus(st, 50, 0);
        const found = data.find(x => x.membershipId === membershipId);
        if (found) return found;
      } catch {}
    }
    return null;
  }
}

export async function adminApproveKyc(membershipId: string, payload: { status: AdminKycStatus; remarks: string }): Promise<{ success?: boolean } & Record<string, any>> {
  const body = { status: payload.status, remarks: payload.remarks };
  const res = await request<any>(`/memberships/kyc/${encodeURIComponent(membershipId)}/approve` as any, { method: 'PUT', body });
  return (res as any) ?? {};
}