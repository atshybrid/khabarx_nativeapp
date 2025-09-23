import BottomSheet from '@/components/ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { LANGUAGES, type Language } from '@/constants/languages';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { logout } from '@/services/api';
import { softLogout } from '@/services/auth';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountScreen() {
  const router = useRouter();
  const { setTabBarVisible } = useTabBarVisibility();
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState<Language | null>(null);
  const [notify, setNotify] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  useEffect(() => {
    (async () => {
      const jwt = await AsyncStorage.getItem('jwt');
      setLoggedIn(Boolean(jwt));
      const savedLang = await AsyncStorage.getItem('selectedLanguage');
      if (savedLang) {
        try {
          const parsed = JSON.parse(savedLang);
          if (parsed && typeof parsed === 'object' && parsed.code) setLanguage(parsed as Language);
          else if (typeof parsed === 'string') setLanguage(LANGUAGES.find(l => l.code === parsed) || LANGUAGES[0]);
        } catch {
          setLanguage(LANGUAGES[0]);
        }
      } else {
        setLanguage(LANGUAGES[0]);
      }
      setNotify((await AsyncStorage.getItem('notify')) !== '0');
      setAutoplay((await AsyncStorage.getItem('autoplay')) === '1');
      const savedName = await AsyncStorage.getItem('profile_name');
      if (savedName) setName(savedName);
      const savedRole = await AsyncStorage.getItem('profile_role');
      if (savedRole) setRole(savedRole);
      const savedLocObj = await AsyncStorage.getItem('profile_location_obj');
      if (savedLocObj) {
        try {
          const obj = JSON.parse(savedLocObj);
          setLocation(obj?.name || '');
        } catch {
          const savedLoc = await AsyncStorage.getItem('profile_location');
          if (savedLoc) setLocation(savedLoc);
        }
      } else {
        const savedLoc = await AsyncStorage.getItem('profile_location');
        if (savedLoc) setLocation(savedLoc);
      }
    })();
  }, []);

  // Refresh location when coming back from picker
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const savedLocObj = await AsyncStorage.getItem('profile_location_obj');
        if (savedLocObj) {
          try { const obj = JSON.parse(savedLocObj); setLocation(obj?.name || ''); } catch {}
        }
      })();
      return () => {};
    }, [])
  );

  // Persist toggles immediately (remove Save button)
  useEffect(() => { AsyncStorage.setItem('notify', notify ? '1' : '0'); }, [notify]);
  useEffect(() => { AsyncStorage.setItem('autoplay', autoplay ? '1' : '0'); }, [autoplay]);
  const persistLanguage = useCallback(async (lang: Language) => {
    setLanguage(lang);
    await AsyncStorage.setItem('selectedLanguage', JSON.stringify(lang));
  }, []);

  const gotoLogin = () => router.push('/auth/login');
  const doLogout = async () => {
    try {
      const jwt = await AsyncStorage.getItem('jwt');
      const mobile = await AsyncStorage.getItem('profile_mobile') || await AsyncStorage.getItem('last_login_mobile') || '';
        if (jwt) { try { await logout(); } catch (e:any) { console.warn('[UI] remote logout failed (continuing)', e?.message); } }
  // legacy is_guest_session flag no longer in use
      await softLogout([], mobile || undefined);
      setLoggedIn(false);
      // Keep role if present but tokens gone; ensures fast MPIN flow next time
    } catch (e) {
      try { console.warn('[UI] logout failed locally', (e as any)?.message); } catch {}
    }
  };

  const changeLocation = () => router.push({ pathname: '/settings/location' as any });
  const languageDisplay = useMemo(() => language?.name ?? 'English', [language]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.appBar}>
        <Pressable onPress={() => router.replace('/news')} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={Colors.light.primary} />
          <Text style={styles.backText}>Home</Text>
        </Pressable>
        <Text style={styles.appBarTitle}>Account</Text>
        <View style={{ width: 60 }} />
      </View>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(name || 'G').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.displayName}>{loggedIn ? name || 'User' : 'Reader'}</Text>
            <Text style={styles.subtleText}>{loggedIn ? (role || 'Member') : 'Not signed in'}</Text>
          </View>
          {loggedIn ? (
            <Pressable onPress={doLogout} style={[styles.button, styles.secondary, { width: 100 }]}>
              <Text style={[styles.buttonText, { color: Colors.light.primary }]}>Logout</Text>
            </Pressable>
          ) : (
            <Pressable onPress={gotoLogin} style={[styles.button, styles.primary, { width: 100 }]}>
              <Text style={[styles.buttonText, { color: '#fff' }]}>Sign In</Text>
            </Pressable>
          )}
        </View>
        {!loggedIn && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.helper}>Sign in or register as a Citizen Reporter to manage your profile and post.</Text>
            <Pressable onPress={gotoLogin} style={[styles.button, styles.primary, { marginTop: 12 }]}>
              <Text style={[styles.buttonText, { color: '#fff' }]}>Sign In / Register</Text>
            </Pressable>
          </View>
        )}

        {/* Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>{location ? location : 'Not set'}</Text>
              <Text style={styles.helper}>Used to personalize local news</Text>
            </View>
            <Pressable onPress={changeLocation} style={[styles.button, styles.secondary, { paddingHorizontal: 14 }]}>
              <Text style={[styles.buttonText, { color: Colors.light.primary, fontSize: 14 }]}>Change location</Text>
            </Pressable>
          </View>
        </View>

        {/* Language Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Language</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>{languageDisplay}</Text>
              <Text style={styles.helper}>App language for headlines and UI</Text>
            </View>
            <Pressable onPress={() => setLangSheetOpen(true)} style={[styles.button, styles.secondary, { paddingHorizontal: 14 }]}>
              <Text style={[styles.buttonText, { color: Colors.light.primary, fontSize: 14 }]}>Change</Text>
            </Pressable>
          </View>
        </View>

        {/* Other Preferences */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferences</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Notifications</Text>
              <Text style={styles.helper}>Breaking news and daily digests</Text>
            </View>
            <Switch value={notify} onValueChange={setNotify} />
          </View>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Video autoplay</Text>
              <Text style={styles.helper}>Play videos automatically on Wi‑Fi</Text>
            </View>
            <Switch value={autoplay} onValueChange={setAutoplay} />
          </View>
        </View>

        {/* Language Picker Bottom Sheet */}
        <BottomSheet
          visible={langSheetOpen}
          onClose={() => setLangSheetOpen(false)}
          snapPoints={[400]}
          initialSnapIndex={0}
          respectSafeAreaBottom={false}
          shadowEnabled={false}
          header={
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.light.primary }}>Select language</Text>
              <Pressable onPress={() => setLangSheetOpen(false)} accessibilityLabel="Close language picker">
                <MaterialIcons name="close" size={22} color={Colors.light.primary} />
              </Pressable>
            </View>
          }
        >
          <View style={{ paddingBottom: 50 }}>
            {LANGUAGES.map((l) => {
              const active = language?.code === l.code;
              return (
                <Pressable
                  key={l.code}
                  onPress={async () => { await persistLanguage(l); setLangSheetOpen(false); }}
                  style={({ pressed }) => [styles.langRow, active && styles.langRowActive, pressed && { opacity: 0.9 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langNative, { color: l.color }]}>{l.nativeName}</Text>
                    <Text style={styles.langEnglish}>{l.name}</Text>
                  </View>
                  {active ? <MaterialIcons name="check-circle" size={22} color={Colors.light.secondary} /> : <View style={{ width: 22, height: 22 }} />}
                </Pressable>
              );
            })}
          </View>
        </BottomSheet>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  backText: { color: Colors.light.primary, fontWeight: '600' },
  appBarTitle: { color: Colors.light.primary, fontSize: 16, fontWeight: '700' },
  container: { padding: 16, gap: 12 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#eee', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  avatarText: { color: Colors.light.primary, fontWeight: '800', fontSize: 20 },
  displayName: { fontSize: 18, fontWeight: '800', color: Colors.light.primary },
  subtleText: { color: '#666', marginTop: 2 },
  locationChip: { marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  locationText: { color: Colors.light.primary, fontWeight: '600', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#eee', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.primary, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: '#fff', color: '#111' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  label: { fontSize: 15, color: '#333' },
  helper: { fontSize: 12, color: '#666', marginTop: 2 },
  langPills: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  pillActive: { backgroundColor: Colors.light.secondary, borderColor: Colors.light.secondary },
  pillText: { color: Colors.light.primary, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  button: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.light.secondary },
  secondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f1f3' },
  langRowActive: { backgroundColor: '#fafcff' },
  langNative: { fontSize: 18, fontWeight: '700' },
  langEnglish: { color: '#666', marginTop: 2 },
});
