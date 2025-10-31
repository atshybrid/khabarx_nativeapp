import { Colors } from '@/constants/Colors';
import { MembershipDiscount, cancelAdminDiscount, getAdminDiscount, updateAdminDiscount } from '@/services/hrciAdmin';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DiscountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<MembershipDiscount | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Editable fields
  const [percentOff, setPercentOff] = useState<string>('');
  const [amountOff, setAmountOff] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [maxRedemptions, setMaxRedemptions] = useState<string>('');
  const [activeFrom, setActiveFrom] = useState<string>('');
  const [activeTo, setActiveTo] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getAdminDiscount(String(id));
        setItem(data);
        setPercentOff(data?.percentOff != null ? String(data.percentOff) : '');
        setAmountOff(data?.amountOff != null ? String(data.amountOff) : '');
        setCurrency(data?.currency || 'INR');
        setMaxRedemptions(data?.maxRedemptions != null ? String(data.maxRedemptions) : '');
        setActiveFrom(data?.activeFrom || '');
        setActiveTo(data?.activeTo || '');
        setStatus(data?.status || '');
        setReason(data?.reason || '');
      } catch (e: any) {
        Alert.alert('Discount', e?.message || 'Failed to load');
      } finally {
        // no-op
      }
    })();
  }, [id]);

  const fmtISODate = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toISOString().slice(0,10); } catch { return iso || ''; } };
  const onDateChanged = (kind: 'from'|'to') => (_: DateTimePickerEvent, date?: Date) => {
    const d = date || new Date();
    const iso = d.toISOString();
    if (kind==='from') { setActiveFrom(iso); setShowFromPicker(Platform.OS==='ios'); } else { setActiveTo(iso); setShowToPicker(Platform.OS==='ios'); }
  };

  const onSave = async () => {
    const pct = percentOff.trim() ? Number(percentOff) : undefined;
    const amt = amountOff.trim() ? Number(amountOff) : undefined;
    const max = maxRedemptions.trim() ? Number(maxRedemptions) : undefined;
    setSaving(true);
    try {
      const updated = await updateAdminDiscount(String(id), {
        percentOff: isFinite(pct as any) ? pct! : undefined,
        amountOff: isFinite(amt as any) ? amt! : undefined,
        currency: currency.trim() || undefined,
        maxRedemptions: isFinite(max as any) ? max! : undefined,
        activeFrom: activeFrom || undefined,
        activeTo: activeTo || undefined,
        status: status.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      setItem(updated);
      Alert.alert('Discount', 'Saved');
    } catch (e: any) {
      Alert.alert('Discount', e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const onCancel = async () => {
    Alert.alert('Cancel Discount', 'Are you sure you want to cancel this discount?', [
      { text: 'No' },
      { text: 'Yes, cancel', style: 'destructive', onPress: async () => {
        try {
          const res = await cancelAdminDiscount(String(id));
          setItem(res);
          setStatus(res.status || 'CANCELLED');
          Alert.alert('Discount', 'Cancelled');
        } catch (e: any) {
          Alert.alert('Discount', e?.message || 'Failed to cancel');
        }
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>‹</Text></Pressable>
        <Text style={styles.title}>Discount</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        <Section title="Summary">
          <Row>
            <KV label="Mobile" value={item?.mobileNumber || '—'} />
            <KV label="Code" value={item?.code || '—'} />
          </Row>
          <Row>
            <KV label="Status" value={item?.status || '—'} />
            <KV label="Redeemed" value={`${item?.redeemedCount ?? 0}/${item?.maxRedemptions ?? '∞'}`} />
          </Row>
        </Section>

        <Section title="Edit">
          <Row>
            <Field label="Percent Off" value={percentOff} onChangeText={setPercentOff} keyboardType="numeric" style={{ flex: 1 }} />
            <Field label="Amount Off" value={amountOff} onChangeText={setAmountOff} keyboardType="numeric" style={{ flex: 1 }} />
          </Row>
          <Row>
            <Field label="Currency" value={currency} onChangeText={setCurrency} style={{ flex: 1 }} />
            <Field label="Max Redemptions" value={maxRedemptions} onChangeText={setMaxRedemptions} keyboardType="numeric" style={{ flex: 1 }} />
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Active From</Text>
              <View style={styles.inputRow}>
                <TextInput value={fmtISODate(activeFrom)} onChangeText={setActiveFrom} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" style={[styles.input, { flex: 1 }]} />
                <Pressable onPress={() => setShowFromPicker(true)} style={styles.pickBtn}><Text style={styles.pickTxt}>Pick</Text></Pressable>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Active To</Text>
              <View style={styles.inputRow}>
                <TextInput value={fmtISODate(activeTo)} onChangeText={setActiveTo} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" style={[styles.input, { flex: 1 }]} />
                <Pressable onPress={() => setShowToPicker(true)} style={styles.pickBtn}><Text style={styles.pickTxt}>Pick</Text></Pressable>
              </View>
            </View>
          </Row>
          {showFromPicker && (
            <DateTimePicker value={activeFrom ? new Date(activeFrom) : new Date()} mode="date" display="default" onChange={onDateChanged('from')} />
          )}
          {showToPicker && (
            <DateTimePicker value={activeTo ? new Date(activeTo) : new Date()} mode="date" display="default" onChange={onDateChanged('to')} />
          )}
          <Field label="Status" value={status} onChangeText={setStatus} />
          <Field label="Reason" value={reason} onChangeText={setReason} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={onSave} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]} disabled={saving}><Text style={styles.saveTxt}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.9 }]}><Text style={styles.cancelTxt}>Cancel Discount</Text></Pressable>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

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

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

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
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111' },
  kvLabel: { color: '#64748b', fontWeight: '700' },
  kvValue: { color: '#0f172a', fontWeight: '900' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  pickTxt: { color: '#111', fontWeight: '800' },
  saveBtn: { backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '800' },
  cancelBtn: { borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  cancelTxt: { color: '#b91c1c', fontWeight: '800' },
});
