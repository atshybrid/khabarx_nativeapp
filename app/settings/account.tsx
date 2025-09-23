import { usePreferences } from '@/hooks/usePreferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AccountScreen() {
  const router = useRouter();
  const { prefs, updateLocation, loading } = usePreferences();
  const [localDraft, setLocalDraft] = React.useState<{ name: string; lat: number; lng: number } | null>(null);
  const [syncing, setSyncing] = React.useState(false);

  // When screen focused, see if location picker stored a new selection
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('profile_location_obj');
        if (!active) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          // Keep as draft until user presses save
          setLocalDraft(parsed);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []));

  const currentDisplay = () => {
    const loc: any = localDraft || prefs?.location;
    if (!loc) return 'Not set';
    const meta: string[] = [];
    if (loc.latitude != null && loc.longitude != null) {
      meta.push(`${Number(loc.latitude).toFixed(3)}, ${Number(loc.longitude).toFixed(3)}`);
    } else if (loc.lat != null && loc.lng != null) {
      meta.push(`${Number(loc.lat).toFixed(3)}, ${Number(loc.lng).toFixed(3)}`);
    }
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
      // Clear draft marker
      setLocalDraft(null);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Page</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location Preference</Text>
        <Text style={styles.value}>{currentDisplay()}</Text>
        {loading && <ActivityIndicator style={{ marginTop: 8 }} />}
        {localDraft && (
          <Text style={styles.draftNote}>Unsaved selection. Press Save to apply.</Text>
        )}
        <View style={styles.row}>
          <TouchableOpacity style={styles.smallBtn} onPress={() => router.push('/settings/location')}>
            <Text style={styles.smallBtnTxt}>Change</Text>
          </TouchableOpacity>
          {localDraft && (
            <TouchableOpacity style={[styles.smallBtn, styles.saveEmph]} onPress={saveDraftToPreferences} disabled={syncing}>
              <Text style={styles.smallBtnTxt}>{syncing ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/settings/account-debug')}
      >
        <Text style={styles.buttonText}>Test: Clear ALL App Storage</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 10,
  },
  card: {
    width: '90%',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  value: { marginTop: 6, fontSize: 14, color: '#444' },
  draftNote: { marginTop: 4, fontSize: 12, color: '#d97706' },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  smallBtn: { backgroundColor: '#6366f1', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  saveEmph: { backgroundColor: '#16a34a' },
  smallBtnTxt: { color: '#fff', fontWeight: '600' },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
  },
});
