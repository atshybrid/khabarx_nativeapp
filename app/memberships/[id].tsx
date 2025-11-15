import { Colors } from '@/constants/Colors';
import type { AdminMembership } from '@/services/hrciAdmin';
import { getAdminMembership } from '@/services/hrciAdmin';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function MembershipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminMembership | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getAdminMembership(String(id));
        setData(res);
      } catch (e: any) {
        setError(e?.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.backTxt}>{'<'} Back</Text>
        </Pressable>
        <Text style={styles.title}>Member Detail</Text>
        <View style={{ width: 64 }} />
      </View>
      {loading ? (
        <View style={styles.center}> 
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
      ) : !data ? (
        <View style={styles.center}><Text style={styles.error}>No data</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}> 
          <View style={styles.card}>
            <Text style={styles.h1}>{data?.idCard?.fullName || data?.user?.profile?.fullName || '—'}</Text>
            <Text style={styles.sub}>{data?.designation?.name || data?.idCard?.designationName || '—'} • {data?.level || '—'}{data?.zone ? ` • ${data.zone}` : ''}</Text>
            <Text style={styles.sub}>Status: {data?.status || '—'} • Payment: {data?.paymentStatus || '—'} • IDCard: {data?.idCardStatus || '—'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.h2}>Seat</Text>
            <Text style={styles.kv}>ID: <Text style={styles.v}>{data.id}</Text></Text>
            {data.cell?.name || data.cell?.code ? <Text style={styles.kv}>Cell: <Text style={styles.v}>{data.cell?.name || data.cell?.code}</Text></Text> : null}
            {data.seatSequence ? <Text style={styles.kv}>Seat #: <Text style={styles.v}>{data.seatSequence}</Text></Text> : null}
            {data.activatedAt ? <Text style={styles.kv}>Activated: <Text style={styles.v}>{data.activatedAt}</Text></Text> : null}
            {data.updatedAt ? <Text style={styles.kv}>Updated: <Text style={styles.v}>{data.updatedAt}</Text></Text> : null}
          </View>
          <View style={styles.card}>
            <Text style={styles.h2}>Contact</Text>
            <Text style={styles.kv}>Mobile: <Text style={styles.v}>{data.user?.mobileNumber || data.idCard?.mobileNumber || '—'}</Text></Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.h2}>ID Card</Text>
            <Text style={styles.kv}>Card No: <Text style={styles.v}>{data.idCard?.cardNumber || '—'}</Text></Text>
            {data.idCard?.issuedAt ? <Text style={styles.kv}>Issued: <Text style={styles.v}>{data.idCard?.issuedAt}</Text></Text> : null}
            {data.idCard?.expiresAt ? <Text style={styles.kv}>Expires: <Text style={styles.v}>{data.idCard?.expiresAt}</Text></Text> : null}
            {data.idCard?.appointmentLetterPdfUrl ? <Text style={styles.kv}>Letter: <Text style={[styles.v, styles.link]}>{data.idCard?.appointmentLetterPdfUrl}</Text></Text> : null}
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#eef2f7', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor:'#fff' },
  title: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  backBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor:'#fff' },
  backTxt: { color:'#0f172a', fontWeight:'800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color:'#dc2626', fontWeight:'700' },
  content: { padding: 12 },
  card: { backgroundColor:'#fff', borderRadius: 12, borderWidth:1, borderColor:'#eef2f7', padding: 12, marginBottom: 12 },
  h1: { fontSize: 18, fontWeight: '900', color:'#0f172a' },
  sub: { marginTop: 6, color:'#475569', fontWeight:'700' },
  h2: { fontSize: 14, fontWeight: '900', color:'#0f172a', marginBottom: 8 },
  kv: { color:'#64748b', marginBottom: 6, fontWeight:'800' },
  v: { color:'#0f172a', fontWeight:'900' },
  link: { color:'#1d4ed8' },
});
