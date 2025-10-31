import { getLanguages, getMockMode, getNews, setMockMode } from '@/services/api';
import { clearTokens, isExpired, loadTokens, refreshTokens, Tokens } from '@/services/auth';
import { getBaseUrl } from '@/services/http';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

export default function SplashScreen() {
  const scaleRef = useRef(new Animated.Value(0.86));
  // Simple zoom-in animation for top KhabarX logo
  useEffect(() => {
    try {
      Animated.sequence([
        Animated.timing(scaleRef.current, { toValue: 1.06, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scaleRef.current, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true })
      ]).start();
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const start = Date.now();
        console.log('[BOOT] Splash start');
        // Ensure mock mode is disabled per requirement to always show real data
        try {
          const mock = await getMockMode();
          if (mock) {
            console.warn('[BOOT] Mock mode detected → disabling');
            await setMockMode(false);
          }
        } catch {}
        try { console.log('[BOOT] API BASE_URL', getBaseUrl()); } catch {}
        let tokens: Tokens | null = await loadTokens();
        console.log('[BOOT] Tokens loaded', {
          jwtPresent: Boolean(tokens?.jwt),
          refreshPresent: Boolean(tokens?.refreshToken),
          expiresAt: tokens?.expiresAt || null,
          expired: tokens ? isExpired(tokens.expiresAt) : null,
        });
        try {
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
          if (langRaw) {
            const lang = JSON.parse(langRaw) as { id?: string; code?: string; name?: string };
            console.log('[BOOT] Selected language', { id: lang.id, code: (lang as any).code, name: lang.name });
          } else {
            console.log('[BOOT] Selected language: none');
          }
        } catch {}
        if (tokens && (isExpired(tokens.expiresAt) || !tokens.expiresAt)) {
          console.log('[BOOT] Token expired, attempting refresh');
          try {
            tokens = await refreshTokens();
            console.log('[BOOT] Refresh success', {
              jwtPresent: Boolean(tokens?.jwt),
              refreshPresent: Boolean(tokens?.refreshToken),
              expiresAt: tokens?.expiresAt || null,
              expired: tokens ? isExpired(tokens.expiresAt) : null,
            });
          } catch {
            // Refresh failed -> clear and force re-register
            await clearTokens();
            tokens = null;
            console.log('[BOOT] Refresh failed, tokens cleared');
          }
        }
        // Minimum splash visibility
        const ensureMinSplash = async () => {
          const elapsed = Date.now() - start;
          const minMs = 900;
          if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
        };

        if (tokens) {
          // If tokens exist, proceed to app regardless of news probe; warm up in background
          try {
            const role = tokens.user?.role || (await AsyncStorage.getItem('profile_role'));
            if (role && role !== 'Guest') {
              // no-op: role info only for logs/analytics
            }
          } catch {}
          console.log('[BOOT] Authenticated → warm up /shortnews in background and navigate');
          try {
            const stored = await AsyncStorage.getItem('selectedLanguage');
            const lang = stored ? (JSON.parse(stored)?.code ?? 'en') : 'en';
            // Best-effort warmup (non-blocking)
            getNews(lang).catch((e) => console.warn('[BOOT] Warmup shortnews failed (ignored)', e?.message || e));
          } catch {}
          // Do not auto-route members/admins to dashboards from splash; always land on news
          await ensureMinSplash();
          try { await ExpoSplashScreen.hideAsync(); } catch {}
          router.replace('/news');
          return;
        }
        // No tokens case: check if language already chosen
        let storedLanguage: any = null;
        try {
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
          if (langRaw) storedLanguage = JSON.parse(langRaw);
        } catch {}
        if (storedLanguage?.id || storedLanguage?.code) {
          // Language chosen but no auth tokens: proceed anonymous to news
          console.log('[BOOT] Language selected, no auth tokens → warm up in background and navigate');
          try {
            const code = storedLanguage.code || 'en';
            // Best-effort warmup (non-fatal)
            getNews(code).catch(()=>{});
          } catch {}
          await ensureMinSplash();
            try { await ExpoSplashScreen.hideAsync(); } catch {}
            router.replace('/news');
            return;
        }

        // No language stored: go to language selection first
        console.log('[BOOT] No tokens & no language → /language');
        getLanguages().catch((e) => console.log('[BOOT] Warmup getLanguages failed (ignored)', e?.message || e));
        await ensureMinSplash();
        try { await ExpoSplashScreen.hideAsync(); } catch {}
        router.replace('/language');
      } catch (e) {
        console.warn('[BOOT] Boot failed, redirecting to language', e);
        // Be safe and clear any potentially invalid tokens
        try { await clearTokens(); } catch {}
        try { await ExpoSplashScreen.hideAsync(); } catch {}
        router.replace('/language');
      }
    })();
  }, []);

  return (
    <View style={styles.root}>
      {/* Top KhabarX logo with gentle zoom-in */}
      <View style={styles.topWrap}>
        <Animated.View style={{ transform: [{ scale: scaleRef.current }] }}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.kxLogo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
      {/* Bottom powered-by HRCI */}
      <View style={styles.bottomWrap}>
        <Text style={styles.poweredBy} numberOfLines={2}>
          Powered By
          {'\n'}HUMAN RIGHTS COUNCIL FOR INDIA (HRCI)
        </Text>
        <Image
          source={require('@/assets/images/hrci_logo.png')}
          style={styles.hrciLogo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', alignItems: 'center', paddingBottom: 36 },
  topWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  bottomWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  kxLogo: { width: 160, height: 160 },
  poweredBy: { textAlign: 'center', fontSize: 12, color: '#334155', fontWeight: '800', letterSpacing: 0.4, marginBottom: 8 },
  hrciLogo: { width: 120, height: 56 },
});

