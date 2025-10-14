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
      // Suppress very common / noisy validation 400 toasts; UI often handles them locally
      if (err?.status === 400) {
        const raw = (err?.body?.message || err?.message || '').toLowerCase();
        if (raw.startsWith('http 400')) return null; // generic
        if (raw.includes('validation') || raw.includes('invalid')) return null; // let field-level errors surface
      }
      // Suppress expected 404s for membership/profile bootstrap (we handle fallback silently)
      if (err?.status === 404 && ctx?.path) {
        const p = ctx.path;
        if (p === '/memberships/me' || p === '/memberships/me/profile' || p === '/profiles/me') return null;
      }
      if (err?.status === 401 || err?.status === 403) return 'Session expired. Please sign in again.';
      if (err?.status === 404) return 'Resource not found.';
      if (err?.status === 429) return 'Too many requests. Slow down a bit.';
      if (err?.status >= 500) return 'Server error. Please try again shortly.';
      const msg = err?.message || err?.body?.message || 'Network error';
      return String(msg);
    }

    const unsubscribe = onHttpError((err, ctx) => {
      const mapped = mapMessage(err, ctx as any);
      if (!mapped) return; // suppressed
      showToast(mapped);
    });
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); unsubscribe(); };
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
