import { request } from './http';

export type CreateDonationOrderPayload = {
  eventId?: string | null;
  amount: number;
  donorName: string;
  donorAddress?: string;
  donorMobile: string;
  donorEmail?: string;
  donorPan?: string;
  isAnonymous?: boolean;
  shareCode?: string;
};

export type DonationOrder = {
  orderId: string;
  amount: number; // in INR
  currency: string; // INR
  provider: 'razorpay' | string;
  providerOrderId?: string | null;
  providerKeyId?: string | null;
};

export async function createDonationOrder(payload: CreateDonationOrderPayload): Promise<DonationOrder> {
  const res = await request<{ success?: boolean; data?: { order: DonationOrder } }>(`/donations/orders` as any, {
    method: 'POST',
    body: {
      eventId: payload.eventId || '',
      amount: Number(payload.amount || 0),
      donorName: payload.donorName,
      donorAddress: payload.donorAddress || '',
      donorMobile: payload.donorMobile,
      donorEmail: payload.donorEmail || '',
      donorPan: payload.donorPan || '',
      isAnonymous: Boolean(payload.isAnonymous),
      shareCode: payload.shareCode || '',
    },
    noAuth: true,
  });
  const order = (res?.data as any)?.order || (res as any)?.order;
  if (!order?.orderId) throw new Error('Failed to create donation order');
  return order as DonationOrder;
}

export type ConfirmDonationPayload = {
  orderId: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  provider: 'razorpay' | string;
  providerRef?: string | null; // e.g., payment id
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export async function confirmDonation(payload: ConfirmDonationPayload): Promise<{ success?: boolean } & Record<string, any>> {
  const res = await request<any>(`/donations/confirm` as any, { method: 'POST', body: payload, noAuth: true });
  return res as any;
}

export type DonationStatusResponse = {
  success?: boolean;
  data?: {
    providerOrderId: string;
    paid: boolean;
    paymentId?: string | null;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
    receiptPdfUrl?: string | null;
    receiptHtmlUrl?: string | null;
  };
};

export async function getDonationOrderStatus(providerOrderId: string): Promise<DonationStatusResponse['data']> {
  const res = await request<DonationStatusResponse>(`/donations/orders/${encodeURIComponent(providerOrderId)}/status` as any, { method: 'GET', noAuth: true });
  return (res as any)?.data || (res as any);
}

export type ReceiptSearchQuery = {
  donationId?: string;
  mobile?: string;
  pan?: string;
  name?: string;
  limit?: number;
  offset?: number;
  from?: string; // ISO date
  to?: string;   // ISO date
};

export async function searchDonationReceipts(q: ReceiptSearchQuery): Promise<{ success?: boolean; count?: number; total?: number; data: any[] }>{
  const usp = new URLSearchParams();
  if (q.donationId) usp.set('donationId', q.donationId);
  if (q.mobile) usp.set('mobile', q.mobile);
  if (q.pan) usp.set('pan', q.pan);
  if (q.name) usp.set('name', q.name);
  if (q.from) usp.set('from', q.from);
  if (q.to) usp.set('to', q.to);
  usp.set('limit', String(q.limit ?? 20));
  usp.set('offset', String(q.offset ?? 0));
  const res = await request<any>(`/donations/receipts/search?${usp.toString()}` as any, { method: 'GET', noAuth: true });
  return res as any;
}
