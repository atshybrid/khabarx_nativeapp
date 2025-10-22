import { request } from './http';

export type DonationStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUND' | string;

export type DonationLinkItem = {
  id: string; // donationId
  eventId?: string | null;
  amount: number;
  status: DonationStatus;
  providerOrderId?: string | null; // plink_*
  providerPaymentId?: string | null;
  createdAt: string;
  // donor details (optional)
  donorName?: string | null;
  donorMobile?: string | null;
  donorAddress?: string | null;
  donorPan?: string | null;
  donorEmail?: string | null;
  isAnonymous?: boolean;
  // receipt URL (populated after calling receipt API)
  receiptPdfUrl?: string | null;
};

export type DonationTotals = {
  overall?: { count: number; amount: number };
  byStatus?: Record<string, { count: number; amount: number }>; // PENDING/SUCCESS/FAILED/REFUND
};

export type DonationListResponse = {
  success?: boolean;
  count?: number;
  total?: number;
  totals?: DonationTotals;
  data: DonationLinkItem[];
  reconciled?: number;
};

export async function getMemberDonationLinks(params: {
  from?: string | number; // ISO or epoch
  to?: string | number;   // ISO or epoch
  status?: string;        // comma-separated
  eventId?: string;
  limit?: number;
  offset?: number;
}): Promise<DonationListResponse> {
  const usp = new URLSearchParams();
  if (params.from != null) usp.set('from', String(params.from));
  if (params.to != null) usp.set('to', String(params.to));
  if (params.status) usp.set('status', params.status);
  if (params.eventId) usp.set('eventId', params.eventId);
  usp.set('limit', String(params.limit ?? 50));
  usp.set('offset', String(params.offset ?? 0));
  const res = await request<DonationListResponse>(`/donations/members/payment-links?${usp.toString()}` as any, { method: 'GET' });
  return {
    success: res.success,
    count: res.count ?? res.data?.length ?? 0,
    total: res.total,
    totals: res.totals || {},
    data: Array.isArray(res.data) ? res.data : [],
    reconciled: res.reconciled,
  };
}

export type DonationEvent = {
  id: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  goalAmount?: number | null;
  currency?: string | null;
  status?: string | null;
  presets?: number[];
  allowCustom?: boolean;
  collectedAmount?: number;
  startAt?: string | null;
  endAt?: string | null;
};

export async function getDonationEvents(limit = 20): Promise<DonationEvent[]> {
  const usp = new URLSearchParams({ limit: String(limit) });
  const res = await request<{ success?: boolean; count?: number; data?: DonationEvent[] }>(`/donations/events?${usp.toString()}` as any, { method: 'GET' });
  return Array.isArray(res?.data) ? res.data! : [];
}

export type CreateDonationPayload = {
  amount: number; // in INR; backend expects number (e.g., 500)
  eventId?: string;
  donorName?: string;
  donorAddress?: string;
  donorMobile?: string;
  donorEmail?: string;
  donorPan?: string; // required when amount > 1000 and isAnonymous=false
  isAnonymous: boolean;
  shareCode?: string;
};

export type CreateDonationResponse = {
  success?: boolean;
  data: {
    donationId: string;
    intentId: string;
    linkId: string; // plink_...
    shortUrl: string;
    status: DonationStatus | 'PENDING' | 'created';
    statusUrl: string; // endpoint to check status
  };
};

export async function createDonationPaymentLink(payload: CreateDonationPayload): Promise<CreateDonationResponse['data']> {
  const res = await request<CreateDonationResponse>(`/donations/members/payment-links`, { method: 'POST', body: payload });
  return (res as any)?.data;
}

export async function getDonationLinkById(linkId: string): Promise<any> {
  const res = await request<any>(`/donations/members/payment-links/${encodeURIComponent(linkId)}` as any, { method: 'GET' });
  return (res as any)?.data ?? res;
}

export async function notifyDonationLink(linkId: string, via: 'sms' | 'email' | 'whatsapp' = 'sms'): Promise<boolean> {
  const res = await request<{ success?: boolean; data?: { success?: boolean } }>(`/donations/members/payment-links/${encodeURIComponent(linkId)}/notify`, {
    method: 'POST',
    body: { via },
  });
  return Boolean((res as any)?.data?.success ?? res?.success);
}

/**
 * Get a downloadable/viewable 80G receipt URL for a donation.
 * The backend endpoint returns a presigned URL. Open this in a browser to download the PDF.
 */
export async function getDonationReceiptUrl(donationId: string): Promise<string | undefined> {
  if (!donationId) return undefined;
  
  try {
    console.log(`Calling receipt API for donation: ${donationId}`);
    const res = await request<{ success?: boolean; url?: string; data?: { url?: string } }>(
      `/donations/receipt/${encodeURIComponent(donationId)}/url` as any,
      { method: 'GET' }
    );
    console.log('Receipt API response:', JSON.stringify(res, null, 2));
    
    // Some backends respond with { url } or { data: { url } }
    const url = (res as any)?.url || (res as any)?.data?.url;
    console.log(`Extracted URL: ${url}`);
    return typeof url === 'string' ? url : undefined;
  } catch (error) {
    // Only log to console if it's not a known server configuration issue
    const errorMsg = (error as any)?.message || '';
    const isKnownServerIssue = errorMsg.includes('Chrome') || 
                              errorMsg.includes('puppeteer') || 
                              errorMsg.includes('Puppeteer') ||
                              errorMsg.includes('browser') ||
                              errorMsg.includes('render');
    
    if (!isKnownServerIssue) {
      console.error('getDonationReceiptUrl error:', error);
    } else {
      console.log('Receipt generation temporarily unavailable due to server configuration');
    }
    throw error;
  }
}
