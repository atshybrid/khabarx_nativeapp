import { Colors } from '@/constants/Colors';
import { canCreateHrciCase, createHrciCase, getHrciCaseCategories, HrciCaseCategoryNode, HrciCasePriority } from '@/services/hrciCases';
import DateTimePicker from '@react-native-community/datetimepicker';
// Lazy-load native modules to avoid crashes before dev client rebuild
// import * as Location from 'expo-location';
import { FullScreenLoader, LOADER_SIZES } from '@/components/ui/Loader';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function HrciNewCaseScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [incidentAtDate, setIncidentAtDate] = useState<Date>(new Date());
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [address, setAddress] = useState('');
  const [priority, setPriority] = useState<HrciCasePriority>('MEDIUM');
  const [categories, setCategories] = useState<HrciCaseCategoryNode[]>([]);
  const [category, setCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locMessage, setLocMessage] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  // No time picker; date only
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const role = await canCreateHrciCase();
      if (!role.allowed) {
        try { Alert.alert('Not allowed', role.reason || 'Only Member or HRCI Admin can create cases'); } catch {}
        router.back();
        return;
      }
      try {
        const cats = await getHrciCaseCategories();
        setCategories(cats);
      } catch (e:any) {
        try { Alert.alert('Error', e?.message || 'Failed to load categories'); } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-capture current location on mount (graceful if unavailable)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLocLoading(true);
        setLocMessage('Fetching current location…');
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setLocMessage('Location permission denied');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          if (!latitude) setLatitude(String(pos.coords.latitude));
          if (!longitude) setLongitude(String(pos.coords.longitude));
        }
        try {
          const r = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          const first = r?.[0];
          if (!cancelled && first && !address) {
            const composed = [first.name, first.street, first.city, first.region, first.postalCode, first.country].filter(Boolean).join(', ');
            setAddress(composed);
          }
        } catch {}
        if (!cancelled) setLocMessage('Coordinates auto-captured');
      } catch {
        if (!cancelled) setLocMessage('Unable to fetch location');
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // We intentionally run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flatCategories = useMemo(() => flattenCats(categories), [categories]);

  const submit = useCallback(async () => {
    if (!title.trim() || !description.trim() || !category) {
      try { Alert.alert('Missing fields', 'Title, description and category are required'); } catch {}
      return;
    }
    // Enforce 1000 words max on description
    const words = description.trim().split(/\s+/).filter(Boolean);
    if (words.length > 1000) {
      try { Alert.alert('Too long', 'Description cannot exceed 1000 words'); } catch {}
      return;
    }
    const lat = Number(latitude); const lng = Number(longitude);
    if (!isFinite(lat) || !isFinite(lng)) {
      try { Alert.alert('Location unavailable', 'Current GPS location is not available yet. Please enable location and try again.'); } catch {}
      return;
    }
    setSubmitting(true);
    try {
      const dateOnly = new Date(incidentAtDate);
      dateOnly.setHours(0, 0, 0, 0);
      const created = await createHrciCase({
        title: title.trim(),
        description: description.trim(),
        incidentAt: dateOnly.toISOString(),
        latitude: lat,
        longitude: lng,
        address: address.trim(),
        category,
        priority,
      });
      try { Alert.alert('Success', `Case #${created.caseNumber} created`); } catch {}
      router.replace('/hrci/cases' as any);
    } catch (e:any) {
      try { Alert.alert('Failed', e?.message || 'Could not create case'); } catch {}
    } finally {
      setSubmitting(false);
    }
  }, [title, description, category, latitude, longitude, address, incidentAtDate, priority]);

  if (loading) {
    return <FullScreenLoader size={LOADER_SIZES.xxlarge} label="Preparing…" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* App Bar */}
      <SafeAreaView style={{ backgroundColor: '#fff' }}>
        <View style={styles.appBar}>
          <Pressable onPress={() => router.back()} style={styles.appBarBtn} hitSlop={8}>
            <Text style={styles.appBarBtnText}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.appBarTitle}>Create Case</Text>
          <View style={styles.appBarBtn} />
        </View>
      </SafeAreaView>
      <LabeledInput label="Title" value={title} onChangeText={setTitle} maxLength={120} />
      <DescriptionInput
        value={description}
        onChange={(txt) => {
          const words = txt.trim().split(/\s+/).filter(Boolean);
          if (words.length <= 1000) setDescription(txt);
          else {
            // Trim to first 1000 words
            const trimmed = words.slice(0, 1000).join(' ');
            setDescription(trimmed);
          }
        }}
      />

      <Text style={styles.label}>Incident Date</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>{incidentAtDate.toDateString()}</Text>
        </Pressable>
      </View>
      {showDatePicker && (
        <DateTimePicker
          value={incidentAtDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(e, d) => {
            setShowDatePicker(false);
            if (d) {
              const cur = new Date(incidentAtDate);
              cur.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              // ensure date-only (midnight)
              cur.setHours(0, 0, 0, 0);
              setIncidentAtDate(cur);
            }
          }}
        />
      )}
      {/* Lat/Long are auto-captured in the background; no manual inputs */}
      {!!locMessage && (
        <Text style={styles.helperText}>{locLoading ? 'Fetching current location…' : locMessage}</Text>
      )}
      <LabeledInput label="Address" value={address} onChangeText={setAddress} />

      <View style={{ marginBottom: 16 }}>
        <Text style={styles.label}>Category</Text>
        <Pressable onPress={() => setCategoryOpen(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={{ color: '#111' }}>{flatCategories.find(x => x.code === category)?.name || 'Select category'}</Text>
          <Text style={{ color: '#888' }}>▼</Text>
        </Pressable>
        <Modal transparent visible={categoryOpen} animationType="slide" onRequestClose={() => setCategoryOpen(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setCategoryOpen(false)} />
            <View style={styles.bottomSheet}>
              <View style={styles.sheetGrabber} />
              <Text style={styles.sheetTitle}>Select Category</Text>
              <ScrollView style={{ maxHeight: 420 }}>
                {flatCategories.map((c) => (
                  <Pressable key={c.code} onPress={() => { setCategory(c.code); setCategoryOpen(false); }} style={styles.modalItem}>
                    <Text style={{ color: '#111' }}>{c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={() => setCategoryOpen(false)} style={[styles.modalItem, { borderTopWidth: 1, borderTopColor: '#e5e7eb' }]}>
                <Text style={{ color: '#6b7280' }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={styles.label}>Priority</Text>
        <Pressable onPress={() => setPriorityOpen(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={{ color: '#111' }}>{priority}</Text>
          <Text style={{ color: '#888' }}>▼</Text>
        </Pressable>
        <Modal transparent visible={priorityOpen} animationType="slide" onRequestClose={() => setPriorityOpen(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPriorityOpen(false)} />
            <View style={styles.bottomSheet}>
              <View style={styles.sheetGrabber} />
              <Text style={styles.sheetTitle}>Select Priority</Text>
              {(['LOW','MEDIUM','HIGH','CRITICAL'] as HrciCasePriority[]).map(p => (
                <Pressable key={p} onPress={() => { setPriority(p); setPriorityOpen(false); }} style={styles.modalItem}>
                  <Text style={{ color: '#111' }}>{p}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setPriorityOpen(false)} style={[styles.modalItem, { borderTopWidth: 1, borderTopColor: '#e5e7eb' }]}>
                <Text style={{ color: '#6b7280' }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>

      <Pressable disabled={submitting} onPress={submit} style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}>
        <Text style={styles.primaryBtnText}>{submitting ? 'Submitting…' : 'Create Case'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function flattenCats(nodes: HrciCaseCategoryNode[], prefix: string[] = []): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  for (const n of nodes || []) {
    const name = [...prefix, n.name].join(' / ');
    out.push({ code: n.code, name });
    if (n.children && n.children.length) {
      out.push(...flattenCats(n.children, [...prefix, n.name]));
    }
  }
  return out;
}

function LabeledInput({ label, ...props }: any) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#888" style={[styles.input, props.multiline && styles.inputMultiline]} />
    </View>
  );
}

function DescriptionInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const words = value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0;
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.label}>Description</Text>
        <Text style={[styles.label, { color: words > 1000 ? '#ff6b6b' : '#bbb' }]}>{words}/1000 words</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Describe the incident in detail"
        placeholderTextColor="#888"
        multiline
        style={[styles.input, styles.inputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', gap: 12 },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  appBarBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarBtnText: { fontSize: 24, color: '#111' },
  appBarTitle: { color: '#111', fontSize: 18, fontWeight: '700' },
  label: { color: '#444', marginBottom: 8, fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#111', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10 },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  helperText: { marginTop: -8, marginBottom: 12, color: '#6b7280', fontSize: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  chipActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipText: { color: '#444' },
  chipTextActive: { color: '#000', fontWeight: '700' },
  primaryBtn: { backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8, elevation: 2 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  secondaryBtnText: { color: '#111' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalSheet: { width: '80%', backgroundColor: '#1a1a1a', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  bottomSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, elevation: 8 },
  sheetGrabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: '#e5e7eb', marginBottom: 8 },
  sheetTitle: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16 },
});
