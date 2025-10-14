import { request } from './http';

// Types reflect the combined membership profile response
export interface MembershipProfileData {
  user?: {
    id?: string;
    mobileNumber?: string;
    role?: string;
    languageId?: string;
    profile?: {
      fullName?: string;
      gender?: string | null;
      dob?: string | null;
      profilePhotoUrl?: string | null;
    };
  };
  membership?: {
    id?: string;
    level?: string;
    status?: string;
    paymentStatus?: string;
    idCardStatus?: string;
    activatedAt?: string;
    expiresAt?: string | null;
    cell?: { id?: string; code?: string; name?: string };
    designation?: { id?: string; code?: string; name?: string; validityDays?: number; defaultCapacity?: number };
    hrci?: {
      zone?: string | null;
      country?: any;
      state?: any;
      district?: any;
      mandal?: { id?: string; name?: string; districtId?: string } | null;
    };
    lastPayment?: { amount?: number; status?: string; providerRef?: string | null; createdAt?: string };
    kyc?: { hasKyc?: boolean; status?: string; updatedAt?: string };
  };
  card?: {
    id?: string;
    cardNumber?: string;
    status?: string;
    issuedAt?: string;
    expiresAt?: string;
    paths?: { json?: string; html?: string; qr?: string };
  };
  nextAction?: any;
}

export async function getMembershipProfile(): Promise<MembershipProfileData | null> {
  try {
    const res = await request<any>('/memberships/me/profile', { method: 'GET' });
    return (res?.data || res) as MembershipProfileData;
  } catch (e) {
    console.warn('[Membership] getMembershipProfile failed', (e as any)?.message || e);
    return null;
  }
}

export async function issueMembershipIdCard(): Promise<boolean> {
  try {
    const res = await request<any>('/memberships/me/idcard/issue', { method: 'POST' });
    const data = res?.data || res;
    const ok = data?.success !== false; // assume success if not explicitly false
    console.log('[Membership] ID card issue response', { ok, status: data?.card?.status || data?.status });
    return true;
  } catch (e: any) {
    console.warn('[Membership] issueMembershipIdCard failed', e?.status, e?.message || e);
    return false;
  }
}

// Ensure card is generated; returns latest profile after potential generation
export async function ensureIdCardGenerated(): Promise<MembershipProfileData | null> {
  const initial = await getMembershipProfile();
  if (!initial) return null;
  const status = initial.membership?.idCardStatus || initial.card?.status;
  if (status === 'GENERATED') {
    console.log('[Membership] ID card already generated');
    return initial;
  }
  console.log('[Membership] ID card not generated (status=', status, ') – attempting issue');
  const issued = await issueMembershipIdCard();
  if (!issued) return initial; // return what we have; caller may retry later
  // Re-fetch to confirm
  const after = await getMembershipProfile();
  console.log('[Membership] Post-issue status', after?.membership?.idCardStatus || after?.card?.status);
  return after || initial;
}
