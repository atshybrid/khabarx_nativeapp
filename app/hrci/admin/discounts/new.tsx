import { Colors } from '@/constants/Colors';
import { DiscountCreate, createAdminDiscount } from '@/services/hrciAdmin';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NewDiscountScreen() {
  const insets = useSafeAreaInsets();
  const [mobileNumber, setMobileNumber] = useState('');
  const [percentOff, setPercentOff] = useState<string>('');
  const [activeTo, setActiveTo] = useState<string>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const mobileValid = mobileNumber.length === 10;
  const pctNum = percentOff.trim() ? Number(percentOff) : NaN;
  const pctValid = Number.isFinite(pctNum) && pctNum >= 1 && pctNum <= 99;

  const fmtISODate = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toISOString().slice(0,10); } catch { return iso || ''; } };
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, (e) => {
      const h = e?.endCoordinates?.height ?? 0;
      setKbHeight(h);
    });
    const subHide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { subShow.remove(); subHide.remove(); };
  }, []);
  const onExpireChanged = (_: DateTimePickerEvent, date?: Date) => {
    const d = date || new Date();
    const iso = d.toISOString();
    setActiveTo(iso);
    setShowToPicker(Platform.OS==='ios');
  };

  const onSave = async () => {
  const pct = percentOff.trim() ? Number(percentOff) : undefined;
    const mobile = mobileNumber.trim();
    // Validate required fields
    if (!mobile) {
      Alert.alert('Create Discount', 'Mobile Number is required.');
      return;
    }
    if (!/^[0-9]{10,}$/.test(mobile)) {
      Alert.alert('Create Discount', 'Enter a valid mobile number.');
      return;
    }
    if (!pct || !isFinite(pct) || pct <= 0 || pct > 99) {
      Alert.alert('Create Discount', 'Enter a valid Discount percentage between 1 and 99.');
      return;
    }
    const payload: DiscountCreate = {
      mobileNumber: mobile,
      // Code/currency/amountOff not used in this flow
      percentOff: isFinite(pct as any) ? pct! : undefined,
      amountOff: undefined,
      currency: undefined,
  maxRedemptions: 1,
      activeFrom: new Date().toISOString(),
      activeTo: activeTo || undefined,
      status: undefined,
      reason: reason.trim() || undefined,
    };
    setSaving(true);
    try {
      await createAdminDiscount(payload);
      Alert.alert('Create Discount', 'Discount created successfully', [
        { text: 'OK', onPress: () => router.replace('/hrci/admin/discounts' as any) }
      ]);
    } catch (e: any) {
      Alert.alert('Create Discount', e?.message || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>‹</Text></Pressable>
        <Text style={styles.title}>New Discount</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 140 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios' ? 'interactive' : 'on-drag'}>
        <Section>
          <Field
            label="Mobile Number*"
            value={mobileNumber}
            onChangeText={(t) => {
              const d = t.replace(/\D/g, '');
              const clipped = d.slice(0, 10);
              setMobileNumber(clipped);
              if (clipped.length === 10) Keyboard.dismiss();
            }}
            keyboardType="phone-pad"
            placeholder="e.g., 9502337779"
            style={!mobileValid && mobileNumber.length > 0 ? { borderColor: '#fca5a5' } : undefined}
          />
          {!mobileValid && mobileNumber.length > 0 && (
            <Text style={styles.errorText}>Enter exactly 10 digits</Text>
          )}
        </Section>

        <Section>
          <Field
            label="Discount percentage*"
            value={percentOff}
            onChangeText={(t) => {
              // Keep only digits, clamp to 99
              const d = t.replace(/[^0-9]/g, '');
              if (!d) { setPercentOff(''); return; }
              const n = Math.max(0, Math.min(99, parseInt(d, 10)));
              setPercentOff(String(n));
              if (d.length >= 2) Keyboard.dismiss();
            }}
            keyboardType="numeric"
            placeholder="e.g., 10"
            maxLength={2}
          />
        </Section>

        

        <Section>
          <Text style={styles.label}>Expire on</Text>
          <Pressable onPress={() => setShowToPicker(true)} style={[styles.inputRow, { alignItems: 'stretch' }]}> 
            <View style={[styles.input, { flex: 1, justifyContent: 'center' }]}>
              <Text style={{ color: activeTo ? '#111' : '#9CA3AF' }}>{fmtISODate(activeTo) || 'YYYY-MM-DD'}</Text>
            </View>
            <View style={styles.pickBtn}><Feather name="calendar" size={16} color="#0f172a" /></View>
          </Pressable>
          {showToPicker && (
            <DateTimePicker value={activeTo ? new Date(activeTo) : new Date()} mode="date" display="default" onChange={onExpireChanged} />
          )}
        </Section>

        <Section>
          <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Short description (optional)" />
        </Section>
      </ScrollView>
      
      {/* Sticky bottom action bar (safe-area aware, moves above keyboard) */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomBar as any, { bottom: Math.max(insets.bottom, kbHeight) }]}>
        <Pressable onPress={onSave} style={({ pressed }) => [styles.saveBtn, (!mobileValid || !pctValid) && styles.saveBtnDisabled, pressed && { opacity: 0.9 }]} disabled={saving || !mobileValid || !pctValid}>
          <Text style={styles.saveTxt}>{saving ? 'Creating…' : 'Create Discount'}</Text>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {!!title && <Text style={styles.sectionTitle}>{title}</Text>}
      {children}
    </View>
  );
}

// Row removed in simplified one-input-per-section layout

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };
function Field({ label, style, ...rest }: FieldProps) {
  return (
    <View style={{ marginBottom: 10, flex: (style as any)?.flex ? (style as any).flex : undefined }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...rest} style={[styles.input, style]} placeholderTextColor="#9CA3AF" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  title: { color: Colors.light.primary, fontWeight: '900' },
  section: { borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  sectionTitle: { color: '#0f172a', fontWeight: '900', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  label: { color: '#111', fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#111', backgroundColor: '#fff' },
  errorText: { color: '#ef4444', marginTop: 4, fontSize: 12, fontWeight: '700' },
  smallHelp: { color: '#6b7280', marginTop: 6, fontSize: 12 },
  saveBtn: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', elevation: 1 },
  saveBtnDisabled: { backgroundColor: '#94a3b8' },
  bottomBar: { position: 'absolute', left: 0, right: 0, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  saveTxt: { color: '#fff', fontWeight: '800' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  pickTxt: { color: '#111', fontWeight: '800' },
});
