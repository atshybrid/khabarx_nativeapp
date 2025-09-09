import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function PlusIcon({ size = 28, color = '#fa7c05', animated = true, active = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return;
    if (active) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 160, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 160, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [active, animated, scale]);
  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale }] }}>
      <Path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z" fill={color} />
    </AnimatedSvg>
  );
}
