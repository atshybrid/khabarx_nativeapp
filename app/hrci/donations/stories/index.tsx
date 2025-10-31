import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getDonationStories, type DonationStorySummary } from '@/services/api';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { Animated, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

export default function DonationStoriesListScreen() {
  const router = useRouter();
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const [items, setItems] = React.useState<DonationStorySummary[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [showSkeleton, setShowSkeleton] = React.useState(true);

  const load = React.useCallback(async (opts?: { fromRefresh?: boolean }) => {
    try {
      const fromRefresh = Boolean(opts?.fromRefresh);
      if (!fromRefresh) setShowSkeleton(true);
      const res = await getDonationStories(20, 0);
      setItems(res.data || []);
    } catch (e) {
      try { console.warn('[Stories] load failed', (e as any)?.message || e); } catch {}
    } finally {
      const minSkeletonMs = 500;
  const clear = () => { setRefreshing(false); };
      if (showSkeleton && !opts?.fromRefresh) {
        // Ensure skeleton is visible for a minimum duration to avoid flicker
        setTimeout(() => { setShowSkeleton(false); clear(); }, minSkeletonMs);
      } else {
        clear();
      }
    }
  }, [showSkeleton]);

  React.useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); return () => {}; }, [load]));

  // Reusable pulsing skeleton box
  const SkeletonBox: React.FC<{ width: number | string; height: number; radius?: number }>= ({ width, height, radius = 8 }) => {
    const pulse = React.useRef(new Animated.Value(0.6)).current;
    React.useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => { loop.stop(); };
    }, [pulse]);
    return (
      <Animated.View
        style={[
          { height, borderRadius: radius, backgroundColor: '#E6E6E6', opacity: pulse },
          typeof width === 'number' ? { width } : ({ width } as any),
        ]}
      />
    );
  };

  // Fade-in image for thumbnails
  const FadedThumb: React.FC<{ uri?: string | null }>= ({ uri }) => {
    const opacity = React.useRef(new Animated.Value(0.15)).current;
    const onEnd = React.useCallback(() => {
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }, [opacity]);
    return (
      <View style={[styles.thumb, { overflow: 'hidden' }] }>
        {uri ? (
          <Animated.Image source={{ uri }} onLoadEnd={onEnd} style={{ width: '100%', height: '100%', opacity }} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#ddd' }]} />
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: DonationStorySummary }) => (
    <Pressable onPress={() => router.push({ pathname: '/hrci/donations/stories/[id]', params: { id: item.id } } as any)} style={({ pressed }) => [styles.card, { backgroundColor: card, borderColor: border }, pressed && { opacity: 0.9 }]}>
      <View style={styles.row}>
        <FadedThumb uri={item.heroImageUrl} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.sub, { color: muted }]} numberOfLines={1}>{new Date(item.createdAt || '').toLocaleString()}</Text>
        </View>
        <Text style={{ color: Colors.light.primary, fontWeight: '700' }}>View</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {showSkeleton ? (
        <FlatList
          data={Array.from({ length: 8 }).map((_, i) => `s${i}`)}
          keyExtractor={(k) => k}
          renderItem={() => (
            <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.row}>
                <SkeletonBox width={96} height={72} radius={8} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SkeletonBox width={'70%'} height={16} radius={6} />
                  <View style={{ height: 8 }} />
                  <SkeletonBox width={'40%'} height={12} radius={6} />
                </View>
                <SkeletonBox width={44} height={16} radius={8} />
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load({ fromRefresh: true }); }} />}
          ListEmptyComponent={<Text style={{ color: muted, textAlign: 'center', marginTop: 24 }}>No stories yet</Text>}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={9}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12 },
  card: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 96, height: 72, borderRadius: 8, backgroundColor: '#eee' },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
});
