import LottieLoader from '@/components/ui/LottieLoader';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { uploadDonationStoryImages } from '@/services/api';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export type UploadImageSheetProps = {
  visible: boolean;
  onClose: () => void;
  storyId: string;
  onUploaded?: (items: any[]) => void;
};

export default function UploadImageSheet({ visible, onClose, storyId, onUploaded }: UploadImageSheetProps) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['65%'], []);

  const [caption, setCaption] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const filesRef = useRef<{ uri: string; name: string; type: string }[]>([]);

  React.useEffect(() => {
    if (visible) {
      try { modalRef.current?.present(); } catch {}
    } else {
      // On close, reset local state so the sheet is fresh next time
      setCaption('');
      setPreviews([]);
      filesRef.current = [];
      try { modalRef.current?.dismiss(); } catch {}
    }
  }, [visible]);

  const pick = async () => {
    const perm = await requestMediaPermissionsOnly();
    if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 10 } as any);
    if (res.canceled) return;
    const assets = (res.assets || []).slice(0, 10);
    const nextFiles = assets
      .filter(a => !!a?.uri)
      .map(a => ({ uri: a.uri!, name: a.fileName || 'upload.jpg', type: (a as any).mimeType || 'image/jpeg' }));
    filesRef.current = nextFiles;
    setPreviews(nextFiles.map(f => f.uri));
  };

  const removeAt = (index: number) => {
    const files = filesRef.current.slice();
    files.splice(index, 1);
    filesRef.current = files;
    setPreviews(files.map(f => f.uri));
  };

  const doUpload = async () => {
    const files = filesRef.current || [];
    if (!files.length) return;
    try {
      setUploading(true);
      const out = await uploadDonationStoryImages(storyId, files, { caption, isActive: true });
      onUploaded?.(out.data || []);
      setCaption('');
      setPreviews([]);
      filesRef.current = [];
      try { modalRef.current?.dismiss(); } catch {}
      onClose();
    } catch (e) {
      try { console.warn('[UploadImageSheet] upload failed', (e as any)?.message || e); } catch {}
    } finally {
      setUploading(false);
    }
  };

  const doCancel = () => {
    setCaption('');
    setPreviews([]);
    filesRef.current = [];
    try { modalRef.current?.dismiss(); } catch {}
    onClose();
  };

  return (
    <BottomSheetModal ref={modalRef} snapPoints={snapPoints} onDismiss={onClose} enableDismissOnClose>
      <BottomSheetView style={[styles.sheet, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.title, { color: text }]}>Add images</Text>

        <Pressable onPress={pick} style={[styles.pick, { borderColor: border }]}> 
          {previews.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {previews.slice(0, 10).map((p, i) => (
                <View key={p + i} style={{ position: 'relative' }}>
                  <Image source={{ uri: p }} style={styles.previewThumb} />
                  <Pressable onPress={() => removeAt(i)} style={styles.removeBadge} accessibilityRole="button" accessibilityLabel="Remove image">
                    <MaterialIcons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {previews.length > 10 ? (
                <View style={[styles.more, { borderColor: border }]}>
                  <Text style={{ color: muted }}>+{previews.length - 10}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: muted }}>Pick up to 10 images</Text>
          )}
        </Pressable>

        <TextInput
          placeholder="Caption (optional)"
          placeholderTextColor={muted}
          value={caption}
          onChangeText={setCaption}
          style={[styles.input, { borderColor: border, color: text }]}
        />

        {/* Bottom action bar */}
        <View style={[styles.footerBar, { borderTopColor: border, backgroundColor: card }]}> 
          <Pressable onPress={doCancel} style={[styles.btnSecondary, { borderColor: border }]}> 
            <Text style={[styles.btnText, { color: text }]}>Cancel</Text>
          </Pressable>
          <Pressable disabled={!previews.length || uploading} onPress={doUpload} style={[styles.btnPrimary, { backgroundColor: Colors.light.primary, opacity: (!previews.length || uploading) ? 0.6 : 1 }]}>
            <Text style={styles.btnTextPrimary}>{uploading ? 'Uploading…' : 'Upload'}</Text>
          </Pressable>
        </View>

        {/* Uploading overlay */}
        {uploading ? (
          <View style={styles.loaderOverlay} pointerEvents="none">
            <LottieLoader size={96} />
          </View>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: 16, borderTopWidth: 1 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  pick: { minHeight: 160, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden', padding: 10 },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  previewThumb: { width: 68, height: 68, borderRadius: 10, backgroundColor: '#eee' },
  more: { width: 68, height: 68, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  removeBadge: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  btnText: { fontWeight: '700' },
  btnSecondary: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, flex: 1, alignItems: 'center' },
  btnPrimary: { borderRadius: 12, paddingVertical: 12, flex: 1, alignItems: 'center' },
  btnTextPrimary: { fontWeight: '800', color: '#fff' },
  footerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  loaderOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
});
