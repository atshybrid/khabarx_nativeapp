import { on as onEvent } from '@/services/events';
import { onHttpError } from '@/services/http';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated as RNAnimated, StyleSheet, Text } from 'react-native';

export default function Toast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string>('');
  const opacity = useMemo(() => new RNAnimated.Value(0), []);

  const hideTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function showToast(msg: string) {
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
      setMessage(msg);
      setVisible(true);
      RNAnimated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        hideTimer.current = setTimeout(() => {
          RNAnimated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
        }, 2600);
      });
    }

    function mapMessage(err: any, ctx?: { path: string; method: string }): string | null {
      const bodyMsg: string | undefined = err?.body?.message || err?.body?.error || undefined;
      const errMsg: string = err?.message || bodyMsg || '';
      const raw = (bodyMsg || errMsg || '').toLowerCase();

      // Suppress very common / noisy validation 400 toasts; UI often handles them locally
      if (err?.status === 400) {
        if (raw.startsWith('http 400')) return null; // generic
        if (raw.includes('validation') || raw.includes('invalid')) return null; // let field-level errors surface
        // Otherwise show server-provided message or fallback
        return bodyMsg || errMsg || 'Request error';
      }

      // Suppress expected 404s for membership/profile bootstrap (we handle fallback silently)
      if (err?.status === 404 && ctx?.path) {
        const p = ctx.path;
        if (p === '/memberships/me' || p === '/memberships/me/profile' || p === '/profiles/me') return null;
      }
      if (err?.status === 401 || err?.status === 403) return 'Session expired. Please sign in again.';
      if (err?.status === 404) return bodyMsg || 'Resource not found.';
      if (err?.status === 429) return bodyMsg || 'Too many requests. Slow down a bit.';
      if (err?.status >= 500) return bodyMsg || 'Server error. Please try again shortly.';
      const msg = bodyMsg || errMsg || 'Network error';
      return String(msg);
    }

    const unsubscribe = onHttpError((err, ctx) => {
      const mapped = mapMessage(err, ctx as any);
      if (!mapped) return; // suppressed
      showToast(mapped);
    });
    // Also listen for explicit toast events
    const offToast = onEvent('toast:show', ({ message }) => {
      if (message) showToast(message);
    });

    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); unsubscribe(); offToast(); };
  }, [opacity]);

  if (!visible) return null;
  return (
    <RNAnimated.View style={[styles.container, { opacity }] }>
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  text: {
    color: '#fff',
    fontSize: 14,
  },
});
