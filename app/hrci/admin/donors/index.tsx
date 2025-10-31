import LottieLoader from '@/components/ui/LottieLoader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { uploadMedia } from '@/services/api';
import { getTopDonors, TopDonor, updateDonorPhoto } from '@/services/hrciDonations';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminDonorWallScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [donors, setDonors] = useState<TopDonor[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<TopDonor | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const list = await getTopDonors(50);
      setDonors(list || []);
    } catch (e: any) {
      Alert.alert('Donors', e?.message || 'Failed to load donors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };

  const pickAndUpload = async (d: TopDonor) => {
    try {
      // Ask for media library permission if not granted
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission', 'Please allow Photos permission to select an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.9 });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      // Upload image first while sheet is open
      setBusyKey(d.key);
      const uploaded = await uploadMedia({ uri: asset.uri, type: 'image', name: `donor_${Date.now()}.jpg`, folder: 'donors' });
      const url = uploaded.url;
      setUploadedUrl(url);
      setApiError(null);
    } catch (e: any) {
      Alert.alert('Upload', e?.message || 'Failed to update donor photo');
    } finally {
      setBusyKey(null);
    }
  };

  const submitUpdate = async () => {
    const d = sheetFor;
    if (!d || !uploadedUrl) return;
    try {
      setApiLoading(true);
      setApiError(null);
      const donationId = (d as any).latestDonationId as string | undefined;
      if (!donationId) throw new Error('Missing latestDonationId for this donor');
      const ok = await updateDonorPhoto(donationId, uploadedUrl);
      if (ok) {
        setDonors(prev => prev.map(x => x.key === d.key ? { ...x, photoUrl: uploadedUrl } : x));
        setSheetFor(null);
        setUploadedUrl(null);
      } else {
        setApiError('Update failed. Please try again.');
      }
    } catch (e: any) {
      setApiError(e?.message || 'Update failed (404). Please try again.');
    } finally {
      setApiLoading(false);
    }
  };

  const renderItem = ({ item }: { item: TopDonor }) => {
    const total = Number(item.totalAmount || 0);
    return (
      <Pressable onPress={() => { setSheetFor(item); setUploadedUrl(null); setApiError(null); }} style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}>
        <View style={styles.avatarWrap}>
          <Image source={item.photoUrl ? { uri: item.photoUrl } : require('@/assets/images/donor.png')} style={styles.avatar} />
          {busyKey === item.key && (
            <View style={styles.avatarBusy}><ActivityIndicator size="small" color="#fff" /></View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.name}>{item.displayName || 'Donor'}</Text>
          <Text style={styles.sub}>Total: ₹ {total.toLocaleString('en-IN')}</Text>
          <Text style={styles.muted}>Donations: {item.donationCount}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <Text style={styles.heading}>Top Donors</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <FlatList
          data={[1,2,3,4,5,6,7,8]}
          keyExtractor={(i) => String(i)}
          renderItem={() => (
            <View style={styles.card}>
              <View style={styles.avatarWrap}><Skeleton width={56} height={56} isCircle /></View>
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width={180} height={14} />
                <Skeleton width={120} height={12} />
                <Skeleton width={100} height={10} />
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        />
      ) : (
        <FlatList
          data={donors}
          keyExtractor={(d) => d.key}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.centerText}>No donors found.</Text></View>}
        />
      )}

      {/* Bottom sheet to choose new photo */}
      <Modal
        visible={!!sheetFor}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetFor(null)}
      >
        <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Update Donor Photo</Text>
            <Text style={styles.sheetSub}>Donor: {sheetFor?.displayName || sheetFor?.key}</Text>
            <View style={{ height: 12 }} />
            {uploadedUrl ? (
              <View>
                <Image source={{ uri: uploadedUrl }} style={{ width: '100%', height: 180, borderRadius: 8 }} resizeMode="cover" />
                {apiError ? <Text style={{ color: '#dc2626', marginTop: 8, fontWeight: '700' }}>{apiError}</Text> : null}
                <Pressable disabled={apiLoading} onPress={submitUpdate} style={({ pressed }) => [styles.primaryBtn, { marginTop: 12 }, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.primaryTxt}>{apiLoading ? 'Submitting…' : 'Submit'}</Text>
                </Pressable>
                <Pressable disabled={apiLoading} onPress={() => setUploadedUrl(null)} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.secondaryTxt}>Choose Different Image</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Pressable onPress={() => sheetFor && pickAndUpload(sheetFor)} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.primaryTxt}>Choose from Gallery</Text>
                </Pressable>
                <Text style={styles.hint}>Select a square image. You can submit after preview.</Text>
              </View>
            )}
            <Pressable disabled={apiLoading} onPress={() => { setSheetFor(null); setUploadedUrl(null); setApiError(null); }} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.secondaryTxt}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen loader during API call */}
      {apiLoading && (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <LottieLoader size={96} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { height: 52, borderBottomWidth: 1, borderBottomColor: '#eef2f7', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#fff' },
  back: { fontSize: 22, color: '#111' },
  heading: { color: Colors.light.primary, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { color: '#6b7280', marginTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12 },
  avatarWrap: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarBusy: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#0f172a', fontWeight: '900' },
  sub: { color: '#0f172a', fontWeight: '700', marginTop: 2 },
  muted: { color: '#6b7280', marginTop: 2 },
  // Sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#e2e8f0', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  sheetSub: { color: '#64748b', marginTop: 2 },
  primaryBtn: { backgroundColor: Colors.light.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  primaryTxt: { color: '#fff', fontWeight: '900' },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.light.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  secondaryTxt: { color: Colors.light.primary, fontWeight: '900' },
  hint: { marginTop: 8, color: '#64748b' },
  loaderOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
});
