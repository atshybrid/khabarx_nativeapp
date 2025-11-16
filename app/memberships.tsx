import FacetPickerModal from '@/components/FacetPickerModal';
import FilterChip from '@/components/FilterChip';
import MemberListItem from '@/components/MemberListItem';
import { Colors } from '@/constants/Colors';
import { useAdminMemberships } from '@/hooks/useAdminMemberships';
import { useMembershipMeta } from '@/hooks/useMembershipMeta';
import type { MembershipRecord } from '@/types/memberships';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MembershipsScreen() {
  // Removed unused showFilters state.
  const { data: members, cursor, filters, setFilters, resetFilters, loading, error, refreshing, hasMore, loadMore, refresh, reload } = useAdminMemberships({ initialFilters: { status: 'ACTIVE' }, pageSize: 20 });
  const meta = useMembershipMeta();
  const [picker, setPicker] = useState<null | 'level' | 'cell' | 'designation' | 'country' | 'state' | 'district' | 'mandal'>(null);
  const selectedCell = useMemo(() => meta.cells.find(c => c.id === filters.cellId), [meta.cells, filters.cellId]);
  const selectedDesignation = useMemo(() => meta.designations.find(d => d.id === filters.designationId), [meta.designations, filters.designationId]);
  // Quick status filter options
  const statusOptions = useMemo(() => [
    { label: 'Active', value: 'ACTIVE', color: '#22c55e' },
    { label: 'Inactive', value: 'INACTIVE', color: '#ef4444' },
    { label: 'Pending', value: 'PENDING', color: '#f59e0b' },
    { label: 'All', value: '', color: '#64748b' }
  ], []);

  const onRefresh = useCallback(() => refresh(), [refresh]);

  const renderItem = ({ item }: { item: MembershipRecord }) => (
    <Pressable onPress={() => router.push(`/memberships/${item.id}` as any)}>
      <MemberListItem membership={item} />
    </Pressable>
  );

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

      {/* Toolbar: search, chips, stats, advanced filters */}
      <View style={styles.secondaryBar}>
        <View style={styles.facetRow}>
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
        <View style={styles.facetRow}>
          <FilterChip
            label={filters.level ? `Level: ${filters.level}` : 'Select Level'}
            color="#2563eb"
            active={!!filters.level}
            onPress={() => setPicker('level')}
          />
          <FilterChip
            label={selectedCell ? `Cell: ${selectedCell.name}` : 'Select Cell'}
            color="#7c3aed"
            active={!!filters.cellId}
            onPress={() => filters.level && setPicker('cell')}
            accessibilityLabel={filters.level ? 'Select cell' : 'Select level first'}
          />
          <FilterChip
            label={selectedDesignation ? `Designation: ${selectedDesignation.name}` : 'Select Designation'}
            color="#ea580c"
            active={!!filters.designationId}
            onPress={() => filters.level && setPicker('designation')}
            accessibilityLabel={filters.level ? 'Select designation' : 'Select level first'}
          />
        </View>
        <View style={styles.facetRow}>
          <FilterChip
            label={meta.selected.countryId ? `Country ✓` : 'Country'}
            color="#0d9488"
            active={!!meta.selected.countryId}
            onPress={() => setPicker('country')}
          />
          <FilterChip
            label={meta.selected.stateId ? 'State ✓' : 'State'}
            color="#059669"
            active={!!meta.selected.stateId}
            onPress={() => meta.selected.countryId && setPicker('state')}
            accessibilityLabel={meta.selected.countryId ? 'Select state' : 'Select country first'}
          />
          <FilterChip
            label={meta.selected.districtId ? 'District ✓' : 'District'}
            color="#10b981"
            active={!!meta.selected.districtId}
            onPress={() => meta.selected.stateId && setPicker('district')}
            accessibilityLabel={meta.selected.stateId ? 'Select district' : 'Select state first'}
          />
          <FilterChip
            label={meta.selected.mandalId ? 'Mandal ✓' : 'Mandal'}
            color="#14b8a6"
            active={!!meta.selected.mandalId}
            onPress={() => meta.selected.districtId && setPicker('mandal')}
            accessibilityLabel={meta.selected.districtId ? 'Select mandal' : 'Select district first'}
          />
        </View>
        <View style={styles.inlineStats}>
          <Text style={styles.statText}>Total: {members.length}</Text>
          <Text style={styles.statText}>Active: {members.filter(m => m.status === 'ACTIVE').length}</Text>
          <Text style={styles.statText}>Paid: {members.filter(m => m.paymentStatus === 'SUCCESS').length}</Text>
        </View>
        <View style={styles.actionsRow}>
          <Pressable style={styles.clearAllBtn} onPress={() => { resetFilters(); meta.selectLevel(undefined); meta.selectCell(undefined); meta.selectDesignation(undefined); meta.selectLocation(undefined); meta.selectCountry(undefined); meta.selectState(undefined); meta.selectDistrict(undefined); meta.selectMandal(undefined); }}>
            <Text style={styles.clearAllText}>Clear</Text>
          </Pressable>
          <Pressable style={styles.applyBtn} onPress={reload}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </View>

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
          data={members}
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
      <View style={styles.fabContainer} pointerEvents="box-none">
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

      {/* Facet Pickers */}
      <FacetPickerModal
        visible={picker === 'level'}
        title="Select Level"
        items={meta.levels.map(l => ({ id: l.id, name: l.name }))}
        selectedId={filters.level as string}
        loading={meta.loading}
        allowClear
        onSelect={(id) => { meta.selectLevel(id); setFilters(prev => ({ ...prev, level: id || '' })); }}
        onClose={() => setPicker(null)}
      />
      <FacetPickerModal
        visible={picker === 'cell'}
        title="Select Cell"
        items={meta.cells.map(c => ({ id: c.id, name: c.name }))}
        selectedId={filters.cellId as string}
        loading={meta.loading}
        allowClear
        onSelect={(id) => { meta.selectCell(id); setFilters(prev => ({ ...prev, cellId: id || '' })); }}
        onClose={() => setPicker(null)}
      />
      <FacetPickerModal
        visible={picker === 'designation'}
        title="Select Designation"
        items={meta.designations.map(d => ({ id: d.id, name: d.name }))}
        selectedId={filters.designationId as string}
        loading={meta.loading}
        allowClear
        onSelect={(id) => { meta.selectDesignation(id); setFilters(prev => ({ ...prev, designationId: id || '' })); }}
        onClose={() => setPicker(null)}
      />
      <FacetPickerModal
        visible={picker === 'country'}
        title="Select Country"
        items={meta.countries.map(c => ({ id: c.id, name: c.name }))}
        selectedId={meta.selected.countryId}
        loading={meta.loading}
        allowClear
        onSelect={(id) => { meta.selectCountry(id); setFilters(prev => ({ ...prev, hrcCountryId: id || '' })); }}
        onClose={() => setPicker(null)}
      />
      <FacetPickerModal
        visible={picker === 'state'}
        title="Select State"
        items={meta.states.map(s => ({ id: s.id, name: s.name }))}
        selectedId={meta.selected.stateId}
        loading={meta.loading}
        allowClear
        onSelect={(id) => { meta.selectState(id); setFilters(prev => ({ ...prev, hrcStateId: id || '' })); }}
        onClose={() => setPicker(null)}
      />
      <FacetPickerModal
        visible={picker === 'district'}
        title="Select District"
        items={meta.districts.map(d => ({ id: d.id, name: d.name }))}
        selectedId={meta.selected.districtId}
        loading={meta.loading}
        allowClear
        onSelect={(id) => { meta.selectDistrict(id); setFilters(prev => ({ ...prev, hrcDistrictId: id || '' })); }}
        onClose={() => setPicker(null)}
      />
      <FacetPickerModal
        visible={picker === 'mandal'}
        title="Select Mandal"
        items={meta.mandals.map(m => ({ id: m.id, name: m.name }))}
        selectedId={meta.selected.mandalId}
        loading={meta.loading}
        allowClear
        onSelect={(id) => { meta.selectMandal(id); setFilters(prev => ({ ...prev, hrcMandalId: id || '' })); }}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  secondaryBar: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e2e8f0' },
  facetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  inlineStats: { flexDirection: 'row', marginTop: 10, marginBottom: 4 },
  statText: { marginRight: 16, fontSize: 12, fontWeight: '600', color: '#475569' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  clearAllBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e2e8f0', marginRight: 8 },
  clearAllText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  applyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.light.primary },
  applyBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
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
});

// Approximate item height used for getItemLayout optimization
const ITEM_HEIGHT = 92;
