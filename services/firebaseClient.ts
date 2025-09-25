import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import * as AuthNS from 'firebase/auth';
import { initializeAuth } from 'firebase/auth';
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
    // Always use official persistence helper; if it throws, surface error so we know root cause.
  const persistence = (AuthNS as any).getReactNativePersistence(AsyncStorage);
    const auth = initializeAuth(app, { persistence });
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

// Convenience eager init (safe – will no-op on failure and lazy path will retry).
// Fire an eager async init (not awaited) to warm up early; errors are logged silently.
if (isFirebaseConfigComplete()) {
  setTimeout(() => {
    ensureFirebaseAuthAsync().catch(e => console.log('[AUTH_INIT] Eager async init failed', e?.message));
  }, 0);
}
