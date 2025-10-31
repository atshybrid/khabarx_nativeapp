import { adminApproveKyc, AdminKycItem, AdminKycStatus, getAdminKycByMembershipId } from '@/services/kyc';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminKycDetailScreen() {
  const router = useRouter();
  const { membershipId = '' } = useLocalSearchParams<{ membershipId?: string }>();
  const [item, setItem] = useState<AdminKycItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AdminKycStatus>('PENDING');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => `KYC Details`, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const rec = await getAdminKycByMembershipId(String(membershipId));
        if (mounted) {
          setItem(rec);
          const st = String(rec?.status || 'PENDING').toUpperCase() as AdminKycStatus;
          setStatus((['PENDING','APPROVED','REJECTED'].includes(st) ? st : 'PENDING') as AdminKycStatus);
          setRemarks(rec?.remarks || '');
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load KYC');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [membershipId]);

  const openLink = async (url?: string | null) => {
    if (!url) return;
    try { await WebBrowser.openBrowserAsync(url); } catch {}
  };

  const onUpdate = async () => {
    if (!membershipId) return;
    setSaving(true);
    try {
      await adminApproveKyc(String(membershipId), { status, remarks });
      Alert.alert('Updated', 'KYC status updated');
      // refresh current record
      const rec = await getAdminKycByMembershipId(String(membershipId));
      setItem(rec);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update KYC');
    } finally {
      setSaving(false);
    }
  };

  const level = item?.membership?.level || '-';
  const cell = item?.membership?.cell?.name || '-';
  const designation = item?.membership?.designation?.name || '-';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.heading}>{title}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D0DA1" />
          <Text style={styles.centerText}>Loading…</Text>
          {!!error && <Text style={[styles.centerText, { color: '#b91c1c' }]}>{error}</Text>}
        </View>
      ) : !item ? (
        <View style={styles.center}><Text style={styles.centerText}>No data</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Membership</Text>
            <Text style={styles.row}>ID: {item.membershipId}</Text>
            <Text style={styles.row}>Level: {level}</Text>
            <Text style={styles.row}>Cell: {cell}</Text>
            <Text style={styles.row}>Designation: {designation}</Text>
            <Text style={styles.row}>Status: {String(item.status || '').toUpperCase()}</Text>
            {!!item.remarks && <Text style={styles.row}>Remarks: {item.remarks}</Text>}
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Documents</Text>
            <Text style={styles.row}>Aadhaar: {item.aadhaarNumber || '-'}</Text>
            <View style={styles.imagesRow}>
              {item.aadhaarFrontUrl ? (
                <TouchableOpacity onPress={() => openLink(item.aadhaarFrontUrl)}><Image source={{ uri: item.aadhaarFrontUrl }} style={styles.image} /></TouchableOpacity>
              ) : null}
              {item.aadhaarBackUrl ? (
                <TouchableOpacity onPress={() => openLink(item.aadhaarBackUrl)}><Image source={{ uri: item.aadhaarBackUrl }} style={styles.image} /></TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.row}>PAN: {item.panNumber || '-'}</Text>
            {item.panCardUrl ? (
              <TouchableOpacity onPress={() => openLink(item.panCardUrl)}><Image source={{ uri: item.panCardUrl }} style={styles.image} /></TouchableOpacity>
            ) : null}
            {!!item.llbRegistrationNumber && <Text style={styles.row}>LLB Reg#: {item.llbRegistrationNumber}</Text>}
            {item.llbSupportDocUrl ? (
              <TouchableOpacity onPress={() => openLink(item.llbSupportDocUrl)}><Image source={{ uri: item.llbSupportDocUrl }} style={styles.image} /></TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Update Status</Text>
            <View style={styles.statusRow}>
              {(['PENDING','APPROVED','REJECTED'] as AdminKycStatus[]).map((st) => (
                <TouchableOpacity key={st} style={[styles.statusBtn, status === st && styles.statusBtnActive]} onPress={() => setStatus(st)}>
                  <Text style={[styles.statusBtnText, status === st && styles.statusBtnTextActive]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Remarks"
              value={remarks}
              onChangeText={setRemarks}
              multiline
            />
            <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={onUpdate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Update</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  heading: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { color: '#6b7280', marginTop: 8 },
  group: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginVertical: 6 },
  groupTitle: { color: '#111827', fontWeight: '800', marginBottom: 6 },
  row: { color: '#374151', marginTop: 4 },
  imagesRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  image: { width: 120, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: '#f3f4f6' },
  statusBtnActive: { backgroundColor: '#111827' },
  statusBtnText: { color: '#111827', fontWeight: '700' },
  statusBtnTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#e6e6ef', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff', marginTop: 8 },
  cta: { backgroundColor: '#1D0DA1', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontWeight: '700' },
});
