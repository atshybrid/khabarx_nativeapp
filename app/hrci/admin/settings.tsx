import { Colors } from '@/constants/Colors';
import { uploadMedia } from '@/services/api';
import { getOrgSettings, OrgSettingsPut, updateOrgSettings } from '@/services/hrciAdmin';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HrciAdminSettingsPage() {
  // Core fields
  const [orgName, setOrgName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('');
  const [pan, setPan] = useState('');
  const [eightyGNumber, setEightyGNumber] = useState('');
  const [eightyGValidFrom, setEightyGValidFrom] = useState('');
  const [eightyGValidTo, setEightyGValidTo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [authorizedSignatoryName, setAuthorizedSignatoryName] = useState('');
  const [authorizedSignatoryTitle, setAuthorizedSignatoryTitle] = useState('');
  const [hrciLogoUrl, setHrciLogoUrl] = useState('');
  const [stampRoundUrl, setStampRoundUrl] = useState('');
  type Doc = { title: string; url: string; type: string };
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [docUploadingIndex, setDocUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await getOrgSettings();
        if (s) {
          setOrgName(s.orgName || '');
          setAddressLine1(s.addressLine1 || '');
          setAddressLine2(s.addressLine2 || '');
          setCity(s.city || '');
          setState(s.state || '');
          setPincode(s.pincode || '');
          setCountry(s.country || '');
          setPan(s.pan || '');
          setEightyGNumber(s.eightyGNumber || '');
          setEightyGValidFrom(s.eightyGValidFrom || '');
          setEightyGValidTo(s.eightyGValidTo || '');
          setEmail(s.email || '');
          setPhone(s.phone || '');
          setWebsite(s.website || '');
          setAuthorizedSignatoryName(s.authorizedSignatoryName || '');
          setAuthorizedSignatoryTitle(s.authorizedSignatoryTitle || '');
          setHrciLogoUrl(s.hrciLogoUrl || '');
          setStampRoundUrl(s.stampRoundUrl || '');
          setDocuments((s.documents || []).map(d => ({ title: d.title || '', url: d.url || '', type: d.type || '' })));
        }
      } catch (e: any) {
        try { Alert.alert('Org Settings', e?.message || 'Failed to load'); } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const parsedDocuments = documents; // Backwards compat var name for payload

  const fmtISODate = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 10); } catch { return iso; }
  };
  const onPickDate = (kind: 'from' | 'to') => {
    if (kind === 'from') setShowFromPicker(true); else setShowToPicker(true);
  };
  const onDateChanged = (kind: 'from' | 'to') => (_: DateTimePickerEvent, date?: Date) => {
    const d = date || new Date();
    const iso = d.toISOString();
    if (kind === 'from') { setEightyGValidFrom(iso); setShowFromPicker(Platform.OS === 'ios'); }
    else { setEightyGValidTo(iso); setShowToPicker(Platform.OS === 'ios'); }
  };
  const addDocument = () => setDocuments(prev => [...prev, { title: '', url: '', type: '' }]);
  const updateDocument = (i: number, key: keyof Doc, val: string) => setDocuments(prev => prev.map((d, idx) => idx === i ? { ...d, [key]: val } as Doc : d));
  const removeDocument = (i: number) => setDocuments(prev => prev.filter((_, idx) => idx !== i));

  async function pickImageFromLibrary(): Promise<{ uri: string; name?: string } | null> {
    try {
      const perm = await requestMediaPermissionsOnly();
      if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') {
        Alert.alert('Permission required', 'Please allow Photos/Media permission to pick an image.');
        return null;
      }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.9 });
      if ((res as any)?.canceled) return null;
      const asset = (res as any)?.assets?.[0];
      if (!asset?.uri) return null;
      return { uri: asset.uri, name: asset.fileName };
    } catch (e: any) {
      try { console.warn('[OrgSettings] pickImage failed', e?.message || e); } catch {}
      Alert.alert('Pick image', e?.message || 'Failed to pick an image');
      return null;
    }
  }

  const onUploadLogo = async () => {
    setUploadingLogo(true);
    try {
      const picked = await pickImageFromLibrary();
      if (!picked) return;
      const uploaded = await uploadMedia({ uri: picked.uri, type: 'image', name: picked.name || `hrci_logo_${Date.now()}.jpg`, folder: 'hrci-org' });
      setHrciLogoUrl(uploaded.url);
    } catch (e: any) {
      Alert.alert('Upload logo', e?.message || 'Upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const onUploadStamp = async () => {
    setUploadingStamp(true);
    try {
      const picked = await pickImageFromLibrary();
      if (!picked) return;
      const uploaded = await uploadMedia({ uri: picked.uri, type: 'image', name: picked.name || `hrci_stamp_${Date.now()}.jpg`, folder: 'hrci-org' });
      setStampRoundUrl(uploaded.url);
    } catch (e: any) {
      Alert.alert('Upload stamp', e?.message || 'Upload failed');
    } finally {
      setUploadingStamp(false);
    }
  };

  const onUploadDocumentAt = async (i: number) => {
    setDocUploadingIndex(i);
    try {
      const picked = await pickImageFromLibrary();
      if (!picked) return;
      const fileName = picked.name || `${(documents[i]?.type || documents[i]?.title || 'document').toString().replace(/\s+/g,'_')}_${Date.now()}.jpg`;
      const uploaded = await uploadMedia({ uri: picked.uri, type: 'image', name: fileName, folder: 'hrci-org' });
      updateDocument(i, 'url', uploaded.url);
    } catch (e: any) {
      Alert.alert('Upload document', e?.message || 'Upload failed');
    } finally {
      setDocUploadingIndex(null);
    }
  };

  const onSave = async () => {
    const payload: OrgSettingsPut = {
      orgName: orgName.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country.trim() || 'INDIA',
      pan: pan.trim() || undefined,
      eightyGNumber: eightyGNumber.trim() || undefined,
      eightyGValidFrom: eightyGValidFrom.trim() || undefined,
      eightyGValidTo: eightyGValidTo.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      website: website.trim() || undefined,
      authorizedSignatoryName: authorizedSignatoryName.trim() || undefined,
      authorizedSignatoryTitle: authorizedSignatoryTitle.trim() || undefined,
      hrciLogoUrl: hrciLogoUrl.trim() || undefined,
      stampRoundUrl: stampRoundUrl.trim() || undefined,
      documents: parsedDocuments,
    };
    if (!payload.orgName || !payload.addressLine1 || !payload.city || !payload.state || !payload.pincode) {
      Alert.alert('Org Settings', 'Please fill required fields: orgName, addressLine1, city, state, pincode.');
      return;
    }
    setSaving(true);
    try {
      const saved = await updateOrgSettings(payload);
      Alert.alert('Org Settings', 'Saved successfully');
      setOrgName(saved.orgName || payload.orgName);
    } catch (e: any) {
      Alert.alert('Org Settings', e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <StatusBar style="dark" />
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Org Settings</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }}>
        <Section title="Organization">
          <Field label="Organization Name" value={orgName} onChangeText={setOrgName} required />
          <Field label="Address Line 1" value={addressLine1} onChangeText={setAddressLine1} required />
          <Field label="Address Line 2" value={addressLine2} onChangeText={setAddressLine2} />
          <Row>
            <Field label="City" value={city} onChangeText={setCity} style={{ flex: 1 }} required />
            <Field label="State" value={state} onChangeText={setState} style={{ flex: 1 }} required />
          </Row>
          <Row>
            <Field label="Pincode" value={pincode} onChangeText={setPincode} style={{ flex: 1 }} required />
            <Field label="Country" value={country} onChangeText={setCountry} style={{ flex: 1 }} />
          </Row>
        </Section>

        <Section title="Compliance">
          <Field label="PAN" value={pan} onChangeText={setPan} autoCapitalize="characters" />
          <Field label="80G Number" value={eightyGNumber} onChangeText={setEightyGNumber} />
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>80G Valid From</Text>
              <View style={styles.inputRow}>
                <TextInput value={fmtISODate(eightyGValidFrom)} placeholder="YYYY-MM-DD" onChangeText={(t)=>setEightyGValidFrom(t)} style={[styles.input, { flex: 1 }]} placeholderTextColor="#9CA3AF" />
                <Pressable style={styles.pickBtn} onPress={() => onPickDate('from')}><Text style={styles.pickTxt}>Pick</Text></Pressable>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>80G Valid To</Text>
              <View style={styles.inputRow}>
                <TextInput value={fmtISODate(eightyGValidTo)} placeholder="YYYY-MM-DD" onChangeText={(t)=>setEightyGValidTo(t)} style={[styles.input, { flex: 1 }]} placeholderTextColor="#9CA3AF" />
                <Pressable style={styles.pickBtn} onPress={() => onPickDate('to')}><Text style={styles.pickTxt}>Pick</Text></Pressable>
              </View>
            </View>
          </Row>
          {showFromPicker && (
            <DateTimePicker value={eightyGValidFrom ? new Date(eightyGValidFrom) : new Date()} mode="date" display="default" onChange={onDateChanged('from')} />
          )}
          {showToPicker && (
            <DateTimePicker value={eightyGValidTo ? new Date(eightyGValidTo) : new Date()} mode="date" display="default" onChange={onDateChanged('to')} />
          )}
        </Section>

        <Section title="Contacts">
          <Row>
            <Field label="Email" value={email} onChangeText={setEmail} style={{ flex: 1 }} autoCapitalize="none" />
            <Field label="Phone" value={phone} onChangeText={setPhone} style={{ flex: 1 }} keyboardType="phone-pad" />
          </Row>
          <Field label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://…" />
        </Section>

        <Section title="Authorized Signatory">
          <Row>
            <Field label="Name" value={authorizedSignatoryName} onChangeText={setAuthorizedSignatoryName} style={{ flex: 1 }} />
            <Field label="Title" value={authorizedSignatoryTitle} onChangeText={setAuthorizedSignatoryTitle} style={{ flex: 1 }} />
          </Row>
        </Section>

        <Section title="Branding">
          <Text style={styles.label}>HRCI Logo URL</Text>
          <View style={styles.inputRow}>
            <TextInput value={hrciLogoUrl} onChangeText={setHrciLogoUrl} autoCapitalize="none" placeholder="https://…" style={[styles.input, { flex: 1 }]} placeholderTextColor="#9CA3AF" />
            <Pressable style={styles.pickBtn} onPress={onUploadLogo} disabled={uploadingLogo}>
              <Text style={styles.pickTxt}>{uploadingLogo ? 'Uploading…' : 'Pick & Upload'}</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>Round Stamp URL</Text>
          <View style={styles.inputRow}>
            <TextInput value={stampRoundUrl} onChangeText={setStampRoundUrl} autoCapitalize="none" placeholder="https://…" style={[styles.input, { flex: 1 }]} placeholderTextColor="#9CA3AF" />
            <Pressable style={styles.pickBtn} onPress={onUploadStamp} disabled={uploadingStamp}>
              <Text style={styles.pickTxt}>{uploadingStamp ? 'Uploading…' : 'Pick & Upload'}</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="Documents">
          {documents.map((doc, i) => (
            <View key={i} style={styles.docCard}>
              <Row>
                <Field label="Title" value={doc.title} onChangeText={(t)=>updateDocument(i,'title',t)} style={{ flex: 1 }} />
                <Field label="Type" value={doc.type} onChangeText={(t)=>updateDocument(i,'type',t)} style={{ flex: 1 }} />
              </Row>
              <Text style={styles.label}>URL</Text>
              <View style={styles.inputRow}>
                <TextInput value={doc.url} onChangeText={(t)=>updateDocument(i,'url',t)} autoCapitalize="none" placeholder="https://…" style={[styles.input, { flex: 1 }]} placeholderTextColor="#9CA3AF" />
                <Pressable style={styles.pickBtn} onPress={() => onUploadDocumentAt(i)} disabled={docUploadingIndex === i}>
                  <Text style={styles.pickTxt}>{docUploadingIndex === i ? 'Uploading…' : 'Upload'}</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => removeDocument(i)} style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.removeTxt}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addDocument} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.addTxt}>+ Add Document</Text>
          </Pressable>
          <Text style={styles.smallHelp}>Attach compliance or registration documents for reference.</Text>
        </Section>

        <Pressable onPress={onSave} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]} disabled={saving}>
          <Text style={styles.saveTxt}>{saving ? 'Saving…' : (loading ? 'Loading…' : 'Save')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  title: { fontSize: 16, fontWeight: '800', color: Colors.light.primary },
  label: { color: '#111', fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111', backgroundColor: '#fff' },
  saveBtn: { backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  saveTxt: { color: '#fff', fontWeight: '800' },
  section: { borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  sectionTitle: { color: '#0f172a', fontWeight: '900', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  smallHelp: { color: '#6b7280', marginTop: 6, fontSize: 12 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  pickTxt: { color: '#111', fontWeight: '800' },
  docCard: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  addBtn: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f8fafc' },
  addTxt: { color: '#111', fontWeight: '800' },
  removeBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#fee2e2', backgroundColor: '#fef2f2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 6 },
  removeTxt: { color: '#b91c1c', fontWeight: '800' },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string; required?: boolean };
function Field({ label, required, style, ...rest }: FieldProps) {
  return (
    <View style={{ marginBottom: 10, flex: (style as any)?.flex ? (style as any).flex : undefined }}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput {...rest} style={[styles.input, style]} placeholderTextColor="#9CA3AF" />
    </View>
  );
}
