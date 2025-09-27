import SettingsRow from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { LANGUAGES } from '@/constants/languages';
import { getUserPreferences, pickPreferenceLanguage, pickPreferenceLocation } from '@/services/api';
import { isCitizenReporter, loadTokens, softLogout } from '@/services/auth';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';

// Enable LayoutAnimation only on Old Architecture (Bridged) Android.
// On New Architecture (Fabric), this API is a no-op and logs a warning.
if (Platform.OS === 'android') {
  const isFabric = (global as any)?.nativeFabricUIManager != null;
  if (!isFabric && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function AccountScreen() {
  const [langName, setLangName] = useState<string>('');
  // const [langCode, setLangCode] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [locExpanded, setLocExpanded] = useState<boolean>(false);
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [roleReporter, setRoleReporter] = useState<boolean>(false);
  const [developerMode, setDeveloperMode] = useState<boolean>(false);
  // Profile welcome card removed per request

  const fetchPrefs = useCallback(async () => {
    try {
      const t = await loadTokens();
      const prefs = await getUserPreferences(t?.user?.id || (t as any)?.user?._id);
      const pl = pickPreferenceLanguage(prefs);
      const loc = pickPreferenceLocation(prefs);
      if (pl) {
        setLangName(pl.name);
        try { await AsyncStorage.setItem('selectedLanguage', JSON.stringify(pl)); } catch {}
      } else {
        const raw = await AsyncStorage.getItem('selectedLanguage');
        if (raw) {
          try {
            const j = JSON.parse(raw);
            if (j && typeof j === 'object' && j.name) {
              setLangName(j.name);
            } else if (typeof j === 'string') {
              const found = LANGUAGES.find(l => l.code === j);
              if (found) setLangName(found.name);
            }
          } catch {
            // raw might be a plain code string
            const found = LANGUAGES.find(l => l.code === raw);
            if (found) setLangName(found.name);
          }
        }
      }
      if (loc) {
        setLocation(loc);
        try { await AsyncStorage.setItem('profile_location', loc); } catch {}
      } else {
        const obj = await AsyncStorage.getItem('profile_location_obj');
        if (obj) {
          try { const parsed = JSON.parse(obj); setLocation(parsed?.name || parsed?.placeName || ''); }
          catch {}
        }
        if (!loc) {
          const l = await AsyncStorage.getItem('profile_location');
          setLocation(l || '');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await fetchPrefs();
      try {
        const t = await loadTokens();
        setLoggedIn(Boolean(t?.jwt));
      } catch {}
      try { setRoleReporter(await isCitizenReporter()); } catch {}
      // Initialize developer mode from env/AsyncStorage
      try {
        const raw = String(process.env.EXPO_PUBLIC_DEVELOPER_MODE ?? '').toLowerCase();
        const envOn = raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
        const stored = (await AsyncStorage.getItem('developer_mode')) === '1';
        setDeveloperMode(envOn || stored);
      } catch {}
    })();
  }, [fetchPrefs]);

  useFocusEffect(useCallback(() => {
    fetchPrefs();
    return () => {};
  }, [fetchPrefs]));

  const onToggleLocation = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLocExpanded((v) => !v);
  };

  const AppBarIcons = useMemo(() => {
    return (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => {
            if (loggedIn) router.push('/settings/profile');
            else router.push('/auth/login');
          }}
          style={styles.iconBtn}
        >
          <Feather name="user" size={18} color="#fff" />
        </Pressable>
        <Pressable
          onPress={async () => {
            if (loggedIn) {
              await softLogout();
              router.replace('/language');
            } else {
              router.push('/auth/login');
            }
          }}
          style={styles.iconBtn}
        >
          <Feather name={loggedIn ? 'log-out' : 'log-in'} size={18} color="#fff" />
        </Pressable>
      </View>
    );
  }, [loggedIn]);

  const toggleDeveloperMode = async () => {
    const next = !developerMode;
    setDeveloperMode(next);
    try { await AsyncStorage.setItem('developer_mode', next ? '1' : '0'); } catch {}
    try { Alert.alert('Developer mode', next ? 'Enabled' : 'Disabled'); } catch {}
  };

  return (
    <View style={styles.safe}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <Pressable onLongPress={toggleDeveloperMode} delayLongPress={600} hitSlop={8}>
          <Text style={styles.appTitle}>Account{developerMode ? ' · Dev' : ''}</Text>
        </Pressable>
        {AppBarIcons}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Preferences section */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        {/* Language */}
        <View style={styles.card}>
          <SettingsRow
            icon={<Feather name="globe" size={20} color={Colors.light.primary} />}
            title="Language"
            subtitle={langName || 'Select your app language'}
            onPress={() => router.push('/language')}
          />
        </View>

        {/* Privacy & Security */}
        <View style={styles.card}>
          <SettingsRow
            icon={<Feather name="shield" size={20} color={Colors.light.primary} />}
            title="Privacy & Security"
            subtitle="Privacy policy, terms, permissions"
            onPress={() => router.push('/settings/privacy')}
          />
        </View>

        {/* Location (collapsible) */}
        <View style={styles.card}>
          <SettingsRow
            icon={<Feather name="map-pin" size={20} color={Colors.light.primary} />}
            title="Location"
            subtitle={location || 'Choose your area'}
            onPress={onToggleLocation}
            chevronDirection={locExpanded ? 'down' : 'right'}
          />
          {locExpanded ? (
            <View style={styles.locDetails}>
              <Text style={styles.locTitle}>Current</Text>
              <Text style={styles.locValue} numberOfLines={2}>{location || 'Not set'}</Text>
            </View>
          ) : null}
        </View>

        {/* Reporter card (hidden as requested) */}
        {false && roleReporter ? (
          <View style={styles.card}>
            <SettingsRow
              icon={<Feather name="user-check" size={20} color={Colors.light.primary} />}
              title="Citizen Reporter"
              subtitle="Manage your reporter profile"
              onPress={() => router.push('/reporter/dashboard')}
            />
          </View>
        ) : null}

        {/* Appearance */}
        <View style={styles.card}>
          <SettingsRow
            icon={<Feather name="moon" size={20} color={Colors.light.primary} />}
            title="Appearance"
            subtitle="Theme, font size, reading mode"
            onPress={() => router.push('/settings/appearance')}
          />
        </View>

        {/* Storage / Downloads */}
        <View style={styles.card}>
          <SettingsRow
            icon={<Feather name="download" size={20} color={Colors.light.primary} />}
            title="Downloads & Storage"
            subtitle="Offline, saved items, cache"
            onPress={() => router.push('/settings/storage')}
          />
        </View>

        {/* Support & About */}
        <View style={styles.card}>
          <SettingsRow
            icon={<Feather name="help-circle" size={20} color={Colors.light.primary} />}
            title="Support & Feedback"
            subtitle="Contact us, report an issue"
            onPress={() => router.push('/settings/support')}
          />
        </View>
        <View style={styles.card}>
          <SettingsRow
            icon={<Feather name="info" size={20} color={Colors.light.primary} />}
            title="About"
            subtitle="Version and app info"
            onPress={() => router.push('/settings/about')}
          />
        </View>

        {/* Debug utilities (visible only in Developer Mode) */}
        {developerMode && (
          <View style={styles.card}>
            <SettingsRow
              icon={<Feather name="tool" size={20} color={Colors.light.primary} />}
              title="Account debug"
              subtitle="Reset app storage, tokens, etc."
              onPress={() => router.push('/settings/account-debug')}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  appTitle: { fontSize: 18, fontWeight: '800', color: Colors.light.primary },
  iconBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.light.secondary, borderRadius: 8 },
  content: { padding: 12, gap: 12 },
  sectionTitle: { marginTop: 4, marginBottom: 4, color: '#64748b', fontWeight: '800', fontSize: 12, paddingHorizontal: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  locDetails: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eef2f7' },
  locTitle: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  locValue: { marginTop: 4, color: '#0f172a' },
  changeBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: Colors.light.secondary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  changeBtnTxt: { color: '#fff', fontWeight: '800' },
  // Removed avatar styles with welcome card
});
