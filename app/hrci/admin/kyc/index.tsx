import { AdminKycItem, AdminKycStatus, listAdminKycByStatus } from '@/services/kyc';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUSES: AdminKycStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export default function AdminKycListScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<AdminKycStatus>('PENDING');
  const [items, setItems] = useState<AdminKycItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache results per status to avoid flicker when switching
  const cacheRef = useRef<Record<AdminKycStatus, AdminKycItem[]>>({} as any);
  // Guard against race conditions when switching fast
  const reqIdRef = useRef(0);

  const title = useMemo(() => `KYC Approvals`, []);

  const load = useCallback(async (chosen?: AdminKycStatus) => {
    const st = chosen || status;
    const currentReq = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    // Show cached items immediately if available; otherwise clear to show skeleton
    const cached = cacheRef.current[st];
    setItems(Array.isArray(cached) ? cached : []);
    try {
      const res = await listAdminKycByStatus(st, 50, 0);
      if (currentReq !== reqIdRef.current) return; // ignore stale
      const data = res.data || [];
      cacheRef.current[st] = data;
      setItems(data);
    } catch (e: any) {
      if (currentReq !== reqIdRef.current) return;
      setError(e?.message || 'Failed to load KYC list');
    } finally {
      if (currentReq === reqIdRef.current) setLoading(false);
    }
  }, [status]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  // Load on mount and when status changes
  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: AdminKycItem }) => {
    const level = item.membership?.level || '-';
    const cell = item.membership?.cell?.name || '-';
    const designation = item.membership?.designation?.name || '-';
    // Prefer human name from nested user/profile where available; never show IDs in title
    const displayName =
      (item as any)?.membership?.user?.profile?.fullName ||
      (item as any)?.user?.profile?.fullName ||
      (item as any)?.membership?.user?.name ||
      (item as any)?.user?.name ||
      'Member';
    const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : '-';
    const aadhaar = item.aadhaarNumber || '';
    const pan = item.panNumber || '';
    const llb = item.llbRegistrationNumber || '';
    const accent = statusColor(item.status as any);
    const vis = statusVisual(item.status as any);
    return (
  <TouchableOpacity style={[styles.card]} onPress={() => router.push({ pathname: '/hrci/admin/kyc/[membershipId]' as any, params: { membershipId: item.membershipId } } as any)}>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <View style={[styles.accent, { backgroundColor: accent }]} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{displayName}</Text>
            <View style={styles.rowWrap}>
              <Text style={styles.cardSub}><Text style={styles.subLabel}>Level:</Text> {level}</Text>
              <Text style={[styles.dot]}>{'•'}</Text>
              <Text style={styles.cardSub}><Text style={styles.subLabel}>Cell:</Text> {cell}</Text>
            </View>
            <Text style={styles.cardSub}><Text style={styles.subLabel}>Designation:</Text> {designation}</Text>
            <View style={styles.divider} />
            {!!aadhaar && (
              <Text style={styles.cardSub}><Text style={styles.subLabel}>Aadhaar:</Text> {aadhaar}</Text>
            )}
            {!!pan && (
              <Text style={styles.cardSub}><Text style={styles.subLabel}>PAN:</Text> {pan}</Text>
            )}
            {!!llb && (
              <Text style={styles.cardSub}><Text style={styles.subLabel}>LLB Reg#:</Text> {llb}</Text>
            )}
            <Text style={[styles.cardSub, { marginTop: 4 }]}><Text style={styles.subLabel}>Created:</Text> {created}</Text>
          </View>
        </View>
        {!!item.remarks && <Text style={styles.remarks} numberOfLines={2}>{item.remarks}</Text>}
        {/* Footer: status chip at bottom */}
        <View style={styles.footerRow}>
          <View style={{ flex: 1 }} />
          <View style={[styles.statusPill, { backgroundColor: vis.bg, borderColor: vis.border }]}>
            <MaterialCommunityIcons name={vis.icon as any} size={14} color={vis.text} style={{ marginRight: 6 }} />
            <Text style={[styles.statusText, { color: vis.text }]}>{String(item.status || '').toUpperCase()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.heading}>{title}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.tabs}>
        {STATUSES.map((st) => (
          <TouchableOpacity key={st} style={[styles.tab, status === st && styles.tabActive]} onPress={() => st !== status && setStatus(st)}>
            <Text style={[styles.tabText, status === st && styles.tabTextActive]}>{st}</Text>
            {status === st && loading && (
              <ActivityIndicator style={{ marginLeft: 6 }} size="small" color={status === st ? '#fff' : '#111827'} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading && (!cacheRef.current[status] || cacheRef.current[status].length === 0) ? (
        <FlatList
          data={Array.from({ length: 6 }).map((_, i) => `skeleton-${i}`)}
          keyExtractor={(k) => String(k)}
          renderItem={() => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.accent, { backgroundColor: '#e5e7eb' }]} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={styles.skelTitle} />
                  <View style={styles.skelLine} />
                  <View style={[styles.skelLine, { width: '40%' }]} />
                </View>
                <View style={[styles.skeletonPill]} />
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ListHeaderComponent={<View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
            <Text style={styles.centerText}>Loading {status.toLowerCase()} KYC…</Text>
            {!!error && <Text style={[styles.centerText, { color: '#b91c1c', marginTop: 6 }]}>{error}</Text>}
          </View>}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.centerText}>No records</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

function statusColor(st: AdminKycStatus): string {
  const s = String(st || '').toUpperCase();
  if (s === 'APPROVED' || s === 'VERIFIED') return '#065f46';
  if (s === 'REJECTED') return '#7f1d1d';
  return '#92400e'; // pending default
}

// Helpers to build nice status chip colors
function hexToRgb(hex: string) {
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
}
function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function statusVisual(st: AdminKycStatus) {
  const base = statusColor(st);
  const s = String(st || '').toUpperCase();
  const text = base;
  const bg = withAlpha(base, 0.1);
  const border = withAlpha(base, 0.25);
  const icon = s === 'APPROVED' || s === 'VERIFIED' ? 'check-circle-outline' : s === 'REJECTED' ? 'close-circle-outline' : 'clock-outline';
  return { text, bg, border, icon } as const;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  heading: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1, textAlign: 'center' },
  tabs: { flexDirection: 'row', padding: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9999, backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: '#111827' },
  tabText: { color: '#111827', fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { color: '#6b7280', marginTop: 8 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 14, padding: 12, marginVertical: 8, gap: 6 },
  cardTitle: { color: '#111827', fontWeight: '800' },
  cardSub: { color: '#6b7280', fontSize: 12 },
  subLabel: { color: '#374151', fontWeight: '800' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  statusText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  remarks: { marginTop: 6, color: '#374151' },
  // Skeleton styles
  skeletonChip: { height: 28, width: 56, borderRadius: 9999, backgroundColor: '#e5e7eb' },
  skelTitle: { height: 14, borderRadius: 6, backgroundColor: '#e5e7eb', width: '60%', marginBottom: 8 },
  skelLine: { height: 12, borderRadius: 6, backgroundColor: '#e5e7eb', width: '80%', marginBottom: 6 },
  skeletonPill: { height: 24, width: 80, borderRadius: 9999, backgroundColor: '#e5e7eb' },
  // New accents
  accent: { width: 4, borderRadius: 4 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  dot: { color: '#9ca3af', marginHorizontal: 2 },
  divider: { height: 1, backgroundColor: '#eef2f7', marginVertical: 8 },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 9999, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  footerRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
});

