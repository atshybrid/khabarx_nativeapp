import CreateStorySheet from '@/components/ui/CreateStorySheet';
import { Colors } from '@/constants/Colors';
import { getDonationStories, type DonationStorySummary } from '@/services/api';
import { makeShadow } from '@/utils/shadow';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HrciAdminStoriesPage() {
  const [items, setItems] = React.useState<DonationStorySummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDonationStories(20, 0);
      setItems(res.data || []);
    } catch (e) {
      try { console.warn('[AdminStories] load failed', (e as any)?.message || e); } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); return () => {}; }, [load]));

  const renderItem = ({ item }: { item: DonationStorySummary }) => (
    <Pressable onPress={() => { setCreateOpen(false); router.push({ pathname: '/hrci/donations/stories/[id]', params: { id: item.id } } as any); }} style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}>
      <Image source={{ uri: item.heroImageUrl || 'https://via.placeholder.com/800x400?text=Story' }} style={styles.hero} />
      <View style={{ padding: 10 }}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.meta}>{new Date(item.createdAt || '').toLocaleString()}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <StatusBar style="dark" />
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Stories</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No stories yet.</Text> : null}
      />
      <Pressable onPress={() => setCreateOpen(true)} style={styles.fab} accessibilityRole="button" accessibilityLabel="Create story">
        <MaterialIcons name="add" size={28} color="#fff" />
      </Pressable>
      <CreateStorySheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(story) => {
          // Prepend new story and navigate to its detail
          setItems((prev) => [{ id: story.id, title: story.title, heroImageUrl: story.heroImageUrl, createdAt: story.createdAt, updatedAt: story.updatedAt }, ...prev]);
          try { router.push({ pathname: '/hrci/donations/stories/[id]', params: { id: story.id } } as any); } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  title: { fontSize: 16, fontWeight: '800', color: Colors.light.primary },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', overflow: 'hidden', marginBottom: 12 },
  hero: { width: '100%', height: 140, backgroundColor: '#f3f4f6' },
  cardTitle: { color: '#0f172a', fontWeight: '900' },
  meta: { color: '#64748b', marginTop: 4 },
  empty: { color: '#64748b', textAlign: 'center', paddingTop: 24 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center', ...makeShadow(6, { opacity: 0.22 }) },
  fabTxt: { color: '#fff', fontSize: 28, lineHeight: 28, fontWeight: '900', marginTop: -2 },
});
