import AsyncStorage from '@react-native-async-storage/async-storage';

type DumpOptions = {
  includeValues?: boolean; // if false, only list keys
  maxValueLength?: number; // truncate large values (default 400 chars)
  filterPrefix?: string; // only include keys starting with prefix
};

export async function logAllStorage(opts: DumpOptions = {}) {
  const { includeValues = true, maxValueLength = 400, filterPrefix } = opts;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const filtered = filterPrefix ? keys.filter(k => k.startsWith(filterPrefix)) : keys;
    const pairs = includeValues ? await AsyncStorage.multiGet(filtered) : filtered.map(k => [k, '']);
    let totalBytes = 0;
    const entries = pairs.map(([k, v]) => {
      const size = v ? (new TextEncoder().encode(v).length) : 0;
      totalBytes += size;
      return { key: k, size, value: includeValues ? (v && v.length > maxValueLength ? v.slice(0, maxValueLength) + '…(truncated)' : v) : undefined };
    });
    entries.sort((a, b) => b.size - a.size);
    console.log('[STORAGE][DUMP] Keys:', entries.length);
    entries.forEach(e => console.log(`[STORAGE] ${e.key} (${e.size}B)${e.value != null ? ' = ' + e.value : ''}`));
    console.log('[STORAGE][SUMMARY]', {
      totalKeys: entries.length,
      totalBytes,
      approxKB: Math.round(totalBytes / 10.24) / 100,
      largest: entries.slice(0, 3).map(e => ({ key: e.key, size: e.size })),
    });
  } catch (e) {
    console.warn('[STORAGE][DUMP] failed', e instanceof Error ? e.message : e);
  }
}

export async function logStorageKey(key: string) {
  try {
    const v = await AsyncStorage.getItem(key);
    console.log('[STORAGE][KEY]', key, v);
  } catch (e) {
    console.warn('[STORAGE][KEY] failed', key, e instanceof Error ? e.message : e);
  }
}

export async function removeStorageKey(key: string) {
  try {
    await AsyncStorage.removeItem(key);
    console.log('[STORAGE][REMOVE] success', key);
  } catch (e) {
    console.warn('[STORAGE][REMOVE] failed', key, e instanceof Error ? e.message : e);
  }
}

export async function storageHealthCheck() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const suspicious = keys.filter(k => /cache|token|pref|news/i.test(k));
    console.log('[STORAGE][HEALTH]', { totalKeys: keys.length, suspiciousCount: suspicious.length });
    return { totalKeys: keys.length, suspicious };
  } catch (e) {
    console.warn('[STORAGE][HEALTH] failed', e instanceof Error ? e.message : e);
    return { totalKeys: 0, suspicious: [] };
  }
}
