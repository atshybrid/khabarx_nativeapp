import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHrciOnboarding } from '../../context/HrciOnboardingContext';
import { request } from '../../services/http';

type Item = { id: string; name: string; code?: string };

export default function HrciGeoScreen() {
  const router = useRouter();
  const { level, updateGeo, geo, cellId, designationCode, returnToAfterGeo, setReturnToAfterGeo } = useHrciOnboarding();
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const bottomPad = 16 + 72 + (insets?.bottom || 0);

  const needs = useMemo(() => {
    switch (level) {
      case 'NATIONAL': return { country: true };
      case 'ZONE': return { country: true, state: true, zone: true };
      case 'STATE': return { country: true, state: true };
      case 'DISTRICT': return { country: true, state: true, district: true };
      case 'MANDAL': return { country: true, state: true, district: true, mandal: true };
      default: return {};
    }
  }, [level]);

  // no global loading here; each list loads separately
  const [countries, setCountries] = useState<Item[]>([]);
  const [states, setStates] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);
  const [mandals, setMandals] = useState<Item[]>([]);
  const [zones, setZones] = useState<Item[]>([]);

  // Load stored selections on mount (persistence across app restarts)
  useEffect(() => {
    (async () => {
      try {
        // Restore fallback target if present so CTA label stays correct
        if (!returnToAfterGeo) {
          const savedTarget = await AsyncStorage.getItem('HRCI_RETURN_TO_AFTER_GEO');
          if (savedTarget) {
            try { setReturnToAfterGeo(savedTarget); } catch {}
          }
        }
        const entries = await AsyncStorage.multiGet([
          'HRCI_COUNTRY_ID','HRCI_COUNTRY_NAME',
          'HRCI_STATE_ID','HRCI_STATE_NAME',
          'HRCI_DISTRICT_ID','HRCI_DISTRICT_NAME',
          'HRCI_MANDAL_ID','HRCI_MANDAL_NAME',
          'HRCI_ZONE'
        ]);
        const map = Object.fromEntries(entries || []);
        const patch: any = {};
        if (!geo.hrcCountryId && map.HRCI_COUNTRY_ID) { patch.hrcCountryId = map.HRCI_COUNTRY_ID; patch.hrcCountryName = map.HRCI_COUNTRY_NAME || null; }
        if (!geo.hrcStateId && map.HRCI_STATE_ID) { patch.hrcStateId = map.HRCI_STATE_ID; patch.hrcStateName = map.HRCI_STATE_NAME || null; }
        if (!geo.hrcDistrictId && map.HRCI_DISTRICT_ID) { patch.hrcDistrictId = map.HRCI_DISTRICT_ID; patch.hrcDistrictName = map.HRCI_DISTRICT_NAME || null; }
        if (!geo.hrcMandalId && map.HRCI_MANDAL_ID) { patch.hrcMandalId = map.HRCI_MANDAL_ID; patch.hrcMandalName = map.HRCI_MANDAL_NAME || null; }
        if (!geo.zone && map.HRCI_ZONE) { patch.zone = map.HRCI_ZONE; }
        if (Object.keys(patch).length) updateGeo(patch);
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnToAfterGeo, setReturnToAfterGeo]);

  useEffect(() => { (async () => {
    try {
      if (needs.country) {
        const res = await request<any>(`/hrci/geo/countries`, { method: 'GET' });
        const data = Array.isArray(res) ? res : (res?.data || []);
        const items: Item[] = (data || []).map((x: any) => ({ id: x.id, name: x.name, code: x.code }));
        setCountries(items);
        if (items.length === 1) updateGeo({ hrcCountryId: items[0].id });
      }
    } catch {}
  })(); }, [needs.country, updateGeo]);

  useEffect(() => { (async () => {
    try {
      if (needs.state && geo.hrcCountryId) {
        const res = await request<any>(`/hrci/geo/states?countryId=${geo.hrcCountryId}`, { method: 'GET' });
        const data = Array.isArray(res) ? res : (res?.data || []);
        const items: Item[] = (data || []).map((x: any) => ({ id: x.id, name: x.name, code: x.code }));
        setStates(items);
      }
    } catch {}
  })(); }, [needs.state, geo.hrcCountryId]);

  useEffect(() => { (async () => {
    try {
      if (needs.district && geo.hrcStateId) {
        const res = await request<any>(`/hrci/geo/districts?stateId=${geo.hrcStateId}`, { method: 'GET' });
        const data = Array.isArray(res) ? res : (res?.data || []);
        const items: Item[] = (data || []).map((x: any) => ({ id: x.id, name: x.name }));
        setDistricts(items);
      }
    } catch {}
  })(); }, [needs.district, geo.hrcStateId]);

  useEffect(() => { (async () => {
    try {
      if (needs.mandal && geo.hrcDistrictId) {
        const res = await request<any>(`/hrci/geo/mandals?districtId=${geo.hrcDistrictId}`, { method: 'GET' });
        const data = Array.isArray(res) ? res : (res?.data || []);
        const items: Item[] = (data || []).map((x: any) => ({ id: x.id, name: x.name }));
        setMandals(items);
      }
    } catch {}
  })(); }, [needs.mandal, geo.hrcDistrictId]);

  useEffect(() => { (async () => {
    try {
      if (needs.zone) {
        const res = await request<any>(`/hrci/geo/zones`, { method: 'GET' });
        const data = Array.isArray(res) ? res : (res?.data || []);
        const items: Item[] = (data || []).map((s: any) => ({ id: String(s), name: String(s) }));
        setZones(items);
      }
    } catch {}
  })(); }, [needs.zone]);

  const canContinue = useMemo(() => {
    if (!cellId || !designationCode || !level) return false;
    if (needs.country && !geo.hrcCountryId) return false;
    if (needs.state && !geo.hrcStateId) return false;
    if (needs.district && !geo.hrcDistrictId) return false;
    if (needs.mandal && !geo.hrcMandalId) return false;
    if (needs.zone && !geo.zone) return false;
    return true;
  }, [geo, level, cellId, designationCode, needs]);

  // Quick-pick: determine the next active field and filter its items via search
  const activeKey: 'country' | 'state' | 'district' | 'mandal' | 'zone' | null = useMemo(() => {
    if (needs.country && !geo.hrcCountryId) return 'country';
    if (needs.state && !geo.hrcStateId) return 'state';
    if (needs.district && !geo.hrcDistrictId) return 'district';
    if (needs.mandal && !geo.hrcMandalId) return 'mandal';
    if (needs.zone && !geo.zone) return 'zone';
    return null;
  }, [needs, geo]);

  const itemsForActive: Item[] = useMemo(() => {
    switch (activeKey) {
      case 'country': return countries;
      case 'state': return states;
      case 'district': return districts;
      case 'mandal': return mandals;
      case 'zone': return zones;
      default: return [];
    }
  }, [activeKey, countries, states, districts, mandals, zones]);

  const filteredItems: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return itemsForActive;
    return itemsForActive.filter(i => i.name.toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q));
  }, [itemsForActive, query]);

  // When there are many items and no search, switch to a sectioned list UI for easier scanning
  const largeList = useMemo(() => query.trim().length === 0 && (itemsForActive?.length || 0) > 40, [itemsForActive?.length, query]);
  const sections = useMemo(() => {
    if (!largeList) return [] as { title: string; data: Item[] }[];
    const groups: Record<string, Item[]> = {};
    for (const it of itemsForActive) {
      const key = (it.name?.[0] || '#').toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    }
    return Object.keys(groups).sort().map(k => ({ title: k, data: groups[k].sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [itemsForActive, largeList]);

  const clearField = (key: 'country' | 'state' | 'district' | 'mandal' | 'zone') => {
    if (key === 'country') updateGeo({ hrcCountryId: null, hrcCountryName: null, hrcStateId: null, hrcStateName: null, hrcDistrictId: null, hrcDistrictName: null, hrcMandalId: null, hrcMandalName: null, zone: null });
    if (key === 'state') updateGeo({ hrcStateId: null, hrcStateName: null, hrcDistrictId: null, hrcDistrictName: null, hrcMandalId: null, hrcMandalName: null });
    if (key === 'district') updateGeo({ hrcDistrictId: null, hrcDistrictName: null, hrcMandalId: null, hrcMandalName: null });
    if (key === 'mandal') updateGeo({ hrcMandalId: null, hrcMandalName: null });
    if (key === 'zone') updateGeo({ zone: null });
  };

  const selectByActive = (id: string) => {
    switch (activeKey) {
      case 'country': {
        const name = countries.find(c => c.id === id)?.name || null;
        updateGeo({ hrcCountryId: id, hrcCountryName: name, hrcStateId: null, hrcStateName: null, hrcDistrictId: null, hrcDistrictName: null, hrcMandalId: null, hrcMandalName: null });
        try { AsyncStorage.multiSet([[ 'HRCI_COUNTRY_ID', id ], [ 'HRCI_COUNTRY_NAME', name || '' ]]); } catch {}
        break;
      }
      case 'state': {
        const name = states.find(s => s.id === id)?.name || null;
        updateGeo({ hrcStateId: id, hrcStateName: name, hrcDistrictId: null, hrcDistrictName: null, hrcMandalId: null, hrcMandalName: null });
        try { AsyncStorage.multiSet([[ 'HRCI_STATE_ID', id ], [ 'HRCI_STATE_NAME', name || '' ]]); } catch {}
        break;
      }
      case 'district': {
        const name = districts.find(d => d.id === id)?.name || null;
        updateGeo({ hrcDistrictId: id, hrcDistrictName: name, hrcMandalId: null, hrcMandalName: null });
        try { AsyncStorage.multiSet([[ 'HRCI_DISTRICT_ID', id ], [ 'HRCI_DISTRICT_NAME', name || '' ]]); } catch {}
        break;
      }
      case 'mandal': {
        const name = mandals.find(m => m.id === id)?.name || null;
        updateGeo({ hrcMandalId: id, hrcMandalName: name });
        try { AsyncStorage.multiSet([[ 'HRCI_MANDAL_ID', id ], [ 'HRCI_MANDAL_NAME', name || '' ]]); } catch {}
        break;
      }
      case 'zone':
        updateGeo({ zone: id });
        try { AsyncStorage.setItem('HRCI_ZONE', id); } catch {}
        break;
    }
    setQuery('');
  };

  const continueNext = () => {
    if (returnToAfterGeo && canContinue) {
      const target = returnToAfterGeo as any;
      // Clear the hint so it doesn't affect other flows
      try { setReturnToAfterGeo(null); AsyncStorage.removeItem('HRCI_RETURN_TO_AFTER_GEO'); } catch {}
      router.push(target);
      return;
    }
    router.push('/hrci/availability' as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top','left','right']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
          </TouchableOpacity>
          <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
          <TextInput
            placeholder={activeKey ? `Search ${activeKey}` : 'Search'}
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRowH}>
          {needs.country && !!geo.hrcCountryId && (
            <Chip label={`Country: ${countries.find(c => c.id === geo.hrcCountryId)?.name || geo.hrcCountryName || ''}`} onClear={() => clearField('country')} />
          )}
          {needs.state && !!geo.hrcStateId && (
            <Chip label={`State: ${states.find(s => s.id === geo.hrcStateId)?.name || geo.hrcStateName || ''}`} onClear={() => clearField('state')} />
          )}
          {needs.district && !!geo.hrcDistrictId && (
            <Chip label={`District: ${districts.find(d => d.id === geo.hrcDistrictId)?.name || geo.hrcDistrictName || ''}`} onClear={() => clearField('district')} />
          )}
          {needs.mandal && !!geo.hrcMandalId && (
            <Chip label={`Mandal: ${mandals.find(m => m.id === geo.hrcMandalId)?.name || geo.hrcMandalName || ''}`} onClear={() => clearField('mandal')} />
          )}
          {needs.zone && !!geo.zone && (
            <Chip label={`Zone: ${geo.zone}`} onClear={() => clearField('zone')} />
          )}
          {(geo.hrcCountryId || geo.hrcStateId || geo.hrcDistrictId || geo.hrcMandalId || geo.zone) && (
            <TouchableOpacity onPress={() => clearField('country')} style={{ marginLeft: 8 }}>
              <Text style={{ color: '#ef4444', fontWeight: '800' }}>Reset</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {query.trim().length > 0 ? (
              <FlatList
                keyboardShouldPersistTaps="handled"
                style={{ backgroundColor: '#ffffff', flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, flexGrow: 1 }}
                data={filteredItems}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultCard} onPress={() => selectByActive(item.id)}>
                    <Text style={styles.resultTitle}>{item.name}</Text>
                    {!!item.code && <Text style={styles.resultSub}>{item.code}</Text>}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Text style={{ color: '#6B7280' }}>No matches</Text>
                  </View>
                }
                showsVerticalScrollIndicator={true}
                showsHorizontalScrollIndicator={false}
              />
            ) : largeList ? (
              <SectionList
                keyboardShouldPersistTaps="handled"
                style={{ backgroundColor: '#ffffff', flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, flexGrow: 1 }}
                sections={sections}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultCard} onPress={() => selectByActive(item.id)}>
                    <Text style={styles.resultTitle}>{item.name}</Text>
                    {!!item.code && <Text style={styles.resultSub}>{item.code}</Text>}
                  </TouchableOpacity>
                )}
                renderSectionHeader={({ section }) => (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>{section.title}</Text>
                  </View>
                )}
                ListHeaderComponent={
                  <View style={{ paddingVertical: 6 }}>
                    <Text style={{ color: '#6B7280' }}>Large list — scroll or use search above</Text>
                  </View>
                }
                stickySectionHeadersEnabled
                showsVerticalScrollIndicator={true}
                showsHorizontalScrollIndicator={false}
              />
            ) : (
              <ScrollView 
                contentContainerStyle={[styles.container, { paddingBottom: bottomPad, flexGrow: 1 }]} 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                showsHorizontalScrollIndicator={false}
              >
                {needs.country && (
                  <PickerRow
                    label="Country"
                    items={countries}
                    selected={geo.hrcCountryId}
                    selectedName={countries.find((c) => c.id === geo.hrcCountryId)?.name}
                    onSelect={(id: string) => {
                      const name = countries.find((c) => c.id === id)?.name || null;
                      updateGeo({ hrcCountryId: id, hrcCountryName: name, hrcStateId: null, hrcStateName: null, hrcDistrictId: null, hrcDistrictName: null, hrcMandalId: null, hrcMandalName: null });
                    }}
                    onClear={() => clearField('country')}
                  />
                )}
                {needs.state && !!geo.hrcCountryId && (
                  <PickerRow
                    label="State"
                    items={states}
                    selected={geo.hrcStateId}
                    selectedName={states.find((s) => s.id === geo.hrcStateId)?.name}
                    onSelect={(id: string) => {
                      const name = states.find((s) => s.id === id)?.name || null;
                      updateGeo({ hrcStateId: id, hrcStateName: name, hrcDistrictId: null, hrcDistrictName: null, hrcMandalId: null, hrcMandalName: null });
                    }}
                    onClear={() => clearField('state')}
                  />
                )}
                {needs.district && !!geo.hrcStateId && (
                  <PickerRow
                    label="District"
                    items={districts}
                    selected={geo.hrcDistrictId}
                    selectedName={districts.find((d) => d.id === geo.hrcDistrictId)?.name}
                    onSelect={(id: string) => {
                      const name = districts.find((d) => d.id === id)?.name || null;
                      updateGeo({ hrcDistrictId: id, hrcDistrictName: name, hrcMandalId: null, hrcMandalName: null });
                    }}
                    onClear={() => clearField('district')}
                  />
                )}
                {needs.mandal && !!geo.hrcDistrictId && (
                  <PickerRow
                    label="Mandal"
                    items={mandals}
                    selected={geo.hrcMandalId}
                    selectedName={mandals.find((m) => m.id === geo.hrcMandalId)?.name}
                    onSelect={(id: string) => {
                      const name = mandals.find((m) => m.id === id)?.name || null;
                      updateGeo({ hrcMandalId: id, hrcMandalName: name });
                    }}
                    onClear={() => clearField('mandal')}
                  />
                )}
                {needs.zone && !!geo.hrcCountryId && !!geo.hrcStateId && (
                  <PickerRow
                    label="Zone"
                    items={zones}
                    selected={geo.zone ?? null}
                    selectedName={geo.zone || undefined}
                    onSelect={(id: string) => updateGeo({ zone: id })}
                    onClear={() => clearField('zone')}
                  />
                )}
              </ScrollView>
            )}

            {/* Bottom fixed CTA (keyboard-aware) */}
            <View style={[styles.actionBar, { paddingBottom: 12 + (insets?.bottom || 0) }]}>
              {/* Subtle fade to create a smooth glide into the fixed bar */}
              <LinearGradient
                colors={["rgba(255,255,255,0)", "#ffffff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.fadeTop, { pointerEvents: 'none' }]}
              />
              {(() => {
                const membershipFlow = !!returnToAfterGeo && returnToAfterGeo.includes('/hrci/admin/members/');
                const title = membershipFlow ? 'Check Availability' : (returnToAfterGeo ? 'Create meeting' : 'Check Availability');
                return (
                  <Button
                    title={title}
                    onPress={continueNext}
                    disabled={!canContinue}
                    backgroundColor={Colors.light.secondary}
                    style={{ width: '100%' }}
                  />
                );
              })()}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PickerRow({ label, items, selected, onSelect, onClear, selectedName }: { label: string; items: Item[]; selected: string | null | undefined; onSelect: (id: string) => void; onClear?: () => void; selectedName?: string }) {
  return (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        {selected ? (
          <Text style={styles.labelSelected}>{label}: {selectedName || ''}</Text>
        ) : (
          <Text style={styles.labelMuted}>Select {label}</Text>
        )}
        {!!selected && onClear && (
          <TouchableOpacity onPress={onClear}>
            <Text style={{ color: '#ef4444', fontWeight: '800' }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      {!selected && (
        <View style={styles.pills}>
          {items?.map(it => (
            <TouchableOpacity key={it.id} onPress={() => onSelect(it.id)} style={[styles.pill]}>
              <Text style={[styles.pillText]}>{it.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#ffffff' },
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff' },
  heading: { fontSize: 18, fontWeight: '800' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#ffffff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, color: '#111827', paddingVertical: 4 },
  summaryRowH: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  resultCard: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#eef0f4', marginBottom: 8 },
  resultTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  resultSub: { color: '#6b7280', marginTop: 2, textTransform: 'uppercase' },
  row: { marginBottom: 12 },
  label: { marginBottom: 8, color: '#333', fontWeight: '600' },
  labelSelected: { color: '#111827', fontWeight: '800' },
  labelMuted: { color: '#6B7280', fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: '100%' },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', flexShrink: 1, maxWidth: '100%' },
  pillActive: { backgroundColor: '#FE000222', borderColor: '#FE0002' },
  pillText: { color: '#333', flexShrink: 1 },
  pillTextActive: { color: '#FE0002', fontWeight: '700' },
  cta: { backgroundColor: '#1D0DA1', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  ctaInline: { marginTop: 16, backgroundColor: '#1D0DA1', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontWeight: '700' },
  sectionHeader: { paddingTop: 12, paddingBottom: 4 },
  sectionHeaderText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 12, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#eef0f4', ...makeShadow(8, { opacity: 0.06, blur: 20, y: 4 }) },
  fadeTop: { position: 'absolute', left: 0, right: 0, top: -20, height: 20 },
});

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <View style={chipStyles.base}>
      <Text style={chipStyles.text}>{label}</Text>
      <TouchableOpacity onPress={onClear}>
        <MaterialCommunityIcons name="close" size={14} color="#374151" />
      </TouchableOpacity>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  text: { color: '#374151', fontWeight: '700' },
});
