import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  isCircle?: boolean;
};

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style, isCircle }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-150, 300] });

  const containerStyle = useMemo(
    () => [
      styles.container,
      { width: width as any, height: height as any, borderRadius: isCircle ? 9999 : borderRadius },
      style,
    ],
    [width, height, borderRadius, isCircle, style]
  );

  return (
    <View style={containerStyle}>
      <AnimatedGradient
        colors={["#e5e7eb", "#f3f4f6", "#e5e7eb"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.shimmer, { transform: [{ translateX }] }]}
      />
    </View>
  );
}

export function SkeletonBlock({ lines = 3, width = '100%', lineHeight = 12, gap = 8 }: { lines?: number; width?: number | string; lineHeight?: number; gap?: number }) {
  return (
    <View style={{ width: width as any }}>
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={{ marginBottom: i === lines - 1 ? 0 : gap }}>
          <Skeleton width={width} height={lineHeight} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  shimmer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 150,
  },
});

export default Skeleton;
