import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'device_id';

export type DeviceIdentity = {
  deviceId: string;
  deviceModel?: string;
};

function randomId(len = 24) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Persist a stable deviceId in AsyncStorage (can be upgraded to SecureStore if dependency is added)
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  let deviceId = (await AsyncStorage.getItem(DEVICE_ID_KEY)) || '';
  if (!deviceId) {
    deviceId = randomId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  const deviceModel = Platform.OS === 'ios' ? 'iOS Device' : Platform.OS === 'android' ? 'Android Device' : 'Unknown Device';
  return { deviceId, deviceModel };
}
