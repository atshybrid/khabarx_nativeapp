import { onHttpError } from '@/services/http';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated as RNAnimated, StyleSheet, Text } from 'react-native';

export default function Toast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string>('');
  const opacity = useMemo(() => new RNAnimated.Value(0), []);

  useEffect(() => {
    const unsubscribe = onHttpError((err) => {
      const msg = (err as any)?.message || 'Network error';
      setMessage(String(msg));
      setVisible(true);
      RNAnimated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        setTimeout(() => {
          RNAnimated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
        }, 2500);
      });
    });
    return () => { unsubscribe(); };
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
