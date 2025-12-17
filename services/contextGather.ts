import { LANGUAGES } from '@/constants/languages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export interface GatheredContext {
  pushToken?: string;
  languageId?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    provider?: string;
    timestampUtc?: string;
    source?: string;
  };
}

export async function gatherRegistrationContext(): Promise<GatheredContext> {
  const out: GatheredContext = {};
  try {
    out.languageId = await resolveLanguageIdFromStorage();
  } catch {}
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) throw new Error('push denied');
    }
    const tokenData = await Notifications.getExpoPushTokenAsync();
    out.pushToken = tokenData.data;
  } catch {}
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      out.location = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracyMeters: loc.coords.accuracy || undefined,
        provider: loc.coords.altitude ? 'gps' : 'network',
        timestampUtc: new Date(loc.timestamp).toISOString(),
        source: 'device',
      };
    }
  } catch {}
  if (!out.languageId) {
    out.languageId = DEFAULT_LANGUAGE_ID;
  }
  return out;
}

const DEFAULT_LANGUAGE_ID = (() => {
  try {
    const envValue = String(process.env.EXPO_PUBLIC_DEFAULT_LANGUAGE_ID || '').trim();
    if (envValue) return envValue;
  } catch {}
  return LANGUAGES[0]?.id || '1';
})();

async function resolveLanguageIdFromStorage(): Promise<string | undefined> {
  const jsonKeys = ['selectedLanguage', 'language_local'];
  for (const key of jsonKeys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      const parsedId = parseLanguageId(raw);
      if (parsedId) return parsedId;
    } catch {}
  }
  const directKeys = ['authLanguageId', 'languageId'];
  for (const key of directKeys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      const parsedId = parseLanguageId(raw);
      if (parsedId) return parsedId;
    } catch {}
  }
  return undefined;
}

function parseLanguageId(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return trimmed;
  try {
    const parsed = JSON.parse(raw);
    const id = parsed?.id
      || parsed?.languageId
      || parsed?.value?.id
      || parsed?.value?.languageId;
    if (id) return String(id);
    const code = parsed?.code || parsed?.slug;
    if (code) {
      const match = LANGUAGES.find(lang => lang.code.toLowerCase() === String(code).toLowerCase());
      if (match?.id) return String(match.id);
    }
  } catch {}
  return undefined;
}
