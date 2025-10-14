import { Colors } from '@/constants/Colors';
import { useCategorySheet } from '@/context/CategorySheetContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { PostArticleIcon } from '@/icons';
import { checkPostArticleAccess } from '@/services/auth';
import { makeShadow } from '@/utils/shadow';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { usePathname, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AutoHideTabBar(props: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { isTabBarVisible, setTabBarVisible } = useTabBarVisibility();
  const { open: openCategorySheet } = useCategorySheet();
  const insets = useSafeAreaInsets();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const animatedRef = useRef(new Animated.Value(isTabBarVisible ? 1 : 0));
  const scaleRef = useRef(new Animated.Value(0.98));
  const fabScale = useRef(new Animated.Value(1));

  const routes = props.state.routes;
  const activeIndex = props.state.index;
  const activeRouteName = routes[activeIndex]?.name;
  const pathname = usePathname();
  // Hide the tab bar on full-screen flows like Post Article (explore) or Account (tech)
  const onExplore = typeof pathname === 'string' && /(^|\/)explore$/.test(pathname);
  const hiddenOnRoute = onExplore || activeRouteName === 'tech';
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

  // Solid background comes from theme.card

  // Active indicator (removed) positioning placeholder
  const tabCount = routes.length || 1;
  const tabWidth = containerWidth > 0 ? containerWidth / tabCount : 0;
  const pillWidth = 38;
  const pillLeft = Math.max(0, activeIndex * tabWidth + (tabWidth - pillWidth) / 2);

  React.useEffect(() => {
    // scale FAB when Post Article (explore) is focused
    const focused = onExplore;
    Animated.spring(fabScale.current, {
      toValue: focused ? 1.06 : 1,
      useNativeDriver: true,
      bounciness: 8,
      speed: 10,
    }).start();
  }, [pillLeft, onExplore]);

  const onContainerLayout = (e: any) => setContainerWidth(e.nativeEvent.layout.width);
  const goToPostArticle = async () => {
    // Comprehensive auth check before allowing post article access
    try {
      const authCheck = await checkPostArticleAccess();
      
      if (!authCheck.canAccess) {
        // For guest users or expired tokens, direct navigate to login
        if (authCheck.isGuest || !authCheck.hasToken) {
          router.push('/auth/login?from=post');
          return;
        }
        
        // For authenticated users without proper role, show alert with options
        Alert.alert(
          'Access Denied',
          authCheck.reason || 'You need to be a Citizen Reporter to create posts.',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Go to Login',
              onPress: () => router.push('/auth/login?from=post')
            }
          ]
        );
        return;
      }
      
      // All checks passed - navigate to post article screen
      router.push('/explore');
    } catch (error) {
      console.warn('[FAB] goToPostArticle auth check failed:', error);
      // On error, default to login
      router.push('/auth/login');
    }
  };

  // Debounce map for tab presses
  const lastPressMap = React.useRef<Record<string, number>>({}).current;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          transform: [{ translateY }],
          // move pointerEvents into style per RN Web deprecation guidance
          pointerEvents: shouldShow ? 'auto' : 'none',
        },
      ]}
      onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
      accessibilityElementsHidden={!shouldShow}
      importantForAccessibility={shouldShow ? 'yes' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.shadowWrap, { transform: [{ scale: scaleRef.current }] }]}>
        <View
          style={[
            styles.inner,
            {
              backgroundColor: theme.card,
              borderTopColor: theme.border,
              borderTopWidth: StyleSheet.hairlineWidth,
            },
          ]}
          onLayout={onContainerLayout}
        >
          <View style={styles.tabRow}>
            {/* Determine only the visible tab routes and enforce order [news, donations] [center] [career, tech] */}
            {(['news', 'donations'] as const).map((name) => {
              const route = routes.find((r) => r.name === name);
              if (!route) return <View key={`missing-${name}`} style={styles.tabItem} />;
              const isFocused = activeRouteName === route.name;
              const { options } = props.descriptors[route.key];
              const label = (options.tabBarLabel as string) || options.title || route.name;
              const color = isFocused ? (colorScheme === 'dark' ? '#fff' : theme.tint) : theme.tabIconDefault;
              const size = 24;
              const icon =
                typeof options.tabBarIcon === 'function'
                  ? options.tabBarIcon({ focused: isFocused, color, size })
                  : null;
              return (
                <Pressable
                  key={route.key}
                  style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={label}
                  onPress={() => {
                    if (!isFocused) {
                      // @ts-ignore expo-router compatible
                      props.navigation.navigate(route.name as never);
                    }
                  }}
                >
                  <View style={styles.tabIconWrap}>{icon}</View>
                  <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Center slot placeholder - shows the Post News label to align like a tab */}
            <View style={[styles.tabItem, { pointerEvents: 'none' }] }>
              <View style={{ height: 24 }} />
              <Text
                style={[
                  styles.tabLabel,
                  { color: onExplore ? theme.tint : theme.tabIconDefault },
                ]}
                numberOfLines={1}
              >
                Post News
              </Text>
            </View>

            {/* Right two tabs */}
            {(['career', 'tech'] as const).map((name) => {
              const route = routes.find((r) => r.name === name);
              if (!route) return <View key={`missing-${name}`} style={styles.tabItem} />;
              const isFocused = activeRouteName === route.name;
              const { options } = props.descriptors[route.key];
              const label = (options.tabBarLabel as string) || options.title || route.name;
              const color = isFocused ? (colorScheme === 'dark' ? '#fff' : theme.tint) : theme.tabIconDefault;
              const size = 24;
              const icon =
                typeof options.tabBarIcon === 'function'
                  ? options.tabBarIcon({ focused: isFocused, color, size })
                  : null;
              const onPress = () => {
                if (name === 'career') {
                  // Debounce rapid double taps and force-show the tab bar before opening
                  const now = Date.now();
                  const last = lastPressMap[name] || 0;
                  if (now - last < 250) return;
                  lastPressMap[name] = now;
                  // Hide the tab bar immediately to avoid a brief flash before opening the sheet
                  setTabBarVisible(false);
                  // Short delay to avoid racing with the previous sheet close animation/backdrop timers
                  setTimeout(() => {
                    openCategorySheet();
                  }, 180);
                  return;
                }
                if (!isFocused) {
                  // @ts-ignore expo-router compatible
                  props.navigation.navigate(route.name as never);
                }
              };
              return (
                <Pressable
                  key={route.key}
                  style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={label}
                  onPress={onPress}
                >
                  <View style={styles.tabIconWrap}>{icon}</View>
                  <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {/* Floating center FAB (clickable). Only show when tab bar is visible */}
        {shouldShow && (
          <Animated.View
            style={[
              styles.fabWrap,
              {
                bottom: Math.max(insets.bottom, 8) + 14,
                transform: [{ scale: fabScale.current }],
              },
            ]}
          >
            <Pressable
              onPress={goToPostArticle}
              accessibilityRole="button"
              accessibilityLabel="Post News"
              style={({ pressed }) => [styles.fab, { backgroundColor: theme.secondary }, pressed && styles.fabPressed]}
              android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
            >
              <View style={styles.fabInner}>
                <PostArticleIcon size={30} color="#ffffff" active />
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
    // backgroundColor moved to themed inline style
    paddingHorizontal: 0, // remove left/right padding to maximize usable width
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabIconWrap: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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
    overflow: 'hidden',
    ...(makeShadow(8, { opacity: 0.2, y: 6, blur: 20 })),
  },
  fabPressed: { opacity: 0.92 },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.text,
  },
  fabDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    opacity: 0.9,
  },
});