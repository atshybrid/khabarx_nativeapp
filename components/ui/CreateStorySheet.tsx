import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { createDonationStory, uploadMedia, type DonationStoryDetail } from '@/services/api';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type CreateStorySheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (story: DonationStoryDetail) => void;
};

export default function CreateStorySheet({ visible, onClose, onCreated }: CreateStorySheetProps) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const modalRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<any>(null);
  const snapPoints = useMemo(() => ['100%'], []);
  const insets = useSafeAreaInsets();
  // Ensure generous space for gesture area on Android and iOS home indicator
  const bottomSafe = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [touched, setTouched] = useState(false);

  React.useEffect(() => {
    if (visible) {
      try {
        modalRef.current?.present();
        // Ensure content starts at top when opening
        setTimeout(() => { try { scrollRef.current?.scrollTo?.({ y: 0, animated: false }); } catch {} }, 30);
      } catch {}
    } else {
      try { modalRef.current?.dismiss(); } catch {}
    }
  }, [visible]);

  const pickHero = async () => {
    const perm = await requestMediaPermissionsOnly();
    if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') return;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled) return;
    const a = res.assets?.[0];
    if (a?.uri) {
      setHeroPreview(a.uri);
      // Upload immediately to get a URL
      try {
        setUploading(true);
        const out = await uploadMedia({ uri: a.uri, type: 'image', name: a.fileName || 'hero.jpg', folder: 'stories' });
        setHeroUrl(out.url);
      } catch (e) {
        try { console.warn('[CreateStorySheet] hero upload failed', (e as any)?.message || e); } catch {}
        setHeroUrl(null);
      } finally {
        setUploading(false);
      }
    }
  };

  const reset = () => {
    setTitle('');
    setDescription('');
    setHeroPreview(null);
    setHeroUrl(null);
  };

  const doCreate = async () => {
    setTouched(true);
    if (!title.trim()) return;
    try {
      setCreating(true);
      const story = await createDonationStory({ title: title.trim(), description: description.trim() || undefined, heroImageUrl: heroUrl || undefined, isActive: true });
      onCreated?.(story);
      reset();
      onClose();
    } catch (e) {
      try { console.warn('[CreateStorySheet] create failed', (e as any)?.message || e); } catch {}
    } finally {
      setCreating(false);
    }
  };

  const canCreate = !!title.trim() && !creating && !uploading;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      enableDismissOnClose
      enablePanDownToClose
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      // Add a bottom inset so the modal content doesn't feel cramped near system bar
      bottomInset={bottomSafe}
    >
      <BottomSheetView style={[styles.sheet, { backgroundColor: card, borderColor: border }]}>
        <BottomSheetScrollView
          ref={scrollRef}
          // Extra bottom padding so content never collides with the fixed footer bar
          contentContainerStyle={{ paddingBottom: 180 + bottomSafe }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.containerMax}>
            <Text style={[styles.title, { color: text }]}>Create story</Text>

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
                <Text style={{ color: muted, marginTop: 6 }}>{uploading ? 'Uploading…' : 'Pick hero image (optional)'}</Text>
              </View>
            )}
          </Pressable>
          {heroUrl ? <Text style={{ color: muted, marginBottom: 8 }} numberOfLines={1}>Uploaded: {heroUrl}</Text> : null}

          <View style={{ height: 1 }} />
          </View>
        </BottomSheetScrollView>
  <View style={[styles.footerBar, { paddingBottom: bottomSafe + 16, backgroundColor: card, borderTopColor: border }]}> 
          <Pressable onPress={() => { reset(); onClose(); }} style={[styles.btnSecondary, { borderColor: border }]}>
            <Text style={[styles.btnText, { color: text }]}>Cancel</Text>
          </Pressable>
          <Pressable disabled={!canCreate} onPress={doCreate} style={[styles.btnPrimary, { backgroundColor: Colors.light.primary, opacity: canCreate ? 1 : 0.6 }]}>
            <Text style={[styles.btnTextPrimary]}>{creating ? 'Creating…' : 'Create'}</Text>
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
