import SettingsRow from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Language, LANGUAGES } from '@/constants/languages';
import { afterPreferencesUpdated, getLanguages, getUserPreferences, pickPreferenceLanguage, pickPreferenceLocation, resolveEffectiveLanguage, updatePreferences } from '@/services/api';
import { checkPostArticleAccess, isCitizenReporter, loadTokens, logoutAndClearProfile } from '@/services/auth';
import { emit, on } from '@/services/events';

import { getMembershipProfile, MembershipProfileData } from '@/services/membership';
import { Feather } from '@expo/vector-icons';
import { BottomSheetFlatList, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, LayoutAnimation, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, useWindowDimensions, View } from 'react-native';
import { HrciIdCardFrontExact } from '../../components/HrciIdCardFrontExact';

import LottieLoader from '@/components/ui/LottieLoader';
import { request } from '@/services/http';
import { SafeAreaView } from 'react-native-safe-area-context';
import { downloadPdfWithFallbacks } from '../../services/fileDownload';

// Enable LayoutAnimation only on Old Architecture (Bridged) Android.
// On New Architecture (Fabric), this API is a no-op and logs a warning.
if (Platform.OS === 'android') {
  const isFabric = (global as any)?.nativeFabricUIManager != null;
  if (!isFabric && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function AccountScreen() {
  const [mp, setMp] = useState<MembershipProfileData | null>(null);
  const [photoVersion, setPhotoVersion] = useState<number>(0);
  const { width: screenWidth } = useWindowDimensions();
  const [langName, setLangName] = useState<string>('');
  // const [langCode, setLangCode] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [locExpanded, setLocExpanded] = useState<boolean>(false);
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [roleReporter, setRoleReporter] = useState<boolean>(false);
  const [developerMode, setDeveloperMode] = useState<boolean>(false);
  const [tokenRole, setTokenRole] = useState<string>('');
  // Debug: surface language storage sources
  const [selectedLangObj, setSelectedLangObj] = useState<any>(null);
  const [localLangObj, setLocalLangObj] = useState<any>(null);
  const [prefLangObj, setPrefLangObj] = useState<any>(null);
  const [effectiveLangObj, setEffectiveLangObj] = useState<any>(null);
  // Bottom sheet state
  const bottomSheetRef = React.useRef<BottomSheetModal>(null);
  const [langList, setLangList] = useState<Language[]>([]);
  const [loadingLangList, setLoadingLangList] = useState<boolean>(false);
  const [updatingLanguage, setUpdatingLanguage] = useState<boolean>(false);
  // Profile welcome card removed per request

  const fetchPrefs = useCallback(async () => {
    try {
      const t = await loadTokens();
      const prefs = await getUserPreferences(t?.user?.id || (t as any)?.user?._id);
      const pl = pickPreferenceLanguage(prefs);
      const loc = pickPreferenceLocation(prefs);
      if (pl) {
        setLangName(pl.name);
        try {
          await AsyncStorage.setItem('selectedLanguage', JSON.stringify(pl));
          // Also mirror to language_local so member/admin override stays consistent
          await AsyncStorage.setItem('language_local', JSON.stringify(pl));
        } catch {}
        setPrefLangObj(pl);
      } else {
        const raw = await AsyncStorage.getItem('selectedLanguage');
        if (raw) {
          try {
            const j = JSON.parse(raw);
            if (j && typeof j === 'object' && j.name) {
              setLangName(j.name);
              setSelectedLangObj(j);
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
      // Prefer local language override for MEMBER/HRCI_MEMBER/HRCI_ADMIN
      try {
        const roleUC = (t?.user?.role || '').toString().trim().toUpperCase();
        if (roleUC === 'MEMBER' || roleUC === 'HRCI_MEMBER' || roleUC === 'HRCI_ADMIN') {
          const ll = await AsyncStorage.getItem('language_local');
          if (ll) {
            try {
              const obj = JSON.parse(ll);
              if (obj?.name) setLangName(obj.name);
              else if (obj?.code) {
                const found = LANGUAGES.find(l => l.code === obj.code);
                if (found) setLangName(found.name);
              }
              setLocalLangObj(obj);
            } catch {}
          }
        }
      } catch {}
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
    // Update debug AsyncStorage mirrors regardless of role
    try {
      const rawSel = await AsyncStorage.getItem('selectedLanguage');
      if (rawSel) { try { setSelectedLangObj(JSON.parse(rawSel)); } catch { setSelectedLangObj(rawSel); } }
      const rawLocal = await AsyncStorage.getItem('language_local');
      if (rawLocal) { try { setLocalLangObj(JSON.parse(rawLocal)); } catch { setLocalLangObj(rawLocal); } }
    } catch {}
  }, []);

  const refreshMembershipProfile = useCallback(async () => {
    try {
      const data = await getMembershipProfile();
      setMp(data);
      // Bump photo version when URL changes to bust cache
      const url = data?.user?.profile?.profilePhotoUrl || '';
      if (url) setPhotoVersion((v) => v + 1);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await fetchPrefs();
      try {
        const t = await loadTokens();
        setLoggedIn(Boolean(t?.jwt));
        setTokenRole((t?.user?.role || '').toString());
      } catch {}
      try { setRoleReporter(await isCitizenReporter()); } catch {}
      await refreshMembershipProfile();
  // Resolve effective language (merged view)
  try { const eff = await resolveEffectiveLanguage(); setEffectiveLangObj(eff); } catch {}
      // Initialize developer mode from env/AsyncStorage
      try {
        const raw = String(process.env.EXPO_PUBLIC_DEVELOPER_MODE ?? '').toLowerCase();
        const envOn = raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
        const stored = (await AsyncStorage.getItem('developer_mode')) === '1';
        setDeveloperMode(envOn || stored);
      } catch {}
    })();
  }, [fetchPrefs, refreshMembershipProfile]);

  useFocusEffect(useCallback(() => {
    fetchPrefs();
    // Also refresh membership profile when screen focuses
    refreshMembershipProfile();
    // Listen for profile updates (e.g., photo changed) and refresh
    const unsubscribe = on('profile:updated', () => {
      refreshMembershipProfile();
    });
    return () => {
      try { unsubscribe(); } catch {}
    };
  }, [fetchPrefs, refreshMembershipProfile]));

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
              try {
                Alert.alert(
                  'Logout',
                  'Are you sure you want to logout?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Logout',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await logoutAndClearProfile();
                        } catch {}
                        // Reset local UI state
                        try {
                          setMp(null);
                          setTokenRole('');
                          setLocExpanded(false);
                          setPhotoVersion(0);
                        } catch {}
                        // Navigate to language (existing behavior)
                        try { router.replace('/language'); } catch {}
                      },
                    },
                  ],
                  { cancelable: true }
                );
              } catch {}
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

  const formatLang = (x: any) => {
    try {
      if (!x) return '—';
      const obj = typeof x === 'string' ? JSON.parse(x) : x;
      const name = obj?.nativeName || obj?.name || '';
      const code = obj?.code || '';
      const id = obj?.id || '';
      const parts = [name && `${name}`, code && `(${code})`, id && `id=${id}`].filter(Boolean);
      return parts.length ? parts.join(' ') : JSON.stringify(obj);
    } catch {
      return String(x);
    }
  };

  const openLanguageSheet = async () => {
    try {
      setLoadingLangList(true);
      const list = await getLanguages();
      setLangList(list || LANGUAGES);
    } catch {
      setLangList(LANGUAGES);
    } finally {
      setLoadingLangList(false);
      try { bottomSheetRef.current?.present(); } catch {}
    }
  };

  const handleSelectLanguage = async (language: Language) => {
    if (!language) return;
    // Update UI immediately
    setLangName(language.name);
    setSelectedLangObj(language);
    setLocalLangObj(language);
    setUpdatingLanguage(true);
    try {
      await AsyncStorage.setItem('selectedLanguage', JSON.stringify(language));
      await AsyncStorage.setItem('language_local', JSON.stringify(language));
      // Mirror split keys for compatibility with other code paths
      await AsyncStorage.multiSet([
        ['language_local_id', String(language.id)],
        ['language_local_code', String(language.code)],
        ['language_local_name', String(language.name || language.nativeName || '')],
      ]);
      if (loggedIn) {
        try {
          await updatePreferences({ languageId: language.id, languageCode: language.code });
          await afterPreferencesUpdated({ languageIdChanged: language.id, languageCode: language.code });
        } catch (e:any) {
          try { Alert.alert('Language', e?.message || 'Failed to update on server.'); } catch {}
        }
      } else {
        // Even for guests, refresh language-dependent caches (news, etc.)
        try { await afterPreferencesUpdated({ languageIdChanged: String(language.id), languageCode: language.code }); } catch {}
      }
      // Resolve effective language after change
      try { const eff = await resolveEffectiveLanguage(); setEffectiveLangObj(eff); } catch {}
      // Ask News screen to refresh feed immediately
      try { emit('news:refresh', { reason: 'language' } as any); } catch {}
      try { bottomSheetRef.current?.dismiss(); } catch {}
    } finally {
      setUpdatingLanguage(false);
    }
  };

  return (
  <BottomSheetModalProvider>
  <SafeAreaView style={styles.safe}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <Pressable onLongPress={toggleDeveloperMode} delayLongPress={600} hitSlop={8}>
          <Text style={styles.appTitle}>Account{developerMode ? ' · Dev' : ''}</Text>
        </Pressable>
        {AppBarIcons}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Conditional: Show HRCI ID card preview for Member/Admin; otherwise show user profile card */}
        {(() => {
          // Determine role strictly from user.role (fallback to tokenRole). Do NOT use membership.level for gating UI.
          const userRoleRaw = (mp?.user?.role || tokenRole || '').toString();
          const roleUC = userRoleRaw.trim().toUpperCase();
          const isAdmin = roleUC === 'HRCI_ADMIN' || roleUC === 'SUPERADMIN';
          // Show HRCI card only for true member/admin roles on user.role
          const isMemberOrAdmin = roleUC === 'MEMBER' || roleUC === 'HRCI_MEMBER' || roleUC === 'HRCI_ADMIN';
          // Synchronous reporter check (fallback) to avoid async race from isCitizenReporter()
          const isReporterSync = roleUC === 'CITIZEN_REPORTER'
            || (tokenRole || '').toString().trim().toUpperCase() === 'CITIZEN_REPORTER'
            || ((mp?.user?.role || '').toString().trim().toUpperCase() === 'CITIZEN_REPORTER');
          if (__DEV__) {
            try {
              console.log('[Account] Role resolution', {
                userRole: mp?.user?.role,
                membershipLevel: mp?.membership?.level,
                tokenRole,
                roleUC,
                isMemberOrAdmin,
                roleReporter,
                isReporterSync,
              });
            } catch {}
          }
          const cardWidth = Math.max(Math.min(screenWidth - 48, 720), 320);

          // If the logged-in user is a Citizen Reporter, hide the HRCI Member & Admin card (sync + async guards)
          if (isMemberOrAdmin && !roleReporter && !isReporterSync) {
            // Derive card props for HRCI card
            let logoUri: string | undefined;
            try {
              const resolved = Image.resolveAssetSource(require('../../assets/images/hrci_logo.png'));
              logoUri = resolved?.uri;
            } catch {}
            const memberName = (mp?.user?.profile?.fullName || 'Member Name').toUpperCase();
            const designation = (mp?.membership?.designation?.name || 'Designation').toUpperCase();
            const cellName = (mp?.membership?.cell?.name || 'Cell Name').toUpperCase();
            const idNumber = (mp?.card?.cardNumber || 'N/A').toUpperCase();
            const contactNumber = mp?.user?.mobileNumber || 'N/A';
            const validUpto = mp?.card?.expiresAt
              ? (() => { try { const d=new Date(mp.card!.expiresAt!); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;} catch { return ''; } })()
              : '';
            const basePhoto = mp?.user?.profile?.profilePhotoUrl || '';
            const photoUri = basePhoto
              ? `${basePhoto}${basePhoto.includes('?') ? '&' : '?' }v=${photoVersion}`
              : undefined;

            return (
              <View style={styles.profileCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.light.primary }}>HRCI Member & Admin</Text>
                </View>
                <Pressable
                  onPress={() => {
                    if (isAdmin) router.push('/hrci/admin' as any);
                    else router.push('/hrci' as any);
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                >
                <HrciIdCardFrontExact
                  width={cardWidth}
                  memberName={memberName}
                  designation={designation}
                  cellName={cellName}
                  idNumber={idNumber}
                  contactNumber={contactNumber}
                  validUpto={validUpto}
                  logoUri={logoUri}
                  photoUri={photoUri}
                />
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  {!isAdmin && (
                    <Pressable
                      onPress={() => router.push('/hrci/id-card' as any)}
                      style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={styles.primaryBtnText}>View ID Card</Text>
                    </Pressable>
                  )}
                  {/* Appointment Letter download/open */}
                  <Pressable
                    onPress={async () => {
                      try {
                        // Prefer API that generates/returns the most recent letter
                        const resp = await request<any>('/memberships/me/appointment-letter?generate=true', { method: 'GET' });
                        const payload = resp?.data ?? resp;
                        const generated = Boolean(payload?.generated);
                        if (!generated) {
                          Alert.alert('Appointment Letter', 'Please complete KYC and generate your ID Card first, then get the appointment letter.');
                          return;
                        }
                        const url = String(payload?.appointmentLetterPdfUrl || '').trim();
                        if (!url) {
                          // Defensive: try previous sources if API omitted URL
                          const fresh = await getMembershipProfile();
                          const fallback = (fresh as any)?.appointmentLetterPdfUrl
                            || (fresh as any)?.membership?.appointmentLetterPdfUrl
                            || (await loadTokens())?.user?.appointmentLetterPdfUrl
                            || '';
                          const clean2 = String(fallback || '').trim();
                          if (!clean2) {
                            Alert.alert('Appointment Letter', 'Not available yet. Please refresh.');
                            return;
                          }
                          await downloadPdfWithFallbacks(clean2, { preferFolderSaveOnAndroid: true });
                          return;
                        }
                        await downloadPdfWithFallbacks(url, { preferFolderSaveOnAndroid: true });
                      } catch (e: any) {
                        try {
                          const resp = await request<any>('/memberships/me/appointment-letter?generate=true', { method: 'GET' });
                          const payload = resp?.data ?? resp;
                          const clean2 = String(payload?.appointmentLetterPdfUrl || '').trim();
                          if (clean2) await Linking.openURL(clean2);
                          else throw e;
                        } catch {
                          Alert.alert('Appointment Letter', e?.message || 'Failed to download or open.');
                        }
                      }
                    }}
                    style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={styles.secondaryBtnText}>Appointment Letter</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      const res = await checkPostArticleAccess();
                      if (res.canAccess || res.hasValidRole) {
                        router.push('/explore');
                      } else {
                        router.push('/auth/login?from=post');
                      }
                    }}
                    style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={styles.secondaryBtnText}>Post News</Text>
                  </Pressable>
                </View>
              </View>
            );
          }

          // Fallback: original user profile card
          return (
            <View style={styles.profileCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.avatarWrap}>
                  {mp?.user?.profile?.profilePhotoUrl ? (
                    <Image
                      key={`${mp.user.profile.profilePhotoUrl}-${photoVersion}`}
                      source={{ uri: `${mp.user.profile.profilePhotoUrl}${mp.user.profile.profilePhotoUrl.includes('?') ? '&' : '?' }v=${photoVersion}` }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' }]}>
                      <Feather name="user" size={26} color="#64748b" />
                    </View>
                  )}
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{mp?.user?.profile?.fullName || 'Your Name'}</Text>
                  <Text style={styles.role} numberOfLines={1}>{mp?.user?.role || mp?.membership?.level || 'Member'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {mp?.membership?.designation?.name ? (
                      <Text style={styles.pill}>{mp.membership.designation.name}</Text>
                    ) : null}
                    {mp?.membership?.cell?.name ? (
                      <Text style={styles.pill}>{mp.membership.cell.name}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                {/* Hide HRCI access for Citizen Reporters entirely */}
                {!(roleReporter || isReporterSync) && (
                  <Pressable
                    onPress={() => router.push('/hrci/id-card' as any)}
                    style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={styles.primaryBtnText}>View ID Card</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={async () => {
                    const res = await checkPostArticleAccess();
                    if (res.canAccess || res.hasValidRole) {
                        router.push('/explore');
                    } else {
                      router.push('/auth/login?from=post');
                    }
                  }}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.secondaryBtnText}>Post News</Text>
                </Pressable>
              </View>
            </View>
          );
        })()}

        {/* Preferences section */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        {developerMode ? (
          <View style={styles.card}>
            <Text style={[styles.locTitle, { marginBottom: 6 }]}>Language Debug</Text>
            <Text style={styles.locValue}>selectedLanguage: {formatLang(selectedLangObj)}</Text>
            <Text style={styles.locValue}>language_local: {formatLang(localLangObj)}</Text>
            <Text style={styles.locValue}>prefs (server): {formatLang(prefLangObj)}</Text>
            <Text style={styles.locValue}>effective: {formatLang(effectiveLangObj)}</Text>
          </View>
        ) : null}
        {/* Language */}
        <View style={styles.card}>
          <SettingsRow
            icon={<Feather name="globe" size={20} color={Colors.light.primary} />}
            title="Language"
            subtitle={langName || 'Select your app language'}
            onPress={openLanguageSheet}
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

      </ScrollView>
      {/* Language bottom sheet */}
      <BottomSheetModal ref={bottomSheetRef} snapPoints={["40%", "80%"]} enablePanDownToClose>
        <BottomSheetView style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, flex: 1 }}>
          <Text style={{ fontWeight: '900', color: '#111', marginBottom: 10 }}>Choose Language</Text>
          {loadingLangList ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
              <LottieLoader size={72} />
              <Text style={{ color: '#6b7280', marginTop: 8 }}>Loading…</Text>
            </View>
          ) : (
            <BottomSheetFlatList
              data={langList}
              keyExtractor={(l:any, i:number) => String(l?.id ?? l?.code ?? l?.name ?? i)}
              contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
              renderItem={({ item: l }: { item: Language }) => (
                <Pressable onPress={() => handleSelectLanguage(l)} style={({ pressed }) => [styles.langItem, pressed && { opacity: 0.7 }] }>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.langDot, { backgroundColor: l.color || '#ddd' }]} />
                      <Text style={styles.langNative}>{l.nativeName || l.name}</Text>
                      <Text style={styles.langCode}>{l.code?.toUpperCase()}</Text>
                    </View>
                    {Boolean((l?.name || '').toLowerCase() === (langName || '').toLowerCase()) ? (
                      <Feather name="check" size={18} color={Colors.light.primary} />
                    ) : null}
                  </View>
                  <Text style={styles.langEnglish}>{l.name}</Text>
                </Pressable>
              )}
            />
          )}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Overlay during update */}
      {updatingLanguage && (
        <View style={styles.overlayFull} pointerEvents="auto">
          <View style={styles.overlayCardCenter}>
            <LottieLoader size={72} />
            <Text style={{ marginTop: 8, color: '#111', fontWeight: '700' }}>Applying language…</Text>
          </View>
        </View>
      )}

    </SafeAreaView>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  appTitle: { fontSize: 18, fontWeight: '800', color: Colors.light.primary },
  iconBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.light.secondary, borderRadius: 8 },
  content: { padding: 12, gap: 12 },
  profileCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  avatarWrap: { width: 86, height: 86, borderRadius: 12, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 86, height: 86, borderRadius: 12 },
  name: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  role: { marginTop: 2, fontSize: 12, fontWeight: '700', color: '#64748b' },
  pill: { fontSize: 11, fontWeight: '800', color: '#0f172a', backgroundColor: '#eef2f7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  primaryBtn: { flex: 1, backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { flex: 1, backgroundColor: Colors.light.secondary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  secondaryBtnText: { color: '#fff', fontWeight: '800' },
  sectionTitle: { marginTop: 4, marginBottom: 4, color: '#64748b', fontWeight: '800', fontSize: 12, paddingHorizontal: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  locDetails: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eef2f7' },
  locTitle: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  locValue: { marginTop: 4, color: '#0f172a' },
  changeBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: Colors.light.secondary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  changeBtnTxt: { color: '#fff', fontWeight: '800' },
  // Removed avatar styles with welcome card
  langItem: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eef2f7', backgroundColor: '#fff' },
  langDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  langNative: { color: '#111', fontWeight: '900', marginRight: 10 },
  langCode: { color: '#6b7280', fontWeight: '800' },
  langEnglish: { color: '#6b7280', marginTop: 4 },
  overlayFull: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  overlayCardCenter: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eef2f7' },
});
