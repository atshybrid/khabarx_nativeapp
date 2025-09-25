import BottomSheet from '@/components/ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { LANGUAGES, type Language } from '@/constants/languages';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
// ...existing code...
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ...existing code...
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountScreen() {
  const router = useRouter();
  const { setTabBarVisible } = useTabBarVisibility();
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [language, setLanguage] = useState<Language | null>(null);
  const [notify, setNotify] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  // No accordion/expand state needed

  // Refactored: load all user/profile state
  const loadProfileState = useCallback(async () => {
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
    if (savedName) setName(savedName); else setName('');
    const savedRole = await AsyncStorage.getItem('profile_role');
    if (savedRole) setRole(savedRole); else setRole('');
    const savedLocObj = await AsyncStorage.getItem('profile_location_obj');
    if (savedLocObj) {
      try {
        const obj = JSON.parse(savedLocObj);
        setLocation(obj?.name || '');
        setPlaceName(obj?.placeName || obj?.fullName || '');
      } catch {
        const savedLoc = await AsyncStorage.getItem('profile_location');
        if (savedLoc) setLocation(savedLoc); else setLocation('');
        setPlaceName('');
      }
    } else {
      const savedLoc = await AsyncStorage.getItem('profile_location');
      if (savedLoc) setLocation(savedLoc); else setLocation('');
      setPlaceName('');
    }
  }, []);

  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  // Always refresh state on focus (fixes stale UI after login/logout)
  useFocusEffect(
    React.useCallback(() => {
      loadProfileState();
      // Also refresh location if changed
      (async () => {
        const savedLocObj = await AsyncStorage.getItem('profile_location_obj');
        if (savedLocObj) {
          try {
            const obj = JSON.parse(savedLocObj);
            setLocation(obj?.name || '');
            setPlaceName(obj?.placeName || obj?.fullName || '');
          } catch {}
        }
      })();
      return () => {};
    }, [loadProfileState])
  );

  // Persist toggles immediately (remove Save button)
  useEffect(() => { AsyncStorage.setItem('notify', notify ? '1' : '0'); }, [notify]);
  useEffect(() => { AsyncStorage.setItem('autoplay', autoplay ? '1' : '0'); }, [autoplay]);
  const persistLanguage = useCallback(async (lang: Language) => {
    setLanguage(lang);
    await AsyncStorage.setItem('selectedLanguage', JSON.stringify(lang));
  }, []);

  // ...existing code...

  const changeLocation = () => router.push({ pathname: '/settings/location' as any });
  const languageDisplay = useMemo(() => language?.name ?? 'English', [language]);

  return (

    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
      {/* AppBar with Back Button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingHorizontal: 8, marginBottom: 2 }}>
        <Pressable
          onPress={() => router.replace('/news')} // Always go to news tab
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={22} color={Colors.light.primary} />
          <Text style={{ color: Colors.light.primary, fontWeight: '600', fontSize: 16 }}>Back</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={true}>
        {/* User Profile Card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }}>
          <View style={{ position: 'relative', marginBottom: 8 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
              <Text style={{ fontSize: 36, fontWeight: '900', color: Colors.light.primary }}>{(name || 'G').charAt(0).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={{ color: Colors.light.primary, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{loggedIn ? name || 'User' : 'Reader'}</Text>
          <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 1 }}>{loggedIn ? (role || 'Member') : 'Not signed in'}</Text>
        </View>

        {/* News Reporter Login Card */}
        <Pressable
          onPress={() => router.push('/auth/login?from=reporter')}
          style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="user-check" size={22} color={Colors.light.secondary} />
            <Text style={{ color: Colors.light.secondary, fontWeight: '700', fontSize: 16 }}>News Reporter Login</Text>
          </View>
          <Feather name="chevron-right" size={22} color={Colors.light.secondary} />
        </Pressable>

        {/* Language Card */}
        <Pressable
          onPress={() => setLangSheetOpen(true)}
          style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="globe" size={22} color={Colors.light.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.light.primary }}>Language</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: Colors.light.secondary, fontWeight: '700', fontSize: 15 }}>{languageDisplay}</Text>
            <Feather name="chevron-right" size={22} color={Colors.light.secondary} />
          </View>
        </Pressable>

        {/* Location Card */}
        <Pressable
          onPress={changeLocation}
          style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="map-pin" size={22} color={Colors.light.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.light.primary }}>Location</Text>
          </View>
          <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 0, maxWidth: 180 }}>
            {placeName ? (
              <Text style={{ color: Colors.light.secondary, fontWeight: '700', fontSize: 15 }} numberOfLines={2} ellipsizeMode="tail">{placeName}</Text>
            ) : (
              <Text style={{ color: '#bbb', fontWeight: '700', fontSize: 15 }}>Not set</Text>
            )}
            <Feather name="chevron-right" size={22} color={Colors.light.secondary} style={{ marginTop: 2 }} />
          </View>
        </Pressable>

        {/* Preferences Card */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Feather name="settings" size={20} color={Colors.light.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.light.primary }}>Preferences</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="bell" size={20} color={Colors.light.primary} />
              <Text style={{ fontSize: 15, color: Colors.light.primary }}>Notifications</Text>
            </View>
            <Pressable onPress={() => setNotify(!notify)} style={{ backgroundColor: notify ? Colors.light.secondary : '#e5e7eb', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7, minWidth: 60, alignItems: 'center' }}>
              <Text style={{ color: notify ? '#fff' : '#333', fontWeight: '700' }}>{notify ? 'On' : 'Off'}</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="play-circle" size={20} color={Colors.light.primary} />
              <Text style={{ fontSize: 15, color: Colors.light.primary }}>Video autoplay</Text>
            </View>
            <Pressable onPress={() => setAutoplay(!autoplay)} style={{ backgroundColor: autoplay ? Colors.light.secondary : '#e5e7eb', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7, minWidth: 60, alignItems: 'center' }}>
              <Text style={{ color: autoplay ? '#fff' : '#333', fontWeight: '700' }}>{autoplay ? 'On' : 'Off'}</Text>
            </Pressable>
          </View>
        </View>

        {/* App Info & Legal Card */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Feather name="info" size={20} color={Colors.light.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.light.primary }}>App Info</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: Colors.light.primary, fontWeight: '600' }}>Version</Text>
            <Text style={{ color: '#666' }}>{'1.0.0' /* TODO: dynamic version */}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.push('/settings/terms')}>
              <Text style={{ color: Colors.light.primary, fontWeight: '600' }}>Terms & Conditions</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/settings/privacy')}>
              <Text style={{ color: Colors.light.primary, fontWeight: '600' }}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>

        {/* Login/Logout Card */}
        <Pressable
          onPress={async () => {
            if (loggedIn) {
              await AsyncStorage.removeItem('jwt');
              setLoggedIn(false);
              setName(''); setRole('');
            } else {
              router.push('/auth/login');
            }
          }}
          style={{ backgroundColor: Colors.light.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 24 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{loggedIn ? 'Logout' : 'Login'}</Text>
        </Pressable>
      </ScrollView>

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
