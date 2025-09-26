import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_MODE = 'app_lock_mode'; // 'off' | 'biometric' | 'mpin' | 'both'
const KEY_MPIN_HASH = 'app_lock_mpin_hash';

export type AppLockMode = 'off' | 'biometric' | 'mpin' | 'both';

export async function getLockMode(): Promise<AppLockMode> {
  const v = (await AsyncStorage.getItem(KEY_MODE)) || 'off';
  if (v === 'biometric' || v === 'mpin' || v === 'both') return v;
  return 'off';
}

export async function setLockMode(mode: AppLockMode): Promise<void> {
  await AsyncStorage.setItem(KEY_MODE, mode);
}

async function sha256(input: string): Promise<string> {
  try {
    const Crypto = await import('expo-crypto');
    const digest = await (Crypto as any).digestStringAsync((Crypto as any).DigestAlgorithm.SHA256, input);
    return digest;
  } catch {
    // Fallback: naive hash (NOT secure) to avoid type/runtime issues if expo-crypto unavailable
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }
}

export async function setMpin(mpin: string): Promise<void> {
  const clean = (mpin || '').trim();
  if (!/^\d{4,6}$/.test(clean)) throw new Error('MPIN must be 4-6 digits');
  const hash = await sha256(`khabarx:${clean}:v1`);
  await AsyncStorage.setItem(KEY_MPIN_HASH, hash);
}

export async function hasMpin(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(KEY_MPIN_HASH));
}

export async function verifyMpin(mpin: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(KEY_MPIN_HASH);
  if (!stored) return false;
  const hash = await sha256(`khabarx:${(mpin || '').trim()}:v1`);
  return stored === hash;
}

export type BiometricSupport = { available: boolean; enrolled: boolean; type?: string };

export async function getBiometricSupport(): Promise<BiometricSupport> {
  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const avail = await (LocalAuthentication as any).hasHardwareAsync();
    const enrolled = await (LocalAuthentication as any).isEnrolledAsync();
    const types = await (LocalAuthentication as any).supportedAuthenticationTypesAsync?.().catch(() => []);
    const type = Array.isArray(types) && types.length ? String(types[0]) : undefined;
    return { available: !!avail, enrolled: !!enrolled, type };
  } catch {
    return { available: false, enrolled: false };
  }
}

export async function promptBiometric(reason = 'Unlock'): Promise<boolean> {
  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const res = await (LocalAuthentication as any).authenticateAsync({ promptMessage: reason });
    return !!res?.success;
  } catch {
    return false;
  }
}
