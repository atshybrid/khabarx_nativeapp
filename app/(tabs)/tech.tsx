import LanguagePickerSheet from '@/components/ui/LanguagePickerSheet';
import { Loader } from '@/components/ui/Loader';
import { Colors } from '@/constants/Colors';
import { LANGUAGES, type Language } from '@/constants/languages';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { afterPreferencesUpdated, getUserPreferences, pickPreferenceLanguage, pickPreferenceLocation, updatePreferences, updateUserProfile, uploadMedia } from '@/services/api';
import { loadTokens, logoutAndClearProfile, saveTokens } from '@/services/auth';
import { emit, on } from '@/services/events';
import { getCurrentPushToken, getPushPermissionStatus } from '@/services/notifications';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import { makeShadow } from '@/utils/shadow';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
  const [photoVersion, setPhotoVersion] = useState<number>(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState<Language | null>(null);
  const [notify, setNotify] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const langSelectingRef = useRef(false);
  // Push notifications status/token
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [pushShortToken, setPushShortToken] = useState<string>('');

  // Refresh account/profile state from tokens + storage
  const refreshProfile = useCallback(async () => {
    try {
      const t = await loadTokens();
      const hasJwt = !!t?.jwt;
      setLoggedIn(hasJwt);
      if (t?.user) {
        setName(t.user.fullName || t.user.name || '');
        setRole(t.user.role || '');
        if (t.user.profilePhotoUrl) {
          setPhotoUrl(t.user.profilePhotoUrl);
          setPhotoVersion((v) => v + 1);
        }
      } else {
        const savedName = await AsyncStorage.getItem('profile_name');
        if (savedName) setName(savedName);
        const savedRole = await AsyncStorage.getItem('profile_role');
        if (savedRole) setRole(savedRole);
        const savedPhoto = await AsyncStorage.getItem('profile_photo_url');
        if (savedPhoto) {
          setPhotoUrl(savedPhoto);
          setPhotoVersion((v) => v + 1);
        }
      }

      // Resolve language with local-first strategy to avoid "late" updates on UI
      let hasLocalOverride = false;
      let localLang: Language | null = null;
      try {
        const ll = await AsyncStorage.getItem('language_local');
        if (ll) {
          try {
            const obj = JSON.parse(ll);
            if (obj && obj.code) {
              localLang = LANGUAGES.find(x => x.code === obj.code) || null;
              hasLocalOverride = !!localLang;
            }
          } catch {}
        }
      } catch {}
      if (!localLang) {
        try {
          const savedLang = await AsyncStorage.getItem('selectedLanguage');
          if (savedLang) {
            try {
              const parsed = JSON.parse(savedLang);
              if (parsed && typeof parsed === 'object' && parsed.code) localLang = (parsed as Language);
              else if (typeof parsed === 'string') localLang = LANGUAGES.find(l => l.code === parsed) || null;
            } catch {}
          }
        } catch {}
      }
      setLanguage(localLang || LANGUAGES[0]);

      // Fetch server preferences in background; only apply if no local override exists
      let prefLoc: string | null = null;
      try {
        const prefs = await getUserPreferences(t?.user?.id || (t as any)?.user?._id);
        const prefLang = pickPreferenceLanguage(prefs);
        prefLoc = pickPreferenceLocation(prefs);
        if (prefLang && !hasLocalOverride) {
          setLanguage(prefLang);
          try { await AsyncStorage.setItem('selectedLanguage', JSON.stringify(prefLang)); } catch {}
        }
      } catch {}

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

  // Language list is fetched inside LanguagePickerSheet when opened

  // Refresh location when coming back from picker
  useFocusEffect(React.useCallback(() => { refreshProfile(); return () => {}; }, [refreshProfile]));

  // Load push permission status + short token on focus
  useFocusEffect(React.useCallback(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await getPushPermissionStatus();
        if (mounted && s?.status) setPushStatus(s.status);
      } catch {}
      try {
        const t = await getCurrentPushToken();
        if (mounted) setPushShortToken(t ? `${t.slice(0, 10)}…${t.slice(-6)}` : '');
      } catch {}
    })();
    return () => { mounted = false; };
  }, []));

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
    // Persist commonly used key across the app
    await AsyncStorage.setItem('selectedLanguage', JSON.stringify(lang));
    // Additionally, if user is MEMBER/HRCI_ADMIN, store a dedicated local-language payload
    try {
      const roleUC = (role || '').toString().trim().toUpperCase();
      if (roleUC === 'MEMBER' || roleUC === 'HRCI_MEMBER' || roleUC === 'HRCI_ADMIN') {
        const payload = { id: lang.id, code: lang.code, name: lang.name };
        await AsyncStorage.multiSet([
          ['language_local', JSON.stringify(payload)],
          ['language_local_id', lang.id],
          ['language_local_code', lang.code],
          ['language_local_name', lang.name],
        ]);
      }
    } catch {}
  }, [role]);

  const gotoLogin = () => router.push('/auth/login');
  const doLogout = async () => {
    try {
      await logoutAndClearProfile();
      // Reset local UI state
      setLoggedIn(false);
      setName('');
      setRole('');
      setPhotoUrl('');
      setPhotoVersion(0);
      setHrciMembership(null);
      // Optionally navigate
      // try { router.replace('/news'); } catch {}
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
        mediaTypes: ['images'],
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

  const handleHrciNavigation = useCallback(async () => {
    console.log('[Tech Tab] HRCI navigation initiated');
    
    try {
      // Check if user has valid HRCI authentication
      const tokens = await loadTokens();
      const hasValidToken = !!(tokens?.jwt);
      const userRole = (tokens?.user?.role || '').toString().trim().toUpperCase();
      
      console.log('[Tech Tab] Auth check result:', {
        hasValidToken,
        userRole,
        tokenExpired: tokens?.expiresAt ? Date.now() >= tokens.expiresAt : false
      });
      
      // Check if token is expired
      const isExpired = tokens?.expiresAt ? Date.now() >= tokens.expiresAt : false;
      
      if (hasValidToken && !isExpired) {
        if (userRole === 'HRCI_ADMIN' || userRole === 'SUPERADMIN') {
          console.log('[Tech Tab] Admin role detected, navigating to admin dashboard');
          router.push('/hrci/admin' as any);
        } else if (userRole === 'MEMBER' || userRole === 'HRCI_MEMBER') {
          console.log('[Tech Tab] Member role detected, navigating to member dashboard');
          router.push('/hrci' as any);
        } else {
          console.log('[Tech Tab] No HRCI role, navigating to login');
          router.push('/hrci/login' as any);
        }
      } else {
        console.log('[Tech Tab] No valid HRCI auth, navigating to login');
        router.push('/hrci/login' as any);
      }
    } catch (error) {
      console.error('[Tech Tab] Error checking HRCI auth:', error);
      // Fallback to login on error
      console.log('[Tech Tab] Fallback navigation to login due to error');
      router.push('/hrci/login' as any);
    }
  }, [router]);

  // HRCI membership preview
  const [hrciMembership, setHrciMembership] = useState<any | null>(null);
  const [hrciLoading, setHrciLoading] = useState(false);
  const hrciLoadingRef = useRef(false);
  const loadHrciMembership = useCallback(async () => {
    if (hrciLoadingRef.current) return; // prevent concurrent/looped fetches
    hrciLoadingRef.current = true;
    setHrciLoading(true);
    try {
      const start = Date.now();
      const res = await loadTokens();
      if (!res?.jwt) { setHrciMembership(null); return; }
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || '';
      const mRes = await fetch(`${apiBase}/memberships/me`, { headers: { Authorization: `Bearer ${res.jwt}` } })
        .then(r => r.json())
        .catch(() => null);
      const data = mRes?.data || mRes;
      setHrciMembership(data || null);
      console.log('[Tech Tab] Membership preview loaded', { dur: Date.now() - start, kyc: data?.kyc?.status });
    } catch {
      setHrciMembership(null);
    } finally {
      hrciLoadingRef.current = false;
      setHrciLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadHrciMembership();
    const off = on('profile:updated', (p) => {
      console.log('[Tech Tab] profile:updated received; refreshing profile + membership', p?.photoUrl?.slice?.(0,40));
      refreshProfile();
      loadHrciMembership();
    });
    return () => off();
  }, [loadHrciMembership, refreshProfile]);

  // Role check for hiding user header when membership is present
  const roleUC = (role || '').toString().trim().toUpperCase();
  const isMemberOrAdmin = roleUC === 'MEMBER' || roleUC === 'HRCI_MEMBER' || roleUC === 'HRCI_ADMIN';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      {/* Fixed app bar (does not scroll) */}
      <View style={[styles.appBar, { backgroundColor: bg, borderColor: border }]}>
        <Pressable onPress={() => router.replace('/news')} style={styles.backRow} accessibilityLabel="Back to News">
          <Feather name="arrow-left" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
        </Pressable>
        <Text style={[styles.appBarTitle, { color: scheme === 'dark' ? '#fff' : Colors.light.primary }]}>Account</Text>
        <View style={{ width: 60, alignItems: 'flex-end' }}>
          <Pressable onPress={loggedIn ? doLogout : gotoLogin} hitSlop={8} accessibilityLabel={loggedIn ? 'Logout' : 'Sign In'}>
            <Feather name={loggedIn ? 'log-out' : 'log-in'} size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {/* If logged-in Member/Admin: hide user header and show HRCI card first; else show header first then HRCI card */}
        {!loggedIn || !isMemberOrAdmin ? (
          <View style={[styles.profileHeader, { backgroundColor: card, borderColor: border }]}> 
            <Pressable onPress={pickAndUploadAvatar} disabled={!loggedIn || uploadingPhoto} accessibilityLabel="Change profile photo"> 
              <View style={styles.avatar}> 
                {photoUrl ? (
                  <Image source={{ uri: `${photoUrl}${photoUrl.includes('?') ? '&' : '?' }v=${photoVersion}` }} style={styles.avatarImg} /> 
                ) : (
                  <Text style={[styles.avatarText, { color: scheme === 'dark' ? '#fff' : Colors.light.primary }]}>{(name || 'G').charAt(0).toUpperCase()}</Text> 
                )}
                {uploadingPhoto ? (
                  <View style={[styles.avatarOverlay, { backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.6)' }]}> 
                    <Loader size={32} /> 
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
        ) : null}

        {/* HRCI Member & Admin at top (always visible) */}
        <View style={[styles.card, styles.hrciCard, { backgroundColor: card, borderColor: '#FE0002' }]}>
          <View style={[styles.hrciHeader, { justifyContent: 'space-between', width: '100%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="account-balance" size={24} color="#FE0002" />
              <Text style={[styles.cardTitle, { color: '#FE0002', marginLeft: 8 }]}>HRCI Member & Admin</Text>
            </View>
            {hrciMembership?.kyc?.status === 'APPROVED' && (
              <View style={styles.kycMiniBadge}>
                <MaterialIcons name="check" size={14} color="#fff" />
              </View>
            )}
          </View>
          {hrciMembership ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.label, { color: text }]}>{hrciMembership?.designation?.name || 'Member'}</Text>
              <Text style={[styles.helper, { color: muted, marginTop: 2 }]}>
                {hrciMembership?.cell?.name || 'Cell'}{hrciMembership?.hrci?.zone ? ` • ${hrciMembership.hrci.zone}` : ''}
              </Text>
              <Text style={[styles.helper, { color: muted, marginTop: 2 }]}>KYC: {hrciMembership?.kyc?.status || 'PENDING'}</Text>
            </View>
          ) : (
            <Text style={[styles.helper, { color: muted, marginTop: 4 }]}>
              Human Rights Council for India - {hrciLoading ? 'Loading...' : 'Login or start onboarding'}
            </Text>
          )}
          <Pressable onPress={handleHrciNavigation} style={({ pressed }) => [styles.button, styles.hrciButton, { marginTop: 12 }, pressed && { opacity: 0.95 }]}>
            <MaterialIcons name="login" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={[styles.buttonText, { color: '#fff' }]}>{hrciMembership ? 'Open Dashboard' : 'Open HRCI'}</Text>
          </Pressable>
        </View>
        {/* Welcome card removed as requested */}

        {/* Location Card */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Location</Text>
          <Pressable onPress={changeLocation} accessibilityLabel="Change location" style={({ pressed }: { pressed: boolean }) => [styles.rowBetween, pressed && { opacity: 0.85 }] }>
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
          <Pressable onPress={() => { try { console.log('[AccountTab] Open language sheet'); } catch {} setLangSheetOpen(true); }} accessibilityLabel="Change language" style={({ pressed }: { pressed: boolean }) => [styles.rowBetween, pressed && { opacity: 0.85 }] }>
            <View>
              <Text style={[styles.label, { color: text }]}>{languageDisplay}</Text>
              <Text style={[styles.helper, { color: muted }]}>App language for headlines and UI</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* (Moved HRCI Membership card to top) */}

        {/* Other Preferences */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Preferences</Text>
          {/* Push notification status row */}
          <Pressable onPress={() => { try { Linking.openSettings(); } catch {} }} accessibilityLabel="Open system Settings to manage notifications" style={({ pressed }: { pressed: boolean }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Push notifications</Text>
              <Text style={[styles.helper, { color: muted }]}>
                {pushStatus === 'granted' ? 'Allowed' : pushStatus === 'denied' ? 'Blocked' : 'Not determined'}
                {pushShortToken ? ` • ${pushShortToken}` : ''}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
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
          <Pressable onPress={() => router.push('/settings/notifications' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Push notifications test</Text>
              <Text style={[styles.helper, { color: muted }]}>View token, local + server test</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings/preferences-debug' as any)} style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.85 }]}>
            <View>
              <Text style={[styles.label, { color: text }]}>Preferences debug</Text>
              <Text style={[styles.helper, { color: muted }]}>Show local language id/code from storage</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={scheme === 'dark' ? '#fff' : Colors.light.primary} />
          </Pressable>
        </View>

        {/* Language Picker Modal Sheet (smoother) */}
        <LanguagePickerSheet
          visible={langSheetOpen}
          onClose={() => setLangSheetOpen(false)}
          currentCode={language?.code || undefined}
          onPick={(l) => {
            if (langSelectingRef.current) return;
            langSelectingRef.current = true;
            // Optimistic update
            persistLanguage(l).catch(() => {});
            (async () => {
              try {
                if (loggedIn) {
                  await updatePreferences({ languageId: l.id, languageCode: l.code });
                  await afterPreferencesUpdated({ languageIdChanged: l.id, languageCode: l.code });
                  const t = await loadTokens();
                  const uid = (t as any)?.user?.id || (t as any)?.user?._id || (t as any)?.user?.userId;
                  const prefs = uid ? await getUserPreferences(uid) : null;
                  const serverLang = pickPreferenceLanguage(prefs) || l;
                  await persistLanguage(serverLang as Language);
                  try { emit('toast:show', { message: `Language updated to ${serverLang?.name || l.name}` } as any); } catch {}
                }
              } catch (e:any) {
                try { emit('toast:show', { message: e?.message || 'Failed to update language' } as any); } catch {}
              } finally {
                langSelectingRef.current = false;
                try { await refreshProfile(); } catch {}
              }
            })();
          }}
        />
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
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 16, borderWidth: 1, ...makeShadow(2, { opacity: 0.04, blur: 12, y: 2 }) },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  avatarText: { color: Colors.light.primary, fontWeight: '800', fontSize: 20 },
  displayName: { fontSize: 18, fontWeight: '800' },
  subtleText: { marginTop: 2 },
  locationChip: { marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1 },
  locationText: { color: Colors.light.primary, fontWeight: '600', fontSize: 12 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1, ...makeShadow(2, { opacity: 0.04, blur: 12, y: 2 }) },
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
  // HRCI-specific styles
  hrciCard: { 
    borderLeftWidth: 4, 
    borderLeftColor: '#FE0002', 
    backgroundColor: '#fff0f0',
    ...makeShadow(6, { color: '254,0,2', opacity: 0.18, blur: 16, y: 4 })
  },
  kycMiniBadge: { backgroundColor: '#1D0DA1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  hrciHeader: { flexDirection: 'row', alignItems: 'center' },
  hrciButton: { backgroundColor: '#1D0DA1', ...makeShadow(6, { color: '29,13,161', opacity: 0.25, blur: 16, y: 4 }), flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  langRowActive: {},
  langNative: { fontSize: 18, fontWeight: '700' },
  langEnglish: { marginTop: 2 },
});
