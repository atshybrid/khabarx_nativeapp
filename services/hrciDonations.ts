import { request } from './http';

// Local switch to silence noisy console warnings when backend migrations are pending
const SILENCE_DONATION_WARNINGS = (() => {
  const raw = String(process.env.EXPO_PUBLIC_SILENCE_DONATION_WARNINGS ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
function donationWarn(msg: string) {
  if (SILENCE_DONATION_WARNINGS) return;
  // Only surface in dev to avoid spamming production logs
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    try { console.warn(msg); } catch {}
  }
}

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
  try {
    const res = await request<DonationListResponse>(`/donations/members/payment-links?${usp.toString()}` as any, { method: 'GET' });
    return {
      success: res.success,
      count: res.count ?? res.data?.length ?? 0,
      total: res.total,
      totals: res.totals || {},
      data: Array.isArray(res.data) ? res.data : [],
      reconciled: res.reconciled,
    };
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const bodyMsg = String((e?.body?.message ?? e?.body) || '').toLowerCase();
    const text = msg + ' ' + bodyMsg;
    // Gracefully handle missing DB relation on server (migration not applied)
    if (text.includes('donationdonorprofile') || text.includes('relation') || text.includes('42p01')) {
      donationWarn('[donations] Server missing table DonationDonorProfile; returning empty list');
      return { success: false, count: 0, total: 0, totals: {}, data: [], reconciled: 0 };
    }
    throw e;
  }
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
  try {
    const res = await request<{ success?: boolean; count?: number; data?: DonationEvent[] }>(
      `/donations/events?${usp.toString()}` as any,
      { method: 'GET', noAuth: true }
    );
    return Array.isArray(res?.data) ? res.data! : [];
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const bodyMsg = String((e?.body?.message ?? e?.body) || '').toLowerCase();
    const text = msg + ' ' + bodyMsg;
    if (text.includes('donationdonorprofile') || text.includes('relation') || text.includes('42p01')) {
      donationWarn('[donations] Events suppressed due to missing DB relation');
      return [];
    }
    throw e;
  }
}

export async function getDonationEventById(id: string): Promise<DonationEvent | undefined> {
  if (!id) return undefined;
  try {
    const res = await request<{ success?: boolean; data?: DonationEvent }>(
      `/donations/events/${encodeURIComponent(id)}` as any,
      { method: 'GET', noAuth: true }
    );
    return (res as any)?.data as DonationEvent;
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const bodyMsg = String((e?.body?.message ?? e?.body) || '').toLowerCase();
    const text = msg + ' ' + bodyMsg;
    if (text.includes('donationdonorprofile') || text.includes('relation') || text.includes('42p01')) {
      donationWarn('[donations] Event suppressed due to missing DB relation');
      return undefined;
    }
    throw e;
  }
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

// Top donors (public)
export type TopDonor = {
  key: string;
  displayName: string;
  mobileMasked?: string | null;
  emailMasked?: string | null;
  panMasked?: string | null;
  totalAmount: number;
  donationCount: number;
  photoUrl?: string | null;
};

export async function getTopDonors(limit = 20): Promise<TopDonor[]> {
  const usp = new URLSearchParams({ limit: String(limit) });
  try {
    const res = await request<{ success?: boolean; count?: number; data?: TopDonor[] }>(
      `/donations/top-donors?${usp.toString()}` as any,
      { method: 'GET', noAuth: true }
    );
    return Array.isArray(res?.data) ? (res.data as TopDonor[]) : [];
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const bodyMsg = String((e?.body?.message ?? e?.body) || '').toLowerCase();
    const text = msg + ' ' + bodyMsg;
    if (text.includes('donationdonorprofile') || text.includes('relation') || text.includes('42p01')) {
      donationWarn('[donations] Top donors suppressed due to missing DB relation');
      return [];
    }
    throw e;
  }
}

/**
 * Update donor photo for a specific donation. Backend contract can vary; this function
 * tries a few common patterns. Adjust to the exact PUT endpoint your server expects.
 * Candidates tried (in order):
 *  - PUT /donations/{donationId}/photo { photoUrl }
 *  - PUT /donations/{donationId}       { photoUrl }
 *  - PUT /donations/admin/donor-photo  { donationId, photoUrl }
 */
export async function updateDonorPhoto(donationId: string, photoUrl: string): Promise<boolean> {
  if (!donationId || !photoUrl) throw new Error('Missing donationId or photoUrl');
  // Per server contract: PUT /donations/admin/donors/photo { donationId, photoUrl }
  const res = await request<{ success?: boolean }>(`/donations/admin/donors/photo` as any, {
    method: 'PUT',
    body: { donationId, photoUrl },
  });
  return Boolean((res as any)?.success !== false);
}

// Success stories (public read)
export type DonationStory = {
  id: string;
  title: string;
  description?: string | null;
  heroImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DonationStoryDetail = DonationStory & {
  images?: { id: string; url: string; caption?: string | null; order?: number; isActive?: boolean; createdAt?: string; updatedAt?: string }[];
};

export async function getDonationStories(limit = 20, offset = 0): Promise<DonationStory[]> {
  const usp = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  try {
    const res = await request<{ success?: boolean; count?: number; total?: number; data?: DonationStory[] }>(
      `/donations/stories?${usp.toString()}` as any,
      { method: 'GET', noAuth: true }
    );
    return Array.isArray(res?.data) ? (res.data as DonationStory[]) : [];
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const bodyMsg = String((e?.body?.message ?? e?.body) || '').toLowerCase();
    const text = msg + ' ' + bodyMsg;
    if (text.includes('donationdonorprofile') || text.includes('relation') || text.includes('42p01')) {
      donationWarn('[donations] Stories suppressed due to missing DB relation');
      return [];
    }
    throw e;
  }
}

export async function getDonationStoryById(id: string): Promise<DonationStoryDetail | undefined> {
  if (!id) return undefined;
  try {
    const res = await request<{ success?: boolean; data?: DonationStoryDetail }>(
      `/donations/stories/${encodeURIComponent(id)}` as any,
      { method: 'GET', noAuth: true }
    );
    return (res as any)?.data as DonationStoryDetail;
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const bodyMsg = String((e?.body?.message ?? e?.body) || '').toLowerCase();
    const text = msg + ' ' + bodyMsg;
    if (text.includes('donationdonorprofile') || text.includes('relation') || text.includes('42p01')) {
      donationWarn('[donations] Story suppressed due to missing DB relation');
      return undefined;
    }
    throw e;
  }
}

// Public quick-pay (direct Razorpay checkout)
// Public/Direct Razorpay order (server requires auth per sample; we'll send auth if available)
export type CreateOrderRequest = {
  eventId?: string;
  amount: number; // INR
  donorName?: string;
  donorAddress?: string;
  donorMobile?: string;
  donorEmail?: string;
  donorPan?: string;
  isAnonymous?: boolean;
  shareCode?: string;
};
export type CreateOrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId: string;
  providerKeyId?: string;
};

export async function createDonationOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
  const res = await request<{ success?: boolean; data?: { order?: CreateOrderResponse } }>(
    `/donations/orders` as any,
    { method: 'POST', body: payload, noAuth: true }
  );
  const order = (res as any)?.data?.order ?? (res as any)?.order ?? res;
  return order as CreateOrderResponse;
}

export type ConfirmDonationPayload = {
  orderId: string;
  status: 'SUCCESS' | 'FAILED' | string;
  provider?: string; // 'razorpay'
  providerRef?: string; // 'razorpay'
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};
export type ConfirmDonationResponse = {
  success?: boolean;
  data?: {
    status?: string;
    donationId?: string;
    receipt?: {
      id?: string;
      receiptNo?: string;
      amount?: number;
      verify?: { htmlUrl?: string; pdfUrl?: string | null };
    };
  };
};

export async function confirmDonation(payload: ConfirmDonationPayload): Promise<ConfirmDonationResponse> {
  const res = await request<ConfirmDonationResponse>(
    `/donations/confirm` as any,
    { method: 'POST', body: payload, noAuth: true }
  );
  return res;
}
