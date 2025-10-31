import LottieLoader from '@/components/ui/LottieLoader';
import { Colors } from '@/constants/Colors';
import { DonationEvent, listAdminDonationEvents, updateDonationEventStatus } from '@/services/hrciAdmin';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HrciAdminEventsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DonationEvent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, Swipeable | null>>({});

  useEffect(() => {
    (async() => {
      try {
        const res = await listAdminDonationEvents({ limit: 20 });
        setItems(res.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <StatusBar style="dark" />
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Donation Events</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><LottieLoader size={72} /><Text style={styles.loadingTxt}>Loading events…</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Swipeable
              ref={(ref) => { rowRefs.current[item.id] = ref; }}
              friction={2}
              rightThreshold={16}
              overshootRight={false}
              renderRightActions={() => {
                const now = String(item.status).toUpperCase();
                // Single-direction swipe like discounts: right swipe reveals action
                const isDraft = now === 'DRAFT';
                const label = isDraft ? 'Activate' : 'Draft';
                const onPress = () => {
                  if (busyId) return;
                  changeStatus(item.id, isDraft ? 'ACTIVE' : 'DRAFT');
                };
                return (
                  <View style={styles.swipeRightWrap}>
                    <Pressable
                      onPress={onPress}
                      accessibilityLabel={label}
                      style={({ pressed }) => [
                        isDraft ? styles.swipeBtnPrimary : styles.swipeBtnDanger,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Feather name={isDraft ? 'check' : 'pause'} size={18} color="#fff" />
                        <Text style={styles.swipeBtnTxtAlt}>{label}</Text>
                      </View>
                    </Pressable>
                  </View>
                );
              }}
            >
              <View style={styles.card}>
                {item.coverImageUrl ? (
                  <Image source={{ uri: item.coverImageUrl }} style={styles.cover} resizeMode="cover" />
                ) : null}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.rowBetween}>
                    <Text style={styles.meta}>
                      {(item.currency || 'INR')} {item.goalAmount ? item.goalAmount.toLocaleString() : '—'}
                    </Text>
                    <View style={[styles.statusChip, String(item.status).toUpperCase()==='ACTIVE' ? styles.statusActive : styles.statusDraft]}>
                      <Text style={[styles.statusTxt, String(item.status).toUpperCase()==='ACTIVE' ? styles.statusActiveTxt : styles.statusDraftTxt]}>
                        {String(item.status).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {typeof item.collectedAmount === 'number' && typeof item.goalAmount === 'number' ? (
                    <View style={{ marginTop: 10 }}>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, Math.round(((item.collectedAmount||0) / Math.max(1, item.goalAmount||0)) * 100))}%` }]} />
                      </View>
                      <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>₹{(item.collectedAmount||0).toLocaleString('en-IN')} raised of ₹{(item.goalAmount||0).toLocaleString('en-IN')}</Text>
                        <Text style={styles.progressPct}>{Math.min(100, Math.round(((item.collectedAmount||0) / Math.max(1, item.goalAmount||0)) * 100))}%</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            </Swipeable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No events yet.</Text>}
        />
      )}

      <Pressable onPress={() => router.push('/hrci/admin/events/new' as any)} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>+</Text>
      </Pressable>
    </View>
  );

  async function changeStatus(id: string, status: string) {
    try {
      setBusyId(id);
      await updateDonationEventStatus(id, status);
      Alert.alert('Event', `Status updated to ${status}`);
      // Refresh list
      const res = await listAdminDonationEvents({ limit: 20 });
      setItems(res.data || []);
    } catch (e: any) {
      Alert.alert('Event', e?.message || 'Failed to update status');
    } finally {
      setBusyId(null);
      // Close the swipe row after update
      try { rowRefs.current[id]?.close && rowRefs.current[id]?.close(); } catch {}
    }
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  title: { fontSize: 16, fontWeight: '800', color: Colors.light.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingTxt: { marginTop: 8, color: '#111', fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', overflow: 'hidden', marginBottom: 12 },
  cover: { width: '100%', height: 140, backgroundColor: '#f1f5f9' },
  cardBody: { padding: 12, gap: 8 },
  cardTitle: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  meta: { color: '#64748b', marginTop: 4 },
  empty: { color: '#64748b', textAlign: 'center', paddingTop: 24 },
  fab: { position: 'absolute', right: 16, bottom: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  swipeRightWrap: { justifyContent: 'center', alignItems: 'flex-end' },
  swipeBtnPrimary: { width: 112, height: '90%', marginVertical: 6, marginRight: 8, backgroundColor: '#22c55e', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swipeBtnDanger: { width: 112, height: '90%', marginVertical: 6, marginRight: 8, backgroundColor: '#ef4444', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swipeBtnTxtAlt: { color: '#fff', fontWeight: '800' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statusActive: { backgroundColor: '#e8f7ef', borderColor: '#22c55e' },
  statusDraft: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  statusTxt: { fontWeight: '900', fontSize: 11 },
  statusActiveTxt: { color: '#16a34a' },
  statusDraftTxt: { color: '#b91c1c' },
  progressBg: { height: 8, borderRadius: 999, backgroundColor: '#eef2f7', overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Colors.light.primary },
  progressRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { color: '#6b7280', fontSize: 12 },
  progressPct: { color: '#0f172a', fontWeight: '800', fontSize: 12 }
});
