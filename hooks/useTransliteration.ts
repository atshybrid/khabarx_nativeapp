import { useCallback, useEffect, useRef, useState } from 'react';
import { transliterateText } from '../services/api';

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
  return /[\s.,;:!?\n\r]$/.test(text);
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
    // Decide scope for transliteration in on-boundary mode: only last token if not forced
    const shouldFull = mode === 'immediate' || forceFull;
    let toProcess = text;
    let prefix = '';
    if (!shouldFull && mode === 'on-boundary') {
      // Split into prefix + lastToken
      const match = /(.*?)([A-Za-z]+)$/.exec(text);
      if (match) {
        prefix = match[1];
        toProcess = match[2];
        // If previous char before token is target script char we skip transliteration of this token
        // (the services/api transliterateText already guards Latin-after-target, this is extra)
      }
      if (!endsWithBoundary(text) && !shouldFull) {
        // Not at boundary yet: show raw text unchanged
        setValue(text);
        return;
      }
    }
    setPending(true);
    try {
      const res = await transliterateText(toProcess, languageCode);
      if (res?.result) {
        const newVal = prefix + res.result;
        setValue(newVal);
      } else {
        setValue(text);
      }
      setLastError(null);
    } catch (e: any) {
      setLastError(e?.message || 'transliteration_failed');
      setValue(text);
    } finally {
      setPending(false);
    }
  }, [enabled, languageCode, mode]);

  const queueTransliteration = useCallback((text: string, forceFull?: boolean) => {
    if (debTimer.current) clearTimeout(debTimer.current);
    debTimer.current = setTimeout(() => {
      performTransliteration(text, forceFull);
    }, debounceMs);
  }, [performTransliteration, debounceMs]);

  const onChangeText = useCallback((next: string) => {
    setRaw(next);
    if (!enabled || !languageCode) {
      setValue(next);
      return;
    }
    // Immediate mode: transliterate entire buffer every keystroke (debounced)
    if (mode === 'immediate') {
      queueTransliteration(next, true);
      return;
    }
    // on-boundary mode enhancements:
    // 1. If this is the very first token (no spaces, only Latin letters so far), transliterate eagerly after debounce even without boundary.
    // 2. Otherwise wait for boundary as before.
    const noBoundaryYet = !/\s/.test(next);
    const singleLatinToken = /^[A-Za-z]+$/.test(next);
    if (noBoundaryYet && singleLatinToken) {
      // first word being typed - transliterate eagerly so user sees Telugu immediately
      queueTransliteration(next, true);
      return;
    }
    if (endsWithBoundary(next)) {
      queueTransliteration(next, true);
    } else {
      setValue(next);
    }
  }, [enabled, languageCode, mode, queueTransliteration]);

  const toggle = useCallback(() => setEnabled(e => !e), []);

  return { value, raw, setRaw: onChangeText, onChangeText, toggle, enabled, lastError, pending };
}

export default useTransliteration;
