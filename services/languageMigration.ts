import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLanguages } from './api';

/**
 * Migrates previously stored language selection that used legacy numeric IDs ("1","2", etc.)
 * to the new server-provided UUID style IDs. We detect legacy by id being purely digits and
 * attempt to map by language.code (preferred) or name.
 * Safe to run multiple times – it will no-op once migrated.
 */
export async function migrateLegacySelectedLanguage(): Promise<{ migrated: boolean; from?: any; to?: any; reason?: string }> {
  try {
    const raw = await AsyncStorage.getItem('selectedLanguage');
    if (!raw) return { migrated: false, reason: 'no-selected-language' };
    let stored: any;
    try { stored = JSON.parse(raw); } catch { return { migrated: false, reason: 'parse-failed' }; }
    if (!stored || typeof stored !== 'object') return { migrated: false, reason: 'invalid-shape' };
    const id: string | undefined = stored.id;
    const code: string | undefined = stored.code;
    if (!id) return { migrated: false, reason: 'no-id' };
    // Legacy heuristic: purely numeric id and short (<4) – our new UUID-like ids are alpha-numeric and longer
    const isLegacy = /^\d+$/.test(id);
    if (!isLegacy) return { migrated: false, reason: 'already-new-format' };

    // Fetch current language list (cached or server). If that fails, bail gracefully.
    let live: any[] = [];
    try { live = await getLanguages(); } catch (e) {
      console.log('[LANG_MIGRATE] getLanguages failed – keeping legacy id', (e as any)?.message || e);
      return { migrated: false, reason: 'fetch-failed' };
    }

    // Try match by code first, else by name (case-insensitive)
    const norm = (s: string) => s.toLowerCase();
    let candidate = live.find(l => code && norm(l.code) === norm(code));
    if (!candidate && stored.name) {
      candidate = live.find(l => norm(l.name) === norm(stored.name));
    }

    if (!candidate) {
      return { migrated: false, reason: 'no-match-live-list' };
    }

    if (candidate.id === id) {
      // Edge case: server still returns numeric (unlikely) – treat as no migration needed
      return { migrated: false, reason: 'match-has-same-id' };
    }

    const next = { id: candidate.id, code: candidate.code, name: candidate.name, nativeName: candidate.nativeName };
    try { await AsyncStorage.setItem('selectedLanguage', JSON.stringify(next)); } catch {}
    console.log('[LANG_MIGRATE] Migrated legacy selectedLanguage', { from: stored, to: next });
    return { migrated: true, from: stored, to: next };
  } catch (e) {
    console.log('[LANG_MIGRATE] Unexpected failure', (e as any)?.message || e);
    return { migrated: false, reason: 'unexpected-error' };
  }
}

/** Optional helper to migrate any cached categories keyed by old numeric language id.
 * Currently NO-OP because we allow caches to repopulate lazily. Left as placeholder.
 */
export async function migrateLegacyCategoryCache(): Promise<void> {
  // Intentionally blank – implement if numeric id based cache must be retained.
}
