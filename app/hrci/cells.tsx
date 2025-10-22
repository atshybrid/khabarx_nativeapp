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

type Cell = { id: string; name: string; code?: string; description?: string };

type FilterKey = 'all' | 'women' | 'youth' | 'general';

function classifyCell(name?: string): Exclude<FilterKey, 'all'> {
  const n = (name || '').toLowerCase();
  if (n.includes('women') || n.includes('mahila')) return 'women';
  if (n.includes('youth') || n.includes('yuva')) return 'youth';
  return 'general';
}

export default function HrciCellsScreen() {
  const router = useRouter();
  const { setCell } = useHrciOnboarding();
  const [loading, setLoading] = useState(true);
  const [cells, setCells] = useState<Cell[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchCells = useCallback(async () => {
    try {
      const res = await request<any>(`/hrci/cells?isActive=true&limit=200`, { method: 'GET' });
      const data = Array.isArray(res) ? res : (res?.data || []);
      setCells((data as Cell[]) || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load cells');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchCells();
      setLoading(false);
    })();
  }, [fetchCells]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCells();
    setRefreshing(false);
  }, [fetchCells]);

  const choose = (c: Cell) => {
    setCell(c.id, c.name, c.code);
    try { AsyncStorage.multiSet([[ 'HRCI_CELL_ID', c.id ], [ 'HRCI_CELL_NAME', c.name || '' ], [ 'HRCI_CELL_CODE', c.code || '' ]]); } catch {}
    router.push('/hrci/designations' as any);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cells.filter(c => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
      const cat = classifyCell(c.name);
      const matchesFilter = filter === 'all' || filter === cat;
      return matchesQuery && matchesFilter;
    });
  }, [cells, query, filter]);

  if (loading) return <View style={styles.center}><Loader size={64} /></View>;
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn]} onPress={fetchCells}>
          <MaterialCommunityIcons name="refresh" color="#fff" size={16} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <FlatList
        style={{ backgroundColor: '#ffffff' }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={filtered}
      keyExtractor={(i: Cell) => i.id}
      renderItem={({ item }: { item: Cell }) => (
        <TouchableOpacity style={styles.card} onPress={() => choose(item)} activeOpacity={0.7}>
          <View style={styles.row}>
            <View style={styles.badge}><CellIcon name={item.name} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
              {!!item.description && <Text style={styles.sub} numberOfLines={2}>{item.description}</Text>}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={26} color="#c7cbd4" />
          </View>
        </TouchableOpacity>
      )}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={
        <View style={{ marginBottom: 4 }}>
          <View style={styles.searchBox}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
            </TouchableOpacity>
            <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
            <TextInput
              placeholder="Search cells"
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
          <View style={styles.filtersRow}>
            <FilterChip label="All" active={filter==='all'} onPress={() => setFilter('all')} icon="shape-outline" />
            <FilterChip label="Women" active={filter==='women'} onPress={() => setFilter('women')} icon="human-female" />
            <FilterChip label="Youth" active={filter==='youth'} onPress={() => setFilter('youth')} icon="human-male-child" />
            <FilterChip label="General" active={filter==='general'} onPress={() => setFilter('general')} icon="account-group" />
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <MaterialCommunityIcons name="database-search" size={36} color="#9CA3AF" />
          <Text style={{ color: '#6B7280', marginTop: 8 }}>No cells found</Text>
        </View>
      }
    />
    </SafeAreaView>
  );
}

function CellIcon({ name }: { name?: string }) {
  const n = (name || '').toLowerCase();
  if (n.includes('women') || n.includes('mahila')) {
    return <MaterialCommunityIcons name="human-female" size={18} color="#fff" />;
  }
  if (n.includes('youth') || n.includes('yuva')) {
    return <MaterialCommunityIcons name="human-male-child" size={18} color="#fff" />;
  }
  // General body default
  return <MaterialCommunityIcons name="account-group" size={18} color="#fff" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#EF4444', marginBottom: 12, fontWeight: '700' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 14, elevation: 2, borderWidth: 1, borderColor: '#eef0f4', ...makeShadow(6, { opacity: 0.06, blur: 20, y: 6 }) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1D0DA1', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sub: { color: '#6b7280', marginTop: 6 },
  // removed pageTitle/levelPill to avoid app bar feel
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, color: '#111827', paddingVertical: 4 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
});

function FilterChip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <TouchableOpacity onPress={onPress} style={[chipStyles.base, active ? chipStyles.active : chipStyles.inactive]} activeOpacity={0.8}>
      <MaterialCommunityIcons name={icon} size={16} color={active ? '#fff' : '#374151'} />
      <Text style={[chipStyles.text, active ? chipStyles.textActive : chipStyles.textInactive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  inactive: { backgroundColor: '#ffffff', borderColor: '#E5E7EB' },
  active: { backgroundColor: '#111827', borderColor: '#111827' },
  text: { fontWeight: '800' },
  textInactive: { color: '#374151' },
  textActive: { color: '#ffffff' },
});

