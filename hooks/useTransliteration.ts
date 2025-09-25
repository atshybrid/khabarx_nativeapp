import { useCallback, useEffect, useRef, useState } from 'react';
import { transliterateText } from '../services/api';

// Debug flag (enable by setting EXPO_PUBLIC_TRANSLIT_DEBUG=1/true/on in app config / env)
const DEBUG_TRANSLIT = (() => {
  try {
    const raw = String(process.env.EXPO_PUBLIC_TRANSLIT_DEBUG ?? '').toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
  } catch {
    return false;
  }
})();

export interface UseTransliterationOptions {
  languageCode: string | undefined; // target language code (e.g., 'te', 'hi')
  enabled?: boolean;                // global enable flag
  debounceMs?: number;              // delay before transliterating
  mode?: 'immediate' | 'on-boundary'; // immediate = transliterate whole value on each change; on-boundary = only transliterate last word after space/punctuation
}

export interface UseTransliterationResult {
  value: string;                      // transformed (display) value
  raw: string;                        // raw latin buffer (when enabled)
  setRaw: (v: string) => void;        // manually set raw input
  onChangeText: (next: string) => void; // handler for TextInput
  toggle: () => void;                 // flip enabled flag
  enabled: boolean;
  lastError: string | null;
  pending: boolean;                   // true while debounced transliteration running
}

// Utility: detect word boundary (space, punctuation, newline)
function endsWithBoundary(text: string): boolean {
  const hit = /[\s.,;:!?\n\r]$/.test(text);
  if (DEBUG_TRANSLIT) console.log('[translit] endsWithBoundary?', { text, hit });
  return hit;
}

export function useTransliteration(opts: UseTransliterationOptions): UseTransliterationResult {
  const { languageCode, enabled: initialEnabled = true, debounceMs = 160, mode = 'on-boundary' } = opts;
  const [enabled, setEnabled] = useState<boolean>(!!initialEnabled);
  const [raw, setRaw] = useState('');
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const debTimer = useRef<any>(null);
  const lastLangRef = useRef<string | undefined>(languageCode);

  // When language changes, re-run transliteration across full buffer
  useEffect(() => {
    if (languageCode !== lastLangRef.current) {
      if (DEBUG_TRANSLIT) console.log('[translit] language change', { from: lastLangRef.current, to: languageCode, hasRaw: !!raw });
      lastLangRef.current = languageCode;
      if (enabled && raw) {
        queueTransliteration(raw, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageCode]);

  const performTransliteration = useCallback(async (text: string, forceFull?: boolean) => {
    if (!enabled || !languageCode) {
      setValue(text);
      return;
    }
    const shouldFull = mode === 'immediate' || forceFull;
    if (DEBUG_TRANSLIT) console.log('[translit] perform start', { text, forceFull, mode, shouldFull });

    // Strategy: only transliterate the last pure Latin token; preserve earlier content.
    // This solves case: first word typed in Telugu (native keyboard) then space + Latin word ("nenu ") expecting transliteration of Latin part only.
    let prefix = '';
    let targetToken = text;

    if (!shouldFull && mode === 'on-boundary') {
      // We only proceed when user ended a word OR forced
      if (!endsWithBoundary(text)) {
        if (DEBUG_TRANSLIT) console.log('[translit] abort perform - no boundary yet');
        setValue(text);
        return;
      }
    }

    if (!shouldFull) {
      // Capture final Latin token + trailing boundary (space/punct)
      // Examples:
      //  "తెలుగు nenu " => prefix="తెలుగు ", token="nenu"
      //  "nenu " => prefix="", token="nenu"
      const m = /(.*?)([A-Za-z]+)([\s.,;:!?]*)$/.exec(text);
      if (m) {
        prefix = m[1];
        targetToken = m[2];
        if (DEBUG_TRANSLIT) console.log('[translit] token match', { prefix, targetToken, trailing: m[3] });
      } else {
        if (DEBUG_TRANSLIT) console.log('[translit] no latin token found, skipping');
        setValue(text);
        return;
      }
    }

    setPending(true);
    try {
      const inputForApi = shouldFull ? text : targetToken;
      if (DEBUG_TRANSLIT) console.log('[translit] calling API', { inputForApi, languageCode });
      const res = await transliterateText(inputForApi, languageCode);
      if (res?.result) {
        const out = shouldFull ? res.result : prefix + res.result + text.slice(prefix.length + targetToken.length);
        if (DEBUG_TRANSLIT) console.log('[translit] success', { out, detected: res.detected });
        setValue(out);
      } else {
        if (DEBUG_TRANSLIT) console.log('[translit] empty result, keeping original', { error: res?.error });
        setValue(text);
      }
      setLastError(null);
    } catch (e: any) {
      if (DEBUG_TRANSLIT) console.log('[translit] error', { message: e?.message });
      setLastError(e?.message || 'transliteration_failed');
      setValue(text);
    } finally {
      setPending(false);
    }
  }, [enabled, languageCode, mode]);

  const queueTransliteration = useCallback((text: string, forceFull?: boolean) => {
    if (debTimer.current) clearTimeout(debTimer.current);
    if (DEBUG_TRANSLIT) console.log('[translit] queue', { text, forceFull, debounceMs });
    debTimer.current = setTimeout(() => {
      if (DEBUG_TRANSLIT) console.log('[translit] debounce fire', { text, forceFull });
      performTransliteration(text, forceFull);
    }, debounceMs);
  }, [performTransliteration, debounceMs]);

  const onChangeText = useCallback((next: string) => {
    if (DEBUG_TRANSLIT) console.log('[translit] onChangeText', { next, enabled, languageCode, mode });
    setRaw(next);
    if (!enabled || !languageCode) {
      setValue(next);
      return;
    }
    if (mode === 'immediate') {
      queueTransliteration(next, true);
      return;
    }
    if (endsWithBoundary(next)) {
      queueTransliteration(next, false);
    } else {
      setValue(next);
    }
  }, [enabled, languageCode, mode, queueTransliteration]);

  const toggle = useCallback(() => {
    if (DEBUG_TRANSLIT) console.log('[translit] toggle');
    setEnabled(e => !e);
  }, []);

  return { value, raw, setRaw: onChangeText, onChangeText, toggle, enabled, lastError, pending };
}

export default useTransliteration;
