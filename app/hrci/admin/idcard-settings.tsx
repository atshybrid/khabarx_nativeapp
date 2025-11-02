import { Colors } from '@/constants/Colors';
import { uploadMedia } from '@/services/api';
import { HrciIdCardSettings, HrciIdCardSettingsPut, listIdCardSettings, updateIdCardSettings } from '@/services/hrciAdmin';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HrciAdminIdCardSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<HrciIdCardSettings | null>(null);

  // Local editable fields (mapped from settings)
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [frontH1, setFrontH1] = useState('');
  const [frontH2, setFrontH2] = useState('');
  const [frontH3, setFrontH3] = useState('');
  const [frontH4, setFrontH4] = useState('');
  const [frontLogoUrl, setFrontLogoUrl] = useState('');
  const [secondLogoUrl, setSecondLogoUrl] = useState('');
  const [hrciStampUrl, setHrciStampUrl] = useState('');
  const [authorSignUrl, setAuthorSignUrl] = useState('');
  const [registerDetails, setRegisterDetails] = useState('');
  const [frontFooterText, setFrontFooterText] = useState('');
  const [headOfficeAddress, setHeadOfficeAddress] = useState('');
  const [regionalOfficeAddress, setRegionalOfficeAddress] = useState('');
  const [administrationOfficeAddress, setAdministrationOfficeAddress] = useState('');
  const [contactNumber1, setContactNumber1] = useState('');
  const [contactNumber2, setContactNumber2] = useState('');
  const [qrLandingBaseUrl, setQrLandingBaseUrl] = useState('');
  const [termsText, setTermsText] = useState(''); // multi-line, one per line

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const arr = await listIdCardSettings();
        const current = Array.isArray(arr) && arr.length ? arr[0] : null;
        setSettings(current);
        if (current) {
          setName(current.name || '');
          setIsActive(Boolean(current.isActive));
          setPrimaryColor(current.primaryColor || '');
          setSecondaryColor(current.secondaryColor || '');
          setFrontH1(current.frontH1 || '');
          setFrontH2(current.frontH2 || '');
          setFrontH3(current.frontH3 || '');
          setFrontH4(current.frontH4 || '');
          setFrontLogoUrl(current.frontLogoUrl || '');
          setSecondLogoUrl(current.secondLogoUrl || '');
          setHrciStampUrl(current.hrciStampUrl || '');
          setAuthorSignUrl(current.authorSignUrl || '');
          setRegisterDetails(current.registerDetails || '');
          setFrontFooterText(current.frontFooterText || '');
          setHeadOfficeAddress(current.headOfficeAddress || '');
          setRegionalOfficeAddress(current.regionalOfficeAddress || '');
          setAdministrationOfficeAddress(current.administrationOfficeAddress || '');
          setContactNumber1(current.contactNumber1 || '');
          setContactNumber2(current.contactNumber2 || '');
          setQrLandingBaseUrl(current.qrLandingBaseUrl || '');
          setTermsText((current.terms || []).join('\n'));
        }
      } catch (e: any) {
        try { Alert.alert('ID Card Settings', e?.message || 'Failed to load'); } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const payload: HrciIdCardSettingsPut = useMemo(() => ({
    name: name.trim(),
    isActive,
    primaryColor: primaryColor.trim() || undefined,
    secondaryColor: secondaryColor.trim() || undefined,
    frontH1: frontH1.trim() || undefined,
    frontH2: frontH2.trim() || undefined,
    frontH3: frontH3.trim() || undefined,
    frontH4: frontH4.trim() || undefined,
    frontLogoUrl: frontLogoUrl.trim() || undefined,
    secondLogoUrl: secondLogoUrl.trim() || undefined,
    hrciStampUrl: hrciStampUrl.trim() || undefined,
    authorSignUrl: authorSignUrl.trim() || undefined,
    registerDetails: registerDetails.trim() || undefined,
    frontFooterText: frontFooterText.trim() || undefined,
    headOfficeAddress: headOfficeAddress.trim() || undefined,
    regionalOfficeAddress: regionalOfficeAddress.trim() || undefined,
    administrationOfficeAddress: administrationOfficeAddress.trim() || undefined,
    contactNumber1: contactNumber1.trim() || undefined,
    contactNumber2: contactNumber2.trim() || undefined,
    qrLandingBaseUrl: qrLandingBaseUrl.trim() || undefined,
    terms: termsText.split('\n').map(t => t.trim()).filter(Boolean),
  }), [name, isActive, primaryColor, secondaryColor, frontH1, frontH2, frontH3, frontH4, frontLogoUrl, secondLogoUrl, hrciStampUrl, authorSignUrl, registerDetails, frontFooterText, headOfficeAddress, regionalOfficeAddress, administrationOfficeAddress, contactNumber1, contactNumber2, qrLandingBaseUrl, termsText]);

  async function pickAndUpload(label: string): Promise<string | null> {
    try {
      const perm = await requestMediaPermissionsOnly();
      if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') {
        Alert.alert('Permission required', 'Please allow Photos/Media permission to pick an image.');
        return null;
      }
      const res = await (await import('expo-image-picker')).launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.92 });
      if ((res as any)?.canceled) return null;
      const asset = (res as any)?.assets?.[0];
      if (!asset?.uri) return null;
      const uploaded = await uploadMedia({ uri: asset.uri, type: 'image', name: `${label}_${Date.now()}.jpg`, folder: 'hrci-idcards' });
      return uploaded.url;
    } catch (e: any) {
      try { Alert.alert('Upload', e?.message || 'Failed to upload'); } catch {}
      return null;
    }
  }

  const onSave = async () => {
    if (!settings?.id) { Alert.alert('ID Card Settings', 'No settings record found'); return; }
    if (!payload.name) { Alert.alert('ID Card Settings', 'Please enter the organization name'); return; }
    setSaving(true);
    try {
      const saved = await updateIdCardSettings(settings.id, payload);
      setSettings(saved);
      Alert.alert('ID Card Settings', 'Saved successfully');
    } catch (e: any) {
      Alert.alert('ID Card Settings', e?.message || 'Failed to save');
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
          <Text style={styles.title}>ID Card Settings</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }}>
        <Section title="General">
          <Field label="Organization Name" value={name} onChangeText={setName} required />
          <Row>
            <Field label="Primary Color" value={primaryColor} onChangeText={setPrimaryColor} style={{ flex: 1 }} placeholder="#0d6efd" autoCapitalize="none" />
            <Field label="Secondary Color" value={secondaryColor} onChangeText={setSecondaryColor} style={{ flex: 1 }} placeholder="#6c757d" autoCapitalize="none" />
          </Row>
          <SwitchRow label="Active" value={isActive} onValueChange={setIsActive} />
        </Section>

        <Section title="Front Text">
          <Field label="Front H1" value={frontH1} onChangeText={setFrontH1} />
          <Field label="Front H2" value={frontH2} onChangeText={setFrontH2} />
          <Field label="Front H3" value={frontH3} onChangeText={setFrontH3} />
          <Field label="Front H4" value={frontH4} onChangeText={setFrontH4} />
          <Field label="Front Footer Text" value={frontFooterText} onChangeText={setFrontFooterText} />
        </Section>

        <Section title="Branding & Assets">
          <UploadField label="Front Logo URL" value={frontLogoUrl} setValue={setFrontLogoUrl} pickLabel="front_logo" onPick={pickAndUpload} />
          <UploadField label="Second Logo URL" value={secondLogoUrl} setValue={setSecondLogoUrl} pickLabel="second_logo" onPick={pickAndUpload} />
          <UploadField label="HRCI Stamp URL" value={hrciStampUrl} setValue={setHrciStampUrl} pickLabel="stamp" onPick={pickAndUpload} />
          <UploadField label="Author Sign URL" value={authorSignUrl} setValue={setAuthorSignUrl} pickLabel="author_sign" onPick={pickAndUpload} />
        </Section>

        <Section title="Addresses & Contacts">
          <Field label="Head Office Address" value={headOfficeAddress} onChangeText={setHeadOfficeAddress} multiline />
          <Field label="Regional Office Address" value={regionalOfficeAddress} onChangeText={setRegionalOfficeAddress} multiline />
          <Field label="Administration Office Address" value={administrationOfficeAddress} onChangeText={setAdministrationOfficeAddress} multiline />
          <Row>
            <Field label="Contact Number 1" value={contactNumber1} onChangeText={setContactNumber1} style={{ flex: 1 }} />
            <Field label="Contact Number 2" value={contactNumber2} onChangeText={setContactNumber2} style={{ flex: 1 }} />
          </Row>
        </Section>

        <Section title="Other">
          <Field label="Register Details" value={registerDetails} onChangeText={setRegisterDetails} multiline />
          <Field label="QR Landing Base URL" value={qrLandingBaseUrl} onChangeText={setQrLandingBaseUrl} autoCapitalize="none" placeholder="https://…" />
          <Text style={styles.label}>Terms (one per line)</Text>
          <TextInput value={termsText} onChangeText={setTermsText} style={[styles.input, { minHeight: 90 }]} multiline placeholder="Term 1\nTerm 2" placeholderTextColor="#9CA3AF" />
        </Section>

        <Pressable onPress={onSave} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]} disabled={saving || loading || !settings}>
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
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  pickTxt: { color: '#111', fontWeight: '800' },
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

function UploadField({ label, value, setValue, pickLabel, onPick }: { label: string; value: string; setValue: (v: string) => void; pickLabel: string; onPick: (label: string) => Promise<string | null> }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput value={value} onChangeText={setValue} autoCapitalize="none" placeholder="https://…" style={[styles.input, { flex: 1 }]} placeholderTextColor="#9CA3AF" />
        <Pressable style={styles.pickBtn} onPress={async () => { const url = await onPick(pickLabel); if (url) setValue(url); }}>
          <Text style={styles.pickTxt}>Pick & Upload</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SwitchRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}
