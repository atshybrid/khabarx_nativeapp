// Membership related TypeScript interfaces derived from sample API response

export interface MembershipDesignation {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  defaultCapacity: number;
  idCardFee: number;
  validityDays: number;
  orderRank: number;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipCell {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipIdCard {
  id: string;
  membershipId: string;
  cardNumber: string;
  issuedAt: string;
  expiresAt: string;
  meta: any | null;
  status: string; // GENERATED, NOT_CREATED, etc.
  fullName: string;
  designationName: string;
  cellName: string;
  mobileNumber: string;
  appointmentLetterPdfUrl: string | null;
  appointmentLetterGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipRecord {
  id: string;
  userId: string;
  cellId: string;
  designationId: string;
  level: string; // NATIONAL | STATE | DISTRICT | ZONE | etc.
  zone: string | null;
  hrcCountryId: string | null;
  hrcStateId: string | null;
  hrcDistrictId: string | null;
  hrcMandalId: string | null;
  status: string; // ACTIVE | INACTIVE | etc.
  paymentStatus: string; // SUCCESS | NOT_REQUIRED | etc.
  idCardStatus: string; // GENERATED | NOT_CREATED | etc.
  seatSequence: number;
  lockedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  designation: MembershipDesignation;
  cell: MembershipCell;
  idCard: MembershipIdCard | null;
}

export interface MembershipListResponse {
  success: boolean;
  count: number;
  total?: number; // Total number of records available
  nextCursor: string | null;
  data: MembershipRecord[];
}

export interface MembershipFilters {
  userId?: string;
  status?: string; // ACTIVE, etc.
  level?: string; // NATIONAL, STATE, DISTRICT, ZONE
  cellId?: string;
  designationId?: string;
  hrcCountryId?: string;
  hrcStateId?: string;
  hrcDistrictId?: string;
  hrcMandalId?: string;
  search?: string; // Search term for names, card numbers, etc.
  limit?: number; // default 20
  cursor?: string; // pagination cursor
}
