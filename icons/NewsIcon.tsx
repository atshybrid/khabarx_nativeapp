import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path, Rect } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

// Simple newspaper-like glyph
export default function NewsIcon({ size = 24, color = '#032557', animated = true, active = false }: Props) {
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

  /*
    Icon layout (24x24):
    - Outer rounded rect newspaper body
    - Left big headline rect
    - Right stacked small lines
  */
  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale }] }}>
      <Path
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6z"
        fill={color}
        fillOpacity={0.12}
      />
      <Path
        d="M6 5h12a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1zm0 0"
        fill={color}
        fillOpacity={0.12}
      />
      {/* Headline block */}
      <Rect x={7} y={7} width={7} height={5} rx={1} fill={color} />
      {/* Right column small lines */}
      <Rect x={15.5} y={7} width={2.5} height={1.6} rx={0.8} fill={color} />
      <Rect x={15.5} y={9.2} width={2.5} height={1.6} rx={0.8} fill={color} />
      <Rect x={7} y={13.5} width={11} height={1.6} rx={0.8} fill={color} />
      <Rect x={7} y={16} width={11} height={1.6} rx={0.8} fill={color} />
    </AnimatedSvg>
  );
}
