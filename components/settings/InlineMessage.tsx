import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text, ViewStyle } from 'react-native';

export interface InlineMessageProps {
  type: 'success' | 'error' | 'info';
  text: string;
  autoHideMs?: number;
  onHide?: () => void;
  style?: ViewStyle;
}

export const InlineMessage: React.FC<InlineMessageProps> = ({ type, text, autoHideMs = 3500, onHide, style }) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (autoHideMs > 0) {
      const id = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
          if (finished && onHide) onHide();
        });
      }, autoHideMs);
      return () => clearTimeout(id);
    }
  }, [autoHideMs, onHide, opacity]);

  return (
    <Animated.View style={[styles.base, styles[type], { opacity }, style]}> 
      <Text style={styles.txt}>{text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  success: { backgroundColor: '#dcfce7' },
  error: { backgroundColor: '#fee2e2' },
  info: { backgroundColor: '#e0f2fe' },
  txt: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
});

export default InlineMessage;
