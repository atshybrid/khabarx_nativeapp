import LottieLoader from '@/components/ui/LottieLoader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { uploadMedia } from '@/services/api';
import { DonationStory, getDonationEvents, getDonationStories, getTopDonors, TopDonor, updateDonorPhoto } from '@/services/hrciDonations';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const PRESETS = [100, 250, 500, 1000];

export default function DonationHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Default donor avatar (local asset)
  const DEFAULT_DONOR_AVATAR = require('@/assets/images/donor.png');
  const [amount, setAmount] = useState<string>('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topDonors, setTopDonors] = useState<TopDonor[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [stories, setStories] = useState<DonationStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [sheetFor, setSheetFor] = useState<TopDonor | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getDonationEvents(10);
      setCampaigns(list || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const run = async () => {
      setLoadingTop(true);
      try {
        const list = await getTopDonors(20);
        setTopDonors(list || []);
      } catch {}
      finally { setLoadingTop(false); }
    };
    run();
  }, []);
  useEffect(() => {
    const run = async () => {
      setLoadingStories(true);
      try {
        const list = await getDonationStories(20, 0);
        setStories(list || []);
      } catch {}
      finally { setLoadingStories(false); }
    };
    run();
  }, []);

  // Handle Android hardware back: go to News tab instead of blank/back stack
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/news');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const validAmount = useMemo(() => {
    const n = Number(amount);
    return !isNaN(n) && n > 0 ? n : 0;
  }, [amount]);

  const pickAndUpload = async (d: TopDonor) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        alert('Please allow Photos permission to select an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setBusyKey(d.key);
      const uploaded = await uploadMedia({ uri: asset.uri, type: 'image', name: `donor_${Date.now()}.jpg`, folder: 'donors' });
      const url = uploaded.url;
      setUploadedUrl(url);
      setApiError(null);
    } catch (e: any) {
      alert(e?.message || 'Upload failed');
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
        setTopDonors(prev => prev.map(x => x.key === d.key ? { ...x, photoUrl: uploadedUrl } : x));
        setSheetFor(null);
        setUploadedUrl(null);
      } else {
        setApiError('Failed to update donor photo.');
      }
    } catch (e: any) {
      setApiError(e?.message || 'Update failed (404). Please try again.');
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView pointerEvents="box-none">
        <StatusBar style="dark" />
        <View style={styles.appBar}>
          <Pressable onPress={() => router.replace('/news')} hitSlop={8} style={styles.iconBtn}>
            <MaterialCommunityIcons name="arrow-left" size={18} color="#111" />
          </Pressable>
          <Text style={styles.appTitle}>Donations</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Quick Donate (direct) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Donate</Text>
          <View style={styles.quickCard}>
            <Text style={styles.hint}>Every contribution helps us do more.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {PRESETS.map(v => (
                <Pressable key={v} onPress={() => setAmount(String(v))} style={[styles.presetBtn, Number(amount)===v && styles.presetBtnActive]}>
                  <Text style={[styles.presetBtnTxt, Number(amount)===v && styles.presetBtnTxtActive]}>₹{v.toLocaleString('en-IN')}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <View style={[styles.input, { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={{ color: '#6b7280', fontWeight: '800', marginRight: 6 }}>₹</Text>
                <TextInput value={amount} onChangeText={setAmount} placeholder="Enter amount" placeholderTextColor="#9CA3AF" keyboardType="numeric" style={{ flex: 1, color: '#111' }} />
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/donations/trust' })}
                style={[styles.iconBtn]}
              >
                <MaterialCommunityIcons name="shield-check-outline" size={18} color="#111" />
              </Pressable>
            </View>
            <Text style={styles.subHint}>100% secure • Instant receipt</Text>
          </View>
        </View>

        {/* Active Campaigns */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Active Campaigns</Text>
            <Pressable onPress={() => router.push('/donations/trust')}><Text style={styles.link}>Transparency</Text></Pressable>
          </View>
          {loading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {[1,2].map(i => (
                <View key={i} style={styles.campaignCard}>
                  <Skeleton width={'100%'} height={140} borderRadius={0} />
                  <View style={{ padding: 10, gap: 8 }}>
                    <Skeleton width={200} height={14} />
                    <Skeleton width={160} height={10} />
                    <Skeleton width={120} height={10} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <FlatList
              horizontal
              data={campaigns}
              keyExtractor={(c:any) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              renderItem={({ item }) => (
                <Pressable onPress={() => router.push({ pathname: '/donations/[id]', params: { id: item.id } })} style={styles.campaignCard}>
                  {item.coverImageUrl ? (
                    <Image source={{ uri: item.coverImageUrl }} style={styles.campaignCover} contentFit="cover" />
                  ) : (
                    <View style={[styles.campaignCover, { alignItems: 'center', justifyContent: 'center' }]}>
                      <MaterialCommunityIcons name="image-off-outline" size={22} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={{ padding: 10 }}>
                    <Text numberOfLines={2} style={styles.campaignTitle}>{item.title || 'Campaign'}</Text>
                    {typeof item.collectedAmount === 'number' && typeof item.goalAmount === 'number' ? (
                      <View style={{ marginTop: 8 }}>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.round((item.collectedAmount / (item.goalAmount||1)) * 100))}%` }]} />
                        </View>
                        <Text style={styles.progressTxt}>₹{(item.collectedAmount||0).toLocaleString('en-IN')} raised of ₹{(item.goalAmount||0).toLocaleString('en-IN')}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={!loading ? <Text style={styles.hintEmpty}>No campaigns yet</Text> : null}
            />
          )}
        </View>

        {/* Success Stories & Donor Wall (placeholders) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Success Stories</Text>
          {loadingStories ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {[1,2,3].map(i => (
                <View key={i} style={styles.storyCard}>
                  <Skeleton width={'100%'} height={100} borderRadius={12} />
                  <View style={{ padding: 10 }}>
                    <Skeleton width={140} height={12} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {(stories.length === 0) ? (
                [1,2,3].map(i => (
                  <View key={i} style={styles.storyCard}>
                    <View style={styles.storyMedia} />
                    <Text numberOfLines={2} style={styles.storyTitle}>Story</Text>
                  </View>
                ))
              ) : (
                stories.map(s => (
                  <Pressable key={s.id} onPress={() => router.push({ pathname: '/donations/story/[id]', params: { id: s.id } })} style={styles.storyCard}>
                    {s.heroImageUrl ? (
                      <Image source={{ uri: s.heroImageUrl }} style={styles.storyMedia} contentFit="cover" />
                    ) : (
                      <View style={[styles.storyMedia, { alignItems: 'center', justifyContent: 'center' }]}>
                        <MaterialCommunityIcons name="image-off-outline" size={22} color="#9CA3AF" />
                      </View>
                    )}
                    <Text numberOfLines={2} style={styles.storyTitle}>{s.title || 'Story'}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Donor Wall</Text>
          {loadingTop ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} width={48} height={48} isCircle />
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {topDonors.length === 0 ? (
                [...Array(8)].map((_, i) => <View key={i} style={styles.avatar} />)
              ) : (
                topDonors.map((d) => (
                  <Pressable key={d.key} onPress={() => { setSheetFor(d); setUploadedUrl(null); setApiError(null); }} style={({ pressed }) => [styles.donorCard, pressed && { opacity: 0.85 }]}>
                    <View>
                      <Image
                        source={d.photoUrl ? { uri: d.photoUrl } : DEFAULT_DONOR_AVATAR}
                        style={styles.donorAvatar}
                        contentFit="cover"
                      />
                      {busyKey === d.key && (
                        <View style={styles.avatarBusy}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={1} style={styles.donorName}>{d.displayName || 'Donor'}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Bottom sheet to choose new donor photo */}
      {sheetFor && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={{ flex: 1 }} onPress={() => setSheetFor(null)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Update Donor Photo</Text>
            <Text style={styles.sheetSub}>{sheetFor.displayName || sheetFor.key}</Text>
            {uploadedUrl ? (
              <View>
                <Image source={{ uri: uploadedUrl }} style={{ width: '100%', height: 180, borderRadius: 8 }} />
                {apiError ? <Text style={{ color: '#dc2626', marginTop: 8, fontWeight: '700' }}>{apiError}</Text> : null}
                <Pressable disabled={apiLoading} onPress={submitUpdate} style={[styles.sheetPrimaryBtn, { marginTop: 12 }]}>
                  <Text style={styles.sheetPrimaryTxt}>{apiLoading ? 'Submitting…' : 'Submit'}</Text>
                </Pressable>
                <Pressable disabled={apiLoading} onPress={() => setUploadedUrl(null)} style={styles.sheetSecondaryBtn}>
                  <Text style={styles.sheetSecondaryTxt}>Choose Different Image</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Pressable onPress={() => sheetFor && pickAndUpload(sheetFor)} style={styles.sheetPrimaryBtn}>
                  <Text style={styles.sheetPrimaryTxt}>Choose from Gallery</Text>
                </Pressable>
                <Text style={styles.sheetHint}>Select a square image. Submit after preview.</Text>
              </View>
            )}
            <Pressable disabled={apiLoading} onPress={() => { setSheetFor(null); setUploadedUrl(null); setApiError(null); }} style={styles.sheetSecondaryBtn}>
              <Text style={styles.sheetSecondaryTxt}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetHint}>Note: Photo updates after Submit.</Text>
          </View>
        </View>
      )}

      {/* API call loader overlay */}
      {apiLoading && (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <LottieLoader size={96} />
        </View>
      )}

      {/* Sticky bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 12 }]}>
        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' }}>Amount</Text>
        <Text style={{ color: '#111', fontSize: 18, fontWeight: '900', marginLeft: 8 }}>₹{(validAmount || 0).toLocaleString('en-IN')}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          disabled={!validAmount}
          onPress={() => router.push({ pathname: '/hrci/donations/create', params: { amount: String(validAmount) } })}
          style={[styles.primaryBtn, !validAmount && { opacity: 0.6 }]}
        >
          <Text style={styles.primaryBtnTxt}>Donate</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  appTitle: { color: '#111', fontWeight: '900', fontSize: 18 },
  section: { marginTop: 8 },
  sectionTitle: { color: '#111', fontWeight: '900', fontSize: 16, paddingHorizontal: 16, marginBottom: 8 },
  quickCard: { marginHorizontal: 16, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eef2f7' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, color: '#111' },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  presetBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  presetBtnTxt: { color: '#111', fontWeight: '800' },
  presetBtnTxtActive: { color: '#fff' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  primaryBtn: { height: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.light.primary },
  primaryBtnTxt: { color: '#fff', fontWeight: '900' },
  subHint: { color: '#9CA3AF', fontSize: 11, marginTop: 6 },
  hint: { color: '#6b7280' },
  hintEmpty: { color: '#9CA3AF', paddingHorizontal: 16 },
  rowBetween: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: Colors.light.primary, fontWeight: '800' },
  campaignCard: { width: 260, borderRadius: 12, borderWidth: 1, borderColor: '#eef0f4', overflow: 'hidden', backgroundColor: '#fff' },
  campaignCover: { width: '100%', height: 140, backgroundColor: '#f3f4f6' },
  campaignTitle: { color: '#111', fontWeight: '800' },
  progressBarBg: { height: 8, borderRadius: 999, backgroundColor: '#eef2f7', overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: Colors.light.primary },
  progressTxt: { color: '#6b7280', fontSize: 12, marginTop: 6 },
  storyCard: { width: 180, borderRadius: 12, borderWidth: 1, borderColor: '#eef0f4', backgroundColor: '#fff' },
  storyMedia: { width: '100%', height: 100, backgroundColor: '#f3f4f6', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  storyTitle: { color: '#111', padding: 10, fontWeight: '700' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb' },
  donorCard: { width: 72, alignItems: 'center' },
  donorAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },
  avatarBusy: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 24 },
  donorName: { color: '#111', fontSize: 12, fontWeight: '700', marginTop: 6, maxWidth: 72, textAlign: 'center' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#eef0f4' },
  // Bottom sheet styles
  modalOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#e2e8f0', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  sheetSub: { color: '#64748b', marginTop: 2, marginBottom: 12 },
  sheetPrimaryBtn: { backgroundColor: Colors.light.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  sheetPrimaryTxt: { color: '#fff', fontWeight: '900' },
  sheetSecondaryBtn: { borderWidth: 1, borderColor: Colors.light.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  sheetSecondaryTxt: { color: Colors.light.primary, fontWeight: '900' },
  sheetHint: { marginTop: 8, color: '#64748b' },
  loaderOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
});
