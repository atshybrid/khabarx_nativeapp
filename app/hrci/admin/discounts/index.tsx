import { Colors } from '@/constants/Colors';
import { MembershipDiscount, cancelAdminDiscount, listAdminDiscounts } from '@/services/hrciAdmin';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, ListRenderItem, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminDiscountsList() {
  const [items, setItems] = useState<MembershipDiscount[]>([]);
  const [count, setCount] = useState<number>(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [fetchingMore, setFetchingMore] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async (reset = false) => {
    try {
      const res = await listAdminDiscounts({ status: status || undefined, mobileNumber: mobile || undefined, limit: 20, cursor: reset ? undefined : cursor || undefined });
      if (reset) {
        setItems(res.data || []);
      } else {
        setItems(prev => [...prev, ...(res.data || [])]);
      }
      setCount(res.count || (res.data?.length || 0));
      setCursor(res.nextCursor ?? null);
    } catch (e: any) {
      Alert.alert('Discounts', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setFetchingMore(false);
    }
  }, [status, mobile, cursor]);

  useEffect(() => { setLoading(true); setCursor(null); load(true); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); setCursor(null); load(true); }, [load]);
  const onApplyFilters = useCallback(() => { setLoading(true); setCursor(null); setItems([]); }, []);
  const onClearFilters = useCallback(() => { setStatus(''); setMobile(''); setLoading(true); setCursor(null); setItems([]); }, []);

  const onCancel = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const s = String(item.status || '').toUpperCase();
    if (!s.includes('ACTIVE')) return;
    const proceed = await new Promise<boolean>((resolve) => {
      try {
        Alert.alert('Cancel discount', 'Are you sure you want to cancel this discount?', [
          { text: 'No' as any, onPress: () => resolve(false) },
          { text: 'Yes, cancel', style: 'destructive' as any, onPress: () => resolve(true) },
        ]);
      } catch { resolve(true); }
    });
    if (!proceed) return;
    try {
      setCancellingId(id);
      const res = await cancelAdminDiscount(id);
      // If viewing ACTIVE filter, remove it; otherwise update in-place
      setItems(prev => (status.toUpperCase() === 'ACTIVE') ? prev.filter(p => p.id !== id) : prev.map(p => p.id === id ? { ...p, status: res.status } : p));
      try { Alert.alert('Discount', 'Cancelled'); } catch {}
    } catch (e: any) {
      Alert.alert('Discount', e?.message || 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  }, [items, status]);

  const renderItem: ListRenderItem<MembershipDiscount> = ({ item }) => {
    const pct = item.percentOff != null ? `${item.percentOff}%` : (item.amountOff != null ? `${item.currency || 'INR'} ${item.amountOff}` : '—');
    const active = [item.activeFrom, item.activeTo].filter(Boolean).map(s => new Date(String(s)).toISOString().slice(0,10)).join(' → ');
    const isActive = String(item.status || '').toUpperCase().includes('ACTIVE');
    const Card = (
      <Pressable onPress={() => router.push(`/hrci/admin/discounts/${item.id}` as any)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}> 
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: statusAccent(item.status), borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.mobile}>{item.mobileNumber || item.code || '—'}</Text>
          <View style={[styles.statusPill, pillColor(item.status)]}><Text style={styles.statusTxt}>{item.status || '—'}</Text></View>
        </View>
        <Text style={styles.percent}>{pct}</Text>
        <Text style={styles.meta}>{active || 'No schedule'}</Text>
        <Text style={styles.meta}>Redeemed {item.redeemedCount ?? 0}/{item.maxRedemptions ?? '∞'}</Text>
      </Pressable>
    );
    if (!isActive) return Card;
    return (
      <Swipeable
        renderRightActions={() => (
          <View style={styles.swipeRightWrap}>
            <Pressable onPress={() => onCancel(item.id)} style={({ pressed }) => [styles.swipeCancelBtn, pressed && { opacity: 0.9 }]} accessibilityLabel="Cancel discount">
              <Feather name="x-circle" size={18} color="#fff" />
              <Text style={styles.swipeCancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        )}
        overshootRight={false}
      >
        {Card}
      </Swipeable>
    );
  };

  const loadMore = useCallback(() => {
    if (!cursor || fetchingMore || loading) return;
    setFetchingMore(true);
    load(false);
  }, [cursor, fetchingMore, loading, load]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>‹</Text></Pressable>
        <Text style={styles.title}>Member Discounts{count ? ` (${count})` : ''}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Quick status chips + Filters */}
      <View style={styles.filters}>
        {loading && !items.length ? (
          <ChipSkeletonRow />
        ) : (
          <View style={styles.chipsRow}>
            {['ALL','ACTIVE','REDEEMED','CANCELLED'].map((s) => {
              const active = (s === 'ALL' && !status) || (s !== 'ALL' && status.toUpperCase() === s);
              return (
                <Pressable key={s} onPress={() => {
                  // When selecting ALL, clear status and mobile filter
                  if (s === 'ALL') { setStatus(''); setMobile(''); } else { setStatus(s); }
                  // Reset list state and let useEffect trigger load
                  setCursor(null); setItems([]); setLoading(true);
                }}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.9 }]}>
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={styles.inputsRow}>
          <View style={[styles.inputWrap, { flex: 1 }]}> 
            <Feather name="phone" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
            <TextInput placeholder="Mobile" placeholderTextColor="#9CA3AF" value={mobile} onChangeText={setMobile} style={[styles.inputBare]} keyboardType="phone-pad" />
          </View>
          <Pressable onPress={onApplyFilters} accessibilityLabel="Apply filters" style={({ pressed }) => [styles.iconBtnPrimary, pressed && { opacity: 0.9 }]}>
            <Feather name="filter" size={18} color="#fff" />
          </Pressable>
          <Pressable onPress={onClearFilters} accessibilityLabel="Reset filters" style={({ pressed }) => [styles.iconBtnGhost, pressed && { opacity: 0.9 }]}>
            <Feather name="rotate-ccw" size={18} color="#0f172a" />
          </Pressable>
        </View>
      </View>

      {loading && !items.length ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListFooterComponent={fetchingMore ? <View style={{ paddingVertical: 12, alignItems: 'center' }}><ActivityIndicator size="small" color={Colors.light.primary} /></View> : null}
          ListEmptyComponent={!loading ? <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: '#64748b' }}>No discounts found.</Text></View> : null}
        />
      )}

      <Pressable onPress={() => router.push('/hrci/admin/discounts/new' as any)} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}>
        <Feather name="percent" size={18} color="#fff" />
      </Pressable>

      {cancellingId && (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={styles.overlayBox}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
            <Text style={styles.overlayText}>Cancelling…</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// Lightweight pulsing skeleton blocks to indicate loading state
function ShimmerBlock({ width = '100%', height = 16, borderRadius = 8, style }: { width?: number | string; height?: number; borderRadius?: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      // Stop the animation loop when unmounting
      try { (loop as any).stop && (loop as any).stop(); } catch {}
    };
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: '#eaeef5', opacity }, style]} />;
}

function ChipSkeletonRow() {
  return (
    <View style={styles.chipsRow}>
      {[60, 82, 104, 74].map((w, i) => (
        <ShimmerBlock key={i} width={w} height={28} borderRadius={999} />
      ))}
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={[styles.card, { position: 'relative' }]}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: '#e2e8f0', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <ShimmerBlock width={120} height={14} />
        <ShimmerBlock width={64} height={18} borderRadius={999} />
      </View>
      <View style={{ height: 8 }} />
      <ShimmerBlock width={90} height={22} />
      <View style={{ height: 6 }} />
      <ShimmerBlock width={'80%'} height={12} />
      <View style={{ height: 6 }} />
      <ShimmerBlock width={'60%'} height={12} />
    </View>
  );
}

function SkeletonList() {
  return (
    <View style={{ padding: 12, gap: 10 }}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </View>
  );
}

function pillColor(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s.includes('REDEEM')) return { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' };
  if (s.includes('CANCEL')) return { backgroundColor: '#fee2e2', borderColor: '#fecaca' };
  if (s.includes('ACTIVE')) return { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' };
  return { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' };
}

function statusAccent(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s.includes('REDEEM')) return '#38bdf8'; // sky-400
  if (s.includes('CANCEL')) return '#ef4444'; // red-500
  if (s.includes('ACTIVE')) return '#22c55e'; // green-500
  return '#e2e8f0';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  title: { color: Colors.light.primary, fontWeight: '900' },
  createBtn: { flexDirection: 'row', gap: 6, backgroundColor: Colors.light.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  createTxt: { color: '#fff', fontWeight: '800' },
  filters: { padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipTxt: { color: '#0f172a', fontWeight: '800', fontSize: 12 },
  chipTxtActive: { color: '#fff' },
  inputsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center' },
  inputBare: { padding: 0, margin: 0, color: '#111', minWidth: 40, flex: 1 },
  filterBtn: { flexDirection: 'row', gap: 6, backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  filterTxt: { color: '#fff', fontWeight: '800' },
  filterGhost: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', backgroundColor: '#fff' },
  filterGhostTxt: { color: '#0f172a', fontWeight: '800' },
  iconBtnPrimary: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center' },
  iconBtnGhost: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12, overflow: 'hidden' },
  mobile: { color: '#0f172a', fontWeight: '900' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusTxt: { color: '#0f172a', fontWeight: '800', fontSize: 12 },
  percent: { color: Colors.light.primary, fontWeight: '900', fontSize: 20, marginTop: 6 },
  meta: { color: '#64748b', marginTop: 2 },
  fab: { position: 'absolute', right: 16, bottom: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  overlayBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  overlayText: { marginTop: 8, color: '#0f172a', fontWeight: '800' }
  ,swipeRightWrap: { justifyContent: 'center', alignItems: 'flex-end' }
  ,swipeCancelBtn: { width: 96, height: '90%', marginVertical: 6, marginRight: 8, backgroundColor: '#ef4444', borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 }
  ,swipeCancelTxt: { color: '#fff', fontWeight: '800' }
});
