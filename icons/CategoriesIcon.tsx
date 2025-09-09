import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Rect } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function CategoriesIcon({ size = 24, color = '#FF9933', animated = true, active = false }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    if (active) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1)), useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start();
    }
  }, [active, animated, anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale }] }}>
      <Rect x="3"  y="3"  width="7" height="7" rx="1.5" fill={color} />
      <Rect x="14" y="3"  width="7" height="7" rx="1.5" fill={color} />
      <Rect x="3"  y="14" width="7" height="7" rx="1.5" fill={color} />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" fill={color} />
    </AnimatedSvg>
  );
}
