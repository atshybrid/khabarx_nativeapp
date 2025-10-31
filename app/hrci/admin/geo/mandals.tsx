import { Colors } from '@/constants/Colors';
import { createAdminMandal, getCountries, getDistricts, getMandals, getStates, HrcCountry, HrcDistrict, HrcMandal, HrcState } from '@/services/hrciGeo';
import { makeShadow } from '@/utils/shadow';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function AdminGeoMandalsScreen() {
  const [countries, setCountries] = useState<HrcCountry[]>([]);
  const [states, setStates] = useState<HrcState[]>([]);
  const [districts, setDistricts] = useState<HrcDistrict[]>([]);
  const [mandals, setMandals] = useState<HrcMandal[]>([]);

  const [countryId, setCountryId] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);

  const [mandalName, setMandalName] = useState('');
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cs = await getCountries();
        if (!cancelled) setCountries(cs);
        if (!cancelled && cs.length === 1) setCountryId(cs[0].id);
      } catch (e) {
        try { Alert.alert('Geo', (e as any)?.message || 'Failed to load countries'); } catch {}
      } finally {
        // no-op
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!countryId) { setStates([]); setStateId(null); return; }
      try {
        const ss = await getStates(countryId);
        if (!cancelled) setStates(ss);
        if (!cancelled && ss.length === 1) setStateId(ss[0].id);
      } catch (e) {
        try { Alert.alert('Geo', (e as any)?.message || 'Failed to load states'); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [countryId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!stateId) { setDistricts([]); setDistrictId(null); return; }
      try {
        const ds = await getDistricts(stateId);
        if (!cancelled) setDistricts(ds);
        if (!cancelled && ds.length === 1) setDistrictId(ds[0].id);
      } catch (e) {
        try { Alert.alert('Geo', (e as any)?.message || 'Failed to load districts'); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [stateId]);

  const canCreate = useMemo(() => !!districtId && mandalName.trim().length >= 3, [districtId, mandalName]);

  const loadMandals = async (did: string) => {
    try {
      setRefreshing(true);
      const ms = await getMandals(did);
      setMandals(ms);
    } catch (e) {
      try { Alert.alert('Geo', (e as any)?.message || 'Failed to load mandals'); } catch {}
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (districtId) loadMandals(districtId).catch(()=>{});
    else setMandals([]);
  }, [districtId]);

  const handleCreate = async () => {
    if (!districtId || !canCreate) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
    setCreating(true);
    try {
      const res = await createAdminMandal({ districtId, name: mandalName.trim() });
      setMandalName('');
      await loadMandals(districtId);
      try { Alert.alert('Mandal', `Created: ${res.name}`); } catch {}
    } catch (e) {
      try { Alert.alert('Mandal', (e as any)?.message || 'Failed to create'); } catch {}
    } finally {
      setCreating(false);
    }
  };

  const Header = () => (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}>
        <Text style={{ color: Colors.light.primary, fontWeight: '900' }}>{'<'} Back</Text>
      </Pressable>
      <Text style={styles.topTitle}>Geo • Mandals</Text>
      <View style={{ width: 52 }} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Header />
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <FlatList
          data={mandals}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <View style={[styles.row, styles.rowDivider]}>
              <View style={styles.rowIconWrap}><Text style={{ color: Colors.light.primary, fontWeight: '900' }}>M</Text></View>
              <Text style={styles.rowLabel} numberOfLines={1}>{item.name}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />}
          refreshing={refreshing}
          onRefresh={() => { if (districtId) { loadMandals(districtId); } }}
          ListHeaderComponent={(
            <View>
              {/* Pickers */}
              <PickerRow label="Country" items={countries} selectedId={countryId} onSelect={setCountryId} />
              {!!countryId && <PickerRow label="State" items={states} selectedId={stateId} onSelect={setStateId} />}
              {!!stateId && <PickerRow label="District" items={districts} selectedId={districtId} onSelect={setDistrictId} />}

              {/* Create */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Create Mandal</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <TextInput
                    placeholder="Mandal name"
                    placeholderTextColor="#94a3b8"
                    value={mandalName}
                    onChangeText={setMandalName}
                    style={styles.input}
                    autoCapitalize="words"
                    autoCorrect
                  />
                  <Pressable disabled={!canCreate || creating} onPress={handleCreate} style={({ pressed }) => [styles.smallBtn, (!canCreate || creating) && { opacity: 0.5 }, pressed && { opacity: 0.9 }]}>
                    {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.smallBtnText}>Add</Text>}
                  </Pressable>
                </View>
                {!districtId && <Text style={styles.hint}>Select a district to enable creation</Text>}
              </View>

              {/* List header */}
              <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9', ...makeShadow(2, { opacity: 0.06, blur: 10, y: 3 }) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sectionTitle}>Mandals{mandals.length ? ` (${mandals.length})` : ''}</Text>
                  {!!districtId && (
                    <Pressable onPress={() => loadMandals(districtId)} style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}>
                      {refreshing ? <ActivityIndicator size="small" color={Colors.light.primary} /> : <Text style={styles.refreshTxt}>Refresh</Text>}
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.card, styles.emptyWrap]}>
              <Text style={styles.emptyText}>{districtId ? 'No mandals yet.' : 'Pick a district above'}</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 24 }} />}
          showsVerticalScrollIndicator={true}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PickerRow({ label, items, selectedId, onSelect }: { label: string; items: { id: string; name: string }[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <View style={styles.pills}>
        {items?.map((it) => (
          <Pressable key={it.id} onPress={() => onSelect(it.id)} style={({ pressed }) => [styles.pill, selectedId === it.id && styles.pillActive, pressed && { opacity: 0.9 }]}>
            <Text style={[styles.pillText, selectedId === it.id && styles.pillTextActive]}>{it.name}</Text>
          </Pressable>
        ))}
        {!items?.length ? <Text style={styles.hint}>No options</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: { paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  backBtn: { paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#fff' },
  content: { padding: 12, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9', ...makeShadow(2, { opacity: 0.06, blur: 10, y: 3 }) },
  sectionTitle: { color: '#0f172a', fontWeight: '900', fontSize: 14 },
  input: { flex: 1, height: 40, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, color: '#0f172a', fontWeight: '700' },
  smallBtn: { backgroundColor: Colors.light.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: '#fff', fontWeight: '800' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#eef2ff', borderColor: '#e0e7ff' },
  pillText: { color: '#0f172a' },
  pillTextActive: { color: Colors.light.primary, fontWeight: '800' },
  hint: { color: '#64748b', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, backgroundColor: '#fff' },
  rowDivider: { borderBottomWidth: 0 },
  rowIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: '#0f172a', fontWeight: '800' },
  emptyWrap: { height: 90, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748b' },
  refreshBtn: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  refreshTxt: { color: Colors.light.primary, fontWeight: '800' },
});
