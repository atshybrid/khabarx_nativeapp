import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getUserPreferences, resolveEffectiveLanguage } from '@/services/api';
import { loadTokens } from '@/services/auth';
import { autoSyncPreferences } from '@/services/loginSync';
import { getCurrentPushToken } from '@/services/notifications';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type LangObj = { id?: string; code?: string; name?: string; nativeName?: string } | null;

export default function PreferencesDebugScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const [effective, setEffective] = React.useState<LangObj>(null);
  const [langLocal, setLangLocal] = React.useState<LangObj>(null);
  const [selected, setSelected] = React.useState<LangObj>(null);
  const [authLangId, setAuthLangId] = React.useState<string | undefined>(undefined);
  const [tokenUserLangId, setTokenUserLangId] = React.useState<string | undefined>(undefined);
  const [localPushToken, setLocalPushToken] = React.useState<string | undefined>(undefined);
  const [serverPushToken, setServerPushToken] = React.useState<string | undefined>(undefined);
  const [serverHasPush, setServerHasPush] = React.useState<boolean>(false);
  const [userId, setUserId] = React.useState<string | undefined>(undefined); // displayed only

  const loadAll = React.useCallback(async () => {
    let uidLocal: string | undefined = undefined;
    try {
      const eff = await resolveEffectiveLanguage();
      setEffective(eff);
    } catch { setEffective(null); }
    try {
      const raw = await AsyncStorage.getItem('language_local');
      setLangLocal(raw ? JSON.parse(raw) : null);
    } catch { setLangLocal(null); }
    try {
      const raw = await AsyncStorage.getItem('selectedLanguage');
      setSelected(raw ? JSON.parse(raw) : null);
    } catch { setSelected(null); }
    try {
      const raw = await AsyncStorage.getItem('authLanguageId');
      setAuthLangId(raw || undefined);
    } catch { setAuthLangId(undefined); }
    try {
      const tokens = await loadTokens();
      setTokenUserLangId(tokens?.user?.languageId || tokens?.languageId || undefined);
  uidLocal = (tokens as any)?.user?.id || (tokens as any)?.user?._id || (tokens as any)?.user?.userId;
  setUserId(uidLocal || undefined);
    } catch { setTokenUserLangId(undefined); }

    try {
      const t = await getCurrentPushToken();
      setLocalPushToken(t);
    } catch { setLocalPushToken(undefined); }

    try {
      // Fetch server prefs to inspect stored push token
      const prefs = uidLocal ? await getUserPreferences(uidLocal) : null;
      setServerHasPush(Boolean(prefs?.device?.hasPushToken));
      setServerPushToken((prefs as any)?.device?.pushToken || undefined);
    } catch {
      setServerHasPush(false);
      setServerPushToken(undefined);
    }
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const copy = async (label: string, value: string) => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(value);
      Alert.alert('Copied', `${label} copied to clipboard`);
    } catch {}
  };

  const Row = ({ label, value }: { label: string; value?: string }) => (
    <View style={[styles.row, { borderBottomColor: border }]}> 
      <Text style={[styles.label, { color: muted }]}>{label}</Text>
      <View style={styles.rowRight}>
        <Text numberOfLines={2} style={[styles.value, { color: text }]}>{value || '—'}</Text>
        {value ? (
          <Pressable onPress={() => copy(label, value)} hitSlop={8}>
            <MaterialIcons name="content-copy" size={18} color={Colors.light.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.safe, { backgroundColor: bg }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.title, { color: text }]}>Preferences Debug</Text>
          <Text style={[styles.subtitle, { color: muted }]}>Inspect local language sources</Text>
          <View style={{ height: 10 }} />
          <Row label="Effective language id" value={effective?.id} />
          <Row label="Effective language code" value={effective?.code} />
          <Row label="language_local.id" value={String(langLocal?.id || '') || undefined} />
          <Row label="language_local.code" value={String(langLocal?.code || '') || undefined} />
          <Row label="selectedLanguage.id" value={String((selected as any)?.id || '') || undefined} />
          <Row label="selectedLanguage.code" value={String((selected as any)?.code || (selected as any)?.slug || '') || undefined} />
          <Row label="authLanguageId (storage)" value={authLangId} />
          <Row label="userId" value={userId} />
          <Row label="tokens.user.languageId" value={tokenUserLangId} />
              <View style={{ height: 8 }} />
              <Text style={[styles.subtitle, { color: muted }]}>Push tokens</Text>
              <Row label="Local Expo pushToken" value={localPushToken} />
              <Row label="Server hasPushToken" value={serverHasPush ? 'true' : 'false'} />
              <Row label="Server device.pushToken" value={serverPushToken} />
          <View style={{ height: 12 }} />
          <Pressable onPress={loadAll} style={[styles.refreshBtn, { borderColor: border }]}>
            <MaterialIcons name="refresh" size={16} color={Colors.light.primary} />
            <Text style={{ marginLeft: 6, color: Colors.light.primary, fontWeight: '700' }}>Refresh</Text>
          </Pressable>
              <View style={{ height: 8 }} />
              <Pressable
                onPress={async () => { try { await autoSyncPreferences('manual'); } catch {}; try { await loadAll(); } catch {} }}
                style={[styles.refreshBtn, { borderColor: border }]}
              >
                <MaterialIcons name="sync" size={16} color={Colors.light.primary} />
                <Text style={{ marginLeft: 6, color: Colors.light.primary, fontWeight: '700' }}>Resync now</Text>
              </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { marginTop: 4, fontSize: 12 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '65%' },
  label: { fontSize: 12 },
  value: { fontSize: 13, fontWeight: '700' },
  refreshBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center' },
});
