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

export type KYCStatusResponse = {
  success: boolean;
  data: {
    kycCompleted: boolean;
    status: KYCStatus;
    kycData?: KYCData;
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
  const res = await request<KYCStatusResponse>('/memberships/kyc/status' as any, {
    method: 'GET'
  });
  return res.data;
}

/**
 * Submit KYC documents for verification
 */
export async function submitKYC(payload: Omit<KYCData, 'id' | 'status' | 'submittedAt' | 'verifiedAt' | 'rejectionReason'>): Promise<KYCSubmissionResponse['data']> {
  const res = await request<KYCSubmissionResponse>('/memberships/kyc' as any, {
    method: 'POST',
    body: payload
  });
  return res.data;
}

/**
 * Upload document image
 */
export async function uploadKYCDocument(file: any, documentType: 'aadhaar_front' | 'aadhaar_back' | 'pan_card'): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  
  const res = await request<{ success: boolean; data: { url: string } }>('/memberships/kyc/upload' as any, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return res.data;
}