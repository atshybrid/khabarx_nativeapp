import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTokens } from './auth';
import { getDeviceIdentity } from './device';
import { request } from './http';

/**
 * Preference system
 * Endpoint(s):
 *  - GET /preferences?deviceId=...&userId=...
 *  - POST/PATCH /preferences/update (as specified)
 *
 * Supports partial update intents:
 *  - pushToken
 *  - languageId
 *  - location
 *  - all combined
 *
 * Rules (from user spec):
 * 1. Always include deviceId, deviceModel.
 * 2. Include userId if logged-in, else pass null (omit or null) for guest.
 * 3. For each intent (token / language / location) send only relevant fields plus forceUpdate=true.
 * 4. When updating all, include all fields and forceUpdate=true.
 * 5. After successful 200 update, caller may refresh local cached news data (handled outside or via callback here).
 */

// Keys for local cache
const PREF_CACHE_KEY = 'preferences_cache_v1';

export interface LocationPreference {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  placeId?: string;
  placeName?: string;
  address?: string;
  source?: string; // e.g., 'GPS' or 'reverse-geocode'
}

export interface PreferenceRecord {
  deviceId: string;
  userId?: string | null;
  languageId?: string | null;
  pushToken?: string | null;
  deviceModel?: string | null;
  location?: LocationPreference | null;
  updatedAt?: string;
  // Additional backend-provided fields allowed
  [k: string]: any;
}

export type PreferenceUpdateIntent = 'pushToken' | 'language' | 'location' | 'all';

export interface PreferenceUpdateInput {
  intent: PreferenceUpdateIntent;
  pushToken?: string | null;
  languageId?: string | null;
  location?: LocationPreference | null;
  forceUpdate?: boolean; // auto-set internally
}

export type PreferenceUpdateResponse = PreferenceRecord;

function buildPayload(base: PreferenceRecord, input: PreferenceUpdateInput): any {
  const payload: any = {
    deviceId: base.deviceId,
    deviceModel: base.deviceModel,
    userId: base.userId ?? null,
    forceUpdate: true,
  };
  switch (input.intent) {
    case 'pushToken':
      payload.pushToken = input.pushToken ?? null;
      break;
    case 'language':
      payload.languageId = input.languageId ?? null;
      break;
    case 'location':
      if (input.location) payload.location = input.location; else payload.location = null;
      break;
    case 'all':
      payload.pushToken = input.pushToken ?? null;
      payload.languageId = input.languageId ?? null;
      if (input.location !== undefined) payload.location = input.location;
      break;
  }
  return payload;
}

/** Fetch current preferences from backend */
export async function fetchPreferences(): Promise<PreferenceRecord | null> {
  try {
    const { deviceId, deviceModel } = await getDeviceIdentity();
    let userId: string | null = null;
    try {
      const tokens = await loadTokens();
      // Attempt multiple common shapes: user.id or user.userId
      const u: any = tokens?.user;
      userId = (u?.id || u?.userId || null) as string | null;
    } catch {}
    const params = new URLSearchParams({ deviceId });
    if (userId) params.set('userId', userId);
    const res = await request<any>(`/preferences?${params.toString()}`, { method: 'GET', timeoutMs: 20000 });
    const record: PreferenceRecord = {
      deviceId,
      deviceModel,
      userId,
      languageId: res?.data?.languageId ?? res?.languageId ?? null,
      pushToken: res?.data?.pushToken ?? res?.pushToken ?? null,
      location: res?.data?.location ?? res?.location ?? null,
      updatedAt: res?.data?.updatedAt ?? res?.updatedAt,
      ...res?.data,
    };
    await AsyncStorage.setItem(PREF_CACHE_KEY, JSON.stringify(record));
    return record;
  } catch (e) {
    console.warn('[PREF] fetch failed, using cache if present', (e as any)?.message);
    const cached = await AsyncStorage.getItem(PREF_CACHE_KEY);
    return cached ? JSON.parse(cached) as PreferenceRecord : null;
  }
}

/** Update preferences according to intent */
export async function updatePreferences(input: PreferenceUpdateInput): Promise<PreferenceUpdateResponse> {
  const { deviceId, deviceModel } = await getDeviceIdentity();
  let userId: string | null = null;
  try {
    const tokens = await loadTokens();
    const u: any = tokens?.user;
    userId = (u?.id || u?.userId || null) as string | null;
  } catch {}

  const base: PreferenceRecord = { deviceId, deviceModel, userId };
  const payload = buildPayload(base, input);
  if (input.intent === 'language') {
    console.log('[PREF][LANG] updatePreferences intent=language payload', { deviceId, userId, languageId: (payload as any).languageId });
  }

  // POST (or PATCH) - spec said /preferences/update; assuming POST
  const res = await request<any>('/preferences/update', { method: 'POST', body: payload });
  const merged: PreferenceRecord = {
    ...base,
    ...res?.data,
    languageId: payload.languageId ?? res?.data?.languageId ?? null,
    pushToken: payload.pushToken ?? res?.data?.pushToken ?? null,
    location: payload.location ?? res?.data?.location ?? null,
    updatedAt: res?.data?.updatedAt ?? new Date().toISOString(),
  };
  await AsyncStorage.setItem(PREF_CACHE_KEY, JSON.stringify(merged));
  return merged;
}

export async function getCachedPreferences(): Promise<PreferenceRecord | null> {
  const raw = await AsyncStorage.getItem(PREF_CACHE_KEY);
  return raw ? JSON.parse(raw) as PreferenceRecord : null;
}

/** Convenience wrappers */
export async function updatePushToken(pushToken: string | null) {
  return updatePreferences({ intent: 'pushToken', pushToken });
}
export async function updateLanguage(languageId: string | null) {
  return updatePreferences({ intent: 'language', languageId });
}
export async function updateLocation(location: LocationPreference | null) {
  return updatePreferences({ intent: 'location', location });
}
export async function updateAll(opts: { pushToken?: string | null; languageId?: string | null; location?: LocationPreference | null }) {
  return updatePreferences({ intent: 'all', pushToken: opts.pushToken ?? null, languageId: opts.languageId ?? null, location: opts.location });
}

/** Optionally: reconcile remote vs cache (fetch then merge) */
export async function reconcilePreferences(): Promise<PreferenceRecord | null> {
  const remote = await fetchPreferences();
  return remote;
}
