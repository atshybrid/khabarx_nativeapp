import AppLockGate from '@/components/AppLockGate';
import Toast from '@/components/Toast';
import { ensureFirebaseAuthAsync, isFirebaseConfigComplete, logFirebaseGoogleAlignment } from '@/services/firebaseClient';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
// removed duplicate react-native import (merged above)
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProviderLocal, useThemePref } from '../context/ThemeContext';
import { UiPrefsProvider } from '../context/UiPrefsContext';
import { useColorScheme } from '../hooks/useColorScheme';
import { ensureNotificationsSetup } from '../services/notifications';

// Keep native splash visible while we boot in app/splash.tsx
SplashScreen.preventAutoHideAsync().catch(() => {});

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

  // Deep link & initial URL handling for khabarx://article/<id>
  React.useEffect(() => {
    const handleUrl = (url?: string | null) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const segments = parsed?.path ? parsed.path.split('/') : [];
        if (segments[0] === 'article' && segments[1]) {
          const articleId = segments[1];
          // Navigate only if not already on that screen
          router.push({ pathname: '/article/[id]', params: { id: articleId } });
        }
      } catch (e) {
        console.log('[DEEP_LINK] failed to parse', url, e);
      }
    };
    // Initial
    Linking.getInitialURL().then(handleUrl).catch(()=>{});
    // Listener
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => { try { sub.remove(); } catch {} };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <ThemeProvider value={effective === 'dark' ? DarkTheme : DefaultTheme}>
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
            <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />
            <Toast />
            <AppLockGate />
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
