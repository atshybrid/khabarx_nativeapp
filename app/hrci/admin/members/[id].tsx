import Toast from '@/components/Toast';
import { Colors } from '@/constants/Colors';
import { AdminMembership, getAdminMembership } from '@/services/hrciAdmin';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HrciAdminMemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<AdminMembership | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getAdminMembership(String(id));
      if (!data) throw new Error('Membership not found');
      setItem(data);
    } catch (e: any) {
      Alert.alert('Membership', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try { const data = await getAdminMembership(String(id)); if (data) setItem(data); } catch {} finally { setRefreshing(false); }
  }, [id]);

  if (!id) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.appBar}><Pressable onPress={() => router.back()} style={styles.iconBtn}><Feather name='arrow-left' size={18} color={Colors.light.primary} /></Pressable><Text style={styles.appTitle}>Member</Text><View style={{ width:36 }} /></View>
        <View style={styles.center}><Text style={styles.errTxt}>Missing member id.</Text></View>
        <Toast />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style='dark' />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}><Feather name='arrow-left' size={18} color={Colors.light.primary} /></Pressable>
        <Text style={styles.appTitle}>Member Detail</Text>
        <Pressable onPress={onRefresh} style={styles.iconBtn}>{refreshing ? <ActivityIndicator size='small' color={Colors.light.primary} /> : <Feather name='refresh-cw' size={16} color={Colors.light.primary} />}</Pressable>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.light.primary} /></View>
      ) : !item ? (
        <View style={styles.center}><Text style={styles.errTxt}>Not found.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}> 
          <View style={styles.section}> 
            <Text style={styles.sectionTitle}>Basic</Text>
            <View style={styles.row}> 
              <Text style={styles.key}>Name</Text><Text style={styles.val}>{item?.user?.profile?.fullName || '—'}</Text>
            </View>
            <View style={styles.row}> 
              <Text style={styles.key}>Mobile</Text><Text style={styles.val}>{item?.user?.mobileNumber || '—'}</Text>
            </View>
            <View style={styles.row}> 
              <Text style={styles.key}>Level</Text><Text style={styles.val}>{item?.level || '—'}</Text>
            </View>
            <View style={styles.row}> 
              <Text style={styles.key}>Designation</Text><Text style={styles.val}>{item?.designation?.name || item?.designation?.code || '—'}</Text>
            </View>
            <View style={styles.row}> 
              <Text style={styles.key}>Cell</Text><Text style={styles.val}>{item?.cell?.name || item?.cell?.code || '—'}</Text>
            </View>
          </View>
          <View style={styles.section}> 
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.row}><Text style={styles.key}>Membership</Text><Text style={styles.val}>{item?.status || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.key}>Payment</Text><Text style={styles.val}>{item?.paymentStatus || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.key}>ID Card</Text><Text style={styles.val}>{item?.idCardStatus || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.key}>Activated</Text><Text style={styles.val}>{item?.activatedAt ? new Date(item.activatedAt).toLocaleString() : '—'}</Text></View>
          </View>
          <View style={styles.section}> 
            <Text style={styles.sectionTitle}>ID Card</Text>
            {item?.idCard ? (
              <>
                <View style={styles.row}><Text style={styles.key}>Card #</Text><Text style={styles.val}>{item.idCard.cardNumber || '—'}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Issued</Text><Text style={styles.val}>{item.idCard.issuedAt ? new Date(item.idCard.issuedAt).toLocaleString() : '—'}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Expires</Text><Text style={styles.val}>{item.idCard.expiresAt ? new Date(item.idCard.expiresAt).toLocaleString() : '—'}</Text></View>
                <View style={styles.row}><Text style={styles.key}>Appointment PDF</Text><Text style={styles.val}>{item.idCard.appointmentLetterPdfUrl ? 'Yes' : 'No'}</Text></View>
              </>
            ) : <Text style={styles.val}>No card info.</Text>}
          </View>
          <View style={styles.section}> 
            <Text style={styles.sectionTitle}>Geo</Text>
            <View style={styles.row}><Text style={styles.key}>Zone</Text><Text style={styles.val}>{item?.zone || item?.hrci?.zone || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.key}>State</Text><Text style={styles.val}>{(item as any)?.hrci?.state?.name || (item as any)?.hrci?.state || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.key}>District</Text><Text style={styles.val}>{(item as any)?.hrci?.district?.name || (item as any)?.hrci?.district || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.key}>Mandal</Text><Text style={styles.val}>{(item as any)?.hrci?.mandal?.name || (item as any)?.hrci?.mandal || '—'}</Text></View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor:'#fff' },
  appTitle: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7' },
  center: { flex:1, alignItems:'center', justifyContent:'center' },
  errTxt: { color:'#dc2626', fontWeight:'800' },
  content: { padding:12 },
  section: { backgroundColor:'#fff', borderRadius:14, padding:12, borderWidth:1, borderColor:'#eef2f7', marginBottom:12 },
  sectionTitle: { color:'#0f172a', fontWeight:'900', marginBottom:8, fontSize:14 },
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:4 },
  key: { color:'#64748b', fontWeight:'800', width:'40%' },
  val: { color:'#0f172a', fontWeight:'700', flex:1, textAlign:'right' },
});
