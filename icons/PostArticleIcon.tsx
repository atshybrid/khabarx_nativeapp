import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { Path, Rect } from 'react-native-svg';
import { AnimatedCircle, AnimatedPath, AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function PostArticleIcon({ size = 24, color = '#FF9933', animated = true, active = false }: Props) {
  const dash = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) return;
    if (active) {
      dash.setValue(0);
      Animated.timing(dash, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
      Animated.sequence([
        Animated.timing(badge, { toValue: 1.12, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(badge, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]).start();
    } else {
      Animated.timing(dash, { toValue: 0, duration: 260, easing: Easing.in(Easing.ease), useNativeDriver: Platform.OS !== 'web' }).start();
      Animated.timing(badge, { toValue: 1, duration: 120, useNativeDriver: false }).start();
    }
  }, [active, animated, dash, badge]);

  const line1Offset = dash.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const line2Offset = dash.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  const badgeR = badge.interpolate({ inputRange: [1, 1.12], outputRange: [3.0, 3.6] });

  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24">
      {/* document */}
      <Rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth={1.6} fill="none" />
      {/* lines */}
      <AnimatedPath d="M7 9h10" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="30" strokeDashoffset={line1Offset as any} />
      <AnimatedPath d="M7 13h6" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="20" strokeDashoffset={line2Offset as any} />
      {/* plus badge (top-right) */}
      <AnimatedCircle cx={17.2 as any} cy={7.2 as any} r={badgeR as any} fill={color} />
      <Path d="M17.2 5.8v2.8M15.8 7.2h2.8" stroke="#fff" strokeWidth={1.6 as any} strokeLinecap="round" />
    </AnimatedSvg>
  );
}
