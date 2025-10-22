import { FullScreenLoader } from '@/components/ui/Loader';
import { Colors } from '@/constants/Colors';
import { getMyUpcomingMeetings, HrciMeeting, joinMeeting } from '@/services/hrciMeet';
import { makeShadow } from '@/utils/shadow';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HrciMeetingsPage() {
  const [items, setItems] = useState<HrciMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyUpcomingMeetings();
      setItems(res);
    } catch (_e:any) {
      setError(_e?.message || 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onJoin = useCallback(async (meetingId: string) => {
    try {
      setJoining(meetingId);
      const data = await joinMeeting(meetingId);
      const url = data?.join?.url;
      const domain = data?.join?.domain;
      const room = data?.join?.roomName;
      const pwd = data?.join?.password;
      const jwt = (data as any)?.join?.jwt as string | undefined;

      // Prefer Jitsi app deep-link if installed
      // org.jitsi.meet://<domain>/<room>?params
      if (domain && room) {
        const deeplinkBase = `org.jitsi.meet://${domain}/${encodeURIComponent(room)}`;
        const params = new URLSearchParams();
        if (pwd) params.set('password', String(pwd));
        if (jwt) params.set('jwt', String(jwt));
        const deeplink = params.toString() ? `${deeplinkBase}?${params.toString()}` : deeplinkBase;
        try {
          const can = await Linking.canOpenURL(deeplink);
          if (can) {
            await Linking.openURL(deeplink);
            return;
          }
        } catch {}
      }

      // Fallback to opening in browser if deep-link not supported
      if (url) await openBrowserAsync(url);
    } catch {
      // no-op, could add a toast
    } finally {
      setJoining(null);
    }
  }, []);

  const renderItem = ({ item }: { item: HrciMeeting }) => (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.pill, item.status === 'LIVE' ? styles.p_live : styles.p_scheduled]}>{item.status || 'SCHEDULED'}</Text>
      </View>
      <Text style={styles.meta}>{item.domain} / {item.roomName}</Text>
      <Text style={styles.meta}>Starts: {new Date(item.scheduledAt).toLocaleString()}</Text>
      {item.endsAt ? <Text style={styles.meta}>Ends: {new Date(item.endsAt).toLocaleString()}</Text> : null}
      <View style={styles.joinRow}>
        <Pressable
          onPress={() => onJoin(item.id)}
          disabled={joining === item.id}
          style={({ pressed }) => [styles.joinBtn, pressed && styles.joinBtnPressed]}
        >
          <Text style={styles.joinIcon}>▶</Text>
          <Text style={styles.joinTxt}>{joining === item.id ? 'Joining…' : 'Join meeting'}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.appTitle}>Meetings</Text>
        </View>
      </SafeAreaView>
      {error ? (
        <View style={styles.center}> 
          <Text style={styles.errorTxt}>{error}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryTxt}>Retry</Text></Pressable>
        </View>
      ) : loading ? (
        <FullScreenLoader label="Loading meetings…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          ListEmptyComponent={<Text style={styles.empty}>No upcoming meetings</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  appTitle: { color: '#111', fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorTxt: { color: '#b91c1c' },
  retry: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8 },
  retryTxt: { color: '#111', fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 },
  title: { color: '#111', fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 12 },
  meta: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700', color: '#111' },
  p_live: { backgroundColor: '#DCFCE7' },
  p_scheduled: { backgroundColor: '#FEF9C3' },
  joinRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Colors.light.primary,
    ...makeShadow(8, { color: '254,0,2', opacity: 0.25, blur: 18, y: 4 })
  },
  joinBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  joinIcon: { color: '#fff', fontSize: 14, marginTop: 1 },
  joinTxt: { color: '#fff', fontWeight: '800' },
  empty: { color: '#6b7280', textAlign: 'center' },
});
