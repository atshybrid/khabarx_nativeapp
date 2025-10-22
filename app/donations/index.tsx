import { Colors } from '@/constants/Colors';
import { getDonationEvents } from '@/services/hrciDonations';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const PRESETS = [100, 250, 500, 1000];

export default function DonationHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState<string>('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getDonationEvents(10);
      setCampaigns(list || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

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

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView pointerEvents="box-none">
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
        </View>

        {/* Success Stories & Donor Wall (placeholders) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Success Stories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {[1,2,3].map(i => (
              <View key={i} style={styles.storyCard}>
                <View style={styles.storyMedia} />
                <Text numberOfLines={2} style={styles.storyTitle}>Story title {i}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Donor Wall</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {[...Array(12)].map((_, i) => (
              <View key={i} style={styles.avatar} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>

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
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#eef0f4' },
});
