import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { AnimatedCircle } from './common';

type Props = {
  size?: number;
  coinColor?: string; // outer coin color
  accentColor?: string; // inner accent/glow
  strokeColor?: string; // rupee symbol color
  animated?: boolean;
  flat?: boolean; // render just the glyph, no coin/bg
};

export default function RupeeDonationIcon({
  size = 30,
  coinColor = '#fa7c05',
  accentColor = '#ffd199',
  strokeColor = '#ffffff',
  animated = true,
  flat = false,
}: Props) {
  const bob = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const coinY = useRef(new Animated.Value(0)).current;
  const coinOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    bobLoop.start();
    pulseLoop.start();
    // small coin drop loop (for donation feel)
    const coinLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(coinOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(coinY, { toValue: -6, duration: 0, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(coinOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(coinY, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(coinOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(700),
      ])
    );
    coinLoop.start();
    return () => {
      bobLoop.stop();
      pulseLoop.stop();
      coinLoop.stop();
    };
  }, [animated, bob, pulse, coinY, coinOpacity]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -1.6] });

  return (
    <Animated.View style={{ transform: [{ translateY }, { scale: pulse }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Coin drop (render only in flat mode to avoid double-circle look) */}
        {flat && (
          <AnimatedCircle
            cx={12}
            cy={7}
            r={2.1}
            fill={accentColor}
            opacity={0.6}
            // animate translateY via Animated props wrapper
            // @ts-ignore react-native-svg supports animated props
            style={{ transform: [{ translateY: coinY }], opacity: coinOpacity }}
          />
        )}
        {!flat && (
          <>
            {/* Coin base */}
            <Circle cx={12} cy={12} r={11} fill={coinColor} />
            {/* Inner glow */}
            <Circle cx={12} cy={12} r={9} fill={accentColor} opacity={0.35} />
          </>
        )}
        {/* Rupee symbol (stylized) */}
        <G stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* top bar */}
          <Path d="M7 7.25 H17" />
          {/* mid bar */}
          <Path d="M7 9.6 H15.2" />
          {/* vertical stem */}
          <Path d="M7 7.25 V12.2" />
          {/* diagonal leg */}
          <Path d="M7 12.2 L15.5 16.75" />
        </G>
      </Svg>
    </Animated.View>
  );
}
