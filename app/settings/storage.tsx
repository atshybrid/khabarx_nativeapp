import { useThemeColor } from '@/hooks/useThemeColor';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export default function StorageScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const primary = useThemeColor({}, 'primary');

  const [clearing, setClearing] = useState(false);
  const [downloadsOnlyWifi, setDownloadsOnlyWifi] = useState(true);
  const [downloadQuality, setDownloadQuality] = useState<'auto'|'high'|'data-saver'>('auto');
  const [sizes, setSizes] = useState<{ cacheMB: number; downloadsMB: number; storageMB: number }>({ cacheMB: 0, downloadsMB: 0, storageMB: 0 });

  const computeSizes = useCallback(async () => {
    try {
      // App document directory and cache directory
      const cacheDir = ((FileSystem as any).cacheDirectory as string | null) ?? '';
      const docDir = ((FileSystem as any).documentDirectory as string | null) ?? '';
      const downDir = docDir + 'downloads/';
      const cacheSize = await dirSizeMB(cacheDir);
      const downloadsSize = await dirSizeMB(downDir);
      // AsyncStorage rough estimate: number of keys * average size (unknown). We'll skip accurate sizing.
      const keys = await AsyncStorage.getAllKeys();
      const storageMB = Math.max(0, Math.min(50, Math.round((keys.length * 0.005) * 100) / 100));
      setSizes({ cacheMB: cacheSize, downloadsMB: downloadsSize, storageMB });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Load pref toggles
      const wifi = await AsyncStorage.getItem('pref_dl_wifi_only');
      setDownloadsOnlyWifi(wifi !== '0');
      const qual = await AsyncStorage.getItem('pref_dl_quality');
      if (qual === 'high' || qual === 'data-saver' || qual === 'auto') setDownloadQuality(qual);
      // Estimate sizes
      await computeSizes();
    })();
  }, [computeSizes]);

  const dirSizeMB = async (path: string): Promise<number> => {
    if (!path) return 0;
    let total = 0;
    try {
      const walk = async (p: string) => {
        const entries = await FileSystem.readDirectoryAsync(p).catch(() => [] as string[]);
        for (const name of entries) {
          const full = p + (p.endsWith('/') ? '' : '/') + name;
          const info = await FileSystem.getInfoAsync(full).catch(() => ({ exists: false } as any));
          if (!info?.exists) continue;
          if (info.isDirectory) await walk(full);
          else total += (info.size ?? 0);
        }
      };
      await walk(path);
    } catch {}
    return Math.round((total / (1024 * 1024)) * 100) / 100; // MB rounded to 2 decimals
  };

  const clearCache = async () => {
    try {
      setClearing(true);
      // Clear only app caches, not auth or preferences. Simplified: nuke select keys.
      const keys = await AsyncStorage.getAllKeys();
      const keep = new Set<string>([
        'jwt','refreshToken','jwtExpiresAt','authLanguageId','authUserJSON',
        'selectedLanguage',
        // preserve local language overrides for member/admin
        'language_local','language_local_id','language_local_code','language_local_name',
        'profile_location','profile_location_obj','last_login_mobile',
        'pref_dl_wifi_only','pref_dl_quality','pref_theme','pref_font_scale','pref_reading_mode']);
      const toRemove = keys.filter(k => !keep.has(k) && !k.startsWith('expo') && !k.startsWith('RNAsyncStorageProvider'));
      if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
      // Optionally clear cache directory contents
  const cacheDir = ((FileSystem as any).cacheDirectory as string | null) ?? '';
      if (cacheDir) {
        const entries = await FileSystem.readDirectoryAsync(cacheDir).catch(() => [] as string[]);
        for (const name of entries) {
          const full = cacheDir + (cacheDir.endsWith('/') ? '' : '/') + name;
          await FileSystem.deleteAsync(full, { idempotent: true }).catch(() => {});
        }
      }
      await computeSizes();
      Alert.alert('Done', 'Cache cleared');
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not clear cache');
    } finally { setClearing(false); }
  };

  const clearDownloads = async () => {
    try {
  const docDir = ((FileSystem as any).documentDirectory as string | null) ?? '';
      const downDir = docDir + 'downloads/';
      const ok = await FileSystem.getInfoAsync(downDir).catch(() => ({ exists: false } as any));
      if (ok.exists) await FileSystem.deleteAsync(downDir, { idempotent: true });
      await computeSizes();
      Alert.alert('Done', 'Downloads cleared');
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not clear downloads');
    }
  };

  const setWifiOnly = async (v: boolean) => {
    setDownloadsOnlyWifi(v);
    await AsyncStorage.setItem('pref_dl_wifi_only', v ? '1' : '0');
  };
  const setQuality = async (q: 'auto'|'high'|'data-saver') => {
    setDownloadQuality(q);
    await AsyncStorage.setItem('pref_dl_quality', q);
  };

  const ItemRow = ({ icon, title, subtitle, right, onPress }: { icon: any; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { backgroundColor: card, borderColor: border }, pressed && { opacity: 0.9 }]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconWrap, { borderColor: border }]}>
          <Feather name={icon} size={18} color={text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: text }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.rowSubtitle, { color: muted }]}>{subtitle}</Text>}
        </View>
      </View>
      {right}
    </Pressable>
  );

  const Pill = ({ label, value }: { label: string; value: string | number }) => (
    <View style={[styles.pill, { borderColor: border }]}>
      <Text style={[styles.pillText, { color: muted }]}>{label}</Text>
      <Text style={[styles.pillValue, { color: text }]}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.safe, { backgroundColor: bg }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}> 
          <View style={styles.headerIconWrap}><Feather name="download" size={20} color={text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>Downloads & Storage</Text>
            <Text style={[styles.subtitle, { color: muted }]}>Manage offline content and app storage</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>Usage</Text>
          <View style={styles.separator} />
          <View style={styles.usageRow}>
            <Pill label="Cache" value={`${sizes.cacheMB} MB`} />
            <Pill label="Downloads" value={`${sizes.downloadsMB} MB`} />
            <Pill label="Storage" value={`${sizes.storageMB} MB`} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>Downloads</Text>
          <View style={styles.separator} />
          <ItemRow icon="wifi" title="Wi‑Fi only" subtitle="Download on Wi‑Fi to save mobile data" right={<Switch value={downloadsOnlyWifi} onValueChange={setWifiOnly} />} />
          <View style={styles.divider} />
          <Text style={[styles.optionTitle, { color: text, marginBottom: 8 }]}>Quality</Text>
          <View style={styles.qualityRow}>
            {(['auto','high','data-saver'] as const).map((q) => (
              <Pressable key={q} onPress={() => setQuality(q)} style={[styles.qualityPill, { borderColor: downloadQuality === q ? primary : border, backgroundColor: card }]}> 
                <Text style={[styles.qualityText, { color: downloadQuality === q ? primary : muted }]}>
                  {q === 'auto' ? 'Auto' : q === 'high' ? 'High' : 'Data Saver'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
          <Text style={[styles.cardTitle, { color: text }]}>Maintenance</Text>
          <View style={styles.separator} />
          <ItemRow icon="trash-2" title="Clear cache" subtitle="Remove temporary files and thumbnails" right={<Feather name="chevron-right" size={18} color={muted} />} onPress={clearing ? undefined : clearCache} />
          <View style={styles.divider} />
          <ItemRow icon="folder" title="Clear downloads" subtitle="Delete offline content" right={<Feather name="chevron-right" size={18} color={muted} />} onPress={clearDownloads} />
        </View>

        <Text style={{ color: muted, marginTop: 2, marginBottom: 10 }}>These settings are saved on this device. Sizes are estimates.</Text>
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
  optionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, marginRight: 8 },
  pillText: { fontSize: 12, marginRight: 6 },
  pillValue: { fontSize: 12, fontWeight: '800' },
  usageRow: { flexDirection: 'row', alignItems: 'center' },
  qualityRow: { flexDirection: 'row' },
  qualityPill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, marginRight: 8 },
  qualityText: { fontWeight: '800', fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },
});
