import { Colors } from '@/constants/Colors';
import type { Language } from '@/constants/languages';
import { getLanguages, uploadMedia } from '@/services/api';
import { AdminAdCreate, createAdminAd } from '@/services/hrciAdmin';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// replaced by consolidated import below
import React, { useEffect, useState } from 'react';
import { Alert, Image, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NewAdScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [mediaUrl, setMediaUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [langsLoading, setLangsLoading] = useState(false);
  const [startAt, setStartAt] = useState<string>('');
  const [endAt, setEndAt] = useState<string>('');
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const openLangSheet = async () => {
    Keyboard.dismiss();
    setLangModalVisible(true);
    if (!languages.length) {
      setLangsLoading(true);
      try { const list = await getLanguages(); setLanguages(list); } finally { setLangsLoading(false); }
    }
  };
  
  useEffect(() => {
    // Prefetch languages for dropdown; do NOT preselect any by default per requirement
    (async () => {
      try {
        setLangsLoading(true);
        const list = await getLanguages();
        setLanguages(list);
      } catch {}
      finally { setLangsLoading(false); }
    })();
  }, []);

  const pickAndUpload = async (kind: 'media' | 'poster') => {
    try {
      const isVideoMedia = mediaType === 'VIDEO' && kind === 'media';
      const upType: 'image' | 'video' = isVideoMedia ? 'video' : 'image';
      let pickerResult: ImagePicker.ImagePickerResult;
      if (upType === 'image') {
        // Always open crop UI for images with 9:16 frame
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [9, 16],
          quality: 1,
          exif: true,
        });
      } else {
        // Video: no editing, but validate ratio if available
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          allowsEditing: false,
          quality: 1,
          exif: true,
        });
      }
      if (pickerResult.canceled) return;
      const asset = pickerResult.assets?.[0];
      if (!asset?.uri) return;

      if (upType === 'video') {
        const w = asset.width || 0, h = asset.height || 0;
        if (h > 0 && w > 0) {
          const ratio = w / h;
          const ok = Math.abs(ratio - 9 / 16) <= 0.03;
          if (!ok) { Alert.alert('Aspect ratio', 'Please select a 9:16 portrait video.'); return; }
        }
      }

      if (kind === 'media') setUploadingMedia(true); else setUploadingPoster(true);
      const uploaded = await uploadMedia({
        uri: asset.uri,
        type: upType,
        name: asset.fileName || `hrci-ad-${kind}-${Date.now()}.${upType === 'video' ? 'mp4' : 'jpg'}`,
        folder: 'hrci-ads',
      });
      if (kind === 'media') setMediaUrl(uploaded.url); else setPosterUrl(uploaded.url);
    } catch (e: any) {
      Alert.alert('Upload', e?.message || 'Upload failed');
    } finally {
      setUploadingMedia(false); setUploadingPoster(false);
    }
  };

  const onDateChanged = (kind: 'start'|'end') => (_: DateTimePickerEvent, date?: Date) => {
    const d = date || new Date();
    const iso = d.toISOString();
    if (kind==='start') { setStartAt(iso); setShowStart(Platform.OS==='ios'); } else { setEndAt(iso); setShowEnd(Platform.OS==='ios'); }
  };

  const fmtISODate = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toISOString().slice(0,10); } catch { return iso || ''; } };

  const onSave = async () => {
    if (!title.trim()) { Alert.alert('Create Ad', 'Title is required'); return; }
    if (!mediaUrl) { Alert.alert('Create Ad', mediaType==='VIDEO' ? 'Upload a video file' : 'Upload an image'); return; }
    if (mediaType==='VIDEO' && !posterUrl) { Alert.alert('Create Ad', 'Upload a poster image for the video'); return; }
    if (clickUrl && !/^https?:\/\//i.test(clickUrl)) { Alert.alert('Create Ad', 'Enter a valid http(s) URL'); return; }
    if (!selectedLang?.id) { Alert.alert('Create Ad', 'Please select a language'); return; }
    const payload: AdminAdCreate = {
      title: title.trim(),
      mediaType,
      mediaUrl,
      posterUrl: mediaType==='VIDEO' ? posterUrl : undefined,
      clickUrl: clickUrl.trim() || undefined,
      weight: 1,
      languageId: selectedLang.id,
      startAt: startAt || undefined,
      endAt: endAt || undefined,
    };
    setSaving(true);
    try {
      await createAdminAd(payload);
      Alert.alert('Create Ad', 'Ad created successfully', [ { text: 'OK', onPress: () => router.replace('/hrci/admin/ads' as any) } ]);
    } catch (e: any) {
      Alert.alert('Create Ad', e?.message || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(
    title.trim() &&
    mediaUrl &&
    (mediaType === 'IMAGE' || (mediaType === 'VIDEO' && posterUrl)) &&
    (!clickUrl || /^https?:\/\//i.test(clickUrl)) &&
    selectedLang?.id
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>‹</Text></Pressable>
        <Text style={styles.titleTop}>New Ad</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Section>
          <Field label="Title*" value={title} onChangeText={setTitle} placeholder="Summer sale…" />
        </Section>

        <Section>
          <Text style={styles.label}>Media type*</Text>
          <View style={styles.segment}>
            {(['IMAGE','VIDEO'] as const).map((t) => (
              <Pressable key={t} onPress={() => { setMediaType(t); Keyboard.dismiss(); }} style={[styles.segmentBtn, mediaType===t && styles.segmentActive]}>
                <Text style={[styles.segmentTxt, mediaType===t && styles.segmentTxtActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section>
          <Text style={styles.label}>{mediaType==='VIDEO' ? 'Video (9:16)*' : 'Image (9:16)*'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.mediaBox}>{mediaUrl ? <Image source={{ uri: mediaUrl }} style={{ width: '100%', height: '100%', borderRadius: 8 }} /> : <View style={styles.mediaPlaceholder} />}</View>
            <Pressable style={styles.pickBtn} onPress={() => pickAndUpload('media')} disabled={uploadingMedia}><Text style={styles.pickTxt}>{uploadingMedia ? 'Uploading…' : 'Pick & Upload'}</Text></Pressable>
          </View>
        </Section>

        {mediaType==='VIDEO' && (
          <Section>
            <Text style={styles.label}>Poster (9:16)*</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.mediaBox}>{posterUrl ? <Image source={{ uri: posterUrl }} style={{ width: '100%', height: '100%', borderRadius: 8 }} /> : <View style={styles.mediaPlaceholder} />}</View>
              <Pressable style={styles.pickBtn} onPress={() => pickAndUpload('poster')} disabled={uploadingPoster}><Text style={styles.pickTxt}>{uploadingPoster ? 'Uploading…' : 'Pick & Upload'}</Text></Pressable>
            </View>
          </Section>
        )}

        <Section>
          <Field label="Click URL (optional)" value={clickUrl} onChangeText={setClickUrl} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        </Section>

        <Section>
          <Pressable onPress={openLangSheet} style={styles.langSelectCard}>
            <Text style={styles.langSelectTitle}>Language*</Text>
            <Text style={[styles.langSelectValue, !selectedLang && styles.langSelectPlaceholder]}>
              {selectedLang
                ? `${selectedLang.nativeName || selectedLang.name}${selectedLang.code ? ` (${String(selectedLang.code).toUpperCase()})` : ''}`
                : (langsLoading ? 'Loading…' : 'Select language')}
            </Text>
          </Pressable>
          {!selectedLang?.id ? (
            <Text style={styles.hintError}>Required</Text>
          ) : null}
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

      </ScrollView>
      {/* Fixed bottom footer button */}
      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable onPress={onSave} style={({ pressed }) => [styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled, pressed && { opacity: 0.9 }]} disabled={saving || !canSave}>
          <Text style={styles.saveTxt}>{saving ? 'Creating…' : 'Create Ad'}</Text>
        </Pressable>
      </View>
      {/* Language Fullscreen Modal (bottom-sheet style) */}
      <Modal visible={langModalVisible} animationType="slide" transparent onRequestClose={() => setLangModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 8 + insets.bottom }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.langHeader}>Select Language</Text>
            {langsLoading ? (
              <View style={{ padding: 16 }}><Text style={{ color: '#64748b' }}>Loading…</Text></View>
            ) : (
              <ScrollView contentContainerStyle={styles.langList}>
                {languages.map((l) => (
                  <LangItem
                    key={String(l.id)}
                    item={l}
                    selectedId={selectedLang?.id}
                    onSelect={(lang) => { setSelectedLang(lang); setLangModalVisible(false); }}
                  />
                ))}
              </ScrollView>
            )}
            <Pressable onPress={() => setLangModalVisible(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  titleTop: { color: Colors.light.primary, fontWeight: '900' },
  section: { borderWidth: 1, borderColor: '#e6eef7', borderRadius: 14, padding: 14, backgroundColor: '#fff', elevation: 1 },
  sectionTitle: { color: '#0f172a', fontWeight: '900', marginBottom: 8 },
  label: { color: '#111', fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#111', backgroundColor: '#fff' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  pickTxt: { color: '#111', fontWeight: '800' },
  mediaBox: { width: 90, height: 160, borderRadius: 8, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  mediaPlaceholder: { flex: 1, backgroundColor: '#e5e7eb' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', backgroundColor: '#fff' },
  segmentActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  segmentTxt: { color: '#0f172a', fontWeight: '800' },
  segmentTxtActive: { color: '#fff' },
  saveBtn: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', elevation: 1 },
  saveBtnDisabled: { backgroundColor: '#cbd5e1' },
  saveTxt: { color: '#fff', fontWeight: '800' },
  hintError: { color: '#ef4444', marginTop: 6, fontWeight: '600' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  dropdown: { marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  langHeader: { paddingHorizontal: 16, paddingVertical: 8, color: '#0f172a', fontWeight: '900' },
  langList: { paddingBottom: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 8 },
  langCard: { width: '48%', marginVertical: 6, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  langCardActive: { borderColor: Colors.light.primary, backgroundColor: '#f8fafc' },
  langSelectCard: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' },
  langSelectTitle: { color: '#111', fontWeight: '800', marginBottom: 6 },
  langSelectValue: { color: '#0f172a', fontWeight: '900' },
  langSelectPlaceholder: { color: '#9CA3AF', fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, maxHeight: '85%' },
  modalHandle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: '#e5e7eb', marginBottom: 6 },
  modalCloseBtn: { alignSelf: 'center', marginTop: 8, marginBottom: 4, paddingVertical: 10, paddingHorizontal: 16 },
  modalCloseTxt: { color: '#64748b', fontWeight: '800' },
});

// BottomSheet backdrop replaced by Modal approach

function LangItem({ item, onSelect, selectedId }: { item: Language; onSelect: (l: Language) => void; selectedId?: string | null }) {
  const active = selectedId && String(selectedId) === String(item.id);
  return (
    <Pressable onPress={() => onSelect(item)} style={({ pressed }) => [styles.langCard, active && styles.langCardActive, pressed && { opacity: 0.95 }]}>
      <Text style={{ color: '#0f172a', fontWeight: '900' }}>
        {item.nativeName || item.name}
        {item.code ? ` (${String(item.code).toUpperCase()})` : ''}
      </Text>
      {active ? <Text style={{ color: Colors.light.primary, fontWeight: '900' }}>✓</Text> : <Text style={{ color: '#cbd5e1' }}>○</Text>}
    </Pressable>
  );
}

