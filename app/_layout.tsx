import AppLockGate from '@/components/AppLockGate';
import MobileLoginModal from '@/components/MobileLoginModal';
import Toast from '@/components/Toast';
import { resolveArticleReference } from '@/services/api';
import { ensureFirebaseAuthAsync, isFirebaseConfigComplete, logFirebaseGoogleAlignment } from '@/services/firebaseClient';
import { makeShadow } from '@/utils/shadow';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { LogBox, Platform, StyleSheet, Text, View } from 'react-native';
// removed duplicate react-native import (merged above)
import ErrorBoundary from '@/components/ErrorBoundary';
import { emit, on } from '@/services/events';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AuthProvider } from '../context/AuthContextNew';
import { ThemeProviderLocal, useThemePref } from '../context/ThemeContext';
import { UiPrefsProvider } from '../context/UiPrefsContext';
import { useColorScheme } from '../hooks/useColorScheme';
import { ensureNotificationsSetup } from '../services/notifications';

// Keep native splash visible until our root view mounts and/or splash screen routes decide to hide it
SplashScreen.preventAutoHideAsync().catch(() => {});

// Reduce noisy web warnings from third-party libs while we migrate
if (Platform.OS === 'web') {
  try {
    LogBox.ignoreLogs([
      // expo-notifications web advisory (harmless, no fix available yet)
      '[expo-notifications] Listening to push token changes is not yet fully supported on web',
      // react-native-web deprecations we'll gradually address
      '"shadow*" style props are deprecated. Use "boxShadow".',
      'props.pointerEvents is deprecated. Use style.pointerEvents',
    ]);
  } catch {}
}

// Custom Header Component
const CustomHeader = () => {
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerText}>
        Choose your preferred <Text style={styles.boldText}>language</Text>
        {'\n'}
        to read the <Text style={styles.boldText}>news</Text>
      </Text>
    </View>
  );
};

function ThemedApp() {
  const system = useColorScheme();
  const { themePref } = useThemePref();
  const effective = themePref === 'system' ? system : themePref;
  const router = useRouter();
  // Font loading temporarily disabled for debugging blank screen

  // Hide native splash as soon as the root view lays out (safety net to avoid being stuck)
  const splashHiddenRef = React.useRef(false);
  const onRootLayout = React.useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Dev-only keep-awake guard to avoid activation errors on some devices
  React.useEffect(() => {
    if (__DEV__ && Platform.OS !== 'web') {
      // Lazy import to avoid initializing keep-awake too early
      (async () => {
        try {
          const mod = await import('expo-keep-awake');
          if (mod?.deactivateKeepAwake) {
            await mod.deactivateKeepAwake();
          } else if ((mod as any)?.deactivateKeepAwakeAsync) {
            await (mod as any).deactivateKeepAwakeAsync();
          }
        } catch (e) {
          // Swallow – keep awake isn’t critical to functionality
          console.log('[KEEP_AWAKE] skip', (e as any)?.message);
        }
      })();
    }
  }, []);

  // Defer preload to allow Firebase modules to register (RN 0.81 timing)
  React.useEffect(() => {
    (async () => {
      try {
        if (isFirebaseConfigComplete()) {
          const auth = await ensureFirebaseAuthAsync();
          console.log('[AUTH_INIT] Layout ensured auth (async)', { appId: auth.app.options.appId, hasUser: !!auth.currentUser });
          logFirebaseGoogleAlignment();
        }
      } catch (e:any) {
        console.log('[AUTH_INIT] Layout init skipped', e?.message);
      }
    })();
  }, []);

  // Initialize notifications and obtain push token on app start
  React.useEffect(() => {
    (async () => {
      try {
        const res = await ensureNotificationsSetup();
        console.log('[NOTIF_INIT] status', res.status, 'expoToken?', !!res.expoToken, 'deviceToken?', !!res.deviceToken);
      } catch (e:any) {
        console.log('[NOTIF_INIT] failed', e?.message);
      }
    })();
  }, []);

  // Deep link & initial URL handling for khabarx://article/<id> and HTTPS App Links
  React.useEffect(() => {
    const handleUrl = async (url?: string | null) => {
      if (!url) return;
      const pushArticle = (articleId?: string | null, resolvedUrl?: string | null) => {
        if (!articleId) return false;
        try {
          router.push({ pathname: '/article/[id]', params: { id: articleId, url: resolvedUrl || url } as any });
          return true;
        } catch (err) {
          console.log('[DEEP_LINK] navigation failed', err);
          return false;
        }
      };
      try {
        const parsed = Linking.parse(url);
        const host = (parsed?.hostname || '').toLowerCase();
        const path = parsed?.path || '';
        const segments = path ? path.split('/') : [];

        // 1) App scheme khabarx://article/<id>
        if (segments[0] === 'article' && segments[1] && pushArticle(segments[1], url)) {
          return;
        }

        // 2) HTTPS canonical links from our domain -> try to extract article id quickly
        if (host === 'app.hrcitodaynews.in') {
          if (segments[0] === 'article' && segments[1] && pushArticle(segments[1], url)) {
            return;
          }
          const last = segments[segments.length - 1] || '';
          const m = last.match(/-([A-Za-z0-9]+)$/);
          if (m && m[1] && pushArticle(m[1], url)) {
            return;
          }
        }
      } catch (e) {
        console.log('[DEEP_LINK] failed to parse', url, e);
      }

      try {
        const resolved = await resolveArticleReference(url);
        if (resolved?.id) {
          pushArticle(resolved.id, resolved.canonicalUrl || resolved.originalUrl || url);
          return;
        }
      } catch (err) {
        console.log('[DEEP_LINK] resolver failed', (err as any)?.message || err);
      }
    };
    // Initial
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    // Listener
    const sub = Linking.addEventListener('url', (e) => { handleUrl(e.url); });
    return () => { try { sub.remove(); } catch {} };
  }, [router]);

  // Global inline login sheet controller (opens without route change)
  const [loginVisible, setLoginVisible] = React.useState(false);
  const loginOriginRef = React.useRef<'post' | 'generic'>('generic');
  React.useEffect(() => {
    const off = on('login:open', (p) => {
      loginOriginRef.current = (p?.from as any) || 'generic';
      setLoginVisible(true);
    });
    return () => { try { off(); } catch {} };
  }, []);
  const handleLoginSuccess = React.useCallback((data: { jwt: string; refreshToken: string; user?: any }) => {
    try { setLoginVisible(false); } catch {}
    try { emit('news:refresh', { reason: 'login' } as any); } catch {}
    if (loginOriginRef.current === 'post') {
      try { router.replace('/explore'); } catch {}
    }
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onRootLayout}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <ThemeProvider value={effective === 'dark' ? DarkTheme : DefaultTheme}>
            <ErrorBoundary>
            <Stack
              initialRouteName="splash"
              screenOptions={{
                // Avoid freezing previous screen during gestures to prevent blank screen
                freezeOnBlur: false,
                // Ensure a solid background during transitions using theme colors
                contentStyle: { backgroundColor: effective === 'dark' ? DarkTheme.colors.background : DefaultTheme.colors.background },
                gestureEnabled: true,
                animationTypeForReplace: 'push',
              }}
            >
              <Stack.Screen name="splash" options={{ headerShown: false }} />
              <Stack.Screen
                name="language"
                options={{
                  header: () => <CustomHeader />,
                }}
              />
              {/* Hide parent header for HRCI group to avoid double app bars on nested screens */}
              <Stack.Screen name="hrci" options={{ headerShown: false }} />
              {/* Keep previous screen attached to avoid blank screen when swiping back from article */}
              <Stack.Screen
                name="article/[id]"
                options={{
                  headerShown: false,
                  freezeOnBlur: false,
                  animation: 'slide_from_right',
                  contentStyle: { backgroundColor: effective === 'dark' ? DarkTheme.colors.background : DefaultTheme.colors.background },
                }}
              />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="comments"
                options={{
                  title: 'Comments',
                  // Bottom-to-top slide
                  animation: 'slide_from_bottom',
                  // iOS modal presentation style
                  presentation: 'modal',
                }}
              />
              <Stack.Screen name="+not-found" />
            </Stack>
            </ErrorBoundary>
            <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />
            <Toast />
            <AppLockGate />
            <MobileLoginModal
              visible={loginVisible}
              onClose={() => setLoginVisible(false)}
              onSuccess={handleLoginSuccess}
            />
          </ThemeProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProviderLocal>
      <UiPrefsProvider>
        <ThemedApp />
      </UiPrefsProvider>
    </ThemeProviderLocal>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 10,
    justifyContent: 'center',
    height: 110,
    ...makeShadow(4, { opacity: 0.25, y: 2, blur: 12 }),
  },
  headerText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#333',
  },
  boldText: {
    fontWeight: 'bold',
  },
});
