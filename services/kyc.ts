import { uploadMedia } from './api';
import { request } from './http';

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

/**
 * Get KYC status for the current member
 */
export async function getKYCStatus(): Promise<KYCStatusResponse['data']> {
  // New contract: GET /memberships/kyc/me returns full record or 404 if not started
  try {
    const res = await request<{ success?: boolean; data?: KYCRecord }>('/memberships/kyc/me' as any, {
      method: 'GET'
    });
    const record = (res as any)?.data || (res as any);
    const raw = record?.data ?? record; // accept either shape
    if (!raw || !raw.id) {
      return { kycCompleted: false, status: 'NOT_STARTED' };
    }
    const st = String(raw.status || '').toUpperCase();
    let mapped: KYCStatus = 'PENDING';
    if (st === 'APPROVED' || st === 'VERIFIED') mapped = 'VERIFIED';
    else if (st === 'REJECTED') mapped = 'REJECTED';
    else if (st === 'NOT_STARTED' || st === 'NONE') mapped = 'NOT_STARTED';
    return {
      kycCompleted: mapped === 'VERIFIED',
      status: mapped,
      kycData: raw,
    };
  } catch (e: any) {
    const status = e?.status || e?.response?.status;
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
export async function submitKYC(payload: Omit<KYCData, 'id' | 'status' | 'submittedAt' | 'verifiedAt' | 'rejectionReason'>): Promise<KYCSubmissionResponse['data']> {
  const res = await request<KYCSubmissionResponse>('/memberships/kyc' as any, {
    method: 'POST',
    body: payload
  });
  return (res as any).data || (res as any);
}

/**
 * Upload document image
 */
export async function uploadKYCDocument(
  file: { uri: string; type?: string; name?: string },
  documentType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card'
): Promise<{ url: string }> {
  // Use the central media upload API, then return the URL for inclusion in /memberships/kyc payload
  const uploaded = await uploadMedia({ uri: file.uri, type: 'image', name: file.name || `${documentType}_${Date.now()}.jpg`, folder: 'kyc' });
  return { url: uploaded.url };
}

// Convenience: upload all KYC docs via media API and submit in one shot
export async function submitKYCWithMedia(input: {
  membershipId: string;
  aadhaarNumber: string;
  aadhaarFront: { uri: string; name?: string };
  aadhaarBack: { uri: string; name?: string };
  panNumber: string;
  panCard: { uri: string; name?: string };
  llbRegistrationNumber?: string;
  llbSupportDoc?: { uri: string; name?: string };
}) {
  const [front, back, pan, llb] = await Promise.all([
    uploadMedia({ uri: input.aadhaarFront.uri, type: 'image', name: input.aadhaarFront.name || `aadhaar_front_${Date.now()}.jpg`, folder: 'kyc' }),
    uploadMedia({ uri: input.aadhaarBack.uri, type: 'image', name: input.aadhaarBack.name || `aadhaar_back_${Date.now()}.jpg`, folder: 'kyc' }),
    uploadMedia({ uri: input.panCard.uri, type: 'image', name: input.panCard.name || `pan_card_${Date.now()}.jpg`, folder: 'kyc' }),
    input.llbSupportDoc ? uploadMedia({ uri: input.llbSupportDoc.uri, type: 'image', name: input.llbSupportDoc.name || `llb_doc_${Date.now()}.jpg`, folder: 'kyc' }) : Promise.resolve(null as any),
  ]);

  const payload = {
    membershipId: input.membershipId,
    aadhaarNumber: input.aadhaarNumber.replace(/\D/g, ''),
    aadhaarFrontUrl: front.url,
    aadhaarBackUrl: back.url,
    panNumber: input.panNumber,
    panCardUrl: pan.url,
    ...(input.llbRegistrationNumber ? { llbRegistrationNumber: input.llbRegistrationNumber } : {}),
    ...(llb ? { llbSupportDocUrl: llb.url } : {}),
  } as any;

  return submitKYC(payload);
}