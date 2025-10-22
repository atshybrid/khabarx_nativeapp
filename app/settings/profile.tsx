import { Loader } from '@/components/ui/Loader';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { updateUserProfile, uploadMedia } from '@/services/api';
import { loadTokens, saveTokens } from '@/services/auth';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await loadTokens();
      const n = t?.user?.fullName || t?.user?.name || '';
      const r = t?.user?.role || '';
      setName(n);
      setRole(r);
      try {
        const saved = await (await import('@react-native-async-storage/async-storage')).default.getItem('profile_photo_url');
        if (saved) setPhotoUrl(saved);
      } catch {}
    })();
  }, []);

  const onChangePhoto = useCallback(async () => {
    try {
      setUploading(true);
      const perm = await requestMediaPermissionsOnly();
      if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') {
        setUploading(false);
        Alert.alert('Permission needed', 'Please allow photo access to change your picture.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.8 });
      if (res.canceled) { setUploading(false); return; }
      const asset = res.assets?.[0];
      if (!asset?.uri) { setUploading(false); return; }
      const uploaded = await uploadMedia({ uri: asset.uri, type: 'image', name: asset.fileName || 'avatar.jpg', folder: 'avatars' });
      await updateUserProfile({ profilePhotoUrl: uploaded.url });
      setPhotoUrl(uploaded.url);
      try { (await import('@react-native-async-storage/async-storage')).default.setItem('profile_photo_url', uploaded.url); } catch {}
      // Update cached tokens so other screens reflect immediately
      try {
        const t = await loadTokens();
        if (t?.user) { await saveTokens({ ...t, user: { ...t.user, profilePhotoUrl: uploaded.url } } as any); }
      } catch {}
      Alert.alert('Updated', 'Profile photo updated');
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update profile photo');
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <View style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Simple App Bar */}
      <View style={[styles.appBar, { borderBottomColor: theme.border }]}>
        <Text style={[styles.appTitle, { color: theme.text }]}>Profile</Text>
        <Pressable style={[styles.editBtn, { backgroundColor: theme.secondary }]} onPress={() => { /* TODO: open editor modal */ }}>
          <Feather name="edit-3" size={18} color="#fff" />
          <Text style={styles.editTxt}>Edit</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { alignItems: 'center', backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable onPress={onChangePhoto} disabled={uploading} accessibilityLabel="Change profile photo">
            <View style={styles.avatarLg}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarInitial, { color: theme.primary }]}>{(name || 'U').charAt(0).toUpperCase()}</Text>
              )}
              {uploading ? (
                <View style={styles.avatarOverlay}>
                  <Loader size={24} />
                </View>
              ) : null}
            </View>
          </Pressable>
          <Text style={{ marginTop: 8, color: theme.muted }}>Tap to change photo</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.muted }]}>Full name</Text>
          <Text style={[styles.value, { color: theme.text }]}>{name || '—'}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.muted }]}>Role</Text>
          <Text style={[styles.value, { color: theme.text }]}>{role || '—'}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  appBar: { height: 52, borderBottomWidth: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  appTitle: { fontSize: 18, fontWeight: '800' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  editTxt: { color: '#fff', fontWeight: '800' },
  content: { padding: 12, gap: 12 },
  card: { borderRadius: 14, padding: 12, borderWidth: 1 },
  label: { fontWeight: '800', fontSize: 12 },
  value: { marginTop: 4, fontSize: 16, fontWeight: '700' },
  avatarLg: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarInitial: { fontWeight: '800', fontSize: 36 },
  avatarOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 48 },
});
