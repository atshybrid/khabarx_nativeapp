import { Loader } from '@/components/ui/Loader';
import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHrciOnboarding } from '../../context/HrciOnboardingContext';
import { request } from '../../services/http';

type Designation = { id?: string; code: string; name: string };

export default function HrciDesignationsScreen() {
  const router = useRouter();
  const { setDesignation } = useHrciOnboarding();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Designation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const fetchDesignations = useCallback(async () => {
    try {
      const res = await request<any>(`/hrci/designations?limit=100`, { method: 'GET' });
      const data = Array.isArray(res) ? res : (res?.data || []);
      setItems((data as Designation[]) || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load designations');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchDesignations();
      setLoading(false);
    })();
  }, [fetchDesignations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDesignations();
    setRefreshing(false);
  }, [fetchDesignations]);

  const choose = (d: Designation) => {
    // Store both id and code properly
    setDesignation(d.id || d.code, d.code, d.name);
    try { AsyncStorage.multiSet([[ 'HRCI_DESIGNATION_ID', (d.id || d.code) ], [ 'HRCI_DESIGNATION_CODE', d.code ], [ 'HRCI_DESIGNATION_NAME', d.name || '' ]]); } catch {}
    router.push('/hrci/geo' as any);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i => !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
  }, [items, query]);

  if (loading) return <View style={styles.center}><Loader size={64} /></View>;
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn]} onPress={fetchDesignations}>
          <MaterialCommunityIcons name="refresh" color="#fff" size={16} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top','left','right']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <FlatList
        style={{ backgroundColor: '#ffffff' }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={filtered}
      keyExtractor={(i: Designation) => i.code}
      renderItem={({ item }: { item: Designation }) => (
        <TouchableOpacity style={styles.card} onPress={() => choose(item)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="id-card" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>{item.code.replace(/_/g,' ')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={26} color="#c7cbd4" />
          </View>
        </TouchableOpacity>
      )}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={
        <View style={{ marginBottom: 8 }}>
          <View style={styles.searchBox}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
            </TouchableOpacity>
            <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
            <TextInput
              placeholder="Search designations"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <MaterialCommunityIcons name="database-search" size={36} color="#9CA3AF" />
          <Text style={{ color: '#6B7280', marginTop: 8 }}>No designations found</Text>
        </View>
      }
    />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#EF4444', marginBottom: 12, fontWeight: '700' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 14, elevation: 2, borderWidth: 1, borderColor: '#eef0f4', ...makeShadow(6, { opacity: 0.06, blur: 20, y: 6 }) },
  title: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sub: { color: '#6b7280', marginTop: 2, textTransform: 'capitalize' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: '#111827', paddingVertical: 4 },
});
