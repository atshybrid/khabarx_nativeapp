import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function ProfileIcon({ size = 24, color = '#032557', animated = true, active = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return;
    if (active) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [active, animated, scale]);
  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale }] }}>
      <Path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-9 9a9 9 0 1 1 18 0H3z" fill={color} />
    </AnimatedSvg>
  );
}
