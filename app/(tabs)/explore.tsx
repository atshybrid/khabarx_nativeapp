import { useColorScheme } from '@/hooks/useColorScheme';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import LottieView from 'lottie-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CitizenReporterArticlesSheet from '../../components/CitizenReporterArticlesSheet';
import { FIREBASE_CONFIG } from '../../config/firebase';
import { Colors } from '../../constants/Colors';
import { useTabBarVisibility } from '../../context/TabBarVisibilityContext';
import { useTransliteration } from '../../hooks/useTransliteration';
import { checkDuplicateShortNews, createShortNews, getCategories, getLanguages, uploadMedia } from '../../services/api';
import { loadTokens } from '../../services/auth';
import { log } from '../../services/logger';
import { requestAppPermissions, type PermissionStatus } from '../../services/permissions';

// Add missing styles object
export default function PostCreateScreen() {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  // --- GROUPED HOOKS AND STATE ---
  const mediaRef = useRef<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [localCategoryId, setLocalCategoryId] = useState<string | null>(null);
  const [languageId, setLanguageId] = useState<string>('');
  const [languageName, setLanguageName] = useState<string>('');
  const titleTx = useTransliteration({ languageCode: languageId, enabled: true, mode: 'on-boundary', debounceMs: 140 });
  const contentTx = useTransliteration({ languageCode: languageId, enabled: true, mode: 'on-boundary', debounceMs: 140 });
  // showLogin state removed - now uses direct navigation to /auth/login
  // showUpgrade state removed - now uses direct navigation to /auth/login
  const [showLottie, setShowLottie] = useState<string | boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  // Removed loginPromptedRef - now check auth on each publish attempt instead
  // Login mobile (reserved for future login modal implementation)
  // Removed loginMobile state and related MPIN flow to reduce unused code noise
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // Parallel upload processor: starts upload for each pending item immediately
  const processUploads = React.useCallback(() => {
    const items = mediaRef.current;
    items.forEach((item: any, idx: number) => {
      if (item.status === 'pending') {
        setMedia((prev: any[]) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'uploading', progress: 0 };
            return next;
        });
        const uploadPayload = { uri: item.localUri || item.uri, type: item.type };
        uploadMedia(uploadPayload)
          .then((result: any) => {
            setMedia((prev: any[]) => {
              const next = [...prev];
              next[idx] = { ...next[idx], status: 'uploaded', remoteUrl: result.url, progress: 100 };
              return next;
            });
            mediaRef.current[idx] = { ...mediaRef.current[idx], remoteUrl: result.url, status: 'uploaded', progress: 100 };
          })
          .catch((err: any) => {
            try { console.warn('upload failed', err?.message || err); } catch {}
            setMedia((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], status: 'error', progress: 0 };
              return next;
            });
            mediaRef.current[idx] = { ...mediaRef.current[idx], status: 'error', progress: 0 };
          });
      }
    });
  }, []);

  const pickMedia = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow media library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 5,
      });
      if (result.canceled) return;
      const assets = (result.assets || []).slice(0, 5 - media.length);
      if (!assets.length) return;
      const mapped = assets.map(a => ({
        id: a.assetId || a.uri,
        uri: a.uri, // ensure uploadMedia gets a direct uri field
        localUri: a.uri,
        thumbnailUri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        status: 'pending',
        progress: 0,
      }));
      mediaRef.current = [...mediaRef.current, ...mapped];
      setMedia(prev => [...prev, ...mapped]);
      // Start uploads after short delay to let UI paint
      setTimeout(() => processUploads(), 50);
    } catch (e:any) {
      Alert.alert('Picker error', e?.message || 'Could not pick media');
    }
  };
  // Removed unused uploadingRef
  const router = useRouter();
  const { setTabBarVisible } = useTabBarVisibility();
  const [perms, setPerms] = useState<PermissionStatus | null>(null);
  const [role, setRole] = useState<string>('Guest');
  const [authLoaded, setAuthLoaded] = useState(false);


  // Google Auth: set up request using client IDs from centralized config
  WebBrowser.maybeCompleteAuthSession();
  const appScheme = (Constants as any)?.expoConfig?.scheme || 'khabarx';
  const webClientId: string | undefined = FIREBASE_CONFIG.googleWebClientId && !/YOUR_/i.test(String(FIREBASE_CONFIG.googleWebClientId)) ? FIREBASE_CONFIG.googleWebClientId : undefined;
  const googleMode: 'auto' | 'proxy' | 'native' = (FIREBASE_CONFIG.googleWebClientId && FIREBASE_CONFIG.googleWebClientId.length > 0 && FIREBASE_CONFIG.googleWebClientId !== 'YOUR_WEB_CLIENT_ID') ? 'proxy' : 'native';
  const androidClientId: string | undefined = FIREBASE_CONFIG.googleAndroidClientId;
  const googleNativeBase = androidClientId
    ? `com.googleusercontent.apps.${androidClientId.replace(/\.apps\.googleusercontent\.com$/i, '')}`
    : appScheme;
  const googleNativeRedirect = androidClientId
    ? `${googleNativeBase}:/oauth2redirect/google`
    : `${appScheme}://redirect`;
  const redirectUriNative = makeRedirectUri({ native: googleNativeRedirect, scheme: appScheme });
  const useProxyMode = googleMode === 'proxy' ? true : (googleMode === 'native' ? false : !!webClientId);
  const [/*googleRequest*/, , /*googlePromptAsync*/] = Google.useAuthRequest({
    clientId: useProxyMode ? webClientId : undefined,
    androidClientId: useProxyMode ? undefined : androidClientId,
    scopes: ['openid', 'profile', 'email'],
    extraParams: { prompt: 'select_account', ...(useProxyMode ? { nonce: String(Date.now()) } : {}) },
    // @ts-ignore
    useProxy: useProxyMode,
    // @ts-ignore
    responseType: useProxyMode ? 'id_token' : 'code',
    redirectUri: !useProxyMode ? redirectUriNative : undefined,
  });

  // Upgrade modal state (mobile + MPIN creation)
  // const [showCreateMpin, setShowCreateMpin] = useState(false); // deprecated MPIN create flow
  const [showArticlesSheet, setShowArticlesSheet] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');
  // Reset local category when the screen regains focus (fresh start)
  useFocusEffect(
    React.useCallback(() => {
      // On focus: clear any stale local selection
      setLocalCategoryId(null);
      return () => {
        // On blur: also clear local selection
        setLocalCategoryId(null);
      };
    }, [])
  );

  // We now rely on expo-image-picker; no custom native probing required

  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  // Android hardware back: always go to News (close modal first)
  useFocusEffect(
    React.useCallback(() => {
      const onBack = () => {
        if (showCategoryModal) {
          setShowCategoryModal(false);
          return true;
        }
        try { setTabBarVisible(true); } catch {}
        try { setLocalCategoryId(null); } catch {}
        try { router.replace('/news'); } catch {}
        return true; // prevent default behavior
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [showCategoryModal, router, setTabBarVisible])
  );

  useEffect(() => {
    (async () => {
      // derive selected language display from storage
      // load languages list (cached or live)
  try { await getLanguages(); } catch {}
      const langJson = await AsyncStorage.getItem('selectedLanguage');
      let effLangId: string | undefined;
      if (langJson) {
        try {
          const lang = JSON.parse(langJson);
          setLanguageName(lang?.nativeName || lang?.name || 'Language');
          setLanguageId(lang?.id);
          effLangId = lang?.id;
        } catch {}
      }
      // load current role if any (from tokens or AsyncStorage)
      try {
        const t = await loadTokens();
        const tokenRole = t?.user?.role;
        if (tokenRole) {
          setRole(tokenRole);
        } else {
          const savedRole = await AsyncStorage.getItem('profile_role');
          if (savedRole) setRole(savedRole);
        }
      } catch {}
      // request permissions (notif + location) upfront for smoother UX
      try {
        const st = await requestAppPermissions();
        setPerms(st);
      } catch {}
      // fetch categories for dropdown (language resolved internally)
      try {
        const list = await getCategories(effLangId);
        setCategories(list);
      } catch {}
      // Configure native Google Sign-In if chosen
      try {
        if (googleMode === 'native' && webClientId) {
          GoogleSignin.configure({ webClientId, forceCodeForRefreshToken: false });
        }
      } catch {}
      setAuthLoaded(true);
    })();
  }, [googleMode, webClientId]);

  // Displayed category name (fallback to stored name if list doesn't include current id yet)
  const [displayedCategoryName, setDisplayedCategoryName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const selId = localCategoryId;
      if (!selId) {
        if (!cancelled) setDisplayedCategoryName(null);
        return;
      }
      const found = categories.find(c => c.id === selId);
      if (found) {
        if (!cancelled) setDisplayedCategoryName(found.name);
        // keep storage in sync for other screens
        try { await AsyncStorage.setItem('selectedCategoryName', found.name); } catch {}
      } else {
        try {
          const stored = await AsyncStorage.getItem('selectedCategoryName');
          if (!cancelled) setDisplayedCategoryName(stored || null);
        } catch {
          if (!cancelled) setDisplayedCategoryName(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [localCategoryId, categories]);

  // Avoid proactively importing expo-image-picker on mount to prevent early native module evaluation.

  // Check authentication when user attempts to publish
  const checkAuthBeforePublish = () => {
    if (!authLoaded) {
      Alert.alert('Please wait', 'Loading authentication status...');
      return false;
    }
    
    if (role !== 'CITIZEN_REPORTER') {
      Alert.alert(
        'Authentication Required',
        'You need to be a Citizen Reporter to create posts. Please login or register.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            // Don't navigate away, let user stay on post creation screen
          },
          {
            text: 'Login',
            onPress: () => router.push('/auth/login?from=post')
          }
        ]
      );
      return false;
    }
    
    return true;
  };

  const titleRemaining = 35 - titleTx.value.length;
  const contentWords = useMemo(() => (contentTx.value.trim() ? contentTx.value.trim().split(/\s+/).length : 0), [contentTx.value]);
  // const contentRemaining = Math.max(0, 60 - contentWords); // not currently surfaced


  // Helper to get effective category ID for posting
  // Helper to get effective category ID for posting
  // Removed unused effectiveCategoryId

  // Parallel upload processor: starts upload for each pending item immediately
  // (Removed duplicate/incorrect nested processUploads definition)
  const checkLocationAndPerms = async () => {
  const items = mediaRef.current;
  const hasVideo = items.some((m: any) => m.type === 'video');
  const imageCount = items.filter((m: any) => m.type === 'image').length;
  if (hasVideo && imageCount === 0) { Alert.alert('Add an image', 'If you upload a video, you must also include at least 1 image.'); return undefined; }
    let effectivePerms = perms;
    if (!effectivePerms?.location || effectivePerms.location !== 'granted' || !effectivePerms.coordsDetailed) {
      try {
        const st = await requestAppPermissions();
        setPerms(st);
        effectivePerms = st;
      } catch {}
    }
    if (!effectivePerms?.coordsDetailed || effectivePerms.location !== 'granted') {
      Alert.alert('Location required', 'Please allow location to post news.');
      return undefined;
    }
    if (!Number.isFinite(effectivePerms.coordsDetailed.latitude) || !Number.isFinite(effectivePerms.coordsDetailed.longitude)) {
      Alert.alert('Location error', 'We could not determine a valid location. Please try again after enabling GPS.');
      return undefined;
    }
    try {
      const cd = effectivePerms?.coordsDetailed;
      log.debug('publish.location', cd ? { lat: cd.latitude, lng: cd.longitude, accuracy: cd.accuracy } : 'no-coords');
    } catch {}
    return effectivePerms;
  };

  // onSubmit handler for publish button and programmatic triggers
  const onSubmit = async () => {
    // Check authentication before any processing
    if (!checkAuthBeforePublish()) {
      return;
    }

    // Basic validation checks
    if (!titleTx.value.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your article.');
      return;
    }
    if (!contentTx.value.trim()) {
      Alert.alert('Content Required', 'Please enter content for your article.');
      return;
    }
    if (!localCategoryId) {
      Alert.alert('Category Required', 'Please select a category for your article.');
      return;
    }
    if (media.length === 0) {
      Alert.alert('Media Required', 'Please add at least one image or video.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    setShowLottie('news');
    try {
      // Make sure media is uploaded; start uploads if any pending
    if (mediaRef.current.some((m: any) => !m.remoteUrl)) {
      // Define ensureAllUploads: upload all pending media
      const pending = mediaRef.current.filter((m: any) => !m.remoteUrl && m.status !== 'error');
      for (let i = 0; i < pending.length; i++) {
        try {
          const up = await uploadMedia({ uri: pending[i].localUri || pending[i].uri, type: pending[i].type });
          const idx = mediaRef.current.findIndex(mm => mm.id === pending[i].id);
          if (idx >= 0) {
            mediaRef.current[idx] = { ...mediaRef.current[idx], remoteUrl: up.url, status: 'uploaded', progress: 100 };
          }
  } catch {
          const idx = mediaRef.current.findIndex(mm => mm.id === pending[i].id);
          if (idx >= 0) mediaRef.current[idx] = { ...mediaRef.current[idx], status: 'error', progress: 0 };
        }
      }
    }
    // Re-check media after waiting
    const itemsNow = mediaRef.current;
    try {
      const summary = itemsNow.reduce((acc: Record<string, number>, m: any) => { acc[m.status || 'unknown'] = (acc[m.status || 'unknown'] || 0) + 1; return acc; }, {} as Record<string, number>);
      log.debug('publish.mediaStatus', summary);
    } catch {}
    const failed = itemsNow.filter((m: any) => m.status === 'error');
    if (failed.length) {
      setSubmitting(false);
      setShowLottie('none');
      return Alert.alert('Some uploads failed', 'Please remove failed items or try again.');
    }
    const uploadedNow = itemsNow.filter((m: any) => m.status === 'uploaded');
    if (!uploadedNow.length) {
      setSubmitting(false);
      setShowLottie('none');
      return Alert.alert('No media uploaded', 'Please add at least 1 image.');
    }
    const uploadedImages = uploadedNow.filter((m: any) => m.type === 'image').length;
    const hasVideoUploaded = uploadedNow.some((m: any) => m.type === 'video');
      if (hasVideoUploaded && uploadedImages === 0) {
        setSubmitting(false);
        setShowLottie('none');
        return Alert.alert('Add an image', 'If you upload a video, you must also include at least 1 image.');
      }
      // require language selection
      let langIdEff: string | undefined = languageId;
      if (!langIdEff) {
        try {
          const raw = await AsyncStorage.getItem('selectedLanguage');
          langIdEff = raw ? (JSON.parse(raw)?.id as string | undefined) : undefined;
        } catch {}
      }
      if (!langIdEff) {
        throw new Error('Language not selected');
      }
      // Duplicate check (best-effort)
      try {
  const isDup = await checkDuplicateShortNews(titleTx.value.trim(), langIdEff!);
        try { log.debug('publish.duplicateCheck', { duplicate: isDup }); } catch {}
        if (isDup) {
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert('Possible duplicate', 'A similar title already exists in this language. Continue?', [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Post Anyway', style: 'default', onPress: () => resolve(true) },
            ]);
          });
          if (!proceed) { setSubmitting(false); setShowLottie('none'); return; }
        }
      } catch {}
      // collect already uploaded URLs (ignore failed items)
      const uploadedUrls = mediaRef.current.filter((m) => m.remoteUrl && m.status === 'uploaded').map((m) => m.remoteUrl!);
      const effectivePerms = await checkLocationAndPerms();
      if (!effectivePerms || !effectivePerms.coordsDetailed) return;
      const cd = effectivePerms.coordsDetailed;
      const payload = {
  title: titleTx.value.trim(),
  content: contentTx.value.trim(),
        languageId: langIdEff!,
        categoryId: localCategoryId!,
        mediaUrls: uploadedUrls.length ? uploadedUrls : undefined,
        role: 'CITIZEN_REPORTER' as const,
        location: {
          latitude: cd.latitude,
          longitude: cd.longitude,
          accuracyMeters: cd.accuracy ?? null,
          provider: 'fused',
          timestampUtc: cd.timestamp || Date.now(),
          placeId: null,
          placeName: effectivePerms.place?.fullName || effectivePerms.place?.name || null,
          address: effectivePerms.place?.fullName || null,
          source: 'gps',
        },
      };
      try { log.event('shortnews.payload', { ...payload, mediaUrls: payload.mediaUrls ? `[${payload.mediaUrls.length}]` : undefined }); } catch {}
      try { console.log('ShortNews Payload\n' + JSON.stringify(payload, null, 2)); } catch {}
      const response = await createShortNews(payload);
      if (response.id) {
        setSubmitting(false);
  titleTx.onChangeText('');
  contentTx.onChangeText('');
        setMedia([]);
        setLocalCategoryId(null);
  router.replace('/congrats');
        setTabBarVisible(true);
      } else {
        setShowLottie('none');
        setSubmitting(false);
        Alert.alert('Failed to publish', 'Please try again later');
      }
    } catch (e: any) {
      setShowLottie('none');
      setSubmitting(false);
      try { log.error('publish.failed', e); } catch {}
      Alert.alert('Failed to publish', e?.message || 'Please try again later');
    } finally {
      setSubmitting(false);
    }
  };

  // Deprecated OTP send flow removed in favor of direct account creation

  // Removed legacy OTP verify-and-upgrade flow. We now create account directly with mobile + MPIN.

  // MPIN/login related logic removed

  // Create Citizen Reporter (mobile) using upgrade modal form
  // onCreateCitizenMobile removed (upgrade modal placeholder only)

  useEffect(() => {
    (async () => {
      try {
  const t = await loadTokens();
  if (t?.jwt) setAuthToken(t.jwt);
      } catch {}
    })();
  }, []);

  const canPublish = titleTx.value.trim().length > 0 && contentTx.value.trim().length > 0 && localCategoryId && media.length > 0 && !submitting;

  const translitBg = titleTx.enabled
    ? (scheme === 'dark' ? 'rgba(34,197,94,0.22)' : '#dcfce7')
    : (scheme === 'dark' ? 'rgba(239,68,68,0.22)' : '#fee2e2');
  const translitColor = titleTx.enabled
    ? (scheme === 'dark' ? '#86efac' : '#166534')
    : (scheme === 'dark' ? '#fca5a5' : '#991b1b');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }] }>
      {/* Minimal header */}
      <View style={[styles.headerBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => {
            setTabBarVisible(true);
            setLocalCategoryId(null);
            // Always return to News screen
            router.replace('/news');
          }}
          style={styles.headerLeft}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color={scheme === 'dark' ? '#fff' : theme.primary} />
          <Text style={[styles.headerBackText, { color: scheme === 'dark' ? '#fff' : theme.primary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Post Article</Text>
        <TouchableOpacity onPress={() => setShowArticlesSheet(true)} style={styles.headerRight} accessibilityLabel="Your Articles">
          <Feather name="list" size={22} color={scheme === 'dark' ? '#fff' : theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollBody, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
        {/* Location Badge */}
        {perms?.coords && (
          <View style={[styles.locationPill, { backgroundColor: scheme === 'dark' ? '#223042' : '#eef2f7' }]}>
            <Text style={[styles.locationPillText, { color: theme.muted }]}>📍 {perms.place?.city || perms.place?.region || 'Location On'}</Text>
          </View>
        )}

        {/* Category & Language Row */}
        <View style={styles.inlineRow}>
          <TouchableOpacity style={[styles.selector, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setShowCategoryModal(true)}>
            <Text style={[styles.selectorLabel, { color: theme.muted }]}>Category</Text>
            <Text style={[styles.selectorValue, { color: theme.text }]}>{displayedCategoryName || 'Select'}</Text>
          </TouchableOpacity>
          <View style={[styles.selector, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.selectorLabel, { color: theme.muted }]}>Language</Text>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <Text style={[styles.selectorValue, { color: theme.text }]}>{languageName || 'Auto'}</Text>
              <TouchableOpacity
                onPress={titleTx.toggle}
                style={{ marginLeft:8, backgroundColor: translitBg, paddingHorizontal:10, paddingVertical:4, borderRadius:999 }}
              >
                <Text style={{ fontSize:11, fontWeight:'600', color: translitColor }}>{titleTx.enabled ? 'Translit ON' : 'Translit OFF'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Title Input */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Title</Text>
            <Text style={styles.counter}>{titleRemaining}</Text>
          </View>
          <TextInput
            style={[styles.titleInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Short, factual headline"
            value={titleTx.value}
            maxLength={35}
            onChangeText={titleTx.onChangeText}
            placeholderTextColor={theme.muted}
          />
        </View>

        {/* Content Input */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Summary</Text>
            <Text style={styles.counter}>{contentWords}/60w</Text>
          </View>
          <TextInput
            style={[styles.contentInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="What happened? Keep it concise and objective."
            multiline
            value={contentTx.value}
            onChangeText={contentTx.onChangeText}
            placeholderTextColor={theme.muted}
          />
        </View>

        {/* Media Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Media</Text>
            <TouchableOpacity style={[styles.addMediaBtn, { backgroundColor: scheme === 'dark' ? '#223042' : '#eef2f7' }]} onPress={pickMedia}>
              <Feather name="plus" size={16} color={theme.primary} />
              <Text style={[styles.addMediaText, { color: theme.primary }]}>Add</Text>
            </TouchableOpacity>
          </View>
          {media.length === 0 && (
            <Pressable style={[styles.mediaPlaceholder, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={pickMedia}>
              <Feather name="image" size={34} color={theme.muted} />
              <Text style={[styles.mediaPlaceholderText, { color: theme.text }]}>Add images / video</Text>
              <Text style={[styles.mediaHint, { color: theme.muted }]}>At least 1 image. Video optional.</Text>
            </Pressable>
          )}
          {media.length > 0 && (
            <View style={styles.mediaGrid}>
              {media.map((m, idx) => (
                <View key={idx} style={[styles.mediaItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {m.thumbnailUri ? (
                    <Image source={{ uri: m.thumbnailUri }} style={styles.mediaThumb} />
                  ) : (
                    <View style={[styles.mediaThumbSkeleton, { backgroundColor: theme.border }]} />
                  )}
                  {m.status === 'uploading' && <View style={[styles.uploadBadge, { backgroundColor: theme.primary }]}><Text style={styles.uploadBadgeText}>…</Text></View>}
                  {m.status === 'error' && <View style={[styles.uploadBadge, styles.uploadError]}><Text style={styles.uploadBadgeText}>!</Text></View>}
                  <Pressable style={styles.removeMediaBtn} onPress={() => {
                    setMedia(prev => prev.filter((_, i) => i !== idx));
                    mediaRef.current = mediaRef.current.filter((_, i) => i !== idx);
                  }}>
                    <Feather name="x" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Spacer to prevent overlap with bottom bar */}
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '75%', width: '88%', backgroundColor: theme.card }]}> 
            <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: theme.text }}>Select Category</Text>
            <TextInput
              style={[styles.searchInput, { backgroundColor: scheme === 'dark' ? '#1f2326' : '#f1f5f9', color: theme.text }]}
              placeholder="Search"
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholderTextColor={theme.muted}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {categories
                .filter(c => !categorySearch.trim() || c.name.toLowerCase().includes(categorySearch.trim().toLowerCase()))
                .map(c => {
                  const selected = c.id === localCategoryId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setLocalCategoryId(c.id);
                        setShowCategoryModal(false);
                      }}
                      style={[styles.categoryRow, { borderBottomColor: theme.border }, selected && [styles.categoryRowSelected, { backgroundColor: scheme === 'dark' ? '#223042' : '#eef2f7' }]]}
                    >
                      <Text style={[styles.categoryRowText, { color: theme.text }, selected && [styles.categoryRowTextSelected, { color: theme.primary }]]}>{c.name}</Text>
                      {selected && <Feather name="check" size={18} color={theme.primary} />}
                    </Pressable>
                  );
                })}
              {categories.length === 0 && (
                <Text style={{ textAlign:'center', paddingVertical:24, color: theme.muted }}>No categories</Text>
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={[styles.publishBtn, { marginTop:16, backgroundColor: theme.primary }]}> 
              <Text style={styles.publishBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fixed bottom action bar */}
      <View style={[styles.bottomBar, { backgroundColor: scheme === 'dark' ? 'rgba(21,23,24,0.93)' : 'rgba(255,255,255,0.93)', borderTopColor: theme.border }] }>
        <View style={styles.validationRow}>
          {!titleTx.value.trim() && <Text style={styles.validationText}>Title required</Text>}
          {!contentTx.value.trim() && <Text style={styles.validationText}>Summary required</Text>}
          {!localCategoryId && <Text style={styles.validationText}>Category</Text>}
          {media.length === 0 && <Text style={styles.validationText}>Media</Text>}
        </View>
        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: theme.primary }, !canPublish && styles.publishBtnDisabled]}
          onPress={onSubmit}
          disabled={!canPublish}
          accessibilityRole="button"
        >
          <Text style={styles.publishBtnText}>{submitting ? 'Publishing…' : 'Publish'}</Text>
        </TouchableOpacity>
      </View>

      {/* Modals and overlays */}
      <>
        {/* Login modal replaced with direct navigation to /auth/login screen */}
        {/* Upgrade modal replaced with direct navigation to /auth/login screen */}
        <CitizenReporterArticlesSheet
          visible={showArticlesSheet}
          onClose={() => setShowArticlesSheet(false)}
          token={authToken}
        />
        {showLottie === 'news' && (
          <Modal visible animationType="fade" transparent>
            <View style={styles.lottieOverlay}>
              <LottieView source={require('../../assets/lotti/News icon.json')} autoPlay loop style={{ width: 180, height: 180 }} />
              <Text style={[styles.lottieText, { color: theme.text }]}>Publishing…</Text>
            </View>
          </Modal>
        )}
        {showLottie === 'congrats' && (
          <Modal visible animationType="fade" transparent>
            <View style={styles.lottieOverlay}>
              <LottieView source={require('../../assets/lotti/congratulation.json')} autoPlay loop={false} style={{ width: 220, height: 220 }} />
              <Text style={[styles.congratsText, { color: '#22c55e' }]}>Congratulations!</Text>
            </View>
          </Modal>
        )}
      </>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  headerBackText: { marginLeft: 4, fontSize: 15, color: Colors.light.primary, fontWeight: '500' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#111' },
  headerRight: { padding: 4 },
  scrollBody: { padding: 16, paddingBottom: 40 },
  locationPill: { alignSelf: 'flex-start', backgroundColor: '#eef2f7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 12 },
  locationPillText: { fontSize: 12.5, color: '#334155' },
  inlineRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  selector: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  selectorLabel: { fontSize: 11, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '600' },
  selectorValue: { marginTop: 4, fontSize: 14.5, color: '#111' },
  section: { marginBottom: 22 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#334155', letterSpacing: 0.3 },
  counter: { fontSize: 12, color: '#64748b' },
  titleInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600', color: '#111' },
  contentInput: { backgroundColor: '#fff', minHeight: 130, textAlignVertical: 'top', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingTop: 12, fontSize: 15, lineHeight: 21, color: '#111' },
  addMediaBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#eef2f7', borderRadius: 999, gap: 4 },
  addMediaText: { fontSize: 12.5, color: Colors.light.primary, fontWeight: '600' },
  mediaPlaceholder: { borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', backgroundColor: '#fff', borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingVertical: 34 },
  mediaPlaceholderText: { marginTop: 10, fontSize: 14, fontWeight: '500', color: '#334155' },
  mediaHint: { marginTop: 4, fontSize: 12, color: '#64748b' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaItem: { width: 90, height: 90, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', position: 'relative' },
  mediaThumb: { width: '100%', height: '100%' },
  mediaThumbSkeleton: { flex: 1, backgroundColor: '#e2e8f0' },
  removeMediaBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 4 },
  uploadBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  uploadBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  uploadError: { backgroundColor: '#dc2626' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, backgroundColor: '#ffffffee', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
  validationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  validationText: { fontSize: 11, color: '#dc2626', backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  publishBtn: { backgroundColor: Colors.light.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  publishBtnDisabled: { backgroundColor: '#94a3b8' },
  publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  lottieOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  lottieText: { marginTop: 18, fontSize: 17, fontWeight: '500', color: '#333', textAlign: 'center' },
  congratsText: { marginTop: 18, fontSize: 19, fontWeight: '700', color: '#22c55e', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, minWidth: 300, elevation: 4 },
  searchInput: { backgroundColor:'#f1f5f9', borderRadius:12, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#111', marginBottom:12 },
  categoryRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:12, paddingHorizontal:10, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:'#e2e8f0' },
  categoryRowSelected: { backgroundColor:'#eef2f7' },
  categoryRowText: { fontSize:14.5, color:'#111' },
  categoryRowTextSelected: { fontWeight:'600', color:Colors.light.primary },
});
