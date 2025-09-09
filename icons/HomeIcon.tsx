import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function HomeIcon({ size = 24, color = '#032557', animated = true, active = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) return;
    if (active) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.14, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [active, animated, scale]);

  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale }] }}>
      <Path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10z" fill={color} />
    </AnimatedSvg>
  );
}
