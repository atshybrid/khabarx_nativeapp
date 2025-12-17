import FacetPickerModal from '@/components/FacetPickerModal';
import FilterChip from '@/components/FilterChip';
import MemberListItem from '@/components/MemberListItem';
import { Colors } from '@/constants/Colors';
import { useAdminMemberships } from '@/hooks/useAdminMemberships';
import { useMembershipMeta } from '@/hooks/useMembershipMeta';
import { emit } from '@/services/events';
import { assignAdminMembershipSeat, deleteAdminMembership } from '@/services/hrciAdmin';
import type { MembershipRecord } from '@/types/memberships';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MembershipsScreen() {
  // Removed unused showFilters state.
  const { data: members, cursor, filters, setFilters, resetFilters, loading, error, refreshing, hasMore, loadMore, refresh, reload } = useAdminMemberships({ initialFilters: { status: 'ACTIVE' }, pageSize: 20 });
  const meta = useMembershipMeta();
  const assignMeta = useMembershipMeta();
  const [picker, setPicker] = useState<null | 'level' | 'cell' | 'designation' | 'country' | 'state' | 'district' | 'mandal'>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const filterSnapPoints = useMemo(() => ['60%'], []);

  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const detailSheetRef = useRef<BottomSheetModal>(null);
  const detailSnapPoints = useMemo(() => ['85%'], []);
  const [selectedMember, setSelectedMember] = useState<MembershipRecord | null>(null);
  const [detailActionBusy, setDetailActionBusy] = useState<null | 'assign' | 'delete'>(null);

  const [assignSheetVisible, setAssignSheetVisible] = useState(false);
  const assignSheetRef = useRef<BottomSheetModal>(null);
  const assignSnapPoints = useMemo(() => ['85%'], []);
  const [assignPicker, setAssignPicker] = useState<null | 'level' | 'country' | 'state' | 'district' | 'mandal' | 'cell' | 'designation'>(null);
  const [assignZone, setAssignZone] = useState('');
  const [assignBusy, setAssignBusy] = useState<null | 'preview' | 'commit'>(null);
  const selectedCell = useMemo(() => meta.cells.find(c => c.id === filters.cellId), [meta.cells, filters.cellId]);
  const selectedDesignation = useMemo(() => meta.designations.find(d => d.id === filters.designationId), [meta.designations, filters.designationId]);
  const selectedDistrictLabel = useMemo(() => {
    const ids = meta.selected.districtIds;
    if (ids && ids.length > 1) return `Districts (${ids.length})`;
    if (ids && ids.length === 1) {
      const one = meta.districts.find(d => d.id === ids[0]);
      return one ? `District: ${one.name}` : 'District';
    }
    if (meta.selected.districtId) {
      const one = meta.districts.find(d => d.id === meta.selected.districtId);
      return one ? `District: ${one.name}` : 'District';
    }
    return 'District';
  }, [meta.selected.districtId, meta.selected.districtIds, meta.districts]);
  // Quick status filter options
  const statusOptions = useMemo(() => [
    { label: 'Active', value: 'ACTIVE', color: '#22c55e' },
    { label: 'Inactive', value: 'INACTIVE', color: '#ef4444' },
    { label: 'Pending', value: 'PENDING', color: '#f59e0b' },
    { label: 'All', value: '', color: '#64748b' }
  ], []);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
  ), []);

  useEffect(() => {
    if (filterSheetVisible) filterSheetRef.current?.present();
    else filterSheetRef.current?.dismiss();
  }, [filterSheetVisible]);

  useEffect(() => {
    if (detailSheetVisible) detailSheetRef.current?.present();
    else detailSheetRef.current?.dismiss();
  }, [detailSheetVisible]);

  useEffect(() => {
    if (assignSheetVisible) assignSheetRef.current?.present();
    else assignSheetRef.current?.dismiss();
  }, [assignSheetVisible]);

  // Auto-select geo hierarchy (country -> state -> district -> mandal) when required.
  // This avoids the common “lists loaded but nothing selected” confusion in the assign flow.
  useEffect(() => {
    if (!assignSheetVisible) return;
    const level = String(assignMeta.selected.level || '');
    if (!['STATE', 'DISTRICT', 'MANDAL'].includes(level)) return;
    if (assignMeta.selected.countryId) return;
    const first = assignMeta.countries[0];
    if (first?.id) assignMeta.selectCountry(first.id);
  }, [assignSheetVisible, assignMeta.countries, assignMeta.selected.countryId, assignMeta.selected.level, assignMeta.selectCountry]);

  useEffect(() => {
    if (!assignSheetVisible) return;
    const level = String(assignMeta.selected.level || '');
    if (!['STATE', 'DISTRICT', 'MANDAL'].includes(level)) return;
    if (!assignMeta.selected.countryId) return;
    if (assignMeta.selected.stateId) return;
    const first = assignMeta.states[0];
    if (first?.id) assignMeta.selectState(first.id);
  }, [assignSheetVisible, assignMeta.selected.countryId, assignMeta.selected.level, assignMeta.selected.stateId, assignMeta.selectState, assignMeta.states]);

  useEffect(() => {
    if (!assignSheetVisible) return;
    const level = String(assignMeta.selected.level || '');
    if (!['DISTRICT', 'MANDAL'].includes(level)) return;
    if (!assignMeta.selected.stateId) return;
    if (assignMeta.selected.districtId) return;
    const first = assignMeta.districts[0];
    if (first?.id) assignMeta.selectDistrict(first.id);
  }, [assignSheetVisible, assignMeta.districts, assignMeta.selected.districtId, assignMeta.selected.level, assignMeta.selected.stateId, assignMeta.selectDistrict]);

  useEffect(() => {
    if (!assignSheetVisible) return;
    const level = String(assignMeta.selected.level || '');
    if (level !== 'MANDAL') return;
    if (!assignMeta.selected.districtId) return;
    if (assignMeta.selected.mandalId) return;
    const first = assignMeta.mandals[0];
    if (first?.id) assignMeta.selectMandal(first.id);
  }, [assignSheetVisible, assignMeta.mandals, assignMeta.selected.districtId, assignMeta.selected.level, assignMeta.selected.mandalId, assignMeta.selectMandal]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (assignPicker) {
        setAssignPicker(null);
        return true;
      }
      if (assignSheetVisible) {
        setAssignSheetVisible(false);
        return true;
      }
      if (detailSheetVisible) {
        setDetailSheetVisible(false);
        return true;
      }
      if (filterSheetVisible) {
        setFilterSheetVisible(false);
        return true;
      }
      if (picker) {
        setPicker(null);
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [assignPicker, assignSheetVisible, detailSheetVisible, filterSheetVisible, picker]);

  const onRefresh = useCallback(() => refresh(), [refresh]);

  const openMemberDetails = useCallback((m: MembershipRecord) => {
    setSelectedMember(m);
    setDetailSheetVisible(true);
  }, []);

  const handleChangeDesignation = useCallback(() => {
    const m = selectedMember;
    if (!m || !m.id) {
      try { emit('toast:show', { message: 'Member not found' }); } catch {}
      return;
    }

    // Prefill current values (like the create-member flow) so admin can adjust quickly.
    assignMeta.selectLevel(m.level || undefined);
    assignMeta.selectCell(m.cellId || undefined);
    assignMeta.selectDesignation(m.designationId || undefined);
    assignMeta.selectCountry(m.hrcCountryId || undefined);
    assignMeta.selectState(m.hrcStateId || undefined);
    assignMeta.selectDistrict(m.hrcDistrictId || undefined);
    assignMeta.selectMandal(m.hrcMandalId || undefined);
    setAssignZone(String(m.zone || ''));

    setAssignSheetVisible(true);
  }, [assignMeta, selectedMember]);

  const buildAssignPayload = useCallback((dryRun: boolean) => {
    const membershipId = selectedMember?.id;
    if (!membershipId) return null;

    const level = String(assignMeta.selected.level || '').trim();
    const cell = assignMeta.cells.find(c => c.id === assignMeta.selected.cellId);
    const designation = assignMeta.designations.find(d => d.id === assignMeta.selected.designationId);
    if (!level || !cell || !designation) return null;
    if (!cell.code || !designation.code) return null;

    const payload: any = {
      level,
      cell: String(cell.code),
      designationCode: String(designation.code),
      dryRun,
    };

    if (assignMeta.selected.countryId) payload.hrcCountryId = assignMeta.selected.countryId;
    if (level === 'STATE') {
      if (assignMeta.selected.stateId) payload.hrcStateId = assignMeta.selected.stateId;
    } else if (level === 'DISTRICT') {
      if (assignMeta.selected.districtId) payload.hrcDistrictId = assignMeta.selected.districtId;
    } else if (level === 'MANDAL') {
      if (assignMeta.selected.districtId) payload.hrcDistrictId = assignMeta.selected.districtId;
      if (assignMeta.selected.mandalId) payload.hrcMandalId = assignMeta.selected.mandalId;
    } else if (level === 'ZONE') {
      const z = String(assignZone || '').trim();
      if (z) payload.zone = z;
    }

    return { membershipId, payload } as { membershipId: string; payload: any };
  }, [assignMeta.cells, assignMeta.designations, assignMeta.selected, assignZone, selectedMember?.id]);

  const validateAssign = useCallback(() => {
    const level = String(assignMeta.selected.level || '').trim();
    if (!level) return 'Select level';
    if (!assignMeta.selected.cellId) return 'Select cell';
    if (!assignMeta.selected.designationId) return 'Select designation';
    if (level === 'STATE' && !assignMeta.selected.stateId) return 'Select state';
    if (level === 'DISTRICT' && !assignMeta.selected.districtId) return 'Select district';
    if (level === 'MANDAL' && (!assignMeta.selected.districtId || !assignMeta.selected.mandalId)) return 'Select district and mandal';
    if (level === 'ZONE' && !String(assignZone || '').trim()) return 'Enter zone';
    const cell = assignMeta.cells.find(c => c.id === assignMeta.selected.cellId);
    const designation = assignMeta.designations.find(d => d.id === assignMeta.selected.designationId);
    if (!cell?.code) return 'Cell code missing';
    if (!designation?.code) return 'Designation code missing';
    return null;
  }, [assignMeta.cells, assignMeta.designations, assignMeta.selected, assignZone]);

  const runAssignPreview = useCallback(async () => {
    const missing = validateAssign();
    if (missing) {
      try { emit('toast:show', { message: missing }); } catch {}
      return;
    }

    const built = buildAssignPayload(true);
    if (!built) {
      try { emit('toast:show', { message: 'Invalid selection' }); } catch {}
      return;
    }

    try {
      setAssignBusy('preview');
      const res = await assignAdminMembershipSeat(built.membershipId, built.payload);

      const accepted = Boolean((res as any)?.accepted);
      const deltaDue = (res as any)?.deltaDue;
      const from = (res as any)?.from || {};
      const to = (res as any)?.to || {};
      const statusFrom = (res as any)?.status?.from;
      const statusTo = (res as any)?.status?.to;

      const lines: string[] = [];
      lines.push(`Accepted: ${accepted ? 'Yes' : 'No'}`);
      if (typeof deltaDue === 'number') lines.push(`Delta Due: ${deltaDue}`);
      if (statusFrom || statusTo) lines.push(`Status: ${statusFrom || '—'} → ${statusTo || '—'}`);
      if (to?.level || to?.cell || to?.designationCode || to?.seatSequence) {
        lines.push('');
        lines.push(`To: ${[to?.level, to?.cell, to?.designationCode].filter(Boolean).join(' / ')}`);
        if (to?.seatSequence) lines.push(`Seat: ${to.seatSequence}`);
      }
      if (from?.level || from?.cell || from?.designationCode || from?.seatSequence) {
        lines.push('');
        lines.push(`From: ${[from?.level, from?.cell, from?.designationCode].filter(Boolean).join(' / ')}`);
        if (from?.seatSequence) lines.push(`Seat: ${from.seatSequence}`);
      }

      if (!accepted) {
        Alert.alert('Preview', lines.join('\n'));
        return;
      }

      Alert.alert('Preview', lines.join('\n'), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const builtCommit = buildAssignPayload(false);
            if (!builtCommit) return;
            try {
              setAssignBusy('commit');
              await assignAdminMembershipSeat(builtCommit.membershipId, builtCommit.payload);
              try { emit('toast:show', { message: 'Seat assigned' }); } catch {}
              setAssignSheetVisible(false);
              setDetailSheetVisible(false);
              setSelectedMember(null);
              reload();
            } catch (e: any) {
              try { emit('toast:show', { message: e?.message || 'Failed to assign seat' }); } catch {}
            } finally {
              setAssignBusy(null);
            }
          },
        },
      ]);
    } catch (e: any) {
      try { emit('toast:show', { message: e?.message || 'Preview failed' }); } catch {}
    } finally {
      setAssignBusy(null);
    }
  }, [buildAssignPayload, reload, validateAssign]);

  const handleDeleteMember = useCallback(() => {
    const m = selectedMember as any;
    const id = m?.id as string | undefined;
    const name = String(m?.fullName || m?.idCard?.fullName || m?.user?.profile?.fullName || 'this member');
    if (!id) {
      try { emit('toast:show', { message: 'Member not found' }); } catch {}
      return;
    }
    Alert.alert('Delete Member', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDetailActionBusy('delete');
            await deleteAdminMembership(id);
            try { emit('toast:show', { message: 'Member deleted' }); } catch {}
            // Close sheets immediately after successful delete.
            try { detailSheetRef.current?.dismiss(); } catch {}
            try { setAssignSheetVisible(false); } catch {}
            setDetailSheetVisible(false);
            setSelectedMember(null);
            reload();
          } catch (e: any) {
            try { emit('toast:show', { message: e?.message || 'Failed to delete member' }); } catch {}
          } finally {
            setDetailActionBusy(null);
          }
        },
      },
    ]);
  }, [reload, selectedMember]);

  const renderItem = ({ item }: { item: MembershipRecord }) => (
    <MemberListItem membership={item} onPress={() => openMemberDetails(item)} />
  );

  const selectedMemberDetails = useMemo(() => {
    const m = selectedMember;
    if (!m) return [] as Array<{ label: string; value: string }>;

    const fullName = String((m as any).fullName || m.idCard?.fullName || (m as any).user?.profile?.fullName || '—');
    const designationName = String(m.designation?.name || (m as any)?.idCard?.designationName || '—');
    const cellName = String(m.cell?.name || '');
    const level = String((m as any).level || '—');
    const status = String((m as any).status || '—');
    const zone = String((m as any).zone || '');
    const mobile = String((m as any)?.idCard?.mobileNumber || (m as any)?.mobileNumber || '');
    const cardNumber = String((m as any)?.idCard?.cardNumber || (m as any)?.idCardNumber || '');
    const createdAt = (m as any).createdAt ? (() => { try { return new Date((m as any).createdAt).toLocaleString(); } catch { return String((m as any).createdAt); } })() : '';

    const country = String((m as any).hrcCountryName || '');
    const state = String((m as any).hrcStateName || '');
    const district = String((m as any).hrcDistrictName || '');
    const mandal = String((m as any).hrcMandalName || '');
    const kycStatus = String((m as any)?.kyc?.status || (m as any)?.kycStatus || '');
    const paymentStatus = String((m as any)?.paymentStatus || '');

    const rows: Array<{ label: string; value: string }> = [
      { label: 'Full Name', value: fullName },
      { label: 'Status', value: status },
      { label: 'Designation', value: designationName },
      { label: 'Level', value: level },
      { label: 'Cell', value: cellName },
      { label: 'Mobile Number', value: mobile },
      { label: 'Card Number', value: cardNumber },
      { label: 'Zone', value: zone },
      { label: 'Country', value: country },
      { label: 'State', value: state },
      { label: 'District', value: district },
      { label: 'Mandal', value: mandal },
      { label: 'KYC Status', value: kycStatus },
      { label: 'Payment Status', value: paymentStatus },
      { label: 'Joined On', value: createdAt },
    ];

    return rows
      .map(r => ({ label: r.label, value: String(r.value || '').trim() }))
      .filter(r => r.value && r.value !== '—');
  }, [selectedMember]);

  const visibleMembers = useMemo(() => {
    const raw = (filters.search || '').trim();
    if (!raw) return members;

    const q = raw.toLowerCase();
    const qDigits = raw.replace(/\s+/g, '');

    return members.filter((m) => {
      const fullName = String((m as any).fullName || m.idCard?.fullName || (m as any).user?.profile?.fullName || '').toLowerCase();
      const mobile = String(m.idCard?.mobileNumber || (m as any).mobileNumber || '').replace(/\s+/g, '');
      const cardNumber = String(m.idCard?.cardNumber || (m as any).idCardNumber || '').replace(/\s+/g, '');
      const membershipId = String((m as any).id || '').toLowerCase();

      return (
        (fullName && fullName.includes(q)) ||
        (mobile && (mobile.includes(qDigits) || mobile.includes(q))) ||
        (cardNumber && (cardNumber.includes(qDigits) || cardNumber.includes(q))) ||
        (membershipId && membershipId.includes(q))
      );
    });
  }, [members, filters.search]);

  const isInitialLoading = loading && members.length === 0 && !refreshing;

  const SkeletonCard = () => (
    <View style={styles.skelCard}>
      <View style={styles.skelLineShort} />
      <View style={styles.skelLine} />
      <View style={[styles.skelLine, { width: '55%' }]} />
    </View>
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="auto" />

      {/* Top app bar (navigation header): search + filter + back */}
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#ffffff' },
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (assignSheetVisible) {
                  setAssignSheetVisible(false);
                  return;
                }
                if (detailSheetVisible) {
                  setDetailSheetVisible(false);
                  return;
                }
                if (filterSheetVisible) {
                  setFilterSheetVisible(false);
                  return;
                }
                if (picker) {
                  setPicker(null);
                  return;
                }
                router.back();
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={10}
            >
              <MaterialCommunityIcons name="chevron-left" size={26} color="#0f172a" />
            </Pressable>
          ),
          headerTitle: () => (
            <View style={styles.headerSearchRow}>
              <MaterialCommunityIcons name="magnify" size={18} color="#64748b" />
              <TextInput
                value={filters.search || ''}
                onChangeText={(t) => setFilters(prev => ({ ...prev, search: t }))}
                placeholder="Search by name or mobile"
                placeholderTextColor="#94a3b8"
                style={styles.headerSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                returnKeyType="search"
              />
              {!!(filters.search || '').trim() && (
                <Pressable
                  onPress={() => setFilters(prev => ({ ...prev, search: '' }))}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={10}
                >
                  <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
                </Pressable>
              )}
            </View>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => setFilterSheetVisible(true)}
              style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Open filters"
              hitSlop={10}
            >
              <MaterialCommunityIcons name="filter-variant" size={22} color="#0f172a" />
            </Pressable>
          ),
        }}
      />

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
          <MaterialCommunityIcons name="alert-circle" size={18} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={reload} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel="Retry loading members">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Member List */}
      {isInitialLoading ? (
        <View style={styles.loadingContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      ) : (
        <FlatList
          data={visibleMembers}
          keyExtractor={(item, index) => item.id ? `m-${item.id}` : `idx-${index}`}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReachedThreshold={0.6}
          onEndReached={() => { if (!loading && hasMore) loadMore(); }}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={12}
          windowSize={5}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
          removeClippedSubviews
          ListFooterComponent={() => (
            <View style={styles.footerContainer}>
              {loading && !refreshing ? (
                <ActivityIndicator style={{ marginVertical: 12 }} color={Colors.light.primary} />
              ) : null}
              {hasMore && !loading ? (
                <Pressable onPress={loadMore} style={({ pressed }) => [styles.loadMoreBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Load more members">
                  <Text style={styles.loadMoreText}>Load more</Text>
                </Pressable>
              ) : null}
              {/* Cursor debug - show truncated cursor if available (helpful for manual inspection) */}
              {cursor ? (
                <Text style={styles.cursorText} numberOfLines={1}>cursor: {String(cursor).slice(0, 80)}{String(cursor).length > 80 ? '…' : ''}</Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={!loading && !error ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-search" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No Members Found</Text>
              <Text style={styles.emptyText}>Try adjusting your search or filters</Text>
            </View>
          ) : null}
        />
      )}

      {/* Add Member FAB */}
      <View style={[styles.fabContainer, { pointerEvents: 'box-none' as any }]}>
        <Pressable
          onPress={() => router.push('/hrci/admin/members/new' as any)}
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
          accessibilityRole="button"
          accessibilityLabel="Add new member"
          accessibilityHint="Opens the member creation flow"
        >
          <MaterialCommunityIcons name="account-plus" size={28} color="#ffffff" />
        </Pressable>
      </View>

      {/* Filters bottom sheet */}
      <BottomSheetModal
        ref={filterSheetRef}
        snapPoints={filterSnapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        onDismiss={() => setFilterSheetVisible(false)}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable
              onPress={() => setFilterSheetVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              hitSlop={10}
            >
              <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
            </Pressable>
          </View>

          <Text style={styles.sheetSectionTitle}>Status</Text>
          <View style={styles.sheetRow}>
            {statusOptions.map(option => (
              <FilterChip
                key={option.value || 'all'}
                label={option.label}
                color={option.color}
                active={filters.status === option.value}
                onPress={() => setFilters(prev => ({ ...prev, status: option.value }))}
              />
            ))}
          </View>

          <Text style={styles.sheetSectionTitle}>Level</Text>
          <View style={styles.sheetRow}>
            <FilterChip
              label={filters.level ? `Level: ${filters.level}` : 'Select Level'}
              color="#2563eb"
              active={!!filters.level}
              onPress={() => setPicker('level')}
            />
          </View>

          <Text style={styles.sheetSectionTitle}>Cell</Text>
          <View style={styles.sheetRow}>
            <FilterChip
              label={selectedCell ? `Cell: ${selectedCell.name}` : 'Select Cell'}
              color="#7c3aed"
              active={!!filters.cellId}
              onPress={() => filters.level && setPicker('cell')}
              accessibilityLabel={filters.level ? 'Select cell' : 'Select level first'}
            />
          </View>

          <Text style={styles.sheetSectionTitle}>Designation</Text>
          <View style={styles.sheetRow}>
            <FilterChip
              label={selectedDesignation ? `Designation: ${selectedDesignation.name}` : 'Select Designation'}
              color="#ea580c"
              active={!!filters.designationId}
              onPress={() => filters.level && setPicker('designation')}
              accessibilityLabel={filters.level ? 'Select designation' : 'Select level first'}
            />
          </View>

          <View style={styles.sheetActionsRow}>
            <Pressable
              style={styles.clearAllBtn}
              onPress={() => {
                resetFilters();
                meta.selectLevel(undefined);
                meta.selectCell(undefined);
                meta.selectDesignation(undefined);
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <Text style={styles.clearAllText}>Clear</Text>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>

      {/* Member details bottom sheet */}
      <BottomSheetModal
        ref={detailSheetRef}
        snapPoints={detailSnapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        onDismiss={() => {
          setDetailSheetVisible(false);
          setSelectedMember(null);
        }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.detailSheetContent}>
          <View style={styles.detailHeaderRow}>
            <Text style={styles.detailTitle} numberOfLines={1}>Member Details</Text>
            <Pressable
              onPress={() => setDetailSheetVisible(false)}
              style={({ pressed }) => [styles.detailCloseBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Close details"
              hitSlop={10}
            >
              <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
            </Pressable>
          </View>

          {selectedMemberDetails.length === 0 ? (
            <Text style={styles.detailEmpty}>No details available.</Text>
          ) : (
            <View style={styles.detailCard}>
              {selectedMemberDetails.map((row) => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.detailActionsRow}>
            <Pressable
              onPress={handleChangeDesignation}
              disabled={detailActionBusy !== null || !selectedMember}
              style={({ pressed }) => [
                styles.detailActionBtn,
                pressed && { opacity: 0.85 },
                (detailActionBusy !== null || !selectedMember) && { opacity: 0.55 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Change designation"
            >
              {detailActionBusy === 'assign' ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.detailActionBtnText}>Change Designation</Text>}
            </Pressable>

            <Pressable
              onPress={handleDeleteMember}
              disabled={detailActionBusy !== null || !selectedMember}
              style={({ pressed }) => [
                styles.detailActionBtnDanger,
                pressed && { opacity: 0.85 },
                (detailActionBusy !== null || !selectedMember) && { opacity: 0.55 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Delete member"
            >
              {detailActionBusy === 'delete' ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.detailActionBtnDangerText}>Delete Member</Text>}
            </Pressable>
          </View>

          <View style={{ height: 16 }} />
        </BottomSheetScrollView>
      </BottomSheetModal>

      {/* Assign seat (change designation) flow */}
      <BottomSheetModal
        ref={assignSheetRef}
        snapPoints={assignSnapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        onDismiss={() => {
          setAssignSheetVisible(false);
          setAssignPicker(null);
          setAssignBusy(null);
        }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.assignSheetContent}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Assign Seat</Text>
            <Pressable
              onPress={() => setAssignSheetVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close assign seat"
              hitSlop={10}
            >
              <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
            </Pressable>
          </View>

          <Text style={styles.sheetSectionTitle}>Level</Text>
          <View style={styles.sheetRow}>
            <FilterChip
              label={assignMeta.selected.level ? `Level: ${assignMeta.selected.level}` : 'Select Level'}
              color="#2563eb"
              active={!!assignMeta.selected.level}
              onPress={() => setAssignPicker('level')}
            />
          </View>

          {assignMeta.selected.level === 'ZONE' ? (
            <>
              <Text style={styles.sheetSectionTitle}>Zone</Text>
              <View style={styles.zoneInputWrap}>
                <TextInput
                  value={assignZone}
                  onChangeText={setAssignZone}
                  placeholder="Enter zone"
                  placeholderTextColor="#94a3b8"
                  style={styles.zoneInput}
                  autoCapitalize="characters"
                />
              </View>
            </>
          ) : null}

          {assignMeta.selected.level === 'STATE' || assignMeta.selected.level === 'DISTRICT' || assignMeta.selected.level === 'MANDAL' ? (
            <>
              <Text style={styles.sheetSectionTitle}>Country</Text>
              <View style={styles.sheetRow}>
                <FilterChip
                  label={assignMeta.selected.countryId ? `Country: ${assignMeta.countries.find(c => c.id === assignMeta.selected.countryId)?.name || 'Selected'}` : 'Select Country'}
                  color="#0ea5e9"
                  active={!!assignMeta.selected.countryId}
                  onPress={() => setAssignPicker('country')}
                />
              </View>

              <Text style={styles.sheetSectionTitle}>State</Text>
              <View style={styles.sheetRow}>
                <FilterChip
                  label={assignMeta.selected.stateId ? `State: ${assignMeta.states.find(s => s.id === assignMeta.selected.stateId)?.name || 'Selected'}` : 'Select State'}
                  color="#0ea5e9"
                  active={!!assignMeta.selected.stateId}
                  onPress={() => {
                    if (!assignMeta.selected.countryId) {
                      try { emit('toast:show', { message: 'Select country first' }); } catch {}
                      return;
                    }
                    setAssignPicker('state');
                  }}
                  accessibilityLabel={assignMeta.selected.countryId ? 'Select state' : 'Select country first'}
                />
              </View>
            </>
          ) : null}

          {assignMeta.selected.level === 'DISTRICT' || assignMeta.selected.level === 'MANDAL' ? (
            <>
              <Text style={styles.sheetSectionTitle}>District</Text>
              <View style={styles.sheetRow}>
                <FilterChip
                  label={assignMeta.selected.districtId ? `District: ${assignMeta.districts.find(d => d.id === assignMeta.selected.districtId)?.name || 'Selected'}` : 'Select District'}
                  color="#0ea5e9"
                  active={!!assignMeta.selected.districtId}
                  onPress={() => {
                    if (!assignMeta.selected.stateId) {
                      try { emit('toast:show', { message: 'Select state first' }); } catch {}
                      return;
                    }
                    setAssignPicker('district');
                  }}
                  accessibilityLabel={assignMeta.selected.stateId ? 'Select district' : 'Select state first'}
                />
              </View>
            </>
          ) : null}

          {assignMeta.selected.level === 'MANDAL' ? (
            <>
              <Text style={styles.sheetSectionTitle}>Mandal</Text>
              <View style={styles.sheetRow}>
                <FilterChip
                  label={assignMeta.selected.mandalId ? `Mandal: ${assignMeta.mandals.find(m => m.id === assignMeta.selected.mandalId)?.name || 'Selected'}` : 'Select Mandal'}
                  color="#0ea5e9"
                  active={!!assignMeta.selected.mandalId}
                  onPress={() => {
                    if (!assignMeta.selected.districtId) {
                      try { emit('toast:show', { message: 'Select district first' }); } catch {}
                      return;
                    }
                    setAssignPicker('mandal');
                  }}
                  accessibilityLabel={assignMeta.selected.districtId ? 'Select mandal' : 'Select district first'}
                />
              </View>
            </>
          ) : null}

          <Text style={styles.sheetSectionTitle}>Cell</Text>
          <View style={styles.sheetRow}>
            <FilterChip
              label={assignMeta.selected.cellId ? `Cell: ${assignMeta.cells.find(c => c.id === assignMeta.selected.cellId)?.name || 'Selected'}` : 'Select Cell'}
              color="#7c3aed"
              active={!!assignMeta.selected.cellId}
              onPress={() => setAssignPicker('cell')}
            />
          </View>

          <Text style={styles.sheetSectionTitle}>Designation</Text>
          <View style={styles.sheetRow}>
            <FilterChip
              label={assignMeta.selected.designationId ? `Designation: ${assignMeta.designations.find(d => d.id === assignMeta.selected.designationId)?.name || 'Selected'}` : 'Select Designation'}
              color="#ea580c"
              active={!!assignMeta.selected.designationId}
              onPress={() => setAssignPicker('designation')}
            />
          </View>

          <View style={styles.assignActionsRow}>
            <Pressable
              style={({ pressed }) => [styles.assignPreviewBtn, pressed && { opacity: 0.85 }, assignBusy && { opacity: 0.6 }]}
              onPress={runAssignPreview}
              disabled={!!assignBusy}
              accessibilityRole="button"
              accessibilityLabel="Preview assign"
            >
              {assignBusy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.assignPreviewText}>Preview</Text>}
            </Pressable>
          </View>

          <View style={{ height: 18 }} />
        </BottomSheetScrollView>
      </BottomSheetModal>

      {/* Assign pickers (names only; no IDs) */}
      <FacetPickerModal
        visible={assignPicker === 'level'}
        title="Select Level"
        items={assignMeta.levels.map(l => ({ id: l.id, name: l.name }))}
        selectedId={assignMeta.selected.level as any}
        loading={assignMeta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          assignMeta.selectLevel((id as string) || undefined);
          setAssignZone('');
          setAssignPicker(null);
        }}
        onClose={() => setAssignPicker(null)}
      />
      <FacetPickerModal
        visible={assignPicker === 'country'}
        title="Select Country"
        items={assignMeta.countries.map(c => ({ id: c.id, name: c.name }))}
        selectedId={assignMeta.selected.countryId as any}
        loading={assignMeta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          assignMeta.selectCountry((id as string) || undefined);
          setAssignPicker(null);
        }}
        onClose={() => setAssignPicker(null)}
      />
      <FacetPickerModal
        visible={assignPicker === 'state'}
        title="Select State"
        items={assignMeta.states.map(s => ({ id: s.id, name: s.name }))}
        selectedId={assignMeta.selected.stateId as any}
        loading={assignMeta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          assignMeta.selectState((id as string) || undefined);
          setAssignPicker(null);
        }}
        onClose={() => setAssignPicker(null)}
      />
      <FacetPickerModal
        visible={assignPicker === 'district'}
        title="Select District"
        items={assignMeta.districts.map(d => ({ id: d.id, name: d.name }))}
        selectedId={assignMeta.selected.districtId as any}
        loading={assignMeta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          assignMeta.selectDistrict((id as string) || undefined);
          setAssignPicker(null);
        }}
        onClose={() => setAssignPicker(null)}
      />
      <FacetPickerModal
        visible={assignPicker === 'mandal'}
        title="Select Mandal"
        items={assignMeta.mandals.map(m => ({ id: m.id, name: m.name }))}
        selectedId={assignMeta.selected.mandalId as any}
        loading={assignMeta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          assignMeta.selectMandal((id as string) || undefined);
          setAssignPicker(null);
        }}
        onClose={() => setAssignPicker(null)}
      />
      <FacetPickerModal
        visible={assignPicker === 'cell'}
        title="Select Cell"
        items={assignMeta.cells.map(c => ({ id: c.id, name: c.name }))}
        selectedId={assignMeta.selected.cellId as any}
        loading={assignMeta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          assignMeta.selectCell((id as string) || undefined);
          setAssignPicker(null);
        }}
        onClose={() => setAssignPicker(null)}
      />
      <FacetPickerModal
        visible={assignPicker === 'designation'}
        title="Select Designation"
        items={assignMeta.designations.map(d => ({ id: d.id, name: d.name }))}
        selectedId={assignMeta.selected.designationId as any}
        loading={assignMeta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          assignMeta.selectDesignation((id as string) || undefined);
          setAssignPicker(null);
        }}
        onClose={() => setAssignPicker(null)}
      />

      {/* Facet Pickers */}
      <FacetPickerModal
        visible={picker === 'level'}
        title="Select Level"
        items={meta.levels.map(l => ({ id: l.id, name: l.name }))}
        selectedId={filters.level as string}
        loading={meta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          meta.selectLevel(id as string | undefined);
          setFilters(prev => ({ ...prev, level: (id as string) || '' }));
        }}
        onClose={() => setPicker(null)}
      />
      <FacetPickerModal
        visible={picker === 'cell'}
        title="Select Cell"
        items={meta.cells.map(c => ({ id: c.id, name: c.name }))}
        selectedId={filters.cellId as string}
        loading={meta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          meta.selectCell(id as string | undefined);
          setFilters(prev => ({ ...prev, cellId: (id as string) || '' }));
        }}
        onClose={() => setPicker(null)}
      />
      <FacetPickerModal
        visible={picker === 'designation'}
        title="Select Designation"
        items={meta.designations.map(d => ({ id: d.id, name: d.name }))}
        selectedId={filters.designationId as string}
        loading={meta.loading}
        allowClear
        onSelect={(idOrIds) => {
          const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
          meta.selectDesignation(id as string | undefined);
          setFilters(prev => ({ ...prev, designationId: (id as string) || '' }));
        }}
        onClose={() => setPicker(null)}
      />
      {/* Removed geographic facet pickers - only level, cell and designation are supported here */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },

  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerSearchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 220 },
  headerSearchInput: { flex: 1, fontSize: 14, color: '#0f172a', paddingVertical: 0 },

  clearAllBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e2e8f0', marginRight: 8 },
  clearAllText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  applyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.light.primary },
  applyBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  sheetSectionTitle: { marginTop: 14, marginBottom: 8, fontSize: 12, fontWeight: '700', color: '#475569' },
  sheetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetActionsRow: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  skelCard: {
    width: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  skelLine: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    marginTop: 10,
    width: '85%',
  },
  skelLineShort: {
    height: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    width: '45%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  listContainer: { flexGrow: 1, paddingBottom: 100 },
  footerContainer: { alignItems: 'center', paddingVertical: 16 },
  loadMoreBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  loadMoreText: { color: '#ffffff', fontWeight: '700' },
  cursorText: { marginTop: 8, fontSize: 11, color: '#6b7280', paddingHorizontal: 12 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  fabContainer: { position: 'absolute', bottom: 28, right: 20 },
  fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center', elevation: 10 },

  detailSheetContent: { paddingHorizontal: 16, paddingBottom: 24 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  detailTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  detailCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  detailEmpty: { marginTop: 18, fontSize: 14, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  detailCard: { marginTop: 10, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  detailRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailLabel: { fontSize: 12, color: '#64748b', fontWeight: '800' },
  detailValue: { marginTop: 3, fontSize: 14, color: '#0f172a', fontWeight: '800' },

  detailActionsRow: { marginTop: 14, gap: 10 },
  detailActionBtn: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  detailActionBtnText: { color: '#0f172a', fontWeight: '900' },
  detailActionBtnDanger: { height: 46, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  detailActionBtnDangerText: { color: '#ffffff', fontWeight: '900' },

  assignSheetContent: { paddingHorizontal: 16, paddingBottom: 24 },
  assignActionsRow: { marginTop: 18, flexDirection: 'row', justifyContent: 'flex-end' },
  assignPreviewBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  assignPreviewText: { color: '#ffffff', fontWeight: '900' },
  zoneInputWrap: { marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#f8fafc', paddingHorizontal: 12 },
  zoneInput: { height: 44, fontSize: 14, color: '#0f172a' },
});

// Approximate item height used for getItemLayout optimization
const ITEM_HEIGHT = 92;
