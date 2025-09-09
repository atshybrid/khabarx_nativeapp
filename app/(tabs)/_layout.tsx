import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomSheet from '@/components/ArticleBottomSheet';
import AutoHideTabBar from '@/components/AutoHideTabBar';
import { HapticTab } from '@/components/HapticTab';
import { Colors } from '@/constants/Colors';
import { CategoryProvider, useCategory } from '@/context/CategoryContext';
import {
  TabBarVisibilityProvider,
  useTabBarVisibility,
} from '@/context/TabBarVisibilityContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CategoriesIcon, HomeIcon, PostArticleIcon, ProfileIcon } from '@/icons';
import { log } from '@/services/logger';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function InnerLayout() {
  const colorScheme = useColorScheme();
  useTabBarVisibility();
  const { setTabBarVisible } = useTabBarVisibility();
  const theme = Colors[colorScheme ?? 'light'];
  useSafeAreaInsets();

  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const { selectedCategory, setSelectedCategory } = useCategory();

  const categories: { key: string; name: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { key: 'top', name: 'Top Stories', icon: 'newspaper-variant' },
    { key: 'india', name: 'India', icon: 'flag' },
    { key: 'world', name: 'World', icon: 'earth' },
    { key: 'business', name: 'Business', icon: 'briefcase' },
    { key: 'tech', name: 'Technology', icon: 'cpu-64-bit' },
    { key: 'sports', name: 'Sports', icon: 'trophy' },
    { key: 'ent', name: 'Entertainment', icon: 'movie-open' },
  ];

  return (
    <>
    <Tabs
      initialRouteName="news"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          position: 'absolute',
        },
  tabBarActiveBackgroundColor: 'transparent',
  tabBarInactiveBackgroundColor: 'transparent',
  tabBarItemStyle: { backgroundColor: 'transparent' },
  tabBarLabelPosition: 'below-icon',
      }}
      tabBar={(p) => <AutoHideTabBar {...p} />}
    >
  {/* Hide auto-routes that shouldn't appear as tabs */}
  <Tabs.Screen name="index" options={{ href: null }} />
  <Tabs.Screen name="trending" options={{ href: null }} />

      <Tabs.Screen
        name="news"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <HomeIcon size={focused ? 28 : 24} color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Post',
           tabBarIcon: ({ color, focused }) => (
             <PostArticleIcon size={focused ? 28 : 24} color={color} active={focused} />
           ),
        }}
      />
      <Tabs.Screen
        name="media"
        options={{
          title: 'Donate',
          // Icon is shown via the floating FAB; hide the default tab icon but keep the label
          tabBarIcon: () => null,
          tabBarLabelStyle: { fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="career"
        options={{
          title: 'Category',
          tabBarIcon: ({ color, focused }) => (
            <CategoriesIcon size={focused ? 28 : 24} color={color} active={focused} />
          ),
          // Intercept tab press to open the bottom sheet instead of navigating
      tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={(e) => {
                e.preventDefault();
        log.event('tab.category.press');
        setCategoryOpen(true);
        // Hide the tab bar while sheet is open (best practice for modal overlays)
        setTabBarVisible(false);
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tech"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <ProfileIcon size={focused ? 28 : 24} color={color} active={focused} />
          ),
        }}
      />
  </Tabs>

    {/* Category Bottom Sheet overlay */}
  <BottomSheet
      visible={categoryOpen}
      onClose={() => {
        log.event('category.sheet.close');
        setCategoryOpen(false);
        setTabBarVisible(true);
      }}
      // Pixel-perfect first snap based on one row height + header + handle + paddings
      snapPoints={[
        20 /* handle */
        + 44 /* header approx */
        + 16 /* content pad */
        + (10 /* tile top pad */ + 44 /* icon */ + 6 /* icon->label gap */ + 16 /* label line */ + 50 /* tile bottom pad + extra row bottom pad */),
        0.8,
      ]}
      initialSnapIndex={0}
  respectSafeAreaBottom={false}
  shadowEnabled={false}
      header={<Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary }}>Categories</Text>}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowScroll}
      >
        {categories.map((c) => {
          const active = selectedCategory === c.key;
          return (
            <Pressable
              key={c.key}
              style={({ pressed }) => [
                styles.tileH,
                pressed && styles.tilePressed,
              ]}
              onPress={async () => {
                log.event('category.select', { key: c.key });
                setSelectedCategory(c.key);
        // Keep sheet open; user can manually close by drag or tapping backdrop
              }}
              accessibilityRole="button"
              accessibilityLabel={`Category ${c.name}`}
              accessibilityState={{ selected: active }}
            >
              <View style={[
                styles.iconCircle,
                active && { backgroundColor: theme.primary },
              ]}>
                <MaterialCommunityIcons name={c.icon} size={22} color={active ? '#fff' : theme.primary} />
              </View>
              <Text style={[styles.tileText, active && styles.tileTextActive]} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  </>
  );
}

export default function TabLayout() {
  return (
    <TabBarVisibilityProvider>
      <CategoryProvider>
        <InnerLayout />
      </CategoryProvider>
    </TabBarVisibilityProvider>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  rowScroll: {
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 50, // extra bottom space so icons/names sit higher
  },
  // Target 5–6 per row depending on device width
  tile: {
    width: '16.5%', // ~6 per row on typical phones; will wrap naturally
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tileH: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  borderRadius: 0,
  backgroundColor: 'transparent',
  borderWidth: 0,
  borderColor: 'transparent',
    marginRight: 10,
  },
  tilePressed: {
  opacity: 0.7,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    marginBottom: 6,
  },
  tileText: { color: '#032557', fontWeight: '700', fontSize: 12, textAlign: 'center', marginTop: 2, maxWidth: 88 },
  tileTextActive: { color: Colors.light.primary },
});
