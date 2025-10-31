import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { DonationEvent, getDonationEventById } from '@/services/hrciDonations';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// LottieLoader is available for future extended loaders

const PRESETS = [250, 500, 1000, 2000];

export default function CampaignDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<DonationEvent | undefined>(undefined);
  const [amount, setAmount] = useState<string>('');
  const [inputFocused, setInputFocused] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputWrapperRef = useRef<View>(null);
  const [inputY, setInputY] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const d = await getDonationEventById(String(id));
        if (mounted) {
          setEvent(d);
          if (d?.presets && d.presets.length > 0) setAmount(String(d.presets[0]));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);
  const validAmount = useMemo(() => {
    const n = Number(amount);
    return !isNaN(n) && n > 0 ? n : 0;
  }, [amount]);

  // Scroll to the amount input when keyboard opens
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (inputFocused) {
        try { scrollRef.current?.scrollTo({ y: Math.max(0, inputY - 24), animated: true }); } catch {}
      }
    });
    return () => sub.remove();
  }, [inputFocused, inputY]);

  if (loading && !event) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <SafeAreaView />
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
          <Skeleton width={'100%'} height={240} borderRadius={0} />
          <View style={{ padding: 16, gap: 10 }}>
            <Skeleton width={240} height={18} />
            <Skeleton width={'80%'} height={12} />
            <Skeleton width={'60%'} height={12} />
            <View style={{ marginTop: 8 }}>
              <Skeleton width={'100%'} height={8} />
              <Skeleton width={160} height={12} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {[1,2,3,4].map(i => (
                <Skeleton key={i} width={90} height={34} borderRadius={999} />
              ))}
            </View>
            <View style={{ marginTop: 12 }}>
              <Skeleton width={'100%'} height={44} borderRadius={10} />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6b7280' }}>Campaign not found</Text>
      </View>
    );
  }

  const pct = event.goalAmount ? Math.min(100, Math.round(((event.collectedAmount || 0) / (event.goalAmount || 1)) * 100)) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 200 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={() => {
          if (inputFocused) {
            try { scrollRef.current?.scrollTo({ y: Math.max(0, inputY - 24), animated: true }); } catch {}
          }
        }}
      >
        <View style={{ position: 'relative' }}>
          {event.coverImageUrl ? (
            <>
              <Image source={{ uri: event.coverImageUrl }} style={styles.hero} contentFit="cover" />
              <Image source={{ uri: event.coverImageUrl }} style={styles.heroBlur} contentFit="cover" blurRadius={30} />
            </>
          ) : (
            <View style={styles.hero} />
          )}
          <SafeAreaView style={styles.heroBar} pointerEvents="box-none">
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={async () => {
                try {
                  await Share.share({ message: `${event.title || 'Campaign'}\nSupport this cause.` });
                } catch {}
              }}
              hitSlop={8}
              style={styles.iconCircle}
            >
              <MaterialCommunityIcons name="share-variant" size={18} color="#111" />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={{ padding: 16 }}>
          <Text style={styles.title}>{event.title || 'Campaign'}</Text>
          {event.goalAmount ? (
            <View style={{ marginTop: 10 }}>
              <View style={styles.progressRow}>
                <Text style={styles.progressBig}>{typeof pct === 'number' ? `${pct}%` : ''}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.raisedTxt}>₹{(event.collectedAmount || 0).toLocaleString('en-IN')}</Text>
                <Text style={styles.ofTxt}> of ₹{(event.goalAmount || 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: typeof pct === 'number' ? `${pct}%` : '0%' }]} />
              </View>
            </View>
          ) : null}

          <View style={styles.quickCard}>
            <Text style={styles.subhead}>Quick Donate</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {PRESETS.map(v => (
                <Pressable key={v} onPress={() => setAmount(String(v))} style={[styles.presetBtn, Number(amount)===v && styles.presetBtnActive]}>
                  <Text style={[styles.presetBtnTxt, Number(amount)===v && styles.presetBtnTxtActive]}>₹{v.toLocaleString('en-IN')}</Text>
                </Pressable>
              ))}
            </View>
            <View
              ref={inputWrapperRef}
              onLayout={(e) => setInputY(e.nativeEvent.layout.y)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}
            >
              <View style={[styles.input, { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center' }]}> 
                <Text style={{ color: '#6b7280', fontWeight: '800', marginRight: 6 }}>₹</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Enter amount"
                  placeholderTextColor="#9CA3AF"
                  keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                  style={{ flex: 1, color: '#111' }}
                  returnKeyType="done"
                  onFocus={() => {
                    setInputFocused(true);
                    try { scrollRef.current?.scrollTo({ y: Math.max(0, inputY - 24), animated: true }); } catch {}
                  }}
                  onBlur={() => { setInputFocused(false); }}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
            </View>
            <Text style={styles.subHint}>Secure • Instant receipt</Text>
          </View>

          {event.description ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.subhead}>About this campaign</Text>
              <Text style={styles.desc}>{event.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 12 }]}>
        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' }}>Amount</Text>
        <Text style={{ color: '#111', fontSize: 18, fontWeight: '900', marginLeft: 8 }}>₹{(validAmount || 0).toLocaleString('en-IN')}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          disabled={!validAmount}
          onPress={() => router.push({ pathname: '/hrci/donations/create', params: { eventId: String(event.id), amount: String(validAmount) } })}
          style={[styles.primaryBtn, !validAmount && { opacity: 0.6 }]}
        >
          <Text style={styles.primaryBtnTxt}>Donate</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 240, backgroundColor: '#f3f4f6' },
  heroBlur: { position: 'absolute', left: 0, right: 0, top: 0, height: 240, opacity: 0.35 },
  heroBar: {
    position: 'absolute', left: 0, right: 0, top: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
    minHeight: 44,
    backgroundColor: 'transparent',
    // no border/elevation so the image looks full-bleed; only floating icons remain
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  title: { color: '#111', fontWeight: '900', fontSize: 20 },
  desc: { color: '#374151', marginTop: 8, lineHeight: 22 },
  subhead: { color: '#111', fontWeight: '900', marginBottom: 6 },
  quickCard: { marginTop: 12, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eef2f7' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, color: '#111' },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  presetBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  presetBtnTxt: { color: '#111', fontWeight: '800' },
  presetBtnTxtActive: { color: '#fff' },
  subHint: { color: '#9CA3AF', fontSize: 11, marginTop: 6 },
  progressBarBg: { height: 8, borderRadius: 999, backgroundColor: '#eef2f7', overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: Colors.light.primary },
  progressTxt: { color: '#6b7280', fontSize: 12, marginTop: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  progressBig: { color: '#111', fontSize: 22, fontWeight: '900' },
  raisedTxt: { color: '#111', fontWeight: '800' },
  ofTxt: { color: '#6b7280' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#eef0f4' },
  primaryBtn: { height: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.light.primary },
  primaryBtnTxt: { color: '#fff', fontWeight: '900' },
});
