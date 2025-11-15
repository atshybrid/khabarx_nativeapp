import { Colors } from '@/constants/Colors';
import { useHrciOnboarding } from '@/context/HrciOnboardingContext';
import { request } from '@/services/http';
import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AvailRes = { success?: boolean; data?: { remaining?: number; designation?: { remaining?: number } } };

export default function AdminAvailability() {
  const { level, cellId, cellName, cellCode, designationCode, designationName, geo } = useHrciOnboarding();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const q = new URLSearchParams({
          // Use cell code when available (examples show cell codes)
          cell: String(cellCode || cellId || ''),
          designationCode: String(designationCode),
          level: String(level),
        });
        // Include country for NATIONAL / ZONE checks when present
        if ((level === 'NATIONAL' || level === 'ZONE') && geo.hrcCountryId) q.set('hrcCountryId', String(geo.hrcCountryId));
        if (geo.zone) q.set('zone', String(geo.zone));
        if (geo.hrcCountryId) q.set('hrcCountryId', String(geo.hrcCountryId));
        if (geo.hrcStateId) q.set('hrcStateId', String(geo.hrcStateId));
        if (geo.hrcDistrictId) q.set('hrcDistrictId', String(geo.hrcDistrictId));
        if (geo.hrcMandalId) q.set('hrcMandalId', String(geo.hrcMandalId));
        const res = await request<AvailRes>(`/memberships/public/availability?${q.toString()}`);
        const rem = res?.data?.designation?.remaining ?? res?.data?.remaining ?? null;
        setRemaining(rem);
      } catch (e: any) {
        setError(e?.message || 'Failed to check availability');
      } finally {
        setLoading(false);
      }
    })();
  }, [level, cellId, designationCode, geo]);

  const canContinue = useMemo(() => (remaining ?? 0) > 0 && !loading && !error, [remaining, loading, error]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Seat Availability</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.kv}><Text style={styles.k}>Level</Text> <Text style={styles.v}>{String(level || '')}</Text></Text>
          <Text style={styles.kv}><Text style={styles.k}>Cell</Text> <Text style={styles.v}>{cellName || String(cellCode || cellId || '')}</Text></Text>
          <Text style={styles.kv}><Text style={styles.k}>Designation</Text> <Text style={styles.v}>{designationName || String(designationCode || '')}</Text></Text>
          {level === 'ZONE' && geo.zone && <Text style={styles.kv}><Text style={styles.k}>Zone</Text> <Text style={styles.v}>{String(geo.zone)}</Text></Text>}
          {level === 'STATE' && geo.hrcStateId && <Text style={styles.kv}><Text style={styles.k}>State</Text> <Text style={styles.v}>{String(geo.hrcStateId)}</Text></Text>}
          {level === 'DISTRICT' && geo.hrcDistrictId && <Text style={styles.kv}><Text style={styles.k}>District</Text> <Text style={styles.v}>{String(geo.hrcDistrictId)}</Text></Text>}
          {level === 'MANDAL' && geo.hrcMandalId && <Text style={styles.kv}><Text style={styles.k}>Mandal</Text> <Text style={styles.v}>{String(geo.hrcMandalId)}</Text></Text>}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.err}>{error}</Text></View>
        ) : (
          <View style={styles.avail}>
            {(remaining ?? 0) > 0 ? (
              <View style={styles.okRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#16a34a" />
                <Text style={styles.okTxt}>Seats available</Text>
              </View>
            ) : (
              <View style={styles.badRow}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#dc2626" />
                <Text style={styles.badTxt}>No seats available</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity disabled={!canContinue} onPress={() => router.push('/hrci/admin/members/finalize' as any)} style={[styles.cta, !canContinue && { opacity: 0.5 }]}> 
          <Text style={styles.ctaTxt}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { height: 52, borderBottomWidth: 1, borderBottomColor: '#eef2f7', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor:'#fff' },
  title: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  container: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', padding: 12, ...makeShadow(2, { opacity: 0.06, blur: 10, y: 2 }) },
  kv: { marginBottom: 6 },
  k: { color:'#64748b', fontWeight: '700' },
  v: { color:'#0f172a', fontWeight: '900' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  err: { color:'#dc2626', fontWeight: '700' },
  avail: { padding: 12, backgroundColor:'#fff', borderRadius: 12, borderWidth:1, borderColor:'#eef2f7' },
  okRow: { flexDirection:'row', alignItems:'center', gap: 8 },
  okTxt: { color:'#16a34a', fontWeight:'800' },
  badRow: { flexDirection:'row', alignItems:'center', gap: 8 },
  badTxt: { color:'#dc2626', fontWeight:'800' },
  bottomBar: { position:'absolute', left:0, right:0, bottom:0, padding: 16, backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#eef2f7' },
  cta: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingVertical: 12, alignItems:'center' },
  ctaTxt: { color:'#fff', fontWeight:'800' },
});
