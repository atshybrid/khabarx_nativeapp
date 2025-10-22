import { FullScreenLoader, Loader, LOADER_SIZES } from '@/components/ui/Loader';
import { getHrciCasesPaginated, getHrciCasesSummary, HrciCasePriority, HrciCasesSummary, HrciCaseStatus, HrciCaseSummary } from '@/services/hrciCases';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FilterState = {
  status?: HrciCaseStatus | 'ALL';
  priority?: HrciCasePriority | 'ALL';
};

export default function HrciAdminCasesPage() {
  const [items, setItems] = useState<HrciCaseSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<FilterState>({ status: 'ALL', priority: 'ALL' });
  const [summary, setSummary] = useState<HrciCasesSummary | null>(null);

  const load = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const [res, sum] = await Promise.all([
        getHrciCasesPaginated({
          status: filters.status && filters.status !== 'ALL' ? (filters.status as HrciCaseStatus) : undefined,
          priority: filters.priority && filters.priority !== 'ALL' ? (filters.priority as HrciCasePriority) : undefined,
          limit: 20,
          cursor: reset ? undefined : cursor || undefined,
        }),
        // Fetch global summary (admin scope) regardless of filters
        getHrciCasesSummary().catch(() => null),
      ]);
      if (reset) {
        setItems(res.data);
      } else {
        setItems(prev => [...prev, ...res.data]);
      }
      setCursor(res.nextCursor);
      if (sum) setSummary(sum);
    } catch (e: any) {
      setError(e?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filters, cursor]);

  useEffect(() => { load(true); }, [filters, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(null);
    load(true);
  }, [load]);

  const onEndReached = useCallback(() => {
    if (!loading && !loadingMore && cursor) {
      load(false);
    }
  }, [loading, loadingMore, cursor, load]);

  const data = useMemo(() => {
    if (!q.trim()) return items;
    const s = q.trim().toLowerCase();
    return items.filter(x => x.title.toLowerCase().includes(s) || x.caseNumber.toLowerCase().includes(s));
  }, [items, q]);

  const statusOrder = useMemo(() => (
    ['NEW','TRIAGED','IN_PROGRESS','LEGAL_REVIEW','ACTION_TAKEN','RESOLVED','REJECTED','ESCALATED','CLOSED'] as const
  ), []);
  const countsByStatus = useMemo(() => {
    const map: Record<string, number> = Object.create(null);
    for (const k of statusOrder) map[k] = 0;
    if (summary?.breakdown) {
      for (const k of Object.keys(summary.breakdown)) {
        const key = k.toUpperCase();
        if (key in map) map[key] = Number(summary.breakdown[k]) || 0;
      }
      return map as Record<typeof statusOrder[number], number>;
    }
    // Fallback: derive from currently loaded items
    for (const it of items) {
      const k = String(it.status || '').toUpperCase();
      if (k) map[k] = (map[k] || 0) + 1;
    }
    return map as Record<typeof statusOrder[number], number>;
  }, [items, summary, statusOrder]);

  function statusChipStyle(status: HrciCaseStatus | string) {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'NEW': return styles.stNew;
      case 'TRIAGED': return styles.stTriaged;
      case 'IN_PROGRESS': return styles.stInProgress;
      case 'LEGAL_REVIEW': return styles.stLegal;
      case 'ACTION_TAKEN': return styles.stAction;
      case 'RESOLVED': return styles.stResolved;
      case 'REJECTED': return styles.stRejected;
      case 'CLOSED': return styles.stClosed;
      case 'ESCALATED': return styles.stEscalated;
      default: return {} as any;
    }
  }

  const statuses: (HrciCaseStatus | 'ALL')[] = ['ALL','NEW','TRIAGED','IN_PROGRESS','LEGAL_REVIEW','ACTION_TAKEN','ESCALATED','RESOLVED','REJECTED','CLOSED'];
  const priorities: (HrciCasePriority | 'ALL')[] = ['ALL','LOW','MEDIUM','HIGH','CRITICAL'];

  const renderItem = ({ item }: { item: HrciCaseSummary }) => (
    <Pressable style={styles.card} onPress={() => router.push({ pathname: '/hrci/cases/[id]', params: { id: item.id } } as any)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.pill, styles[`p_${String(item.priority).toLowerCase()}` as 'p_low'|'p_medium'|'p_high'|'p_critical']]}>{item.priority}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
        <Text style={styles.caseNumber}>#{item.caseNumber}</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
      <View style={{ marginTop: 6 }}>
        <Text style={styles.status}>{item.status}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by title or #number"
            placeholderTextColor="#9CA3AF"
            style={styles.search}
          />
        </View>
        {/* Smart stats mini-cards (admin summary) */}
        <View style={{ paddingTop: 12 }}>
          <FlatList
            horizontal
            data={[{ key: 'TOTAL', label: 'Total', value: summary?.total ?? items.length }, ...statusOrder.map(s => ({ key: s, label: s.replace('_',' '), value: countsByStatus[s] || 0 }))]}
            keyExtractor={(it) => String(it.key)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScroll}
            renderItem={({ item }) => (
              <View style={styles.statMiniCard}>
                {item.key !== 'TOTAL' ? <View style={[styles.statDot, statusChipStyle(item.key as string)]} /> : null}
                <Text style={styles.statMiniLabel}>{item.label}</Text>
                <Text style={styles.statMiniValue}>{item.value}</Text>
              </View>
            )}
          />
        </View>
        {/* Filters */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={styles.filtersRow}>
            {statuses.map(s => (
              <Pressable key={s} onPress={() => { setCursor(null); setFilters(f => ({ ...f, status: s })); }} style={[styles.chip, filters.status === s && styles.chipActive]}>
                <Text style={[styles.chipTxt, filters.status === s && styles.chipTxtActive]}>{s === 'ALL' ? 'All' : s.replace('_',' ')}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.filtersRow, { marginTop: 8 }]}>
            {priorities.map(p => (
              <Pressable key={p} onPress={() => { setCursor(null); setFilters(f => ({ ...f, priority: p })); }} style={[styles.chip, filters.priority === p && styles.chipActive]}>
                <Text style={[styles.chipTxt, filters.priority === p && styles.chipTxtActive]}>{p === 'ALL' ? 'All' : p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {error ? (
        <View style={styles.center}> 
          <Text style={styles.errorTxt}>{error}</Text>
          <Pressable onPress={() => load(true)} style={styles.retry}><Text style={styles.retryTxt}>Retry</Text></Pressable>
        </View>
      ) : loading && items.length === 0 ? (
        <FullScreenLoader size={LOADER_SIZES.xxlarge} label="Loading cases…" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={it => it.id}
          renderItem={renderItem}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: 12 }}>
              <Loader size={32} />
            </View>
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  search: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#111', backgroundColor: '#fff' },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  chipActive: { backgroundColor: '#111' },
  chipTxt: { color: '#111', fontSize: 12, fontWeight: '700' },
  chipTxtActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorTxt: { color: '#b91c1c' },
  retry: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8 },
  retryTxt: { color: '#111', fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 },
  cardTitle: { color: '#111', fontSize: 16, fontWeight: '600', flex: 1, paddingRight: 12 },
  meta: { color: '#6b7280', fontSize: 12 },
  dot: { color: '#9CA3AF' },
  status: { color: '#111', fontSize: 12, backgroundColor: '#f3f4f6', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  caseNumber: { color: '#1D0DA1', fontWeight: '800' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700', color: '#111' },
  p_low: { backgroundColor: '#DCFCE7' },
  p_medium: { backgroundColor: '#FEF9C3' },
  p_high: { backgroundColor: '#FEE2E2' },
  p_critical: { backgroundColor: '#FECACA' },
  // Smart stats mini-cards
  statsScroll: { paddingHorizontal: 16, gap: 8 },
  statMiniCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', minWidth: 84 },
  statMiniLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statMiniValue: { color: '#111', fontSize: 16, fontWeight: '800', marginTop: 2 },
  statDot: { width: 8, height: 8, borderRadius: 999, marginBottom: 6 },
  // status dot background colors
  stNew: { backgroundColor: '#E5E7EB' },
  stTriaged: { backgroundColor: '#DBEAFE' },
  stInProgress: { backgroundColor: '#FEF3C7' },
  stLegal: { backgroundColor: '#EDE9FE' },
  stAction: { backgroundColor: '#DBEAFE' },
  stResolved: { backgroundColor: '#DCFCE7' },
  stRejected: { backgroundColor: '#FEE2E2' },
  stClosed: { backgroundColor: '#E5E7EB' },
  stEscalated: { backgroundColor: '#FFE4E6' },
});
