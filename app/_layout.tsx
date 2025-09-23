import Toast from '@/components/Toast';
import { ensureFirebaseAuthAsync, isFirebaseConfigComplete, logFirebaseGoogleAlignment } from '@/services/firebaseClient';
import { notificationService } from '@/services/notifications';
import { Feather } from '@expo/vector-icons';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AuthProvider } from '../context/AuthContext';
import { useColorScheme } from '../hooks/useColorScheme';

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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  // Font loading temporarily disabled for debugging blank screen

  // Initialize notification service and Firebase
  React.useEffect(() => {
    // Initialize notification service
    notificationService.initialize();
    
    // Initialize Firebase auth
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

    // Cleanup function
    return () => {
      notificationService.cleanup();
    };
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
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack
              initialRouteName="splash"
              screenOptions={{
                // Avoid freezing previous screen during gestures to prevent blank screen
                freezeOnBlur: false,
                // Ensure a solid background during transitions
                contentStyle: { backgroundColor: '#fff' },
                gestureEnabled: true,
                animationTypeForReplace: 'push',
              }}
            >
              <Stack.Screen name="splash" options={{ headerShown: false }} />
              <Stack.Screen
                name="language"
                options={{
                  header: () => <CustomHeader />,
                  headerStyle: {
                    backgroundColor: '#fcfcff',
                  },
                }}
              />
              {/* Keep previous screen attached to avoid blank screen when swiping back from article */}
              <Stack.Screen
                name="article/[id]"
                options={({ navigation }) => ({
                  headerShown: true,
                  headerTitle: 'Article',
                  headerTitleStyle: { fontWeight: '600' },
                  headerStyle: { backgroundColor: '#fff' },
                  freezeOnBlur: false,
                  animation: 'slide_from_right',
                  contentStyle: { backgroundColor: '#fff' },
                  gestureEnabled: true,
                  // Custom back behavior
                  headerLeft: () => (
                    <TouchableOpacity
                      onPress={() => {
                        // Navigate back safely - first try going back, fallback to news tab
                        if (navigation.canGoBack()) {
                          navigation.goBack();
                        } else {
                          navigation.navigate('(tabs)', { screen: 'news' });
                        }
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ marginLeft: 16 }}
                    >
                      <Feather name="arrow-left" size={24} color="#007AFF" />
                    </TouchableOpacity>
                  ),
                })}
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
            <StatusBar style="auto" />
            <Toast />
          </ThemeProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#fcfcff',
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
