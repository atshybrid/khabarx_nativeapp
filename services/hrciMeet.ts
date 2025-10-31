import { request } from './http';

export type HrciMeeting = {
  id: string;
  title: string;
  provider: 'JITSI' | string;
  domain: string;
  roomName: string;
  password?: string | null;
  level?: string | null;
  zone?: string | null;
  cellId?: string | null;
  hrcCountryId?: string | null;
  hrcStateId?: string | null;
  hrcDistrictId?: string | null;
  hrcMandalId?: string | null;
  scheduledAt: string;
  endsAt?: string | null;
  status?: 'SCHEDULED' | 'LIVE' | 'ENDED' | string;
  runtimeStatus?: 'SCHEDULED' | 'LIVE' | 'ENDED' | string;
};

export type HrciUpcomingMeetingsResponse = {
  success?: boolean;
  count: number;
  data: HrciMeeting[];
};

export async function getMyUpcomingMeetings(): Promise<HrciMeeting[]> {
  const res = await request<HrciUpcomingMeetingsResponse>(`/hrci/meet/meetings/my/upcoming`, { method: 'GET' });
  return res.data || [];
}

// Admin: list all meetings
export type HrciAdminMeetingsListResponse = {
  success?: boolean;
  count: number;
  data: HrciMeeting[];
};

export async function listAdminMeetings(): Promise<HrciAdminMeetingsListResponse> {
  const res = await request<HrciAdminMeetingsListResponse>(`/hrci/meet/admin/meetings`, { method: 'GET' });
  return { count: res.count || (res.data?.length || 0), data: res.data || [] } as HrciAdminMeetingsListResponse;
}

export type HrciJoinMeetingResponse = {
  success?: boolean;
  data: {
    join: {
      domain: string;
      roomName: string;
      url: string;
      password?: string | null;
      jwt?: string | null;
    };
    meeting: { id: string; title: string; status?: string };
  };
};

export async function joinMeeting(meetingId: string): Promise<HrciJoinMeetingResponse['data']> {
  const res = await request<HrciJoinMeetingResponse>(`/hrci/meet/meetings/${encodeURIComponent(meetingId)}/join`, { method: 'GET' });
  return res.data as any;
}

// ------------------ Admin: create meeting ------------------
export type HrciAdminCreateMeetingPayload = {
  title: string;
  cellId?: string | null;
  level: string; // e.g., NATIONAL | ZONE | COUNTRY | STATE | DISTRICT | MANDAL | CELL
  includeChildren?: boolean;
  zone?: string | null;
  hrcCountryId?: string | null;
  hrcStateId?: string | null;
  hrcDistrictId?: string | null;
  hrcMandalId?: string | null;
  scheduledAt: string; // ISO
  endsAt?: string | null; // ISO
  password?: string | null;
};

export async function createAdminMeeting(payload: HrciAdminCreateMeetingPayload): Promise<HrciMeeting> {
  // Ensure only allowed fields and nulls for optional empties
  const body: any = {
    title: payload.title,
    cellId: payload.cellId ?? null,
    level: payload.level,
    includeChildren: payload.includeChildren ?? false,
    zone: payload.zone ?? null,
    hrcCountryId: payload.hrcCountryId ?? null,
    hrcStateId: payload.hrcStateId ?? null,
    hrcDistrictId: payload.hrcDistrictId ?? null,
    hrcMandalId: payload.hrcMandalId ?? null,
    scheduledAt: payload.scheduledAt,
    endsAt: payload.endsAt ?? null,
    password: payload.password ?? null,
  };
  const res = await request<any>(`/hrci/meet/admin/meetings`, { method: 'POST', body });
  const data = (res as any)?.data ?? res;
  return data as HrciMeeting;
}
