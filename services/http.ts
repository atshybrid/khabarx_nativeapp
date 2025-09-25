import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Environment-based URL selection
const EXPLICIT_URL = process.env.EXPO_PUBLIC_API_URL; // Highest priority override
const DEV_URL = process.env.EXPO_PUBLIC_API_URL_DEV;  // Used only in dev when no explicit URL
const PROD_URL = process.env.EXPO_PUBLIC_API_URL_PROD; // Used only in prod when no explicit URL

// Helpful default for local development over LAN/USB
const devHost = (Constants.expoConfig?.hostUri ?? '').split(':')[0];
const defaultHost = devHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
const FALLBACK_DEV_URL = `http://${defaultHost}:3000`;

const isDev = __DEV__ === true;

// Resolve final base URL with sensible precedence
const BASE_URL =
  EXPLICIT_URL ||
  (isDev ? (DEV_URL || FALLBACK_DEV_URL) : (PROD_URL || FALLBACK_DEV_URL));

export function getBaseUrl() {
  return BASE_URL;
}

// Debug controls
const DEBUG_HTTP = (() => {
  const raw = String(process.env.EXPO_PUBLIC_HTTP_DEBUG ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
const TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_HTTP_TIMEOUT_MS || '30000');
if (DEBUG_HTTP) {
  console.log('[HTTP] BASE_URL =', BASE_URL, '| DEV =', isDev);
}

export class HttpError extends Error {
  status: number;
  body?: any;
  constructor(status: number, body?: any, message?: string) {
    super(message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Simple error event emitter for toasts or global logging
type ErrorListener = (error: Error | HttpError, context: { path: string; method: HttpMethod }) => void;
const listeners = new Set<ErrorListener>();
export function onHttpError(listener: ErrorListener) { listeners.add(listener); return () => listeners.delete(listener); }
function emitError(err: Error | HttpError, context: { path: string; method: HttpMethod }) { listeners.forEach(l => l(err, context)); }

async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Request timed out')), ms);
    p.then((v) => { clearTimeout(id); resolve(v); })
     .catch((e) => { clearTimeout(id); reject(e); });
  });
}

// Keys must match services/auth.ts
const JWT_KEY = 'jwt';
const REFRESH_KEY = 'refreshToken';
const EXPIRES_AT_KEY = 'jwtExpiresAt';

function isAuthError(err: any): boolean {
  if (!(err instanceof HttpError)) return false;
  const s = err.status;
  const msg = String(err.body?.message || '').toLowerCase();
  return s === 401 || s === 403 || (s === 400 && (msg.includes('unauthor') || msg.includes('expired') || msg.includes('token')));
}

async function tryRefreshJwt(): Promise<string> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error('No refresh token');
  const res = await withTimeout(fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }));
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new HttpError(res.status, json, json?.message || `HTTP ${res.status}`);
  const payload = json?.data ?? json;
  const token: string = payload?.jwt || payload?.token;
  const newRefresh: string = payload?.refreshToken || refreshToken;
  const expiresAt: number | undefined = payload?.expiresAt
    ?? (payload?.expiresInSec ? Date.now() + payload.expiresInSec * 1000 : undefined)
    ?? (payload?.expiresIn ? Date.now() + payload.expiresIn * 1000 : undefined);
  if (!token) throw new Error('Missing token in refresh response');
  await AsyncStorage.multiSet([
    [JWT_KEY, token],
    [REFRESH_KEY, newRefresh],
    [EXPIRES_AT_KEY, expiresAt ? String(expiresAt) : ''],
  ]);
  return token;
}

async function clearStoredTokens() {
  await AsyncStorage.multiRemove([JWT_KEY, REFRESH_KEY, EXPIRES_AT_KEY]);
}

export async function request<T = any>(path: string, options: { method?: HttpMethod; body?: any; headers?: Record<string, string>; timeoutMs?: number; noAuth?: boolean; retry?: boolean | number } = {}): Promise<T> {
  const method: HttpMethod = options.method || 'GET';
  const jwt = options.noAuth ? null : await AsyncStorage.getItem(JWT_KEY);
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };

  const doOnce = async (): Promise<T> => {
    const url = `${BASE_URL}${path}`;
    const started = Date.now();
    if (DEBUG_HTTP) {
      console.log('[HTTP] →', method, url);
    }
    const res = await withTimeout(fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }), options.timeoutMs ?? TIMEOUT_MS);
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    let data: any = undefined;
    if (text) {
      const looksJson = ct.includes('application/json') || /^[\[{]/.test(text.trim());
      if (looksJson) {
        try { data = JSON.parse(text); }
        catch (e) {
          if (DEBUG_HTTP) console.warn('[HTTP] JSON parse failed', (e as Error)?.message || e);
          // keep raw text when parse fails
          data = text;
        }
      } else {
        data = text; // preserve non-JSON bodies (e.g., HTML error pages)
      }
    }
    if (DEBUG_HTTP) {
      const elapsed = Date.now() - started;
      const preview = typeof data === 'string' ? String(data).slice(0, 160).replace(/\n/g, ' ') : undefined;
      console.log('[HTTP] ←', method, url, res.status, `${elapsed}ms`, ct || '(no-ct)', preview ? `| body: ${preview}` : '');
    }
    if (!res.ok) {
      const message = typeof data === 'string' ? data.slice(0, 200) : (data?.message || `HTTP ${res.status}`);
      throw new HttpError(res.status, data, message);
    }
    // Ensure we return parsed JSON; if body isn't JSON, error out so callers can handle explicitly
    if (typeof data === 'string') {
      throw new Error('Expected JSON response but received text');
    }
    return (data as T);
  };

  // Retry policy: retry up to 2 times on network errors or 5xx
  let maxRetries: number;
  if (typeof options.retry === 'number') {
    maxRetries = options.retry;
  } else if (options.retry === false) {
    maxRetries = 0;
  } else {
    maxRetries = 2; // default
  }
  let attempt = 0;
  let attemptedRefresh = false;
  while (true) {
    try {
      const result = await doOnce();
      return result;
    } catch (err: any) {
      const isHttp = err instanceof HttpError;
      const status = isHttp ? err.status : 0;
      // Handle auth errors by attempting a token refresh once per request
      if (!attemptedRefresh && isAuthError(err) && !path.startsWith('/auth/refresh')) {
        try {
          const newJwt = await tryRefreshJwt();
          headers.Authorization = `Bearer ${newJwt}`;
          attemptedRefresh = true;
          // retry immediately with refreshed token
          continue;
        } catch {
          // Refresh failed: clear tokens and navigate to language
          await clearStoredTokens();
          try { router.replace('/language'); } catch {}
          emitError(err, { path, method });
          throw err;
        }
      }

      const transient = !isHttp || (status >= 500 && status < 600);
      if (DEBUG_HTTP) {
        console.log('[HTTP] attempt fail', { path, method, attempt, maxRetries, transient, status });
      }
      if (attempt < maxRetries && transient) {
        const backoff = 300 * Math.pow(2, attempt) + Math.random() * 200;
        await new Promise(r => setTimeout(r, backoff));
        attempt++;
        continue;
      }
      emitError(err, { path, method });
      throw err;
    }
  }
}
