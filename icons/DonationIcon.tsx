import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean };

export default function DonationIcon({ size = 30, color = '#FF9933', animated = true }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, pulse]);

  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale: pulse }] }}>
      <Path d="M12 21s-6.5-4.35-9.33-8.09C-1.2 7.56 4.5 2 12 8.5 19.5 2 25.2 7.56 21.33 12.91 18.5 16.65 12 21 12 21z" fill={color} />
    </AnimatedSvg>
  );
}
