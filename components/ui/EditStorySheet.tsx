import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { updateDonationStory, uploadMedia, type DonationStoryDetail } from '@/services/api';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type EditStorySheetProps = {
  visible: boolean;
  story: DonationStoryDetail | null;
  onClose: () => void;
  onUpdated?: (story: DonationStoryDetail) => void;
};

export default function EditStorySheet({ visible, story, onClose, onUpdated }: EditStorySheetProps) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const modalRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<any>(null);
  const snapPoints = useMemo(() => ['100%'], []);
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  React.useEffect(() => {
    if (visible) {
      try { modalRef.current?.present(); } catch {}
      // Seed fields from story
      if (story) {
        setTitle(story.title || '');
        setDescription(story.description || '');
        setIsActive(Boolean(story.isActive ?? true));
        setHeroPreview(story.heroImageUrl || null);
        setHeroUrl(story.heroImageUrl || null);
      }
      setTimeout(() => { try { scrollRef.current?.scrollTo?.({ y: 0, animated: false }); } catch {} }, 30);
    } else {
      try { modalRef.current?.dismiss(); } catch {}
    }
  }, [visible, story]);

  const pickHero = async () => {
    const perm = await requestMediaPermissionsOnly();
    if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled) return;
    const a = res.assets?.[0];
    if (a?.uri) {
      setHeroPreview(a.uri);
      try {
        setUploading(true);
        const out = await uploadMedia({ uri: a.uri, type: 'image', name: a.fileName || 'hero.jpg', folder: 'stories' });
        setHeroUrl(out.url);
      } catch (e) {
        try { console.warn('[EditStorySheet] hero upload failed', (e as any)?.message || e); } catch {}
      } finally {
        setUploading(false);
      }
    }
  };

  const doSave = async () => {
    if (!story) return;
    setTouched(true);
    if (!title.trim()) return;
    try {
      setSaving(true);
      const updated = await updateDonationStory(story.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        heroImageUrl: heroUrl || undefined,
        isActive,
      });
      onUpdated?.(updated);
      onClose();
    } catch (e) {
      try { console.warn('[EditStorySheet] update failed', (e as any)?.message || e); } catch {}
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!title.trim() && !saving && !uploading;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      enableDismissOnClose
      enablePanDownToClose
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      bottomInset={bottomSafe}
    >
      <BottomSheetView style={[styles.sheet, { backgroundColor: card, borderColor: border }]}>
        <BottomSheetScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 180 + bottomSafe }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.containerMax}>
            <Text style={[styles.title, { color: text }]}>Edit story</Text>

            <BottomSheetTextInput
              placeholder="Title (required)"
              placeholderTextColor={muted}
              value={title}
              onChangeText={setTitle}
              onBlur={() => setTouched(true)}
              style={[styles.input, { borderColor: border, color: text }]}
              returnKeyType="next"
              autoCapitalize="sentences"
            />
            {touched && !title.trim() ? <Text style={styles.validation}>Title is required</Text> : null}

            <BottomSheetTextInput
              placeholder="Description (optional)"
              placeholderTextColor={muted}
              value={description}
              onChangeText={setDescription}
              style={[styles.input, { borderColor: border, color: text, minHeight: 96, textAlignVertical: 'top' }]}
              multiline
              returnKeyType="done"
              autoCapitalize="sentences"
            />

            <Pressable onPress={pickHero} style={[styles.pick, { borderColor: border, borderStyle: 'dashed' }]} accessibilityRole="button" accessibilityLabel="Pick hero image">
              {heroPreview ? (
                <Image source={{ uri: heroPreview }} style={styles.preview} />
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="image" size={24} color={muted} />
                  <Text style={{ color: muted, marginTop: 6 }}>{uploading ? 'Uploading…' : 'Pick hero image'}</Text>
                </View>
              )}
            </Pressable>
            {heroUrl ? <Text style={{ color: muted, marginBottom: 8 }} numberOfLines={1}>Hero: {heroUrl}</Text> : null}

            <View style={[styles.row, { justifyContent: 'space-between', marginTop: 4 }]}> 
              <Text style={{ color: text, fontWeight: '600' }}>Active</Text>
              <Switch value={isActive} onValueChange={setIsActive} thumbColor={isActive ? Colors.light.primary : undefined} />
            </View>

            <View style={{ height: 1 }} />
          </View>
        </BottomSheetScrollView>
        <View style={[styles.footerBar, { paddingBottom: bottomSafe + 16, backgroundColor: card, borderTopColor: border }]}> 
          <Pressable onPress={onClose} style={[styles.btnSecondary, { borderColor: border }]}>
            <Text style={[styles.btnText, { color: text }]}>Cancel</Text>
          </Pressable>
          <Pressable disabled={!canSave} onPress={doSave} style={[styles.btnPrimary, { backgroundColor: Colors.light.primary, opacity: canSave ? 1 : 0.6 }]}>
            <Text style={[styles.btnTextPrimary]}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: 16, borderTopWidth: 1 },
  containerMax: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  pick: { height: 150, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnSecondary: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flex: 1, alignItems: 'center' },
  btnPrimary: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flex: 1, alignItems: 'center' },
  btnText: { fontWeight: '700' },
  btnTextPrimary: { fontWeight: '800', color: '#fff' },
  footerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  validation: { color: '#ef4444', marginTop: -8, marginBottom: 8, fontSize: 12, fontWeight: '600' },
});
