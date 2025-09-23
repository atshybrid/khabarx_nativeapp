import { usePreferences } from '@/hooks/usePreferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AccountScreen() {
  const router = useRouter();
  const { prefs, updateLocation, loading } = usePreferences();
  const [localDraft, setLocalDraft] = React.useState<{ name: string; lat: number; lng: number } | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [inlineMsg, setInlineMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [gpsBusy, setGpsBusy] = React.useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('profile_location_obj');
        if (!active) return;
        if (raw) {
          setLocalDraft(JSON.parse(raw));
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []));

  const currentDisplay = () => {
    const loc: any = localDraft || prefs?.location;
    if (!loc) return 'Not set';
    const meta: string[] = [];
    if (loc.latitude != null && loc.longitude != null) meta.push(`${Number(loc.latitude).toFixed(3)}, ${Number(loc.longitude).toFixed(3)}`);
    else if (loc.lat != null && loc.lng != null) meta.push(`${Number(loc.lat).toFixed(3)}, ${Number(loc.lng).toFixed(3)}`);
    return loc.placeName || loc.name || meta.join(' ');
  };

  const saveDraftToPreferences = async () => {
    if (!localDraft) return;
    setSyncing(true);
    try {
      await updateLocation({
        latitude: localDraft.lat,
        longitude: localDraft.lng,
        placeName: localDraft.name,
        source: 'manual-map',
      });
      setLocalDraft(null);
      setInlineMsg({ type: 'success', text: 'Location updated.' });
    } catch (e: any) {
      setInlineMsg({ type: 'error', text: e?.message || 'Failed to update location.' });
    } finally {
      setSyncing(false);
    }
  };

  const refreshViaGPS = async () => {
    if (gpsBusy) return;
    setGpsBusy(true); setInlineMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setInlineMsg({ type: 'error', text: 'Location permission denied.' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      let placeName: string | undefined;
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
        const first = rev[0];
        if (first) placeName = [first.name, first.subregion, first.region].filter(Boolean).join(', ');
      } catch {}
      await updateLocation({ latitude, longitude, placeName, source: 'gps-refresh' });
      setInlineMsg({ type: 'success', text: 'Location refreshed from GPS.' });
    } catch (e: any) {
      setInlineMsg({ type: 'error', text: e?.message || 'Failed to refresh location.' });
    } finally {
      setGpsBusy(false);
    }
  };

  const lastUpdated = prefs?.updatedAt ? new Date(prefs.updatedAt) : null;
  const lastUpdatedLabel = lastUpdated ? `Updated ${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Never updated';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Page</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location Preference</Text>
        <Text style={styles.value}>{currentDisplay()}</Text>
        <Text style={styles.metaLabel}>{lastUpdatedLabel}</Text>
        {loading && <ActivityIndicator style={{ marginTop: 8 }} />}
        {localDraft && (<Text style={styles.draftNote}>Unsaved selection. Press Save to apply.</Text>)}
        {inlineMsg && (
          <View style={[styles.inlineMsg, inlineMsg.type === 'error' ? styles.inlineErr : styles.inlineOk]}>
            <Text style={styles.inlineMsgTxt}>{inlineMsg.text}</Text>
          </View>
        )}
        <View style={styles.row}>
          <TouchableOpacity style={styles.smallBtn} onPress={() => router.push('/settings/location')}>
            <Text style={styles.smallBtnTxt}>Change</Text>
          </TouchableOpacity>
          {localDraft && (
            <TouchableOpacity style={[styles.smallBtn, styles.saveEmph]} onPress={saveDraftToPreferences} disabled={syncing}>
              <Text style={styles.smallBtnTxt}>{syncing ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          )}
          {!localDraft && (
            <TouchableOpacity style={[styles.smallBtn, styles.gpsBtn]} onPress={refreshViaGPS} disabled={gpsBusy}>
              <Text style={styles.smallBtnTxt}>{gpsBusy ? 'GPS…' : 'Refresh GPS'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/settings/account-debug')}>
        <Text style={styles.buttonText}>Test: Clear ALL App Storage</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 32,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#111827',
  },
  card: {
    width: '90%',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  value: { marginTop: 6, fontSize: 14, color: '#374151' },
  metaLabel: { marginTop: 4, fontSize: 11, color: '#6b7280' },
  draftNote: { marginTop: 4, fontSize: 12, color: '#d97706' },
  inlineMsg: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  inlineErr: { backgroundColor: '#fee2e2' },
  inlineOk: { backgroundColor: '#dcfce7' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  smallBtn: { backgroundColor: '#6366f1', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, marginRight: 8 },
  saveEmph: { backgroundColor: '#16a34a' },
  gpsBtn: { backgroundColor: '#0d9488' },
  smallBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  inlineMsgTxt: { fontSize: 12, color: '#111827' },
});
