import { request } from '@/services/http';

// Minimal types for admin endpoints
export type DonationEvent = {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  goalAmount?: number;
  collectedAmount?: number;
  currency?: string;
  startAt?: string;
  endAt?: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';
  presets?: number[];
  allowCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CasesAnalytics = {
  success?: boolean;
  total?: number;
  countsByStatus?: Record<string, number>;
  countsByPriority?: Record<string, number>;
  trend?: { createdPerDay?: { date: string; count: number }[] };
};

// Organization settings as returned by API
export type OrgSettings = {
  id?: string;
  orgName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  pan?: string;
  eightyGNumber?: string;
  eightyGValidFrom?: string; // ISO
  eightyGValidTo?: string;   // ISO
  email?: string;
  phone?: string;
  website?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryTitle?: string;
  hrciLogoUrl?: string;
  stampRoundUrl?: string;
  documents?: { title: string; url: string; type: string }[];
  createdAt?: string;
  updatedAt?: string;
};

// Payload for updating settings
export type OrgSettingsPut = {
  orgName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  pan?: string;
  eightyGNumber?: string;
  eightyGValidFrom?: string; // ISO
  eightyGValidTo?: string;   // ISO
  email?: string;
  phone?: string;
  website?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryTitle?: string;
  hrciLogoUrl?: string;
  stampRoundUrl?: string;
  documents?: { title: string; url: string; type: string }[];
};

// Membership Discount types
export type MembershipDiscount = {
  id: string;
  code?: string | null;
  mobileNumber?: string | null;
  cell?: string | null;
  designationCode?: string | null;
  level?: string | null;
  zone?: string | null;
  hrcCountryId?: string | null;
  hrcStateId?: string | null;
  hrcDistrictId?: string | null;
  hrcMandalId?: string | null;
  amountOff?: number | null;
  percentOff?: number | null;
  currency?: string | null;
  maxRedemptions?: number | null;
  redeemedCount?: number | null;
  activeFrom?: string | null; // ISO
  activeTo?: string | null;   // ISO
  status?: string;            // ACTIVE | REDEEMED | CANCELLED | etc
  appliedToIntentId?: string | null;
  createdByUserId?: string | null;
  reason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

// Ads types
export type AdminAd = {
  id: string;
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | string;
  mediaType: 'IMAGE' | 'VIDEO' | string;
  mediaUrl: string;
  posterUrl?: string | null;
  clickUrl?: string | null;
  weight?: number | null;
  languageId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number | null;
  state?: string | null;
  district?: string | null;
  mandal?: string | null;
  pincode?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminAdCreate = {
  title: string;
  mediaType: 'IMAGE' | 'VIDEO';
  userId?: string | null; // direct userId from record
  cellId?: string | null;
  designationId?: string | null;
  seatSequence?: number | null;
  idCard?: {
    id?: string;
    membershipId?: string;
    cardNumber?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    status?: string | null;
    fullName?: string | null;
    designationName?: string | null;
    cellName?: string | null;
    mobileNumber?: string | null;
    appointmentLetterPdfUrl?: string | null;
    appointmentLetterGeneratedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  mediaUrl: string;
  posterUrl?: string; // required when VIDEO
  clickUrl?: string;
  weight?: number; // default 1
  languageId?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  state?: string;
  district?: string;
  mandal?: string;
  pincode?: string;
  startAt?: string; // ISO
  endAt?: string;   // ISO
};

export type AdminAdUpdate = Partial<AdminAdCreate> & { title?: string; status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | string };

export async function listAdminAds(params: { status?: string; limit?: number; cursor?: string } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(Math.min(Math.max(params.limit, 1), 50)));
  if (params.cursor) q.set('cursor', params.cursor);
  const res = await request<any>(`/ads/admin${q.toString() ? `?${q.toString()}` : ''}`);
  return {
    success: Boolean((res as any)?.success ?? true),
    count: (res as any)?.count ?? (Array.isArray((res as any)?.data) ? (res as any).data.length : 0),
    nextCursor: (res as any)?.nextCursor ?? null,
    data: ((res as any)?.data ?? []) as AdminAd[],
  } as { success: boolean; count: number; nextCursor: string | null; data: AdminAd[] };
}

export async function createAdminAd(payload: AdminAdCreate): Promise<AdminAd> {
  const res = await request<any>(`/ads/admin`, { method: 'POST', body: payload });
  const data = (res as any)?.data ?? res;
  return data as AdminAd;
}

export async function updateAdminAd(id: string, payload: AdminAdUpdate): Promise<AdminAd> {
  const res = await request<any>(`/ads/admin/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
  const data = (res as any)?.data ?? res;
  return data as AdminAd;
}

export async function createAdminAdPayLink(id: string, payload: { amount: number; description?: string; customer?: { name?: string; contact?: string; email?: string } }): Promise<{ url?: string; [k: string]: any }> {
  const res = await request<any>(`/ads/admin/${encodeURIComponent(id)}/pay/link`, { method: 'POST', body: payload });
  const data = (res as any)?.data ?? res;
  return data as any;
}

// Fetch a single ad by id (to check current status after payment, etc.)
export async function getAdminAd(id: string): Promise<AdminAd | null> {
  const res = await request<any>(`/ads/admin/${encodeURIComponent(id)}`);
  const data = (res as any)?.data ?? res;
  if (!data || typeof data !== 'object') return null;
  return data as AdminAd;
}

export type ListDiscountsParams = {
  status?: string;
  code?: string;
  mobileNumber?: string;
  limit?: number;
  cursor?: string;
};

export type DiscountCreate = {
  mobileNumber?: string;
  code?: string | null;
  percentOff?: number | null;
  amountOff?: number | null;
  currency?: string | null;
  maxRedemptions?: number | null;
  activeFrom?: string | null; // ISO
  activeTo?: string | null;   // ISO
  status?: string | null;     // e.g., ACTIVE
  reason?: string | null;
};

export type DiscountUpdate = Omit<DiscountCreate, 'mobileNumber'>;

export async function listAdminDiscounts(params: ListDiscountsParams = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.code) q.set('code', params.code);
  if (params.mobileNumber) q.set('mobileNumber', params.mobileNumber);
  if (params.limit) q.set('limit', String(Math.min(Math.max(params.limit, 1), 100)));
  if (params.cursor) q.set('cursor', params.cursor);
  const res = await request<any>(`/memberships/admin/discounts${q.toString() ? `?${q.toString()}` : ''}`);
  return {
    success: Boolean((res as any)?.success ?? true),
    count: (res as any)?.count ?? (Array.isArray((res as any)?.data) ? (res as any).data.length : 0),
    nextCursor: (res as any)?.nextCursor ?? null,
    data: ((res as any)?.data ?? []) as MembershipDiscount[],
  } as { success: boolean; count: number; nextCursor: string | null; data: MembershipDiscount[] };
}

export async function getAdminDiscount(id: string): Promise<MembershipDiscount | null> {
  const res = await request<any>(`/memberships/admin/discounts/${encodeURIComponent(id)}`);
  const data = (res as any)?.data ?? res;
  return (data || null) as MembershipDiscount | null;
}

export async function createAdminDiscount(payload: DiscountCreate): Promise<MembershipDiscount> {
  const res = await request<any>(`/memberships/admin/discounts`, { method: 'POST', body: payload });
  const data = (res as any)?.data ?? res;
  return data as MembershipDiscount;
}

export async function updateAdminDiscount(id: string, payload: DiscountUpdate): Promise<MembershipDiscount> {
  const res = await request<any>(`/memberships/admin/discounts/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
  const data = (res as any)?.data ?? res;
  return data as MembershipDiscount;
}

export async function cancelAdminDiscount(id: string): Promise<MembershipDiscount> {
  const res = await request<any>(`/memberships/admin/discounts/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} });
  const data = (res as any)?.data ?? res;
  return data as MembershipDiscount;
}

// Admin: list donation events (with pagination)
export async function listAdminDonationEvents(params: { status?: string; limit?: number; cursor?: string } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(Math.min(Math.max(params.limit, 1), 100)));
  if (params.cursor) q.set('cursor', params.cursor);
  const res = await request<{ success?: boolean; count?: number; nextCursor?: string | null; data: DonationEvent[] }>(`/donations/admin/events${q.toString() ? `?${q.toString()}` : ''}`);
  return {
    success: Boolean((res as any)?.success ?? true),
    count: (res as any)?.count ?? (Array.isArray((res as any)?.data) ? (res as any).data.length : 0),
    nextCursor: (res as any)?.nextCursor ?? null,
    data: (res as any)?.data ?? [],
  } as { success: boolean; count: number; nextCursor: string | null; data: DonationEvent[] };
}

// Create a new donation event
export type DonationEventCreate = {
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  goalAmount?: number | null;
  currency?: string; // default INR
  startAt?: string | null; // ISO
  endAt?: string | null;   // ISO
  status?: string; // e.g., ACTIVE | DRAFT
  presets?: number[]; // e.g., [100,500,1000]
  allowCustom?: boolean; // default true (we will set true by default from UI)
};

export async function createDonationEvent(payload: DonationEventCreate): Promise<DonationEvent> {
  const res = await request<any>(`/donations/events`, { method: 'POST', body: payload });
  const data = (res as any)?.data ?? res;
  return data as DonationEvent;
}

// Update event status
export async function updateDonationEventStatus(id: string, status: string): Promise<DonationEvent> {
  const body = { status } as any;
  const res = await request<any>(`/donations/events/${encodeURIComponent(id)}/status`, { method: 'PATCH', body });
  const data = (res as any)?.data ?? res;
  return data as DonationEvent;
}

export async function getCasesAdminAnalytics(days: number = 7): Promise<CasesAnalytics> {
  const q = new URLSearchParams({ days: String(Math.min(Math.max(days, 1), 60)) });
  const res = await request<any>(`/hrci/cases/admin/analytics?${q.toString()}`);
  return (res as any) as CasesAnalytics;
}

export async function getOrgSettings(): Promise<OrgSettings | null> {
  const res = await request<any>(`/org/settings`);
  const data = (res as any)?.data ?? res;
  if (!data || typeof data !== 'object') return null;
  return data as OrgSettings;
}

export async function updateOrgSettings(payload: OrgSettingsPut): Promise<OrgSettings> {
  const res = await request<any>(`/org/settings`, { method: 'PUT', body: payload });
  const data = (res as any)?.data ?? res;
  return data as OrgSettings;
}

// -------------------------
// HRCI ID Card Settings (Admin)
// -------------------------

export type HrciIdCardSettings = {
  id: string;
  name?: string | null;
  isActive?: boolean;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  frontH1?: string | null;
  frontH2?: string | null;
  frontH3?: string | null;
  frontH4?: string | null;
  frontLogoUrl?: string | null;
  secondLogoUrl?: string | null;
  hrciStampUrl?: string | null;
  authorSignUrl?: string | null;
  registerDetails?: string | null;
  frontFooterText?: string | null;
  headOfficeAddress?: string | null;
  regionalOfficeAddress?: string | null;
  administrationOfficeAddress?: string | null;
  contactNumber1?: string | null;
  contactNumber2?: string | null;
  terms?: string[] | null;
  qrLandingBaseUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type HrciIdCardSettingsPut = Partial<Omit<HrciIdCardSettings, 'id' | 'createdAt' | 'updatedAt'>> & {
  name?: string;
};

export async function listIdCardSettings(): Promise<HrciIdCardSettings[]> {
  const res = await request<any>(`/hrci/idcard/settings`, { method: 'GET' });
  const data = (res as any)?.data ?? res;
  if (Array.isArray(data)) return data as HrciIdCardSettings[];
  if (data && typeof data === 'object' && Array.isArray((data as any).data)) return (data as any).data as HrciIdCardSettings[];
  return [];
}

export async function updateIdCardSettings(id: string, payload: HrciIdCardSettingsPut): Promise<HrciIdCardSettings> {
  const res = await request<any>(`/hrci/idcard/settings/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
  const data = (res as any)?.data ?? res;
  return data as HrciIdCardSettings;
}

// -------------------------
// Memberships (Admin)
// -------------------------

export type AdminMembership = {
  id: string;
  userId?: string | null;
  cellId?: string | null;
  designationId?: string | null;
  level?: string | null;
  zone?: string | null;
  status?: string | null; // ACTIVE | PENDING | EXPIRED | SUSPENDED
  paymentStatus?: string | null; // SUCCESS | NOT_REQUIRED | etc
  idCardStatus?: string | null; // NOT_CREATED | GENERATED
  seatSequence?: number | null;
  lockedAt?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  cell?: { id?: string; code?: string; name?: string } | null;
  designation?: { id?: string; code?: string; name?: string; defaultCapacity?: number; validityDays?: number } | null;
  user?: {
    id?: string;
    mobileNumber?: string | null;
    profile?: { fullName?: string | null; profilePhotoUrl?: string | null } | null;
  } | null;
  idCard?: {
    id?: string;
    membershipId?: string;
    cardNumber?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    status?: string | null;
    fullName?: string | null;
    designationName?: string | null;
    cellName?: string | null;
    mobileNumber?: string | null;
    appointmentLetterPdfUrl?: string | null;
    appointmentLetterGeneratedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  hrci?: {
    zone?: string | null;
    country?: any;
    state?: any;
    district?: any;
    mandal?: { id?: string; name?: string; districtId?: string } | null;
  } | null;
};

export type ListAdminMembershipsParams = {
  status?: string; // ACTIVE | PENDING | etc
  level?: string;
  userId?: string;
  cellId?: string;
  designationId?: string;
  mobileNumber?: string; // optional server-side filter if supported
  zone?: string;
  hrcStateId?: string;
  hrcDistrictId?: string;
  hrcMandalId?: string;
  paymentStatus?: string; // SUCCESS | NOT_REQUIRED | FAILED
  idCardStatus?: string; // GENERATED | NOT_CREATED
  limit?: number; // default 20
  cursor?: string;
};

export async function listAdminMemberships(params: ListAdminMembershipsParams = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.level) q.set('level', params.level);
  if (params.userId) q.set('userId', params.userId);
  if (params.cellId) q.set('cellId', params.cellId);
  if (params.designationId) q.set('designationId', params.designationId);
  if (params.mobileNumber) q.set('mobileNumber', params.mobileNumber);
  if (params.zone) q.set('zone', params.zone);
  if (params.hrcStateId) q.set('hrcStateId', params.hrcStateId);
  if (params.hrcDistrictId) q.set('hrcDistrictId', params.hrcDistrictId);
  if (params.hrcMandalId) q.set('hrcMandalId', params.hrcMandalId);
  if (params.paymentStatus) q.set('paymentStatus', params.paymentStatus);
  if (params.idCardStatus) q.set('idCardStatus', params.idCardStatus);
  q.set('limit', String(Math.min(Math.max(params.limit ?? 20, 1), 50)));
  if (params.cursor) q.set('cursor', params.cursor);
  const res = await request<any>(`/memberships/admin${q.toString() ? `?${q.toString()}` : ''}`);
  return {
    success: Boolean((res as any)?.success ?? true),
    count: (res as any)?.count ?? (Array.isArray((res as any)?.data) ? (res as any).data.length : 0),
    nextCursor: (res as any)?.nextCursor ?? null,
    data: (((res as any)?.data ?? []) as any[]).map((m) => (m as AdminMembership)),
  } as { success: boolean; count: number; nextCursor: string | null; data: AdminMembership[] };
}

// Fetch single membership detail
export async function getAdminMembership(id: string): Promise<AdminMembership | null> {
  try {
    const res = await request<any>(`/memberships/admin/${encodeURIComponent(id)}`);
    const data = (res as any)?.data ?? res;
    if (!data || typeof data !== 'object') return null;
    return data as AdminMembership;
  } catch (e) {
    console.warn('[AdminMembership] detail failed', (e as any)?.message || e);
    return null;
  }
}

// Create a new membership (admin flow)
// Endpoint: POST /memberships/admin/create-member
// Payload keys vary by level; optional activate boolean triggers immediate activation when supported.
export type CreateAdminMemberPayload = {
  fullName: string;
  mobileNumber: string;
  cell?: string; // cell code or id depending on backend contract
  designationCode?: string; // designation code
  level: string; // NATIONAL | ZONE | STATE | DISTRICT | MANDAL
  zone?: string;
  hrcCountryId?: string;
  hrcStateId?: string;
  hrcDistrictId?: string;
  hrcMandalId?: string;
  activate?: boolean;
};

export async function createAdminMember(payload: CreateAdminMemberPayload): Promise<AdminMembership> {
  const body: any = {
    fullName: payload.fullName,
    mobileNumber: payload.mobileNumber,
    level: payload.level,
    activate: payload.activate ?? false,
  };
  if (payload.cell) body.cell = payload.cell;
  if (payload.designationCode) body.designationCode = payload.designationCode;
  // Level-specific geo fields
  if (payload.zone) body.zone = payload.zone;
  if (payload.hrcCountryId) body.hrcCountryId = payload.hrcCountryId;
  if (payload.hrcStateId) body.hrcStateId = payload.hrcStateId;
  if (payload.hrcDistrictId) body.hrcDistrictId = payload.hrcDistrictId;
  if (payload.hrcMandalId) body.hrcMandalId = payload.hrcMandalId;
  const res = await request<any>(`/memberships/admin/create-member`, { method: 'POST', body });
  const data = (res as any)?.data ?? res;
  return data as AdminMembership;
}
