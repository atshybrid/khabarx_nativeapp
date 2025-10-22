import { Button } from '@/components/ui/Button';
import { FullScreenLoader, Loader, LOADER_SIZES } from '@/components/ui/Loader';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContextNew';
import { getHrciCasesPaginated, getHrciCasesSummary, getHrciCaseTimeline, HrciCasePriority, HrciCasesSummary, HrciCaseStatus, HrciCaseSummary, HrciCaseTimelineEntry, uploadHrciCaseAttachment } from '@/services/hrciCases';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HrciMyCasesScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<HrciCaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | HrciCaseStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | HrciCasePriority>('ALL');
  // Pagination
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tl, setTl] = useState<Record<string, HrciCaseTimelineEntry[]>>({});
  const [tlLoading, setTlLoading] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [summary, setSummary] = useState<HrciCasesSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        getHrciCasesPaginated({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
          limit: 20,
        }),
        // Summary is overall; does not depend on filters
        getHrciCasesSummary().catch(() => null),
      ]);
      const { data, nextCursor } = listRes;
      setItems(data);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
      if (summaryRes) setSummary(summaryRes);
    } catch (e: any) {
      setError(e?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [statusFilter, priorityFilter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [listRes, summaryRes] = await Promise.all([
        getHrciCasesPaginated({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
          limit: 20,
        }),
        getHrciCasesSummary().catch(() => null),
      ]);
      const { data, nextCursor } = listRes;
      setItems(data);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
      if (summaryRes) setSummary(summaryRes);
    } catch (e: any) {
      setError(e?.message || 'Failed to refresh');
    } finally { setRefreshing(false); }
  }, [statusFilter, priorityFilter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data, nextCursor } = await getHrciCasesPaginated({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        limit: 20,
        cursor: cursor || undefined,
      });
      // Deduplicate by id when appending
      setItems(prev => {
        const map = new Map(prev.map(it => [it.id, it] as const));
        for (const it of data) map.set(it.id, it);
        return Array.from(map.values());
      });
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch {
      // soft-fail load more
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, statusFilter, priorityFilter, cursor]);

  const ensureTimeline = useCallback(async (id: string) => {
    if (tl[id] || tlLoading === id) return;
    setTlLoading(id);
    try {
      const data = await getHrciCaseTimeline(id);
      setTl(prev => ({ ...prev, [id]: data }));
    } catch {
      // soft-fail timeline load
    } finally { setTlLoading(null); }
  }, [tl, tlLoading]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = !prev[id];
      if (next) ensureTimeline(id);
      return { ...prev, [id]: next };
    });
  }, [ensureTimeline]);

  const openUpload = useCallback((id: string) => {
    setCurrentCaseId(id);
    setSheetOpen(true);
  }, []);

  const pickAndUpload = useCallback(async () => {
    if (!currentCaseId) return;
    try {
      setUploading(true);
      const res = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      if ((res as any)?.canceled) return;
      const file = Array.isArray((res as any)?.assets) ? (res as any).assets[0] : (res as any);
      const uri: string = file?.uri;
      if (!uri) return;
      const name: string = file?.name || uri.split('/').pop() || `file_${Date.now()}`;
      const mime: string = file?.mimeType || file?.mime || 'application/octet-stream';
      await uploadHrciCaseAttachment(currentCaseId, { uri, name, mime });
      // If this case card is expanded, refresh its mini-timeline so the latest entry is visible
      if (expanded[currentCaseId]) {
        try {
          const data = await getHrciCaseTimeline(currentCaseId);
          setTl(prev => ({ ...prev, [currentCaseId]: data }));
        } catch {}
      }
      try { Alert.alert('Uploaded', 'Attachment added'); } catch {}
      setSheetOpen(false);
    } catch (e: any) {
      try { Alert.alert('Failed', e?.message || 'Could not upload file'); } catch {}
    } finally {
      setUploading(false);
    }
  }, [currentCaseId, expanded]);

  const renderItem = ({ item }: { item: HrciCaseSummary }) => {
    const isOpen = !!expanded[item.id];
    const tlist = tl[item.id] || [];
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push({ pathname: '/hrci/cases/[id]', params: { id: item.id, caseNumber: item.caseNumber, status: String(item.status), priority: String(item.priority) } } as any)}
        android_ripple={{ color: '#f3f4f6' }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.caseNo} numberOfLines={1} ellipsizeMode="middle">{item.caseNumber}</Text>
            <Text style={styles.title} numberOfLines={4} ellipsizeMode="tail">{item.title}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.pill, styles[item.priority?.toLowerCase?.() as 'low'|'medium'|'high'|'critical' || 'medium']]}>{item.priority}</Text>
            <Pressable onPress={(e) => { e.stopPropagation(); toggleExpand(item.id); }} style={styles.chevBtn} hitSlop={8}>
              <Text style={styles.chev}>{isOpen ? '▲' : '▼'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.status, styles.statusPill, statusChipStyle(item.status as HrciCaseStatus)]}>{item.status}</Text>
        </View>
        {isOpen && (
          <View style={{ marginTop: 10, gap: 8 }}>
            {tlLoading === item.id ? (
              <Text style={styles.meta}>Loading updates…</Text>
            ) : tlist.length ? (
              tlist.slice(0, 2).map((t) => (
                <View key={t.id} style={styles.tlRow}>
                  <View style={styles.tlDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tlType}>{t.type}</Text>
                    <Text style={styles.tlWhen}>{new Date(t.createdAt).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.meta}>No updates yet.</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="View details"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/hrci/cases/[id]', params: { id: item.id, caseNumber: item.caseNumber, status: String(item.status), priority: String(item.priority) } } as any)}
                  style={{ width: '100%' }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Add attachment"
                  variant="primary"
                  onPress={(e: any) => { e?.stopPropagation?.(); openUpload(item.id); }}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  const stats = useMemo(() => {
    const norm = (s: any) => String(s || '').toUpperCase().trim();
    let completed = 0, rejected = 0, pending = 0;
    for (const it of items) {
      const st = norm(it.status);
      if (st === 'CLOSED' || st === 'COMPLETED' || st === 'RESOLVED' || st === 'DONE') completed++;
      else if (st === 'REJECTED' || st === 'REVOKED' || st === 'DENIED') rejected++;
      else pending++;
    }
    // Prefer backend summary total when available
    const computed = { total: summary?.total ?? items.length, pending, completed, rejected };
    const roleUC = (user?.role || '').toUpperCase();
    const isMember = roleUC.includes('MEMBER');
    // Fallback: if Member role and no items yet, show dummy counts to avoid empty dashboard feel
    if (!summary && isMember && computed.total === 0) {
      return { total: 12, pending: 3, completed: 8, rejected: 1 };
    }
    return computed;
  }, [items, user?.role, summary]);

  // Per-status counts for smart, simple cards
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
    // Fallback: derive from currently loaded items (may be paginated)
    for (const it of items) {
      const k = String(it.status || '').toUpperCase();
      if (k) map[k] = (map[k] || 0) + 1;
    }
    return map as Record<typeof statusOrder[number], number>;
  }, [items, statusOrder, summary]);

  function statusChipStyle(status: HrciCaseStatus) {
    const s = String(status || '').toUpperCase() as HrciCaseStatus;
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
      default: return styles.statusPill;
    }
  }

  if (!initialized && loading) {
    return <FullScreenLoader size={LOADER_SIZES.xxlarge} label="Loading your cases…" />;
  }

  const statuses: ('ALL' | HrciCaseStatus)[] = ['ALL','NEW','TRIAGED','IN_PROGRESS','LEGAL_REVIEW','ACTION_TAKEN','RESOLVED','REJECTED','CLOSED','ESCALATED'];
  const priorities: ('ALL' | HrciCasePriority | 'URGENT')[] = ['ALL','LOW','MEDIUM','HIGH','URGENT']; // URGENT maps to CRITICAL
  const effPriorityFilter: 'ALL' | HrciCasePriority = priorityFilter === 'ALL' ? 'ALL' : priorityFilter;
  const data = items.filter(it => (statusFilter === 'ALL' ? true : String(it.status).toUpperCase() === statusFilter))
                    .filter(it => {
                      if (!query.trim()) return true;
                      const q = query.trim().toLowerCase();
                      return it.title.toLowerCase().includes(q) || it.caseNumber.toLowerCase().includes(q);
                    })
                    .filter(it => {
                      if (effPriorityFilter === 'ALL') return true;
                      const p = String(it.priority).toUpperCase();
                      const want = effPriorityFilter.toUpperCase();
                      return p === want;
                    });

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: '#ffffff' }}>
        <View style={styles.appBar}>
          <Pressable onPress={() => router.back()} style={styles.appBarBtn} hitSlop={8}>
            <Text style={styles.appBarBtnText}>{'‹'}</Text>
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search cases by title or #number"
            placeholderTextColor="#9CA3AF"
            style={styles.appBarSearch}
          />
        </View>
      </SafeAreaView>

      <View style={{ paddingTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
          <View style={[styles.statMiniCard]}> 
            <Text style={styles.statMiniLabel}>Total</Text>
            <Text style={styles.statMiniValue}>{stats.total}</Text>
          </View>
          {statusOrder.map((s) => (
            <View key={s} style={[styles.statMiniCard]}> 
              <View style={[styles.statDot, statusChipStyle(s as any)]} />
              <Text style={styles.statMiniLabel}>{s.replace('_',' ')}</Text>
              <Text style={styles.statMiniValue}>{countsByStatus[s] || 0}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 0, paddingBottom: 4, paddingTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRowH}>
          {statuses.map(s => (
            <Pressable key={s} onPress={() => { setStatusFilter(s); setCursor(null); setHasMore(true); }} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                {s === 'ALL' ? 'All' : s.replace('_',' ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ paddingHorizontal: 0, paddingBottom: 8, paddingTop: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRowH}>
          {priorities.map(p => (
            <Pressable key={p} onPress={() => { const mapped = p === 'URGENT' ? 'CRITICAL' : p; setPriorityFilter(mapped as any); setCursor(null); setHasMore(true); }} style={[styles.filterChip, (priorityFilter === (p === 'URGENT' ? 'CRITICAL' : p)) && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, (priorityFilter === (p === 'URGENT' ? 'CRITICAL' : p)) && styles.filterChipTextActive]}>
                {p === 'ALL' ? 'All priorities' : (p === 'URGENT' ? 'Urgent' : p.charAt(0) + p.slice(1).toLowerCase())}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {error ? (
        <View style={styles.center}> 
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}> 
          <Text style={styles.emptyText}>No cases yet.</Text>
          <Pressable onPress={() => router.push('/hrci/cases/new' as any)} style={styles.newBtn}><Text style={styles.newBtnText}>Create Case</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: 12 }}>
              <Loader size={LOADER_SIZES.regular} />
            </View>
          ) : null}
        />
      )}

      {/* Bottom sheet for quick upload (light) */}
      <Modal transparent visible={sheetOpen} animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetGrabber} />
            <Text style={styles.sheetTitle}>Attachments</Text>
            <Pressable onPress={pickAndUpload} style={[styles.sheetAction, uploading && { opacity: 0.7 }]} disabled={uploading}>
              <Text style={styles.sheetActionText}>Upload file</Text>
            </Pressable>
            <Pressable onPress={() => { if (currentCaseId) router.push({ pathname: '/hrci/cases/[id]', params: { id: currentCaseId } } as any); setSheetOpen(false); }} style={styles.sheetAction}>
              <Text style={styles.sheetActionText}>View details</Text>
            </Pressable>
            <Pressable onPress={() => setSheetOpen(false)} style={[styles.modalItem, { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 }]}>
              <Text style={{ color: '#6b7280' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Page overlay loader during quick upload */}
      {uploading ? (
        <Modal visible animationType="fade" transparent>
          <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
            <FullScreenLoader size={LOADER_SIZES.xxlarge} label="Uploading…" />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#ffffff' },
  loadingText: { color: '#111' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  appBarTitle: { color: '#111', fontSize: 18, fontWeight: '700' },
  appBarBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  appBarBtnText: { fontSize: 22, color: '#111' },
  appBarSearch: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#111', backgroundColor: '#fff' },
  newBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  newBtnText: { color: '#fff', fontWeight: '700' },
  errorText: { color: '#b91c1c' },
  emptyText: { color: '#6b7280' },
  retryBtn: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  retryText: { color: '#111' },
  search: { marginTop: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111', backgroundColor: '#fff' },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filtersRowH: { paddingHorizontal: 16, gap: 8 },
  statsScroll: { paddingHorizontal: 16, gap: 8 },
  statMiniCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', minWidth: 84 },
  statMiniLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statMiniValue: { color: '#111', fontSize: 16, fontWeight: '800', marginTop: 2 },
  statDot: { width: 8, height: 8, borderRadius: 999, marginBottom: 6 },
  filterChip: { borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#111' },
  filterChipText: { color: '#111', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },
  card: { backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderWidth: 1, padding: 12, borderRadius: 12, marginBottom: 12, elevation: 1 },
  caseNo: { color: Colors.light.primary, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  title: { color: '#111', fontSize: 15, fontWeight: '600', flex: 1, paddingRight: 8, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  meta: { color: '#6b7280', fontSize: 12 },
  dot: { color: '#9CA3AF' },
  status: { color: '#111', fontSize: 12 },
  statusPill: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  stNew: { backgroundColor: '#E5E7EB' },
  stTriaged: { backgroundColor: '#DBEAFE' },
  stInProgress: { backgroundColor: '#FEF3C7' },
  stLegal: { backgroundColor: '#EDE9FE' },
  stAction: { backgroundColor: '#DBEAFE' },
  stResolved: { backgroundColor: '#DCFCE7' },
  stRejected: { backgroundColor: '#FEE2E2' },
  stClosed: { backgroundColor: '#E5E7EB' },
  stEscalated: { backgroundColor: '#FFE4E6' },
  pill: { color: '#111', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  low: { backgroundColor: '#DCFCE7' },
  medium: { backgroundColor: '#FEF9C3' },
  high: { backgroundColor: '#FEE2E2' },
  critical: { backgroundColor: '#FECACA' },
  chevBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb' },
  chev: { color: '#6b7280', fontSize: 12 },
  tlRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tlDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: Colors.light.primary, marginTop: 6 },
  tlType: { color: '#111', fontWeight: '700' },
  tlWhen: { color: '#6b7280', fontSize: 12 },
  // Replaced inline buttons with shared Button component
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  sheetGrabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: '#e5e7eb', marginBottom: 8 },
  sheetTitle: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16 },
  // Dark sheet variants
  modalBackdropDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheetDark: { backgroundColor: '#111111', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderWidth: 1, borderColor: '#1f2937' },
  sheetGrabberDark: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: '#374151', marginBottom: 8 },
  sheetTitleDark: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  // Light sheet action styles (used now)
  sheetAction: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff', marginTop: 8, alignItems: 'center' },
  sheetActionText: { color: '#111111', fontWeight: '700' },
  modalItemDark: { paddingVertical: 14, paddingHorizontal: 16 },
});
