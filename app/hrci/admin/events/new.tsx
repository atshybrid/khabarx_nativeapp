import { Colors } from '@/constants/Colors';
import { uploadMedia } from '@/services/api';
import { createDonationEvent, DonationEventCreate } from '@/services/hrciAdmin';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewDonationEventScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [presetsText, setPresetsText] = useState('100,500,1000');
  const [startAt, setStartAt] = useState<string>('');
  const [endAt, setEndAt] = useState<string>('');
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickCover = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setUploading(true);
      const uploaded = await uploadMedia({ uri: asset.uri, type: 'image', name: asset.fileName || `event_cover_${Date.now()}.jpg`, folder: 'hrci-events' });
      setCoverUrl(uploaded.url);
    } catch (e: any) {
      Alert.alert('Upload', e?.message || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const onDateChanged = (kind: 'start'|'end') => (_: DateTimePickerEvent, date?: Date) => {
    const d = date || new Date();
    const iso = d.toISOString();
    if (kind==='start') { setStartAt(iso); setShowStart(Platform.OS==='ios'); } else { setEndAt(iso); setShowEnd(Platform.OS==='ios'); }
  };
  const fmtISODate = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toISOString().slice(0,10); } catch { return iso || ''; } };

  const canSave = Boolean(title.trim() && coverUrl && currency.trim());

  const onSave = async () => {
    if (!title.trim()) { Alert.alert('Event', 'Title is required'); return; }
    if (!coverUrl) { Alert.alert('Event', 'Upload a cover image'); return; }
    const ga = goalAmount.trim() ? Number(goalAmount) : 0;
    if (isNaN(ga) || ga < 0) { Alert.alert('Event', 'Enter a valid goal amount'); return; }
    const presets = presetsText.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);

    const payload: DonationEventCreate = {
      title: title.trim(),
      description: description.trim() || undefined,
      coverImageUrl: coverUrl,
      goalAmount: ga,
      currency: currency.trim() || 'INR',
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      status: 'ACTIVE',
      presets,
      allowCustom: true,
    };

    setSaving(true);
    try {
      await createDonationEvent(payload);
      Alert.alert('Event', 'Event created', [{ text: 'OK', onPress: () => router.replace('/hrci/admin/events' as any) }]);
    } catch (e: any) {
      Alert.alert('Event', e?.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>‹</Text></Pressable>
        <Text style={styles.titleTop}>New Event</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 100 }}>
        <Section>
          <Field label="Title*" value={title} onChangeText={setTitle} placeholder="Medical Aid…" />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Short description" multiline numberOfLines={3} style={{ height: 100, textAlignVertical: 'top' }} />
        </Section>

        <Section>
          <Text style={styles.label}>Cover (16:9)*</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.coverBox}>{coverUrl ? <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%', borderRadius: 8 }} /> : <View style={styles.coverPh} />}</View>
            <Pressable onPress={pickCover} disabled={uploading} style={styles.pickBtn}><Text style={styles.pickTxt}>{uploading ? 'Uploading…' : 'Pick & Upload'}</Text></Pressable>
          </View>
        </Section>

        <Section>
          <Field label="Goal Amount" value={goalAmount} onChangeText={setGoalAmount} placeholder="e.g., 500000" keyboardType="numeric" />
          <Field label="Currency" value={currency} onChangeText={setCurrency} placeholder="INR" autoCapitalize="characters" />
        </Section>

        <Section>
          <Text style={styles.label}>Active window</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => setShowStart(true)} style={[styles.input, { flex: 1, justifyContent: 'center' }]}>
              <Text style={{ color: startAt ? '#111' : '#9CA3AF' }}>{fmtISODate(startAt) || 'Start date'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowEnd(true)} style={[styles.input, { flex: 1, justifyContent: 'center' }]}>
              <Text style={{ color: endAt ? '#111' : '#9CA3AF' }}>{fmtISODate(endAt) || 'End date'}</Text>
            </Pressable>
          </View>
          {showStart && <DateTimePicker value={startAt ? new Date(startAt) : new Date()} mode="date" display="default" onChange={onDateChanged('start')} />}
          {showEnd && <DateTimePicker value={endAt ? new Date(endAt) : new Date()} mode="date" display="default" onChange={onDateChanged('end')} />}
        </Section>

        <Section>
          <Field label="Presets (comma-separated)" value={presetsText} onChangeText={setPresetsText} placeholder="100,500,1000" autoCapitalize="none" />
          <Text style={styles.hint}>Allow custom is enabled by default.</Text>
        </Section>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onSave} style={({ pressed }) => [styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled, pressed && { opacity: 0.9 }]} disabled={saving || !canSave}>
          <Text style={styles.saveTxt}>{saving ? 'Creating…' : 'Create Event'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };
function Field({ label, style, ...rest }: FieldProps) {
  return (
    <View style={{ marginBottom: 10 }}>
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
  titleTop: { color: Colors.light.primary, fontWeight: '900' },
  section: { borderWidth: 1, borderColor: '#e6eef7', borderRadius: 14, padding: 14, backgroundColor: '#fff', elevation: 1 },
  label: { color: '#111', fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#111', backgroundColor: '#fff' },
  coverBox: { width: 160, height: 90, borderRadius: 8, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  coverPh: { flex: 1, backgroundColor: '#e5e7eb' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  pickTxt: { color: '#111', fontWeight: '800' },
  hint: { color: '#64748b', fontStyle: 'italic' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  saveBtn: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', elevation: 1 },
  saveBtnDisabled: { backgroundColor: '#cbd5e1' },
  saveTxt: { color: '#fff', fontWeight: '800' },
});
