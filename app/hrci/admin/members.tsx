import Toast from '@/components/Toast';
import { Colors } from '@/constants/Colors';
import { AdminMembership, listAdminMemberships } from '@/services/hrciAdmin';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function HrciAdminMembers() {
  const [items, setItems] = useState<AdminMembership[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null); // null => All
  const [level, setLevel] = useState<string | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [cellQuery, setCellQuery] = useState<string>('');
  const [stateQuery, setStateQuery] = useState<string>('');
  const [districtQuery, setDistrictQuery] = useState<string>('');
  const [mandalQuery, setMandalQuery] = useState<string>('');
  // Server-side filter inputs
  const [userIdFilter, setUserIdFilter] = useState<string>('');
  const [cellIdFilter, setCellIdFilter] = useState<string>('');
  const [designationIdFilter, setDesignationIdFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');
  const [idCardStatusFilter, setIdCardStatusFilter] = useState<string>('');

  const load = useCallback(async (opts?: { cursor?: string | null; append?: boolean }) => {
    const isInitial = !opts?.append && !opts?.cursor;
    if (isInitial) setLoading(true);
    const start = Date.now();
    try {
  const res = await listAdminMemberships({
      status: status || undefined,
      level: level || undefined,
      userId: userIdFilter.trim() || undefined,
      cellId: cellIdFilter.trim() || undefined,
      designationId: designationIdFilter.trim() || undefined,
      paymentStatus: paymentStatusFilter.trim() || undefined,
      idCardStatus: idCardStatusFilter.trim() || undefined,
      limit: 20,
      cursor: opts?.cursor || undefined,
    });
      const data = Array.isArray(res.data) ? res.data : [];
      setNextCursor(res.nextCursor || null);
      setItems(prev => (opts?.append ? [...prev, ...data] : data));
    } catch (e) {
      console.warn('[AdminMembers] load failed', (e as any)?.message || e);
      // Fire toast event
      try { const evt = require('@/services/events'); evt.emit?.('toast:show', { message: 'Failed to load members' }); } catch {}
    } finally {
      if (isInitial) {
        const elapsed = Date.now() - start;
        const minMs = 400;
        const remain = Math.max(minMs - elapsed, 0);
        if (remain > 0) await new Promise(r => setTimeout(r, remain));
        setLoading(false);
      }
    }
  }, [status, level, userIdFilter, cellIdFilter, designationIdFilter, paymentStatusFilter, idCardStatusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || loading || !nextCursor) return;
    setLoadingMore(true);
    try {
      await load({ cursor: nextCursor, append: true });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, nextCursor, load]);

  const StatusChips = useMemo(() => {
    const options = [
      { key: 'ALL', label: 'All', value: null },
      { key: 'ACTIVE', label: 'Active', value: 'ACTIVE' },
      { key: 'PENDING', label: 'Pending', value: 'PENDING' },
      { key: 'EXPIRED', label: 'Expired', value: 'EXPIRED' },
    ] as { key: string; label: string; value: string | null }[];
    return (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map(opt => {
          const selected = status === opt.value || (opt.value === null && status === null);
          return (
            <Pressable key={opt.key} onPress={() => setStatus(opt.value)} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.chipTxt, selected && styles.chipTxtSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }, [status]);

  const LevelChips = useMemo(() => {
    const uniq = Array.from(new Set((items || []).map(i => (i.level || '').toString().trim()).filter(Boolean)));
    const options = [{ key: 'ALL', label: 'All', value: null as string | null }, ...uniq.map(v => ({ key: v, label: v, value: v }))];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map(opt => {
          const selected = level === opt.value || (opt.value === null && level === null);
          return (
            <Pressable key={opt.key} onPress={() => setLevel(opt.value)} style={({ pressed }) => [styles.chip, selected && styles.chipSelectedSecondary, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.chipTxt, selected && styles.chipTxtSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }, [level, items]);

  const clearFilters = useCallback(() => {
    setStatus(null);
    setLevel(null);
    setSearch('');
    setCellQuery('');
    setStateQuery('');
    setDistrictQuery('');
    setMandalQuery('');
    setUserIdFilter('');
    setCellIdFilter('');
    setDesignationIdFilter('');
    setPaymentStatusFilter('');
    setIdCardStatusFilter('');
  }, []);

  const renderItem = useCallback(({ item }: { item: AdminMembership }) => {
    const name = item?.user?.profile?.fullName || 'Member';
    const mobile = item?.user?.mobileNumber || '—';
    const lvl = item?.level || '—';
    const st = item?.status || '—';
    const cell = item?.cell?.name || item?.cell?.code || '';
    const desig = item?.designation?.name || item?.designation?.code || '';
    const cardNumber = item?.idCard?.cardNumber || '';
    const subtitle = [mobile, cell, cardNumber].filter(Boolean).join(' · ');
    const locParts: string[] = [];
    const stateName = (item as any)?.hrci?.state?.name || (item as any)?.hrci?.state || '';
    const districtName = (item as any)?.hrci?.district?.name || (item as any)?.hrci?.district || '';
    const mandalName = (item as any)?.hrci?.mandal?.name || (item as any)?.hrci?.mandal || '';
    if (stateName) locParts.push(stateName);
    if (districtName) locParts.push(districtName);
    if (mandalName) locParts.push(mandalName);
    const locationStr = locParts.join(' • ');
    const photo = item?.user?.profile?.profilePhotoUrl || '';
    const statusColor = st === 'ACTIVE' ? '#16a34a' : st === 'PENDING' ? '#e67e22' : st === 'EXPIRED' ? '#64748b' : '#ef4444';
    return (
      <Pressable onPress={() => router.push(`/hrci/admin/members/${item.id}` as any)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={styles.avatarWrap}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}><Feather name="user" size={16} color="#64748b" /></View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text numberOfLines={1} style={styles.title}>{name}</Text>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <View style={[styles.badge, { backgroundColor: `${statusColor}20`, borderColor: `${statusColor}55` }]}>
                <Text style={[styles.badgeTxt, { color: statusColor }]}>{st}</Text>
              </View>
              {lvl ? (
                <View style={[styles.badge, styles.badgeOutline]}>
                  <Text style={[styles.badgeTxt, { color: Colors.light.secondary }]}>{lvl}</Text>
                </View>
              ) : null}
              {desig ? (
                <View style={[styles.badge, styles.badgeGhost]}>
                  <Text style={[styles.badgeTxtGhost]}>{desig}</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
            {!!locationStr && <Text numberOfLines={1} style={styles.meta}>{locationStr}</Text>}
          </View>
        </View>
      </Pressable>
    );
  }, []);

  const keyExtractor = useCallback((item: AdminMembership, index: number) => String(item.id || index), []);

  // Apply client-side filters (search, cell/name, location)
  const filteredItems = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    const cq = (cellQuery || '').trim().toLowerCase();
    const sq = (stateQuery || '').trim().toLowerCase();
    const dq = (districtQuery || '').trim().toLowerCase();
    const mq = (mandalQuery || '').trim().toLowerCase();
    return items.filter(it => {
      const name = (it?.user?.profile?.fullName || '').toLowerCase();
      const mobile = (it?.user?.mobileNumber || '').toLowerCase();
      const inSearch = !q || name.includes(q) || mobile.includes(q);
      const cellStr = `${it?.cell?.name || ''} ${it?.cell?.code || ''}`.toLowerCase();
      const inCell = !cq || cellStr.includes(cq);
      const stateName = ((it as any)?.hrci?.state?.name || (it as any)?.hrci?.state || '').toLowerCase();
      const distName = ((it as any)?.hrci?.district?.name || (it as any)?.hrci?.district || '').toLowerCase();
      const mandalName = ((it as any)?.hrci?.mandal?.name || (it as any)?.hrci?.mandal || '').toLowerCase();
      const inState = !sq || stateName.includes(sq);
      const inDist = !dq || distName.includes(dq);
      const inMandal = !mq || mandalName.includes(mq);
      return inSearch && inCell && inState && inDist && inMandal;
    });
  }, [items, search, cellQuery, stateQuery, districtQuery, mandalQuery]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {/* App Bar */}
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}>
          <Feather name="arrow-left" size={18} color={Colors.light.primary} />
        </Pressable>
        <Text style={styles.appTitle}>Members</Text>
        <Pressable onPress={clearFilters} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.85 }]}>
          <Feather name="x-circle" size={16} color={Colors.light.primary} />
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filtersCard}>
        <Text style={styles.filtersTitle}>Filters</Text>
        {/* Search */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="#94a3b8" />
          <TextInput
            placeholder="Search name or mobile"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            keyboardType="default"
            returnKeyType="search"
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}><Feather name="x" size={16} color="#94a3b8" /></Pressable>
          )}
        </View>
        {/* Quick chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {StatusChips}
          {LevelChips}
        </ScrollView>
        {/* More filters toggle */}
        <Pressable onPress={() => setShowMoreFilters(v => !v)} style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.9 }]}>
          <Feather name={showMoreFilters ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.light.primary} />
          <Text style={styles.moreTxt}>{showMoreFilters ? 'Hide filters' : 'More filters'}</Text>
        </Pressable>
        {showMoreFilters && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>User ID</Text>
              <TextInput value={userIdFilter} onChangeText={setUserIdFilter} placeholder="Exact userId" placeholderTextColor="#94a3b8" style={styles.fieldInput} autoCapitalize="none" />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Cell ID</Text>
              <TextInput value={cellIdFilter} onChangeText={setCellIdFilter} placeholder="Exact cellId" placeholderTextColor="#94a3b8" style={styles.fieldInput} autoCapitalize="none" />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Designation ID</Text>
              <TextInput value={designationIdFilter} onChangeText={setDesignationIdFilter} placeholder="Exact designationId" placeholderTextColor="#94a3b8" style={styles.fieldInput} autoCapitalize="none" />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Payment</Text>
              <TextInput value={paymentStatusFilter} onChangeText={setPaymentStatusFilter} placeholder="SUCCESS / FAILED" placeholderTextColor="#94a3b8" style={styles.fieldInput} autoCapitalize="characters" />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>ID Card</Text>
              <TextInput value={idCardStatusFilter} onChangeText={setIdCardStatusFilter} placeholder="GENERATED / NOT_CREATED" placeholderTextColor="#94a3b8" style={styles.fieldInput} autoCapitalize="characters" />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Cell</Text>
              <TextInput value={cellQuery} onChangeText={setCellQuery} placeholder="Name or code" placeholderTextColor="#94a3b8" style={styles.fieldInput} />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput value={stateQuery} onChangeText={setStateQuery} placeholder="State" placeholderTextColor="#94a3b8" style={styles.fieldInput} />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>District</Text>
              <TextInput value={districtQuery} onChangeText={setDistrictQuery} placeholder="District" placeholderTextColor="#94a3b8" style={styles.fieldInput} />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Mandal</Text>
              <TextInput value={mandalQuery} onChangeText={setMandalQuery} placeholder="Mandal" placeholderTextColor="#94a3b8" style={styles.fieldInput} />
            </View>
          </View>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ paddingHorizontal: 12 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.35}
          onEndReached={onEndReached}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.light.primary} />
            </View>
          ) : (
            <View style={{ height: 12 }} />
          )}
          ListEmptyComponent={!loading ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Feather name="users" size={24} color="#94a3b8" />
              <Text style={{ color: '#64748b', marginTop: 8 }}>No members found.</Text>
            </View>
          ) : null}
        />
      )}
      {/* FAB to create member */}
      <Pressable onPress={() => router.push('/hrci/admin/members/create' as any)} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}>
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>
      <Toast />
    </SafeAreaView>
  );
}

function SkeletonRow() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => { loop.stop(); };
  }, [pulse]);
  const bg = pulse.interpolate({ inputRange: [0, 1], outputRange: ['#f1f5f9', '#e2e8f0'] });
  return (
    <View style={[styles.card]}> 
      <Animated.View style={[styles.avatar, { backgroundColor: bg }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <Animated.View style={{ height: 12, borderRadius: 6, backgroundColor: bg, width: '55%' }} />
        <Animated.View style={{ height: 10, borderRadius: 6, backgroundColor: bg, width: '35%' }} />
        <Animated.View style={{ height: 10, borderRadius: 6, backgroundColor: bg, width: '45%' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  appTitle: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7' },
  clearBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7' },
  filtersCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef2f7', margin: 12, marginBottom: 8 },
  filtersTitle: { color: '#0f172a', fontWeight: '900', marginBottom: 8, fontSize: 14 },
  chip: { backgroundColor: '#f8fafc', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  chipSelected: { backgroundColor: Colors.light.secondary, borderColor: Colors.light.secondary },
  chipSelectedSecondary: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipTxt: { color: '#0f172a', fontWeight: '800' },
  chipTxtSelected: { color: '#fff' },
  card: { flexDirection: 'column', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef2f7', marginBottom: 8, elevation: 1 },
  avatarWrap: { },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPh: { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  title: { color: '#0f172a', fontWeight: '900' },
  subtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  meta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1 },
  badgeTxt: { fontSize: 11, fontWeight: '900' },
  badgeOutline: { backgroundColor: '#fff', borderColor: Colors.light.secondary },
  badgeGhost: { backgroundColor: '#f8fafc', borderColor: '#e5e7eb' },
  badgeTxtGhost: { color: '#0f172a', fontSize: 11, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc', paddingHorizontal: 10, height: 40, marginBottom: 6 },
  searchInput: { flex: 1, color: '#0f172a' },
  moreBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', marginTop: 6 },
  moreTxt: { color: Colors.light.primary, fontWeight: '900' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel: { width: 72, color: '#64748b', fontWeight: '800' },
  fieldInput: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 10, backgroundColor: '#f8fafc', color: '#0f172a' },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
