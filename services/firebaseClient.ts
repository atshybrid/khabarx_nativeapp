import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import * as AuthNS from 'firebase/auth';
import { browserLocalPersistence, initializeAuth } from 'firebase/auth';
import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from '../config/firebase';

/** Basic config completeness check (apiKey + project + appId). */
export function isFirebaseConfigComplete() {
  return !!(FIREBASE_CONFIG?.webApiKey && FIREBASE_CONFIG?.projectId && FIREBASE_CONFIG?.appId);
}

/** Singleton app accessor. */
export function getFirebaseApp() {
  if (!isFirebaseConfigComplete()) throw new Error('Firebase config incomplete');
  if (!getApps().length) {
    initializeApp({
      apiKey: FIREBASE_CONFIG.webApiKey,
      projectId: FIREBASE_CONFIG.projectId,
      appId: FIREBASE_CONFIG.appId,
      storageBucket: FIREBASE_CONFIG.storageBucket,
      messagingSenderId: FIREBASE_CONFIG.messagingSenderId,
    });
  }
  return getApps()[0];
}

let authSingleton: import('firebase/auth').Auth | null = null;
let authInitPromise: Promise<import('firebase/auth').Auth> | null = null;

export function ensureFirebaseAuthAsync(): Promise<import('firebase/auth').Auth> {
  if (authSingleton) return Promise.resolve(authSingleton);
  if (authInitPromise) return authInitPromise;
  authInitPromise = (async () => {
    if (!isFirebaseConfigComplete()) throw new Error('Firebase config incomplete');
    const app = getFirebaseApp();
    // Platform-specific persistence selection. On web, getReactNativePersistence does not exist.
    let persistence: any;
    if (Platform.OS === 'web') {
      // Prefer durable local persistence; fall back to session if local unavailable (older browsers / SSR)
      persistence = browserLocalPersistence;
    } else {
      const getPersist = (AuthNS as any)?.getReactNativePersistence;
      if (typeof getPersist === 'function') {
        try {
          persistence = getPersist(AsyncStorage);
        } catch (e) {
          console.warn('[AUTH_INIT] getReactNativePersistence failed, falling back to in-memory', (e as any)?.message);
        }
      }
      // If persistence could not be created, let Firebase use in-memory persistence on native
    }
    const auth = initializeAuth(app, persistence ? { persistence } : {});
    authSingleton = auth;
    console.log('[AUTH_INIT] initializeAuth (async) success', { appId: app.options.appId });
    return auth;
  })();
  return authInitPromise;
}

// Google Sign-In flow no longer performs a Firebase credential exchange. The backend will
// validate the raw Google ID token directly. We retain Firebase initialization only in case
// other features (e.g., messaging, storage) are added later.

export function logFirebaseGoogleAlignment(debug?: boolean) {
  try {
    const sender = FIREBASE_CONFIG.messagingSenderId || '';
    const web = FIREBASE_CONFIG.googleWebClientId || '';
    const android = FIREBASE_CONFIG.googleAndroidClientId || '';
    const pick = (id: string) => (id ? id.split('-')[0] : '');
    const webPrefix = pick(web);
    const androidPrefix = pick(android);
    const okWeb = !!webPrefix && webPrefix === sender;
    const okAndroid = !android || androidPrefix === sender;
    const status = { sender, webPrefix, androidPrefix, okWeb, okAndroid, hasAndroid: !!android };
    if (okWeb && okAndroid) console.log('[AUTH_CHECK] Alignment OK', status); else console.warn('[AUTH_CHECK] Alignment issue', status);
    if (debug) console.log('[AUTH_CHECK] Raw IDs', { web, android });
  } catch (e:any) {
    console.warn('[AUTH_CHECK] failed', e?.message);
  }
}

// Note: Avoid eager init at module load to prevent timing issues where the
// Auth component may not be registered yet on some RN versions. Initialization
// is triggered from app/_layout.tsx after the app is mounted.
