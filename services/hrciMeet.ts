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
  hrcCountryId?: string | null;
  hrcStateId?: string | null;
  hrcDistrictId?: string | null;
  hrcMandalId?: string | null;
  scheduledAt: string;
  endsAt?: string | null;
  status?: 'SCHEDULED' | 'LIVE' | 'ENDED' | string;
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
