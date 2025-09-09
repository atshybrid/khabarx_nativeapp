import { Colors } from '@/constants/Colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { RupeeDonationIcon } from '@/icons';
import { BottomTabBar, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AutoHideTabBar(props: BottomTabBarProps) {
  const { isTabBarVisible } = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const animatedRef = useRef(new Animated.Value(isTabBarVisible ? 1 : 0));
  const scaleRef = useRef(new Animated.Value(0.98));
  const fabScale = useRef(new Animated.Value(1));

  const routes = props.state.routes;
  const activeIndex = props.state.index;
  const activeRouteName = routes[activeIndex]?.name;
  const hiddenOnRoute = activeRouteName === 'explore' || activeRouteName === 'tech' || activeRouteName === 'media';
  const shouldShow = isTabBarVisible && !hiddenOnRoute;

  React.useEffect(() => {
    Animated.timing(animatedRef.current, {
      toValue: shouldShow ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
    if (shouldShow) {
      Animated.spring(scaleRef.current, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else {
      scaleRef.current.setValue(0.98);
    }
  }, [shouldShow]);

  const translateY = animatedRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: [measuredHeight + Math.max(insets.bottom, 0), 0],
  });

  // Solid background (100% white)

  // Active indicator (removed) positioning placeholder
  const tabCount = routes.length || 1;
  const tabWidth = containerWidth > 0 ? containerWidth / tabCount : 0;
  const pillWidth = 38;
  const pillLeft = Math.max(0, activeIndex * tabWidth + (tabWidth - pillWidth) / 2);

  React.useEffect(() => {
    // scale FAB when focused
    const mediaIdx = routes.findIndex(r => r.name === 'media');
    const focused = mediaIdx === activeIndex;
    Animated.spring(fabScale.current, {
      toValue: focused ? 1.06 : 1,
      useNativeDriver: true,
      bounciness: 8,
      speed: 10,
    }).start();
  }, [pillLeft, activeIndex, routes]);

  const onContainerLayout = (e: any) => setContainerWidth(e.nativeEvent.layout.width);
  const goToMedia = () => {
    const mediaIdx = routes.findIndex(r => r.name === 'media');
    if (mediaIdx >= 0) props.navigation.navigate(routes[mediaIdx].name as never);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          transform: [{ translateY }],
        },
      ]}
      onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
  pointerEvents={shouldShow ? 'auto' : 'none'}
  accessibilityElementsHidden={!shouldShow}
  importantForAccessibility={shouldShow ? 'yes' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.shadowWrap, { transform: [{ scale: scaleRef.current }] }]}>
        <View style={styles.inner} onLayout={onContainerLayout}>
          <BottomTabBar {...props} />
        </View>
        {/* Floating center FAB (clickable). Hide if tab bar hidden */}
        {!hiddenOnRoute && (
          <Animated.View style={[styles.fabWrap, { transform: [{ scale: fabScale.current }] }]}> 
          <Pressable onPress={goToMedia} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}>
            <View style={styles.fabInner}>
              <RupeeDonationIcon size={30} strokeColor="#ffffff" flat animated />
            </View>
          </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  shadowWrap: {
    elevation: 0,
    borderRadius: 0,
  },
  inner: {
    borderRadius: 0,
    overflow: 'hidden',
    minHeight: 62,
    backgroundColor: '#fff', // 100% opacity white
  },
  fabWrap: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 52, // lift to avoid overlapping center label
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.secondary,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    overflow: 'hidden',
  },
  fabPressed: { opacity: 0.92 },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    opacity: 0.9,
  },
});