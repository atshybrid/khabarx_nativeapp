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
  const rawRef = useRef<string>('');
  const valueRef = useRef<string>('');
  const opSeqRef = useRef<number>(0); // async op seq id

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

  useEffect(() => { rawRef.current = raw; }, [raw]);
  useEffect(() => { valueRef.current = value; }, [value]);

  const performTransliteration = useCallback(async (text: string, forceFull?: boolean, opIdParam?: number) => {
    if (!enabled || !languageCode) {
      if (valueRef.current !== text) setValue(text);
      return;
    }
    // Assign/gate operation id to avoid stale overwrites
    let opId = opIdParam;
    if (opId == null) {
      opSeqRef.current += 1;
      opId = opSeqRef.current;
    }
    // Decide scope for transliteration in on-boundary mode: only last token if not forced
    const shouldFull = mode === 'immediate' || forceFull;
    let toProcess = text;
    let prefix = '';
    let suffix = '';
    if (!shouldFull && mode === 'on-boundary') {
      // Only transliterate when boundary present; otherwise, show as-is
      if (!endsWithBoundary(text)) {
        if (valueRef.current !== text) setValue(text);
        return;
      }
      // With boundary at end, strip trailing boundary to find the last Latin token
      const mSuffix = /[\s.,;:!?\n\r]+$/.exec(text);
      suffix = mSuffix ? mSuffix[0] : '';
      const base = suffix ? text.slice(0, -suffix.length) : text;
      // Split into prefix + lastToken from base
      const match = /(.*?)([A-Za-z]+)$/.exec(base);
      if (match) {
        prefix = match[1];
        toProcess = match[2];
      } else {
        // No Latin token found; keep text unchanged
        if (valueRef.current !== text) setValue(text);
        return;
      }
    }
    setPending(true);
    try {
      const res = await transliterateText(toProcess, languageCode);
      // Discard stale result if a newer op started
      if (opId !== opSeqRef.current) return;
      if (res?.result) {
        const newVal = prefix + res.result + suffix;
        if (valueRef.current !== newVal) setValue(newVal);
      } else {
        if (valueRef.current !== text) setValue(text);
      }
      setLastError(null);
    } catch (e: any) {
      setLastError(e?.message || 'transliteration_failed');
      if (opId === opSeqRef.current && valueRef.current !== text) setValue(text);
    } finally {
      if (opId === opSeqRef.current) setPending(false);
    }
  }, [enabled, languageCode, mode]);

  const queueTransliteration = useCallback((text: string, forceFull?: boolean) => {
    if (debTimer.current) clearTimeout(debTimer.current);
    opSeqRef.current += 1;
    const opId = opSeqRef.current;
    debTimer.current = setTimeout(() => {
      performTransliteration(text, forceFull, opId);
    }, debounceMs);
  }, [performTransliteration, debounceMs]);

  const onChangeText = useCallback((next: string) => {
    setRaw(next);
    rawRef.current = next;
    if (!enabled || !languageCode) {
      if (valueRef.current !== next) setValue(next);
      return;
    }
    // Immediate mode: transliterate entire buffer every keystroke (debounced)
    if (mode === 'immediate') {
      queueTransliteration(next, true);
      return;
    }
    // on-boundary mode: transliterate only after boundary (space/punctuation), and only last word
    if (endsWithBoundary(next)) {
      // Process immediately at boundary to avoid visible lag/flicker
      if (debTimer.current) clearTimeout(debTimer.current);
      opSeqRef.current += 1;
      const opId = opSeqRef.current;
      performTransliteration(next, false, opId);
      return;
    }
    // No boundary yet: keep as typed and cancel any pending op
    if (debTimer.current) clearTimeout(debTimer.current);
    opSeqRef.current += 1; // invalidate in-flight ops
    if (valueRef.current !== next) setValue(next);
  }, [enabled, languageCode, mode, queueTransliteration, performTransliteration]);

  const toggle = useCallback(() => setEnabled(e => !e), []);

  return { value, raw, setRaw: onChangeText, onChangeText, toggle, enabled, lastError, pending };
}

export default useTransliteration;
