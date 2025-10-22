import { Loader } from '@/components/ui/Loader';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getCachedPermissions, requestAppPermissions, type PermissionStatus } from '@/services/permissions';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PermissionsScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const [perm, setPerm] = useState<PermissionStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const load = async () => {
    setLoading(true);
    try { setPerm(await getCachedPermissions()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const updated = await requestAppPermissions();
      setPerm(updated);
    } finally {
      setRefreshing(false);
    }
  };

  const StatusPill = ({ label, value }: { label: string; value?: string | null }) => (
    <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.04)', borderColor: border }]}> 
      <Text style={[styles.pillText, { color: muted }]}>{label}</Text>
      <Text style={[styles.pillValue, { color: text }]}>{value || 'unknown'}</Text>
    </View>
  );

  const Row = ({ icon, title, subtitle, right }: { icon: any; title: string; subtitle?: string; right?: React.ReactNode }) => (
    <View style={styles.row}> 
      <View style={[styles.iconWrap, { borderColor: border }]}>
        <Feather name={icon} size={18} color={text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: muted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );

  return (
    <View style={[styles.safe, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}> 
          <View style={styles.headerIconWrap}><Feather name="key" size={20} color={text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>App Permissions</Text>
            <Text style={[styles.subtitle, { color: muted }]}>Overview of permissions used by the app</Text>
          </View>
        </View>

        {loading && (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Loader size={48} />
          </View>
        )}

        {!loading && (
          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
            <Row icon="bell" title="Notifications" subtitle="Push notifications and alerts" right={<StatusPill label="Status" value={perm?.notifications} />} />
            <View style={styles.separator} />
            <Row icon="image" title="Photos / Media" subtitle="Access to your photo library" right={<StatusPill label="Status" value={perm?.mediaLibrary} />} />
            <View style={styles.separator} />
            <Row icon="map-pin" title="Location" subtitle="Approximate / Precise location" right={<StatusPill label="Status" value={perm?.location} />} />

            {perm?.coords ? (
              <View style={[styles.extra, { borderTopColor: border }]}> 
                <Text style={[styles.extraTitle, { color: text }]}>Last Known Location</Text>
                <Text style={[styles.extraText, { color: muted }]}>{perm.coords.latitude.toFixed(4)}, {perm.coords.longitude.toFixed(4)}</Text>
                {!!perm.place?.fullName && <Text style={[styles.extraText, { color: muted }]}>{perm.place.fullName}</Text>}
              </View>
            ) : null}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>How to change permissions</Text>
          <Text style={[styles.help, { color: muted }]}>
            You can change permissions anytime from your device Settings. Use pull-to-refresh here after changes.
          </Text>
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 2 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSubtitle: { marginTop: 2, fontSize: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  pillText: { fontSize: 12, marginRight: 6 },
  pillValue: { fontSize: 12, fontWeight: '800' },
  extra: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4 },
  extraTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  extraText: { fontSize: 12 },
  help: { fontSize: 13 },
});
