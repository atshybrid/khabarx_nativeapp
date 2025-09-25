
import { getLanguages, getNews } from '@/services/api';
import { clearTokens, isExpired, loadTokens, refreshTokens, Tokens } from '@/services/auth';
import { migrateLegacySelectedLanguage } from '@/services/languageMigration';
import AsyncStorage from '@react-native-async-storage/async-storage';
// router replaced by nav logger
import { nav } from '@/services/navLogger';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Alert, View } from 'react-native';

export default function SplashScreen() {

  useEffect(() => {
    (async () => {
      try {
        const start = Date.now();
        console.log('[BOOT] Splash start');
        let tokens: Tokens | null = await loadTokens();
        console.log('[BOOT] Tokens loaded', {
          jwtPresent: Boolean(tokens?.jwt),
          refreshPresent: Boolean(tokens?.refreshToken),
          expiresAt: tokens?.expiresAt || null,
          expired: tokens ? isExpired(tokens.expiresAt) : null,
        });
        try {
          // Perform one-time migration of legacy numeric language IDs to new UUID ids
          const mig = await migrateLegacySelectedLanguage();
          if (mig.migrated) {
            console.log('[BOOT] Language migration applied');
          } else {
            console.log('[BOOT] Language migration not needed', mig.reason);
          }
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
            if (langRaw) {
              const lang = JSON.parse(langRaw) as { id?: string; code?: string; name?: string };
              console.log('[BOOT] Selected language', { id: lang.id, code: (lang as any).code, name: lang.name });
            } else {
              console.log('[BOOT] Selected language: none');
            }
        } catch (e) {
          console.log('[BOOT] Language inspect/migrate failed', (e as any)?.message || e);
        }
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
          // If tokens exist, ensure guest flag reflects actual role
          try {
            const role = tokens.user?.role || (await AsyncStorage.getItem('profile_role'));
            if (role && role !== 'Guest') {
              // legacy guest flag removal: no-op
            }
          } catch {}
          // Authenticated: ensure the API is reachable for shortnews BEFORE hiding splash
          console.log('[BOOT] Authenticated → probing /shortnews before navigating');
          try {
            const stored = await AsyncStorage.getItem('selectedLanguage');
            const lang = stored ? (JSON.parse(stored)?.code ?? 'en') : 'en';
            await getNews(lang); // will throw if API fails or non-JSON
            console.log('[BOOT] Shortnews reachable');
            await ensureMinSplash();
            try { await ExpoSplashScreen.hideAsync(); } catch {}
            nav.replace('/(tabs)/news');
            return;
          } catch (e: any) {
            console.warn('[BOOT] Shortnews probe failed, keeping splash', e?.message || e);
            Alert.alert('Network issue', 'Unable to reach news service. Please check internet and try again.');
            // Optionally retry later; for now, stay on splash to avoid mock data
            return;
          }
        }
        // No tokens case: check if language already chosen
        let storedLanguage: any = null;
        try {
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
          if (langRaw) storedLanguage = JSON.parse(langRaw);
        } catch {}
        if (storedLanguage?.id || storedLanguage?.code) {
          // Language chosen but no auth tokens: allow anonymous reading (no guest token).
          console.log('[BOOT] Language selected, no auth tokens → proceed anonymous to news');
          try {
            const code = storedLanguage.code || 'en';
            // Best-effort warmup (non-fatal)
            getNews(code).catch(()=>{});
          } catch {}
          await ensureMinSplash();
            try { await ExpoSplashScreen.hideAsync(); } catch {}
            nav.replace('/(tabs)/news');
            return;
        }

        // No language stored: go to language selection first
        console.log('[BOOT] No tokens & no language → /language');
        getLanguages().catch((e) => console.log('[BOOT] Warmup getLanguages failed (ignored)', e?.message || e));
        await ensureMinSplash();
        try { await ExpoSplashScreen.hideAsync(); } catch {}
  nav.replace('/language');
      } catch (e) {
        console.warn('[BOOT] Boot failed, redirecting to language', e);
        // Be safe and clear any potentially invalid tokens
        try { await clearTokens(); } catch {}
        try { await ExpoSplashScreen.hideAsync(); } catch {}
  nav.replace('/language');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1 }} />
  );
}

