import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomSheet from '@/components/ArticleBottomSheet';
import AutoHideTabBar from '@/components/AutoHideTabBar';
import { HapticTab } from '@/components/HapticTab';
import { Colors } from '@/constants/Colors';
import { CategoryProvider, useCategory } from '@/context/CategoryContext';
import { CategorySheetProvider, useCategorySheet } from '@/context/CategorySheetContext';
import {
    TabBarVisibilityProvider,
    useTabBarVisibility,
} from '@/context/TabBarVisibilityContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CategoriesIcon, DonationIcon, NewsIcon, ProfileIcon } from '@/icons';
import { CategoryItem, getCategories } from '@/services/api';
import { log } from '@/services/logger';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function InnerLayout() {
  const colorScheme = useColorScheme();
  useTabBarVisibility();
  const theme = Colors[colorScheme ?? 'light'];
  useSafeAreaInsets();

  const { close, visible, currentOnSelect, _clearHandler } = useCategorySheet() as any;
  const { selectedCategory, setSelectedCategory } = useCategory();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [pressLocked, setPressLocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Pull languageId from tokens or local storage inside getCategories()
        const list = await getCategories();
        setCategories(list);
      } catch (e) {
        console.warn('Failed to load categories', e);
        setCategories([]);
      }
    })();
  }, []);

  return (
    <>
    <Tabs
      initialRouteName="news"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        // Keep inactive screens mounted to prevent blank frames during gestures
        freezeOnBlur: false,
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
  <Tabs.Screen name="media" options={{ href: null }} />
  <Tabs.Screen name="explore" options={{ href: null }} />

      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color, focused }) => (
            <NewsIcon size={focused ? 28 : 24} color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="donations"
        options={{
          title: 'Donations',
          tabBarIcon: ({ color, focused }) => (
            <DonationIcon size={focused ? 28 : 24} color={color} />
          ),
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
      visible={visible}
      onClose={() => {
        close();
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
          const active = selectedCategory === c.id;
          return (
            <Pressable
              key={c.id}
              style={({ pressed }) => [
                styles.tileH,
                pressed && styles.tilePressed,
              ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={async () => {
                if (pressLocked) return;
                setPressLocked(true);
                log.event('category.select', { id: c.id, slug: c.slug });
                if (currentOnSelect) {
                  // Local selection mode (e.g., Create Article) -> don't change global filter
                  try {
                    const payload = { id: c.id, name: c.name, slug: c.slug, iconUrl: c.iconUrl };
                    if ((payload as any).id) currentOnSelect(payload as any);
                  } catch {}
                  try { _clearHandler?.(); } catch {}
                  close();
                  // release lock after close animation window
                  setTimeout(() => setPressLocked(false), 360);
                  return;
                }
                // Global selection (News filter)
                setSelectedCategory(c.id);
                try { await AsyncStorage.setItem('selectedCategoryName', c.name); } catch {}
                close();
                setTimeout(() => setPressLocked(false), 360);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Category ${c.name}`}
              accessibilityState={{ selected: active }}
            >
              <View style={[
                styles.iconCircle,
                active && { backgroundColor: theme.primary },
              ]}>
                {c.iconUrl ? (
                  <Image source={{ uri: c.iconUrl }} style={{ width: 22, height: 22, borderRadius: 4 }} />
                ) : (
                  <MaterialCommunityIcons name="shape" size={22} color={active ? '#fff' : theme.primary} />
                )}
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
        <CategorySheetProvider>
          <InnerLayout />
        </CategorySheetProvider>
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
