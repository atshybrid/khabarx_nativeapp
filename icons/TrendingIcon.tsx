import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function TrendingIcon({ size = 24, color = '#032557', animated = true, active = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return;
    if (active) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [active, animated, scale]);
  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale }] }}>
      <Path d="M3 17l5-5 4 4 7-7 2 2-9 9-4-4-5 5z" fill={color} />
    </AnimatedSvg>
  );
}
