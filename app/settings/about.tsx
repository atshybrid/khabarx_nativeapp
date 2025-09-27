import { WEB_BASE_URL } from '@/config/appConfig';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AboutScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const version = (Constants as any)?.expoConfig?.version || (Constants as any)?.nativeAppVersion || '1.0.0';
  const build = (Constants as any)?.expoConfig?.android?.versionCode || (Constants as any)?.expoConfig?.ios?.buildNumber || (Constants as any)?.nativeBuildVersion || '';
  const appName = (Constants as any)?.expoConfig?.name || 'KhabarX';

  const copyInfo = async () => {
    try {
      await Clipboard.setStringAsync(`${appName} v${version}${build ? ` (${build})` : ''} — ${Platform.OS}`);
      Alert.alert('Copied', 'App info copied to clipboard');
    } catch {}
  };

  const ItemRow = ({ icon, title, subtitle, onPress }: { icon: any; title: string; subtitle?: string; onPress?: () => void }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { backgroundColor: card, borderColor: border }, pressed && { opacity: 0.92 }]}> 
      <View style={styles.rowLeft}>
        <View style={[styles.iconWrap, { borderColor: border }]}>
          <Feather name={icon} size={18} color={text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: text }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.rowSubtitle, { color: muted }]}>{subtitle}</Text>}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={muted} />
    </Pressable>
  );

  return (
    <View style={[styles.safe, { backgroundColor: bg }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}> 
          <View style={styles.headerIconWrap}><Feather name="info" size={20} color={text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>{appName}</Text>
            <Text style={[styles.subtitle, { color: muted }]}>Fast, beautiful news for everyone</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>App details</Text>
          <View style={styles.separator} />
          <ItemRow icon="tag" title={`Version ${version}${build ? ` (${build})` : ''}`} subtitle={Platform.OS.toUpperCase()} onPress={copyInfo} />
          <View style={styles.divider} />
          <ItemRow icon="globe" title="Website" subtitle="Open our homepage" onPress={() => Linking.openURL(WEB_BASE_URL).catch(() => Alert.alert('Error', 'Unable to open website'))} />
        </View>

        {/* Legal section removed as requested */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 2 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSubtitle: { marginTop: 2, fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },
});
