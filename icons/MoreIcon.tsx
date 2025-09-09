import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { AnimatedCircle, AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function MoreIcon({ size = 24, color = '#FF9933', animated = true, active = false }: Props) {
  const b1 = useRef(new Animated.Value(0)).current;
  const b2 = useRef(new Animated.Value(0)).current;
  const b3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    if (active) {
      Animated.sequence([
        Animated.timing(b1, { toValue: 1, duration: 160, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(b2, { toValue: 1, duration: 160, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(b3, { toValue: 1, duration: 160, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(b1, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.timing(b2, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.timing(b3, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [active, animated, b1, b2, b3]);

  const tY1 = b1.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const tY2 = b2.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const tY3 = b3.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24">
      <AnimatedCircle cx="5"  cy={12 as any} r="2" fill={color} style={{ transform: [{ translateY: tY1 }] }} />
      <AnimatedCircle cx="12" cy={12 as any} r="2" fill={color} style={{ transform: [{ translateY: tY2 }] }} />
      <AnimatedCircle cx="19" cy={12 as any} r="2" fill={color} style={{ transform: [{ translateY: tY3 }] }} />
    </AnimatedSvg>
  );
}
