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
    const raw = await AsyncStorage.getItem('selectedLanguage');
    if (raw) {
      try { out.languageId = JSON.parse(raw)?.id; } catch {}
    }
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
  return out;
}
