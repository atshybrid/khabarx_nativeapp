import { WEB_BASE_URL } from '@/config/appConfig';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getDeviceIdentity } from '@/services/device';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

export default function SupportScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceModel, setDeviceModel] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const id = await getDeviceIdentity();
        setDeviceId(id.deviceId);
        setDeviceModel(id.deviceModel || 'Unknown');
      } catch {}
    })();
  }, []);

  const versionName = (Constants as any)?.expoConfig?.version || (Constants as any)?.nativeAppVersion || '1.0.0';
  const buildCode = (Constants as any)?.expoConfig?.android?.versionCode || (Constants as any)?.nativeBuildVersion || '';

  const sendEmail = (kind: 'support' | 'feature' = 'support') => {
    const to = 'info@hrcitodaynews.in';
    const subject = encodeURIComponent(
      `KhabarX ${kind === 'support' ? 'Support' : 'Feature Request'} — v${versionName} (${Platform.OS}${buildCode ? `, ${buildCode}` : ''})`
    );
    const body = encodeURIComponent(
      `Hello KhabarX team,%0D%0A%0D%0A` +
      `${kind === 'support' ? 'I need help with...' : 'I have a feature idea: ...'}%0D%0A%0D%0A` +
      `—%0D%0ADevice ID: ${deviceId}%0D%0ADevice: ${deviceModel}%0D%0APlatform: ${Platform.OS}%0D%0AApp: v${versionName}${buildCode ? ` (${buildCode})` : ''}`
    );
    const url = `mailto:${to}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open mail'));
  };

  const openSupport = () => {
    Linking.openURL(`${WEB_BASE_URL}/support`).catch(() => Alert.alert('Error', 'Unable to open website'));
  };

  const rateUs = () => {
    const pkg = (Constants as any)?.expoConfig?.android?.package || 'com.amoghnya.khabarx';
    const url = `market://details?id=${pkg}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${pkg}`;
    Linking.openURL(url).catch(() => Linking.openURL(webUrl).catch(() => Alert.alert('Error', 'Unable to open Play Store')));
  };

  const shareApp = async () => {
    try {
      const pkg = (Constants as any)?.expoConfig?.android?.package || 'com.amoghnya.khabarx';
      const link = `https://play.google.com/store/apps/details?id=${pkg}`;
      await Share.share({ message: `Try KhabarX — fast, beautiful news. ${link}` });
    } catch {}
  };

  const copyDebugInfo = async () => {
    const info = `KhabarX v${versionName}${buildCode ? ` (${buildCode})` : ''}\nPlatform: ${Platform.OS}\nDevice: ${deviceModel}\nDevice ID: ${deviceId}`;
    try {
      await Clipboard.setStringAsync(info);
      Alert.alert('Copied', 'Debug info copied to clipboard');
    } catch {
      Alert.alert('Failed', 'Unable to copy');
    }
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
          <View style={styles.headerIconWrap}><Feather name="help-circle" size={20} color={text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>Support & Feedback</Text>
            <Text style={[styles.subtitle, { color: muted }]}>We’re here to help — reach us anytime</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>Get help</Text>
          <View style={styles.separator} />
          <ItemRow icon="mail" title="Contact support" subtitle="Email us your questions" onPress={() => sendEmail('support')} />
          <View style={styles.divider} />
          <ItemRow icon="alert-circle" title="Report an issue" subtitle="Open our support page" onPress={openSupport} />
          <View style={styles.divider} />
          <ItemRow icon="star" title="Rate us" subtitle="Love the app? Leave a review" onPress={rateUs} />
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>Feedback</Text>
          <View style={styles.separator} />
          <ItemRow icon="message-square" title="Feature request" subtitle="Tell us what to build next" onPress={() => sendEmail('feature')} />
          <View style={styles.divider} />
          <ItemRow icon="share-2" title="Share KhabarX" subtitle="Invite friends to try the app" onPress={shareApp} />
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>App info</Text>
          <View style={styles.separator} />
          <ItemRow icon="info" title={`Version ${versionName}${buildCode ? ` (${buildCode})` : ''}`} subtitle={`${Platform.OS} • ${deviceModel}`} onPress={copyDebugInfo} />
        </View>
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
