import BottomSheet from '@/components/ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { LANGUAGES, type Language } from '@/constants/languages';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { afterPreferencesUpdated, getUserPreferences, logout, pickPreferenceLanguage, pickPreferenceLocation, updatePreferences, updateUserProfile, uploadMedia } from '@/services/api';
import { loadTokens, saveTokens, softLogout } from '@/services/auth';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const { setTabBarVisible } = useTabBarVisibility();
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState<Language | null>(null);
  const [notify, setNotify] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  // Refresh account/profile state from tokens + storage
  const refreshProfile = useCallback(async () => {
    try {
      const t = await loadTokens();
      const hasJwt = !!t?.jwt;
      setLoggedIn(hasJwt);
      if (t?.user) {
        setName(t.user.fullName || t.user.name || '');
        setRole(t.user.role || '');
        if (t.user.profilePhotoUrl) setPhotoUrl(t.user.profilePhotoUrl);
      } else {
        const savedName = await AsyncStorage.getItem('profile_name');
        if (savedName) setName(savedName);
        const savedRole = await AsyncStorage.getItem('profile_role');
        if (savedRole) setRole(savedRole);
        const savedPhoto = await AsyncStorage.getItem('profile_photo_url');
        if (savedPhoto) setPhotoUrl(savedPhoto);
      }

      // Try server preferences first
      let prefLang: Language | null = null;
      let prefLoc: string | null = null;
      try {
        const prefs = await getUserPreferences(t?.user?.id || (t as any)?.user?._id);
        prefLang = pickPreferenceLanguage(prefs);
        prefLoc = pickPreferenceLocation(prefs);
      } catch {}
      if (prefLang) {
        setLanguage(prefLang);
        try { await AsyncStorage.setItem('selectedLanguage', JSON.stringify(prefLang)); } catch {}
      } else {
        const savedLang = await AsyncStorage.getItem('selectedLanguage');
        if (savedLang) {
          try {
            const parsed = JSON.parse(savedLang);
            if (parsed && typeof parsed === 'object' && parsed.code) setLanguage(parsed as Language);
            else if (typeof parsed === 'string') setLanguage(LANGUAGES.find(l => l.code === parsed) || LANGUAGES[0]);
          } catch { setLanguage(LANGUAGES[0]); }
        } else { setLanguage(LANGUAGES[0]); }
      }

      setNotify((await AsyncStorage.getItem('notify')) !== '0');
      setAutoplay((await AsyncStorage.getItem('autoplay')) === '1');

      if (prefLoc) {
        setLocation(prefLoc);
        try { await AsyncStorage.setItem('profile_location', prefLoc); } catch {}
      } else {
        const savedLocObj = await AsyncStorage.getItem('profile_location_obj');
        if (savedLocObj) {
          try { const obj = JSON.parse(savedLocObj); setLocation(obj?.name || ''); } catch {}
        } else {
          const savedLoc = await AsyncStorage.getItem('profile_location');
          if (savedLoc) setLocation(savedLoc);
        }
      }
    } catch (e) {
      try { console.warn('[AccountTab] refreshProfile failed', (e as any)?.message || e); } catch {}
    }
  }, []);

  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  // Refresh location when coming back from picker
  useFocusEffect(React.useCallback(() => { refreshProfile(); return () => {}; }, [refreshProfile]));

  // Android back: go to News instead of blank route
  useFocusEffect(
    React.useCallback(() => {
      const onBack = () => { try { router.replace('/news'); } catch {} return true; };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
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

  const pickAndUploadAvatar = useCallback(async () => {
    if (!loggedIn) { router.push('/auth/login'); return; }
    try {
      setUploadingPhoto(true);
      const perm = await requestMediaPermissionsOnly();
      if (perm.mediaLibrary !== 'granted' && perm.mediaLibrary !== 'limited') {
        setUploadingPhoto(false);
        Alert.alert('Permission needed', 'Please allow photo library access to update your profile picture.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (res.canceled) { setUploadingPhoto(false); return; }
      const asset = res.assets?.[0];
      if (!asset?.uri) { setUploadingPhoto(false); return; }
      const uploaded = await uploadMedia({ uri: asset.uri, type: 'image', name: asset.fileName || 'avatar.jpg', folder: 'avatars' });
      const url = uploaded.url;
      await updateUserProfile({ profilePhotoUrl: url });
      setPhotoUrl(url);
      try { await AsyncStorage.setItem('profile_photo_url', url); } catch {}
      // Update cached tokens.user so all screens reflect immediately
      try {
        const t = await loadTokens();
        if (t?.user) { await saveTokens({ ...t, user: { ...t.user, profilePhotoUrl: url } } as any); }
      } catch {}
      Alert.alert('Profile updated', 'Your profile photo has been updated.');
    } catch (e: any) {
      const msg = e?.message || 'Failed to update profile photo';
      Alert.alert('Upload failed', msg);
    } finally {
      setUploadingPhoto(false);
    }
  }, [loggedIn, router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      {/* Fixed app bar (does not scroll) */}
      <View style={[styles.appBar, { backgroundColor: bg, borderColor: border }]}>
        <Pressable onPress={() => router.replace('/news')} style={styles.backRow} accessibilityLabel="Back to News">
          <Feather name="arrow-left" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
        </Pressable>
        <Text style={[styles.appBarTitle, { color: scheme === 'dark' ? '#fff' : Colors.light.primary }]}>Account</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.profileHeader, { backgroundColor: card, borderColor: border }]}>
          <Pressable onPress={pickAndUploadAvatar} disabled={!loggedIn || uploadingPhoto} accessibilityLabel="Change profile photo">
            <View style={styles.avatar}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarText, { color: scheme === 'dark' ? '#fff' : Colors.light.primary }]}>{(name || 'G').charAt(0).toUpperCase()}</Text>
              )}
              {uploadingPhoto ? (
                <View style={[styles.avatarOverlay, { backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.6)' }]}>
                  <ActivityIndicator color={Colors.light.primary} />
                </View>
              ) : null}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.displayName, { color: text }]}>{loggedIn ? name || 'User' : 'Reader'}</Text>
            <Text style={[styles.subtleText, { color: muted }]}>{loggedIn ? (role || 'Member') : 'Not signed in'}</Text>
          </View>
          {loggedIn ? (
            <Pressable onPress={doLogout} style={[styles.button, styles.secondary, { width: 100, backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.buttonText, { color: scheme === 'dark' ? '#fff' : Colors.light.primary }]}>Logout</Text>
            </Pressable>
          ) : (
            <Pressable onPress={gotoLogin} style={[styles.button, styles.primary, { width: 100 }]}>
              <Text style={[styles.buttonText, { color: '#fff' }]}>Sign In</Text>
            </Pressable>
          )}
        </View>
        {/* Welcome card removed as requested */}

        {/* Location Card */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Location</Text>
          <Pressable onPress={changeLocation} accessibilityLabel="Change location" style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }] }>
            <View>
              <Text style={[styles.label, { color: text }]}>{location ? location : 'Not set'}</Text>
              <Text style={[styles.helper, { color: muted }]}>Used to personalize local news</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Language Card */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Language</Text>
          <Pressable onPress={() => setLangSheetOpen(true)} accessibilityLabel="Change language" style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }] }>
            <View>
              <Text style={[styles.label, { color: text }]}>{languageDisplay}</Text>
              <Text style={[styles.helper, { color: muted }]}>App language for headlines and UI</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Other Preferences */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Preferences</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.label, { color: text }]}>Notifications</Text>
              <Text style={[styles.helper, { color: muted }]}>Breaking news and daily digests</Text>
            </View>
            <Switch value={notify} onValueChange={setNotify} />
          </View>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.label, { color: text }]}>Video autoplay</Text>
              <Text style={[styles.helper, { color: muted }]}>Play videos automatically on Wi‑Fi</Text>
            </View>
            <Switch value={autoplay} onValueChange={setAutoplay} />
          </View>
        </View>

        {/* Appearance */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Appearance</Text>
          <Pressable onPress={() => router.push('/settings/appearance' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Theme, font size, reading mode</Text>
              <Text style={[styles.helper, { color: muted }]}>Dark/Light, comfortable reading</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Privacy & Security */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Privacy & Security</Text>
          <Pressable onPress={() => router.push('/settings/privacy' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Privacy policy, Terms & Permissions</Text>
              <Text style={[styles.helper, { color: muted }]}>Understand how we use your data</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Downloads & Storage */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Downloads & Storage</Text>
          <Pressable onPress={() => router.push('/settings/storage' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Offline news, saved articles, clear cache</Text>
              <Text style={[styles.helper, { color: muted }]}>Manage space and offline content</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Support & Feedback */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Support & Feedback</Text>
          <Pressable onPress={() => router.push('/settings/support' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Contact us, report an issue, rate us</Text>
              <Text style={[styles.helper, { color: muted }]}>We love hearing from you</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* About App */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>About</Text>
          <Pressable onPress={() => router.push('/settings/about' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Version and developer details</Text>
              <Text style={[styles.helper, { color: muted }]}>Learn more about this app</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Developer */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Developer</Text>
          <Pressable onPress={() => router.push('/settings/account-debug' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Account debug</Text>
              <Text style={[styles.helper, { color: muted }]}>Reset storage, tokens, mock mode</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
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
                  onPress={async () => {
                    await persistLanguage(l);
                    try {
                      await updatePreferences({ languageId: l.id, languageCode: l.code });
                      await afterPreferencesUpdated({ languageIdChanged: l.id, languageCode: l.code });
                    } catch {
                      // likely guest user without userId; ignore
                    }
                    setLangSheetOpen(false);
                    try { await refreshProfile(); } catch {}
                  }}
                  style={({ pressed }) => [styles.langRow, { borderBottomColor: border }, active && { backgroundColor: card }, pressed && { opacity: 0.9 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langNative, { color: l.color }]}>{l.nativeName}</Text>
                    <Text style={[styles.langEnglish, { color: muted }]}>{l.name}</Text>
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
  safe: { flex: 1 },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  backText: { color: Colors.light.primary, fontWeight: '600' },
  appBarTitle: { color: Colors.light.primary, fontSize: 16, fontWeight: '700' },
  container: { padding: 16, gap: 12 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  avatarText: { color: Colors.light.primary, fontWeight: '800', fontSize: 20 },
  displayName: { fontSize: 18, fontWeight: '800' },
  subtleText: { marginTop: 2 },
  locationChip: { marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1 },
  locationText: { color: Colors.light.primary, fontWeight: '600', fontSize: 12 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  label: { fontSize: 15 },
  helper: { fontSize: 12, marginTop: 2 },
  langPills: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1 },
  pillActive: { backgroundColor: Colors.light.secondary, borderColor: Colors.light.secondary },
  pillText: { color: Colors.light.primary, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  button: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.light.secondary },
  secondary: { borderWidth: 1 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  langRowActive: {},
  langNative: { fontSize: 18, fontWeight: '700' },
  langEnglish: { marginTop: 2 },
});
