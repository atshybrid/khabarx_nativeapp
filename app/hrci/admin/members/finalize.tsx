import { Colors } from '@/constants/Colors';
import { useHrciOnboarding } from '@/context/HrciOnboardingContext';
import { createAdminMember } from '@/services/hrciAdmin';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function AdminFinalizeMember() {
  const { level, cellId, cellCode, cellName, designationCode, designationName, geo, reset } = useHrciOnboarding();
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [activate, setActivate] = useState(true);
  const mobileValid = useMemo(() => /^([6-9]\d{9})$/.test(mobileNumber.trim()), [mobileNumber]);
  const canSubmit = useMemo(() => fullName.trim().length >= 3 && mobileValid && !!level && !!designationCode && (!!cellCode || !!cellId), [fullName, mobileValid, level, designationCode, cellCode, cellId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      // Build level-specific minimal payload per examples
      const payload: any = {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        cell: cellCode || cellId,
        designationCode,
        level,
        activate,
      };
      if (level === 'NATIONAL') {
        if (geo.hrcCountryId) payload.hrcCountryId = geo.hrcCountryId;
      } else if (level === 'ZONE') {
        if (geo.hrcCountryId) payload.hrcCountryId = geo.hrcCountryId;
        if (geo.zone) payload.zone = geo.zone;
      } else if (level === 'STATE') {
        if (geo.hrcStateId) payload.hrcStateId = geo.hrcStateId;
      } else if (level === 'DISTRICT') {
        if (geo.hrcDistrictId) payload.hrcDistrictId = geo.hrcDistrictId;
      } else if (level === 'MANDAL') {
        if (geo.hrcMandalId) payload.hrcMandalId = geo.hrcMandalId;
      }

      await createAdminMember(payload);
      // Clean markers and reset flow
      try { await AsyncStorage.removeItem('HRCI_ADMIN_MEMBER_CREATE_ACTIVE'); } catch {}
      try { reset(); } catch {}
      router.replace('/memberships' as any);
    } catch (e: any) {
      setError(e?.message || 'Failed to create member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </Pressable>
        <Text style={styles.title}>Finalize Member</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.kv}><Text style={styles.k}>Level</Text> <Text style={styles.v}>{String(level || '')}</Text></Text>
            <Text style={styles.kv}><Text style={styles.k}>Cell</Text> <Text style={styles.v}>{cellName || String(cellCode || cellId || '')}</Text></Text>
            <Text style={styles.kv}><Text style={styles.k}>Designation</Text> <Text style={styles.v}>{designationName || String(designationCode || '')}</Text></Text>
            {level === 'ZONE' && geo.zone && <Text style={styles.kv}><Text style={styles.k}>Zone</Text> <Text style={styles.v}>{String(geo.zone)}</Text></Text>}
            {level === 'STATE' && geo.hrcStateId && <Text style={styles.kv}><Text style={styles.k}>StateId</Text> <Text style={styles.v}>{String(geo.hrcStateId)}</Text></Text>}
            {level === 'DISTRICT' && geo.hrcDistrictId && <Text style={styles.kv}><Text style={styles.k}>DistrictId</Text> <Text style={styles.v}>{String(geo.hrcDistrictId)}</Text></Text>}
            {level === 'MANDAL' && geo.hrcMandalId && <Text style={styles.kv}><Text style={styles.k}>MandalId</Text> <Text style={styles.v}>{String(geo.hrcMandalId)}</Text></Text>}
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
            <Text style={[styles.label,{ marginTop: 12 }]}>Mobile Number</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" placeholder="10-digit" value={mobileNumber} onChangeText={setMobileNumber} />
            {!mobileValid && mobileNumber.length > 0 && <Text style={styles.err}>Invalid mobile format</Text>}
            <View style={{ height: 4 }} />
            <Pressable onPress={() => setActivate(!activate)} style={styles.switchRow}>
              <View style={[styles.switchDot, activate ? styles.switchOn : styles.switchOff]} />
              <Text style={styles.switchLabel}>Activate now</Text>
            </Pressable>
          </View>
          {error && <Text style={styles.err}>{error}</Text>}
          <Pressable disabled={!canSubmit || loading} onPress={submit} style={[styles.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>Create Member</Text>}
          </Pressable>
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#eef2f7', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor:'#fff' },
  title: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  content: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', padding: 12, marginBottom: 12 },
  kv: { marginBottom: 6 },
  k: { color:'#64748b', fontWeight: '700' },
  v: { color:'#0f172a', fontWeight: '900' },
  label: { color:'#0f172a', fontWeight:'800', marginBottom: 6 },
  input: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, backgroundColor: '#fff', color: '#0f172a', fontWeight:'700' },
  err: { color:'#dc2626', fontWeight:'700', marginTop: 6 },
  switchRow: { flexDirection:'row', alignItems:'center', gap: 10, marginTop: 8 },
  switchDot: { width: 36, height: 20, borderRadius: 10, backgroundColor:'#e5e7eb', justifyContent:'center' },
  switchOn: { backgroundColor: Colors.light.primary },
  switchOff: { backgroundColor:'#e5e7eb' },
  switchLabel: { color:'#0f172a', fontWeight:'800' },
  submitBtn: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingVertical: 12, alignItems:'center' },
  submitTxt: { color:'#fff', fontWeight:'900' },
});
