import Constants from 'expo-constants';
// Fallbacks: allow runtime env and google-services.json when expo.extra is incomplete
// Import is wrapped in try/catch to avoid bundling issues in web/unsupported platforms
let GOOGLE_SERVICES: any = null;
try {
  // Preferred path (root google-services.json referenced by app.json if present)
  GOOGLE_SERVICES = require('../google-services.json');
} catch {
  try {
    // Fallback to Android native location if root copy not present
    GOOGLE_SERVICES = require('../android/app/google-services.json');
  } catch {}
}

export type FirebaseConfig = {
  webApiKey: string;
  projectId: string;
  appId?: string;
  messagingSenderId?: string;
  storageBucket?: string;
  googleAndroidClientId?: string;
  googleIosClientId?: string;
  googleWebClientId?: string;
};

const extra = (Constants.expoConfig?.extra || {}) as any;
const firebaseCfg = extra.firebase || {};
const googleCfg = extra.google || {};

// Environment fallbacks
const envFirebase = {
  webApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

// Environment fallbacks for Google OAuth client IDs (lets us fix mismatches without native rebuilds)
const envGoogle = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

// google-services.json fallbacks (Android)
const gsProjectId = GOOGLE_SERVICES?.project_info?.project_id;
const gsAppId = GOOGLE_SERVICES?.client?.[0]?.client_info?.mobilesdk_app_id;
const gsApiKey = GOOGLE_SERVICES?.client?.[0]?.api_key?.[0]?.current_key;
const gsSenderId = GOOGLE_SERVICES?.project_info?.project_number;
const gsBucket = GOOGLE_SERVICES?.project_info?.storage_bucket;

// Attempt to derive OAuth client IDs from google-services.json so we are not forced to hardcode them
// This lets us simply download a refreshed file after creating the Android OAuth client.
let gsAndroidOAuth: string | undefined;
let gsWebOAuth: string | undefined;
let gsAndroidCertHash: string | undefined;
try {
  const oauthClients: any[] = GOOGLE_SERVICES?.client?.[0]?.oauth_client || [];
  gsAndroidOAuth = oauthClients.find(c => c?.client_type === 1)?.client_id;
  // Web client (client_type 3) can appear in two places; prefer top-level then other_platform_oauth_client
  gsWebOAuth = oauthClients.find(c => c?.client_type === 3)?.client_id
    || GOOGLE_SERVICES?.client?.[0]?.services?.appinvite_service?.other_platform_oauth_client?.find?.((c: any) => c?.client_type === 3)?.client_id;
  try {
    gsAndroidCertHash = oauthClients.find(c => c?.client_type === 1)?.android_info?.certificate_hash;
  } catch {}
} catch {}

// Sanitize / normalize Google OAuth client IDs
const rawWebId = googleCfg.webClientId || envGoogle.webClientId || gsWebOAuth;
let rawAndroidId = googleCfg.androidClientId || envGoogle.androidClientId || gsAndroidOAuth;

// Treat placeholders or obviously wrong values as undefined so we can fall back.
const PLACEHOLDER_ANDROID_VALUES = [
  '__AUTO_FROM_GOOGLE_SERVICES_JSON__',
  'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
];
if (rawAndroidId) {
  const sameAsWeb = rawWebId && rawAndroidId === rawWebId; // accidentally set to web client
  const placeholder = PLACEHOLDER_ANDROID_VALUES.includes(rawAndroidId);
  const genericPattern = /YOUR_/i.test(rawAndroidId);
  if (sameAsWeb || placeholder || genericPattern) {
    rawAndroidId = gsAndroidOAuth; // final fallback to parsed file (may be undefined)
  }
}

export const FIREBASE_CONFIG: FirebaseConfig = {
  webApiKey: firebaseCfg.webApiKey || envFirebase.webApiKey || gsApiKey || '',
  projectId: firebaseCfg.projectId || envFirebase.projectId || gsProjectId || '',
  appId: firebaseCfg.appId || envFirebase.appId || gsAppId,
  messagingSenderId: firebaseCfg.messagingSenderId || envFirebase.messagingSenderId || gsSenderId,
  storageBucket: firebaseCfg.storageBucket || envFirebase.storageBucket || gsBucket,
  googleAndroidClientId: rawAndroidId,
  googleIosClientId: googleCfg.iosClientId,
  googleWebClientId: rawWebId,
};

// Export diagnostic helper
export const ANDROID_OAUTH_CERT_HASH = gsAndroidCertHash;
