import { Colors } from '@/constants/Colors';
import { AdminAd, createAdminAdPayLink, getAdminAd, listAdminAds } from '@/services/hrciAdmin';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Image, KeyboardAvoidingView, Linking, ListRenderItem, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminAdsList() {
  const [items, setItems] = useState<AdminAd[]>([]);
  const [count, setCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Payment sheet state
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [payAd, setPayAd] = useState<AdminAd | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payName, setPayName] = useState('');
  const [payContact, setPayContact] = useState('');
  const [payEmail, setPayEmail] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payResult, setPayResult] = useState<{ shortUrl?: string; url?: string; linkId?: string; intentId?: string } | null>(null);

  const load = useCallback(async (reset = false) => {
    try {
      const res = await listAdminAds({ status: status || undefined, limit: 12, cursor: reset ? undefined : cursor || undefined });
      if (reset) setItems(res.data || []); else setItems(prev => [...prev, ...(res.data || [])]);
      setCount(res.count || (res.data?.length || 0));
      setCursor(res.nextCursor ?? null);
    } catch (e: any) {
      Alert.alert('Ads', e?.message || 'Failed to load ads');
    } finally {
      setLoading(false); setRefreshing(false); setFetchingMore(false);
    }
  }, [status, cursor]);

  useEffect(() => { setLoading(true); setCursor(null); load(true); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); setCursor(null); load(true); }, [load]);

  const loadMore = useCallback(() => {
    if (!cursor || fetchingMore || loading) return; setFetchingMore(true); load(false);
  }, [cursor, fetchingMore, loading, load]);

  const renderRightActions = (ad: AdminAd) => {
    const isBusy = busyId === ad.id;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <RectButton enabled={!isBusy} onPress={() => openPaymentSheet(ad)} style={styles.swipeAction}>
          {isBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="zap" size={16} color="#fff" />
              <Text style={styles.swipeActionTxt}>Activate</Text>
            </>
          )}
        </RectButton>
      </View>
    );
  };

  const renderItem: ListRenderItem<AdminAd> = ({ item }) => {
    const isVideo = String(item.mediaType || '').toUpperCase() === 'VIDEO';
    const thumb = isVideo ? (item.posterUrl || item.mediaUrl) : item.mediaUrl;
    const isDraft = String(item.status || '').toUpperCase() === 'DRAFT';
    const isBusy = busyId === item.id;
    const card = (
      <Pressable onPress={() => router.push(`/hrci/admin/ads/${item.id}` as any)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}> 
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: statusAccent(item.status), borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={styles.mediaBox}>{thumb ? <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" /> : <View style={styles.mediaPlaceholder} />}</View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text numberOfLines={1} style={styles.title}>{item.title || '—'}</Text>
              <View style={[styles.statusPill, pillColor(item.status)]}><Text style={styles.statusTxt}>{item.status || '—'}</Text></View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <View style={styles.badge}><Text style={styles.badgeTxt}>{item.mediaType}</Text></View>
              {!!item.languageId && <View style={styles.badgeLight}><Text style={styles.badgeLightTxt}>Lang</Text></View>}
              {!!item.startAt && !!item.endAt && <Text style={styles.meta}>{new Date(String(item.startAt)).toISOString().slice(0,10)} → {new Date(String(item.endAt)).toISOString().slice(0,10)}</Text>}
            </View>
            {!!item.clickUrl && <Text style={styles.meta} numberOfLines={1}>{item.clickUrl}</Text>}
          </View>
        </View>
        {isDraft ? (
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
            <Pressable disabled={isBusy} onPress={() => openPaymentSheet(item)} style={({ pressed }) => [styles.payBtn, { backgroundColor: '#0ea5e9' }, (pressed || isBusy) && { opacity: 0.9 }]} accessibilityLabel="Activate ad">
              {isBusy ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="zap" size={14} color="#fff" />}
              <Text style={styles.payTxt}>{isBusy ? 'Working…' : 'Activate'}</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
    return isDraft ? (
      <Swipeable overshootRight={false} friction={2} renderRightActions={() => renderRightActions(item)}>
        {card}
      </Swipeable>
    ) : card;
  };

  const openPaymentSheet = (ad: AdminAd) => {
    setPayAd(ad);
    setPayAmount('');
    setPayName('');
    setPayContact('');
    setPayEmail('');
    setPayResult(null);
    setPaySubmitting(false);
    setPaySheetOpen(true);
  };

  const submitPaymentLink = async () => {
    if (!payAd) return;
    const amount = Number(payAmount);
    if (!amount || isNaN(amount) || amount <= 0) { Alert.alert('Payment', 'Enter a valid amount'); return; }
    if (!payName.trim()) { Alert.alert('Payment', 'Enter name'); return; }
    if (!payContact.trim()) { Alert.alert('Payment', 'Enter mobile number'); return; }
    try {
      setPaySubmitting(true);
      setBusyId(payAd.id);
      const res = await createAdminAdPayLink(payAd.id, {
        amount,
        description: 'pay ads payment',
        customer: { name: payName.trim(), contact: payContact.trim(), email: payEmail.trim() || undefined },
      });
      setPayResult({
        shortUrl: (res as any)?.shortUrl,
        url: (res as any)?.url,
        linkId: (res as any)?.linkId,
        intentId: (res as any)?.intentId,
      });
    } catch (e: any) {
      Alert.alert('Payment', e?.message || 'Failed to create link');
    } finally {
      setPaySubmitting(false);
      setBusyId(null);
    }
  };

  const checkPaymentStatus = async () => {
    if (!payAd) return;
    try {
      const fresh = await getAdminAd(payAd.id);
      if (!fresh) return;
      // Update list locally
      setItems(prev => prev.map(it => it.id === fresh.id ? fresh : it));
      const s = String(fresh.status || '').toUpperCase();
      if (s === 'ACTIVE') {
        Alert.alert('Payment', 'Payment complete. Ad is ACTIVE.');
        setPaySheetOpen(false);
        // Refresh list to reflect filters
        setCursor(null); setLoading(true); await load(true);
      } else if (s.includes('DRAFT')) {
        Alert.alert('Payment', 'Payment is still pending.');
      } else {
        Alert.alert('Payment', `Current status: ${fresh.status}`);
      }
    } catch (e: any) {
      Alert.alert('Payment', e?.message || 'Failed to check status');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>‹</Text></Pressable>
        <Text style={styles.titleTop}>Ads{count ? ` (${count})` : ''}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filters}>
        {loading && !items.length ? (
          <ChipSkeletonRow />
        ) : (
          <View style={styles.chipsRow}>
            {['ALL','ACTIVE','EXPIRED','DRAFT'].map((s) => {
              const active = (s === 'ALL' && !status) || (s !== 'ALL' && status.toUpperCase() === s);
              return (
                <Pressable key={s} onPress={() => { setStatus(s==='ALL' ? '' : s); setCursor(null); setItems([]); setLoading(true); }}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.9 }]}>
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
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
          ListEmptyComponent={!loading ? <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: '#64748b' }}>No ads found.</Text></View> : null}
        />
      )}

      <Pressable onPress={() => router.push('/hrci/admin/ads/new' as any)} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}>
        <Feather name="plus" size={18} color="#fff" />
      </Pressable>

      {/* Payment Bottom Sheet */}
      {paySheetOpen && (
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>Activate Ad</Text>
              <Pressable onPress={() => setPaySheetOpen(false)} accessibilityLabel="Close"><Text style={styles.modalCloseTxt}>Close</Text></Pressable>
            </View>

            {!payResult ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View>
                  <Text style={styles.label}>Amount</Text>
                  <TextInput value={payAmount} onChangeText={setPayAmount} placeholder="Enter amount" keyboardType="numeric" style={styles.input} />
                </View>
                <View>
                  <Text style={styles.label}>Name</Text>
                  <TextInput value={payName} onChangeText={setPayName} placeholder="Enter name" style={styles.input} />
                </View>
                <View>
                  <Text style={styles.label}>Mobile Number</Text>
                  <TextInput value={payContact} onChangeText={setPayContact} placeholder="Enter mobile" keyboardType="phone-pad" style={styles.input} />
                </View>
                <View>
                  <Text style={styles.label}>Email (optional)</Text>
                  <TextInput value={payEmail} onChangeText={setPayEmail} placeholder="Enter email" keyboardType="email-address" style={styles.input} />
                </View>
                <Pressable disabled={paySubmitting} onPress={submitPaymentLink} style={({ pressed }) => [styles.primaryBtn, (pressed || paySubmitting) && { opacity: 0.9 }]}>
                  {paySubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnTxt}>Create Payment Link</Text>}
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: 12, gap: 12 }}>
                <View style={styles.noticePending}><Text style={styles.noticePendingTxt}>Payment Pending</Text></View>
                {!!(payResult.shortUrl || payResult.url) && (
                  <Pressable onPress={() => Linking.openURL((payResult.shortUrl || payResult.url)!)} style={({ pressed }) => [styles.linkBox, pressed && { opacity: 0.9 }]}>
                    <Feather name="external-link" size={14} color={Colors.light.primary} />
                    <Text numberOfLines={1} style={styles.linkBoxTxt}>{payResult.shortUrl || payResult.url}</Text>
                  </Pressable>
                )}
                <Pressable onPress={checkPaymentStatus} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.secondaryBtnTxt}>Check Status</Text>
                </Pressable>
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}

function pillColor(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s.includes('EXPIRE')) return { backgroundColor: '#fee2e2', borderColor: '#fecaca' };
  if (s.includes('ACTIVE')) return { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' };
  if (s.includes('DRAFT')) return { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' };
  return { backgroundColor: '#e2e8f0', borderColor: '#e2e8f0' };
}
function statusAccent(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s.includes('EXPIRE')) return '#ef4444';
  if (s.includes('ACTIVE')) return '#22c55e';
  if (s.includes('DRAFT')) return '#94a3b8';
  return '#e2e8f0';
}

// Skeletons
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
    return () => { try { (loop as any).stop && (loop as any).stop(); } catch {} };
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
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={styles.mediaBox}><ShimmerBlock width={'100%'} height={'100%' as any} borderRadius={8} /></View>
        <View style={{ flex: 1 }}>
          <ShimmerBlock width={'70%'} height={16} />
          <View style={{ height: 8 }} />
          <ShimmerBlock width={64} height={18} borderRadius={999} />
          <View style={{ height: 8 }} />
          <ShimmerBlock width={'60%'} height={12} />
          <View style={{ height: 6 }} />
          <ShimmerBlock width={'50%'} height={12} />
        </View>
      </View>
    </View>
  );
}
function SkeletonList() {
  return (
    <View style={{ padding: 12, gap: 10 }}>
      {Array.from({ length: 6 }).map((_, idx) => (<SkeletonCard key={idx} />))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  titleTop: { color: Colors.light.primary, fontWeight: '900' },
  filters: { padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipTxt: { color: '#0f172a', fontWeight: '800', fontSize: 12 },
  chipTxtActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12, overflow: 'hidden' },
  mediaBox: { width: 72, height: 128, borderRadius: 8, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  mediaPlaceholder: { flex: 1, backgroundColor: '#e5e7eb' },
  title: { color: '#0f172a', fontWeight: '900', flex: 1, marginRight: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusTxt: { color: '#0f172a', fontWeight: '800', fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#eef2ff' },
  badgeTxt: { color: Colors.light.primary, fontWeight: '800', fontSize: 10 },
  badgeLight: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#f1f5f9' },
  badgeLightTxt: { color: '#0f172a', fontWeight: '800', fontSize: 10 },
  meta: { color: '#64748b' },
  fab: { position: 'absolute', right: 16, bottom: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  payTxt: { color: '#fff', fontWeight: '800' },
  swipeAction: { width: 140, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0ea5e9', marginVertical: 6, borderTopRightRadius: 12, borderBottomRightRadius: 12, gap: 4 },
  swipeActionTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  // Modal sheet styles
  modalOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#e2e8f0', marginBottom: 8 },
  modalCloseTxt: { color: Colors.light.primary, fontWeight: '800' },
  label: { color: '#0f172a', fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryBtn: { backgroundColor: Colors.light.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnTxt: { color: '#fff', fontWeight: '900' },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.light.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  secondaryBtnTxt: { color: Colors.light.primary, fontWeight: '900' },
  noticePending: { backgroundColor: '#fff7ed', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ffedd5' },
  noticePendingTxt: { color: '#9a3412', fontWeight: '800' },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  linkBoxTxt: { color: Colors.light.primary, fontWeight: '800', flex: 1 },
});
