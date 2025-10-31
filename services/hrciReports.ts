import { request } from '@/services/http';

// Share the same silence flag as donations warnings
const SILENCE_DONATION_WARNINGS = (() => {
  const raw = String(process.env.EXPO_PUBLIC_SILENCE_DONATION_WARNINGS ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
function reportsWarn(msg: string) {
  if (SILENCE_DONATION_WARNINGS) return;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    try { console.warn(msg); } catch {}
  }
}

export type HrciMetricsResponse = {
  success?: boolean;
  range?: { from: string; to: string; granularity?: 'daily' | 'weekly' | 'monthly' };
  totals: {
    memberships?: { joinsCount?: number; activatedCount?: number };
    membershipFees?: { successCount?: number; successAmount?: number };
    donations?: {
      totalCount?: number;
      totalAmount?: number;
      memberAttributedCount?: number;
      memberAttributedAmount?: number;
      directCount?: number;
      directAmount?: number;
    };
  };
  series?: {
    period: { label: string; start: string; end: string };
    memberships?: { joinsCount?: number; activatedCount?: number };
    membershipFees?: { successCount?: number; successAmount?: number };
    donations?: {
      totalCount?: number;
      totalAmount?: number;
      memberAttributedCount?: number;
      memberAttributedAmount?: number;
      directCount?: number;
      directAmount?: number;
    };
  }[];
};

export async function getHrciMetrics(params: { from?: string; to?: string; granularity?: 'daily' | 'weekly' | 'monthly' } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  q.set('granularity', params.granularity || 'daily');
  const res = await request<any>(`/hrci/reports/metrics?${q.toString()}`);
  const data = (res?.data ?? res) as HrciMetricsResponse;
  return data;
}

export type MemberDonationsResponse = {
  success?: boolean;
  range?: { from?: string; to?: string };
  target?: { userId?: string; membershipId?: string };
  totals?: { generatedCount?: number; successCount?: number; successAmount?: number; pendingCount?: number; failedCount?: number };
};

export async function getMemberDonations(params: { userId?: string; membershipId?: string; from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (params.userId) q.set('userId', params.userId);
  if (params.membershipId) q.set('membershipId', params.membershipId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  try {
    const res = await request<any>(`/hrci/reports/member-donations?${q.toString()}`);
    const data = (res?.data ?? res) as MemberDonationsResponse;
    return data;
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const bodyMsg = String((e?.body?.message ?? e?.body) || '').toLowerCase();
    const text = msg + ' ' + bodyMsg;
    if (text.includes('donationdonorprofile') || text.includes('relation') || text.includes('42p01')) {
      reportsWarn('[reports] Member donations suppressed due to missing DB relation');
      return { success: false, totals: { generatedCount: 0, successCount: 0, successAmount: 0, pendingCount: 0, failedCount: 0 } };
    }
    throw e;
  }
}
