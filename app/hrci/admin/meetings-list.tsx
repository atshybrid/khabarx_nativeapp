import { Colors } from '@/constants/Colors';
import { HrciMeeting, joinMeeting, listAdminMeetings } from '@/services/hrciMeet';
import { makeShadow } from '@/utils/shadow';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { ActivityIndicator, Alert, Animated, Easing, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHrciOnboarding } from '../../../context/HrciOnboardingContext';

export default function AdminMeetingsListScreen() {
  const insets = useSafeAreaInsets();
  const { setReturnToAfterGeo } = useHrciOnboarding();
  const [items, setItems] = React.useState<HrciMeeting[]>([]);
  const [count, setCount] = React.useState<number>(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [joiningId, setJoiningId] = React.useState<string | null>(null);
  const skelPulse = React.useRef(new Animated.Value(0.6)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skelPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(skelPulse, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { try { loop.stop(); } catch {} };
  }, [skelPulse]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAdminMeetings();
      setItems(res.data || []);
      setCount(res.count || 0);
    } catch (e) {
      try { console.warn('[AdminMeetings] load failed', (e as any)?.message || e); } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleStartMeeting = React.useCallback(async (meetingId: string) => {
    try {
      setJoiningId(meetingId);
      const res = await joinMeeting(meetingId);
      const url = res?.join?.url;
      if (!url) throw new Error('Join URL not available');
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      try {
        const msg = (e as any)?.message || 'Failed to start meeting';
        Alert.alert('Unable to start', String(msg));
      } catch {}
    } finally {
      setJoiningId(null);
    }
  }, []);

  const renderItem = ({ item }: { item: HrciMeeting }) => {
    const status = String(item.runtimeStatus || item.status || '').toUpperCase();
    const isLive = status === 'LIVE';
    const isJoining = joiningId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{item.title || 'Meeting'}</Text>
          <View style={[styles.chip, styles.chipAlign, chipColor(item.runtimeStatus)]}><Text style={styles.chipTxt}>{item.runtimeStatus || item.status || '—'}</Text></View>
        </View>
        <View style={styles.row}><Feather name="calendar" size={14} color="#64748b" /><Text style={styles.rowTxt}>{new Date(item.scheduledAt).toLocaleString()}</Text></View>
        <View style={styles.row}><Feather name="map-pin" size={14} color="#64748b" /><Text style={styles.rowTxt}>Level: {item.level || '—'}</Text></View>
        <View style={styles.row}><Feather name="lock" size={14} color="#64748b" /><Text style={styles.rowTxt}>Password: {item.password || '—'}</Text></View>
        {isLive ? (
          <Pressable
            disabled={isJoining}
            onPress={() => handleStartMeeting(item.id)}
            style={({ pressed }) => [styles.startBtn, pressed && !isJoining && { opacity: 0.9 }]}
          >
            {isJoining ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="play-circle" size={18} color="#fff" />
                <Text style={styles.startBtnTxt}>Start Meeting</Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  };

  const onCreate = React.useCallback(() => {
    try { setReturnToAfterGeo('/hrci/admin/meeting-create'); AsyncStorage.setItem('HRCI_RETURN_TO_AFTER_GEO', '/hrci/admin/meeting-create'); } catch {}
    router.push('/hrci/level' as any);
  }, [setReturnToAfterGeo]);

  const SkeletonCard = () => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Animated.View style={[styles.skelTitle, { flex: 1, marginRight: 8, opacity: skelPulse }]} />
        <Animated.View style={[styles.skelChip, { opacity: skelPulse }]} />
      </View>
      <Animated.View style={[styles.skelRow, { opacity: skelPulse }]} />
      <Animated.View style={[styles.skelRow, { opacity: skelPulse }]} />
      <Animated.View style={[styles.skelRow, { width: '40%', opacity: skelPulse }]} />
    </View>
  );

  const SkeletonList = () => (
    <View>
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={`skel-${i}`} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top','left','right']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}>
          <Feather name="arrow-left" size={18} color={Colors.light.primary} />
        </Pressable>
        <Text style={styles.appTitle}>Meetings{count ? ` (${count})` : ''}</Text>
        <View style={{ width: 36 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 + (insets?.bottom || 0) + 64 }}
        ListHeaderComponent={loading ? <SkeletonList /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={!loading ? (
          <View style={{ alignItems: 'center', marginTop: 24 }}><Text style={{ color: '#64748b' }}>No meetings yet</Text></View>
        ) : null}
      />
      <Pressable onPress={onCreate} style={({ pressed }) => [styles.fab, { bottom: (insets?.bottom || 0) + 16 }, pressed && { opacity: 0.9 }]}>
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

function chipColor(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'LIVE') return { backgroundColor: '#16a34a22', borderColor: '#16a34a' };
  if (s === 'SCHEDULED') return { backgroundColor: '#2563eb22', borderColor: '#2563eb' };
  if (s === 'ENDED') return { backgroundColor: '#6b728022', borderColor: '#6b7280' };
  return { backgroundColor: '#e5e7eb', borderColor: '#e5e7eb' };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#fff' },
  appTitle: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef2f7', marginHorizontal: 12, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { color: '#0f172a', fontWeight: '900', flex: 1, minWidth: 0, marginRight: 8, fontSize: 16, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  rowTxt: { color: '#334155', fontWeight: '700' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#e5e7eb' },
  chipAlign: { alignSelf: 'flex-start', flexShrink: 0 },
  chipTxt: { color: '#0f172a', fontWeight: '900', fontSize: 12 },
  fab: { position: 'absolute', right: 16, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.primary, elevation: 4, ...makeShadow(8, { opacity: 0.15, blur: 12, y: 4 }) },
  startBtn: { marginTop: 10, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.primary },
  startBtnTxt: { color: '#fff', fontWeight: '900' },
  skelTitle: { height: 16, backgroundColor: '#e5e7eb', borderRadius: 6 },
  skelChip: { width: 76, height: 22, borderRadius: 999, backgroundColor: '#e5e7eb' },
  skelRow: { height: 14, backgroundColor: '#e5e7eb', borderRadius: 6, marginTop: 10, width: '60%' },
});
