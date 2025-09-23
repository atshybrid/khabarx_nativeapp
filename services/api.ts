
import { LANGUAGES, Language } from '@/constants/languages';
// Session semantics simplified: no more automatic guest bootstrap. Reading news is anonymous.
// Authenticated actions require a real jwt issued via MPIN / registration flows.
import { Article } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { loadTokens } from './auth';
import { HttpError, getBaseUrl, request } from './http';

// ---- Mock Mode (ON/OFF) ----
// Env override: EXPO_PUBLIC_FORCE_MOCK=true|1|on
const FORCE_MOCK = (() => {
  const raw = String(process.env.EXPO_PUBLIC_FORCE_MOCK ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
const MOCK_MODE_KEY = 'force_mock_mode';
let mockModeCache: boolean | null = null;

export async function getMockMode(): Promise<boolean> {
  if (mockModeCache !== null) return mockModeCache || FORCE_MOCK;
  const v = await AsyncStorage.getItem(MOCK_MODE_KEY);
  mockModeCache = v === '1' || v === 'true' || v === 'on';
  return mockModeCache || FORCE_MOCK;
}

export async function setMockMode(enabled: boolean) {
  mockModeCache = enabled;
  await AsyncStorage.setItem(MOCK_MODE_KEY, enabled ? '1' : '0');
}

// API debug flag (mirrors EXPO_PUBLIC_HTTP_DEBUG)
const DEBUG_API = (() => {
  const raw = String(process.env.EXPO_PUBLIC_HTTP_DEBUG ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();

// -------- User Profile (Google auth enrichment) --------
export interface UserProfileUpdateInput {
  fullName?: string;
  gender?: string;
  dob?: string; // ISO date (YYYY-MM-DD)
  maritalStatus?: string;
  bio?: string;
  profilePhotoUrl?: string;
  profilePhotoMediaId?: string;
  emergencyContactNumber?: string;
  address?: Record<string, any> | null;
  stateId?: string;
  districtId?: string;
  assemblyId?: string;
  mandalId?: string;
  villageId?: string;
  occupation?: string;
  education?: string;
  socialLinks?: Record<string, any> | null;
}
export interface UserProfileResponse extends UserProfileUpdateInput {
  id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function updateUserProfile(partial: UserProfileUpdateInput): Promise<UserProfileResponse> {
  // Merge with existing server state: fetch current, shallow merge, send PUT/PATCH.
  // Assume backend supports PATCH; fallback to PUT if 405.
  const endpoint = '/profiles/me';
  try {
    const existing = await request<UserProfileResponse>(endpoint, { method: 'GET' });
    const merged = { ...existing, ...partial };
    try {
      return await request<UserProfileResponse>(endpoint, { method: 'PATCH', body: merged });
    } catch (e: any) {
      if (e instanceof HttpError && e.status === 405) {
        return await request<UserProfileResponse>(endpoint, { method: 'PUT', body: merged });
      }
      throw e;
    }
  } catch (e: any) {
    // If GET fails (e.g., 404 first-time profile), send provided partial directly
    try {
      return await request<UserProfileResponse>(endpoint, { method: 'POST', body: partial });
    } catch {
      throw e instanceof Error ? e : new Error('Failed to update profile');
    }
  }
}

const mockArticles: Article[] = [
  {
    id: '1',
    title: 'Breaking News: Something Happened',
    summary: 'A brief summary of the breaking news event.',
    body: 'This is the full body of the article. It contains all the details about the event that happened. It can be a long text.',
    image: 'https://picsum.photos/700',
    author: {
      id: 'author1',
      name: 'John Doe',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    },
    category: 'General',
    createdAt: new Date().toISOString(),
    isRead: false,
  },
  // ... other mock articles
];

export const getNews = async (lang: string, category?: string, cursor?: string): Promise<Article[]> => {
  try {
    // If mock mode is forced, skip network and return mock
    if (await getMockMode()) {
      return mockArticles;
    }

    // Build cache key for offline support
    const key = `news_cache:${lang}:${category || 'all'}`;
    // Correct endpoint: /shortnews with limit and optional cursor
    // Resolve languageId (required by public endpoint)
    let languageId: string | undefined;
    try {
      const t = await loadTokens();
      languageId = t?.languageId;
      if (!languageId) {
        const raw = await AsyncStorage.getItem('selectedLanguage');
        languageId = raw ? (JSON.parse(raw)?.id as string | undefined) : undefined;
      }
    } catch {}
    const params = new URLSearchParams({ limit: '10' });
    if (languageId) params.set('languageId', languageId);
  if (cursor) params.set('cursor', cursor);
  // Do NOT pass category to backend yet; we filter client-side for stability
  const endpoint = `/shortnews/public?${params.toString()}`;
  const json = await request<{ data?: any[]; items?: any[]; success?: boolean; nextCursor?: string }>(endpoint, { timeoutMs: 30000, noAuth: true });
    if (DEBUG_API) {
      const keys = json && typeof json === 'object' ? Object.keys(json as any) : [];
      const dataArr = Array.isArray((json as any)?.data) ? (json as any).data : null;
      const itemsArr = Array.isArray((json as any)?.items) ? (json as any).items : null;
      const arr = dataArr || itemsArr;
      const sample = Array.isArray(arr) && arr.length ? arr[0] : null;
      const sJsonLd = sample?.jsonLd || sample?.jsonld || sample?.jsonLD;
      console.log('[API] /shortnews response', {
        endpoint,
        keys,
        hasDataArray: Array.isArray(dataArr),
        hasItemsArray: Array.isArray(itemsArr),
        length: Array.isArray(arr) ? arr.length : null,
        sampleKeys: sample ? Object.keys(sample) : null,
        samplePreview: sample ? {
          id: sample.id ?? sample._id,
          title: sample.title,
          category: sample.category?.name || sample.category,
          createdAt: sample.createdAt,
          media: {
            hero: sample.image || sample.thumbnail,
            jsonLdImagesLen: Array.isArray(sJsonLd?.image) ? sJsonLd.image.length : null,
            jsonLdFirst: Array.isArray(sJsonLd?.image) ? sJsonLd.image[0] : null,
            video: sJsonLd?.video?.contentUrl || sample.videoUrl || sample.video || null,
          }
        } : null,
      });
    }
    const listRaw = (json as any)?.data ?? (json as any)?.items ?? null;
    if (!Array.isArray(listRaw)) {
      // Hard fail if unexpected shape; caller decides what to do
      throw new Error('Invalid shortnews response');
    }
    const list = listRaw as any[];
    // Helper: collect URLs from mixed shapes (string | object | array)
    const collectUrls = (input: any): string[] => {
      const urls: string[] = [];
      const push = (u?: string) => {
        if (!u || typeof u !== 'string') return;
        const trimmed = u.trim();
        if (!trimmed) return;
        // basic URL sanity (http/https/data)
        if (/^(https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
          urls.push(trimmed);
        }
      };
      const fromObj = (o: any) => {
        if (!o || typeof o !== 'object') return;
        // common fields in various APIs
        push(o.url || o.src || o.source || o.imageUrl || o.original || o.secure_url || o.secureUrl || o.contentUrl);
      };
      const walk = (val: any) => {
        if (!val) return;
        if (typeof val === 'string') { push(val); return; }
        if (Array.isArray(val)) { val.forEach(walk); return; }
        if (typeof val === 'object') { fromObj(val); return; }
      };
      walk(input);
      return urls;
    };

    // Normalize to Article shape with support for jsonLd and publisher data
    const normalized: Article[] = list.map((a) => {
      let jsonLd: any = (a as any)?.jsonLd || (a as any)?.jsonld || (a as any)?.jsonLD || undefined;
      if (jsonLd && typeof jsonLd === 'string') {
        try { jsonLd = JSON.parse(jsonLd); } catch { /* ignore parse errors */ }
      }
      // Prefer primary media fields from backend; fallback to jsonLd.image
      const primaryImage: string | undefined = a.primaryImageUrl || a.coverImageUrl || a.featuredImage || a.image || a.thumbnail || (() => {
        const arr = collectUrls(jsonLd?.image);
        return arr[0];
      })();
      const primaryVideo: string | undefined = a.primaryVideoUrl || a.videoUrl || a.video || jsonLd?.video?.contentUrl;
      // Build media list from many possible fields, de-duplicate, keep primary first
      const jsonLdImages: string[] = collectUrls(jsonLd?.image);
      const mediaUrls: string[] = collectUrls((a as any)?.mediaUrls);
      const imagesField: string[] = collectUrls((a as any)?.images);
      const galleryField: string[] = collectUrls((a as any)?.gallery);
      const photosField: string[] = collectUrls((a as any)?.photos);
      const mediaField: string[] = collectUrls((a as any)?.media);
      const mediaGalleryField: string[] = collectUrls((a as any)?.mediaGallery || (a as any)?.imageGallery);
      const imageUrlsField: string[] = collectUrls((a as any)?.imageUrls || (a as any)?.imagesUrls);
      const seen = new Set<string>();
      const allImages: string[] = [];
      const add = (u?: string) => { if (u && !seen.has(u)) { seen.add(u); allImages.push(u); } };
      add(primaryImage);
      ;[jsonLdImages, mediaUrls, imagesField, galleryField, photosField, mediaField, mediaGalleryField, imageUrlsField].forEach(arr => arr.forEach(add));
      const imagesArr: string[] | undefined = allImages.length ? allImages : undefined;
      const publisherLogo = jsonLd?.publisher?.logo?.url || (a.publisher?.logo?.url);
      const publisherName = jsonLd?.publisher?.name || a.publisher?.name;
      const firstImage = imagesArr?.[0] || 'https://picsum.photos/800/1200';
      const videoUrl: string | undefined = primaryVideo;
  // Extended author fields (backend may send either nested author.* or flat fields)
  const rawAuthor = (a as any).author || {};
  const authorFullName = (a as any).authorFullName || rawAuthor.fullName || (a as any).fullName;
  const authorProfilePhoto = (a as any).authorProfilePhotoUrl || rawAuthor.profilePhotoUrl || (a as any).profilePhotoUrl;
  const authorRoleName = (a as any).authorRoleName || rawAuthor.roleName || (a as any).roleName;
  const authorPlaceName = (a as any).authorPlaceName || rawAuthor.placeName || (a as any).placeName;
  const authorName = authorFullName || rawAuthor.name || (a as any).authorName || jsonLd?.author?.name || '';
  const authorAvatar = authorProfilePhoto || rawAuthor.avatar || (a as any).authorAvatar || publisherLogo || 'https://i.pravatar.cc/100';
      const articleObj: Article = {
        id: String(a.id ?? a._id ?? Date.now()),
        title: a.title ?? jsonLd?.headline ?? 'Untitled',
        summary: a.summary ?? a.seo?.metaDescription ?? a.seo?.description ?? '',
        body: a.content ?? a.body ?? a.seo?.description ?? '',
        image: firstImage,
        images: imagesArr,
        videoUrl,
        author: {
          id: a.authorId || rawAuthor.id,
          name: authorName || '',
          avatar: authorAvatar,
          fullName: authorFullName || authorName || '',
          profilePhotoUrl: authorProfilePhoto || authorAvatar,
          roleName: authorRoleName || null,
          placeName: authorPlaceName || null,
        } as any,
        publisherName,
        publisherLogo,
        category: a.category?.name || a.categoryName || a.category || 'General',
        createdAt: a.createdAt ?? a.publishDate ?? a.publishedAt ?? jsonLd?.datePublished ?? new Date().toISOString(),
        isRead: Boolean(a.isRead),
        likes: a.likes ?? 0,
        dislikes: a.dislikes ?? 0,
        comments: a.comments ?? 0,
        language: a.languageCode || a.inLanguage || a.language,
        tags: a.tags ?? [],
        canonicalUrl: (a as any).canonicalUrl || (a.seo?.canonical) || jsonLd?.mainEntityOfPage?.['@id'] || jsonLd?.url || undefined,
        metaTitle: (a as any).metaTitle || a.seo?.metaTitle || jsonLd?.headline || undefined,
        metaDescription: (a as any).metaDescription || a.seo?.metaDescription || jsonLd?.description || undefined,
      } as Article;
      if (DEBUG_API) {
        (articleObj as any)._mediaDebug = {
          counts: {
            total: imagesArr?.length || 0,
            jsonLd: jsonLdImages.length,
            mediaUrls: mediaUrls.length,
            imagesField: imagesField.length,
            galleryField: galleryField.length,
            photosField: photosField.length,
            mediaField: mediaField.length,
            mediaGalleryField: mediaGalleryField.length,
            imageUrlsField: imageUrlsField.length,
          }
        };
      }
      return articleObj;
    });
    if (DEBUG_API && normalized.length) {
      try {
        const sample = normalized.slice(0, 3).map((n) => (n as any)._mediaDebug?.counts || { total: n.images?.length || 0 });
        console.log('[API] extracted image counts (first 3):', sample);
      } catch {}
    }
    // Cache for offline
    try { await AsyncStorage.setItem(key, JSON.stringify(normalized)); } catch {}
    if (!normalized.length) throw new Error('Empty shortnews list');
    return normalized;
  } catch (err) {
    // Offline-first: try cached data only; do NOT fallback to mock unless mockMode is on
    try {
      const key = `news_cache:${lang}:${category || 'all'}`;
      const cached = await AsyncStorage.getItem(key);
      if (cached) return JSON.parse(cached) as Article[];
    } catch {}
    console.warn('getNews failed with no cache available', err);
    throw err;
  }
};

export const getArticleById = async (id: string): Promise<Article | undefined> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockArticles.find(article => article.id === id);
}

// Lightweight translation helper. Tries backend first; falls back to no-op.
export async function translateText(text: string, targetLangCode: string): Promise<string> {
  try {
    if (!text || !targetLangCode || text.trim().length === 0) return text;
    if (await getMockMode()) {
      // Mock mode: return original text with a simple suffix to indicate translation
      return `${text}`;
    }
    const res = await request<any>(`/translate`, {
      method: 'POST',
      body: { text, target: targetLangCode },
      timeoutMs: 15000,
      noAuth: true,
    });
    const out = (res as any)?.data?.translated || (res as any)?.translated || (res as any)?.text || (res as any)?.result;
    return typeof out === 'string' && out.length ? out : text;
  } catch {
    // Best-effort: return original text if translation service is unavailable
    return text;
  }
}

// Transliteration helper: converts Roman-encoded input to target script without changing meaning.
// Returns a strict JSON object per spec.
export type TransliterateResult = {
  detected: 'roman' | 'target' | 'other';
  result?: string;
  candidates?: string[];
  error?: 'unsupported_language' | string;
};

function langCodeToScript(code: string): 'telugu' | 'devanagari' | 'tamil' | 'kannada' | undefined {
  const c = (code || '').toLowerCase();
  if (c.startsWith('te')) return 'telugu'; // Telugu
  if (c.startsWith('hi') || c === 'mr' || c === 'ne') return 'devanagari'; // Hindi/Dev scripts use Devanagari
  if (c.startsWith('ta')) return 'tamil'; // Tamil
  if (c.startsWith('kn')) return 'kannada'; // Kannada
  return undefined;
}

function detectScript(text: string, target: 'telugu' | 'devanagari' | 'tamil' | 'kannada'): 'target' | 'roman' | 'other' {
  const hasLatin = /[A-Za-z]/.test(text);
  const ranges: Record<string, RegExp> = {
    devanagari: /[\u0900-\u097F]/,
    telugu: /[\u0C00-\u0C7F]/,
    tamil: /[\u0B80-\u0BFF]/,
    kannada: /[\u0C80-\u0CFF]/,
  };
  const r = ranges[target];
  if (r?.test(text)) return 'target';
  if (hasLatin) return 'roman';
  return 'other';
}

async function transliterateUsingSanscript(input: string, target: 'telugu' | 'devanagari' | 'tamil' | 'kannada'): Promise<string> {
  try {
    const mod: any = await import('sanscript');
    const Sanscript = mod?.default || mod;
    // Use ITRANS scheme for roman input; Sanscript handles punctuation/numbers
    const out = Sanscript.t(String(input), 'itrans', target);
    return typeof out === 'string' ? out : input;
  } catch {
    // If library not available, return original
    return input;
  }
}

export async function transliterateText(content: string, targetLangCode: string): Promise<TransliterateResult> {
  // Unsupported language
  const target = langCodeToScript(targetLangCode);
  if (!target) {
    return { detected: 'other', error: 'unsupported_language' };
  }
  // If already in target script, return unchanged
  const detected = detectScript(content, target);
  if (detected === 'target') {
    return { detected: 'target', result: content, candidates: [content] };
  }
  // Operate token-wise to preserve punctuation, URLs, emails
  // Split into tokens (words) and separators (spaces/punct)
  const parts: string[] = [];
  const regex = /(https?:\/\/\S+|\w+[\w.-]*@\w+[\w.-]*\.[A-Za-z]{2,}|`[^`]*`|```[\s\S]*?```|\*\*[^*]*\*\*|__[^_]*__|\*[^*]*\*|_[^_]*_|<[^>]+>|[A-Za-z]+|[^A-Za-z]+)/g;
  const chunks = String(content).match(regex) || [content];
  // Improvement: Avoid transliterating a Latin token immediately appended to a target-script
  // character (no whitespace/punctuation). Scenario: user uses native Telugu keyboard for
  // first glyph then continues in Latin expecting raw Latin, but previous logic would
  // transliterate every isolated Latin token, producing mixed unwanted script. We track
  // whether the previous emitted character is in the target script and only transliterate
  // Latin tokens when (a) start of string, or (b) previous emitted character is NOT in
  // target script, or (c) previous token ended with whitespace/punctuation.
  const scriptRanges: Record<string, RegExp> = {
    devanagari: /[\u0900-\u097F]/,
    telugu: /[\u0C00-\u0C7F]/,
    tamil: /[\u0B80-\u0BFF]/,
    kannada: /[\u0C80-\u0CFF]/,
  };
  const targetRange = scriptRanges[target];
  let lastChar = '';
  for (const ch of chunks) {
    const isLatinWord = /^[A-Za-z]+$/.test(ch);
    const isSkippable = /^(https?:\/\/|\w+[\w.-]*@|`|\*|_|<|```)/.test(ch) || (/[^A-Za-z]/.test(ch) && !isLatinWord);
    if (isSkippable) {
      parts.push(ch);
      lastChar = ch.slice(-1) || lastChar;
      continue;
    }
    if (isLatinWord) {
      const prevIsTarget = targetRange?.test(lastChar || '') || false;
      const prevIsBoundary = /[\s\n\r\t.,;:!?()\[\]{}'"-]/.test(lastChar || '') || !lastChar;
      if (!prevIsTarget || prevIsBoundary) {
        const out = await transliterateUsingSanscript(ch, target);
        parts.push(out);
        lastChar = out.slice(-1) || lastChar;
        continue;
      } else {
        // Append raw Latin because user is intentionally mixing after script char
        parts.push(ch);
        lastChar = ch.slice(-1) || lastChar;
        continue;
      }
    }
    // Fallback (should not normally reach for latin words)
    parts.push(ch);
    lastChar = ch.slice(-1) || lastChar;
  }
  const result = parts.join('');
  return { detected: detected === 'roman' ? 'roman' : 'other', result, candidates: [result] };
}

// ---------------- Reactions (Like / Dislike) ----------------
// Backend contract:
// GET /reactions/shortnews/:id -> { success, data: { contentType, contentId, reaction, counts: { likes, dislikes } } }
// PUT /reactions  body: { articleId, reaction } reaction in [ 'LIKE','DISLIKE','NONE' ]
// NOTE: For removal we send reaction:'NONE'. We expose small helpers plus a toggle.
export interface ReactionGetResponse {
  success?: boolean;
  data: {
    contentType: string;
    contentId: string;
    reaction: 'LIKE' | 'DISLIKE' | 'NONE';
    counts: { likes: number; dislikes: number };
  };
}


export async function getArticleReaction(articleId: string): Promise<ReactionGetResponse['data']> {
  const json = await request<ReactionGetResponse>(`/reactions/shortnews/${articleId}`, { method: 'GET' });
  return (json as any).data;
}

export async function updateArticleReaction(articleId: string, reaction: 'LIKE' | 'DISLIKE' | 'NONE'): Promise<ReactionGetResponse['data']> {
  const json = await request<ReactionGetResponse>(`/reactions`, { method: 'PUT', body: { articleId, reaction } });
  return (json as any).data;
}

// Convenience: given current reaction + desired (LIKE/DISLIKE) returns new reaction respecting toggle-to-none.
export function computeNextReaction(current: 'LIKE' | 'DISLIKE' | 'NONE', wanted: 'LIKE' | 'DISLIKE'): 'LIKE' | 'DISLIKE' | 'NONE' {
  if (current === wanted) return 'NONE';
  return wanted;
}

// Languages API with caching (prefer live, flexible shapes)
const LANG_CACHE_KEY = 'cached_languages';
function pickColor(code: string): string {
  const palette = ['#e74c3c','#f1c40f','#3498db','#2ecc71','#9b59b6','#e67e22','#1abc9c','#34495e','#27ae60','#d35400','#c0392b','#8e44ad','#2c3e50','#2980b9','#f39c12','#16a085','#7f8c8d','#bdc3c7'];
  let h = 0; for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
function normalizeLanguage(x: any): Language {
  const code = x?.code || x?.lang || x?.iso || x?.isoCode || 'en';
  return {
    id: String(x?.id || x?._id || x?.value || x?.key || code),
    name: x?.name || x?.englishName || x?.displayName || code.toUpperCase(),
    nativeName: x?.nativeName || x?.localName || x?.name || x?.englishName || code.toUpperCase(),
    code,
    color: x?.color || pickColor(String(code)),
    isRtl: Boolean(x?.isRtl || x?.rtl),
  };
}

export async function getLanguages(): Promise<Language[]> {
  const cachedRaw = await AsyncStorage.getItem(LANG_CACHE_KEY);
  const cached: Language[] | null = cachedRaw ? (() => { try { return JSON.parse(cachedRaw) as Language[]; } catch { return null; } })() : null;

  // Mock mode short-circuit
  if (await getMockMode()) {
    if (!cached) await AsyncStorage.setItem(LANG_CACHE_KEY, JSON.stringify(LANGUAGES));
    return cached || LANGUAGES;
  }

  // Prefer live fetch; fall back to cache; then constants
  try {
    const res = await request<any>('/languages');
    // Accept multiple shapes
    const arr = Array.isArray(res) ? res
      : Array.isArray(res?.data) ? res.data
      : Array.isArray(res?.items) ? res.items
      : Array.isArray(res?.languages) ? res.languages
      : Array.isArray(res?.data?.items) ? res.data.items
      : Array.isArray(res?.data?.languages) ? res.data.languages
      : null;
    if (!arr) throw new Error('Invalid languages response');
    const list = (arr as any[]).map(normalizeLanguage);
    await AsyncStorage.setItem(LANG_CACHE_KEY, JSON.stringify(list));
    return list;
  } catch {
    if (cached && Array.isArray(cached) && cached.length) return cached;
    await AsyncStorage.setItem(LANG_CACHE_KEY, JSON.stringify(LANGUAGES));
    return LANGUAGES;
  }
}

export type GuestAuthResponse = {
  jwt: string;
  refreshToken: string;
  expiresAt?: number;
  expiresIn?: number;
  user?: any;
  languageId?: string;
  raw?: any;
};

// Central user normalization to guarantee downstream fields (id, role, languageId)
export function extractUser(payload: any, fallbackLanguageId?: string): { id: string; role: string; languageId?: string; [k: string]: any } {
  let user = payload?.user || payload?.profile || null;
  if (!user) {
    const fallbackId = payload?.userId || payload?.id || payload?.uid || 'guest';
    user = { id: fallbackId };
  }
  if (!user.id) user.id = user.userId || payload?.userId || payload?.id || 'guest';
  user.role = user.role || payload?.role || 'Guest';
  user.languageId = user.languageId || payload?.languageId || payload?.langId || fallbackLanguageId;
  return user;
}

// -------------------
// Auth endpoints (MPIN / Google / Create Citizen Reporter)
// -------------------

export type MpinStatus = {
  mpinStatus: boolean;
  isRegistered: boolean;
  roleId: string | null;
  roleName: string | null;
};

export type AuthUser = {
  userId: string;
  role: string;
  languageId?: string;
};

export type AuthResponse = {
  success?: boolean;
  message?: string;
  data: {
    jwt: string;
    refreshToken: string;
    expiresIn?: number;
    expiresAt?: number;
    user?: AuthUser;
    location?: { latitude?: number; longitude?: number } | null;
  };
};

export async function getMpinStatus(mobileNumber: string): Promise<MpinStatus> {
  const res = await request<MpinStatus>(`/auth/mpin-status/${encodeURIComponent(mobileNumber)}` as any, { noAuth: true });
  return res;
}

// --- MPIN Reset Flow (request OTP -> verify OTP -> set new MPIN) ---
// Backend sample cURL provided:
// POST /api/v1/auth/request-otp  { mobileNumber }
// POST /api/v1/auth/verify-otp { id, otp }
// POST /api/v1/auth/set-mpin { id, mobileNumber, mpin }

export interface RequestOtpForMpinResetResponse {
  success: boolean;
  id: string; // correlation id for subsequent verify & set-mpin
  isRegistered?: boolean;
  notification?: { successCount: number; failureCount: number };
}
export async function requestOtpForMpinReset(mobileNumber: string): Promise<RequestOtpForMpinResetResponse> {
  return await request<RequestOtpForMpinResetResponse>(`/auth/request-otp`, { method: 'POST', body: { mobileNumber } });
}

export interface VerifyOtpForMpinResetPayload { id: string; otp: string; }
export interface VerifyOtpForMpinResetResponse { success: boolean; }
export async function verifyOtpForMpinReset(payload: VerifyOtpForMpinResetPayload): Promise<VerifyOtpForMpinResetResponse> {
  return await request<VerifyOtpForMpinResetResponse>(`/auth/verify-otp`, { method: 'POST', body: payload });
}

export interface SetNewMpinPayload { id: string; mobileNumber: string; mpin: string; }
export interface SetNewMpinResponse { success: boolean; }
export async function setNewMpin(payload: SetNewMpinPayload): Promise<SetNewMpinResponse> {
  return await request<SetNewMpinResponse>(`/auth/set-mpin`, { method: 'POST', body: payload });
}

// ---- Logout ----
export interface LogoutResponse { ok?: boolean; success?: boolean }
export async function logout(): Promise<boolean> {
  try {
    const res = await request<LogoutResponse>('/auth/logout', { method: 'POST', body: {} });
    const ok = (res as any)?.ok || (res as any)?.success;
    if (DEBUG_API) try { console.log('[API] logout', { ok }); } catch {}
    return !!ok;
  } catch (e:any) {
    if (DEBUG_API) try { console.warn('[API] logout fail', e?.message); } catch {}
    // Even if network fails we still clear locally
    return false;
  }
}

export async function loginWithMpin(payload: { mobileNumber: string; mpin: string }): Promise<AuthResponse['data']> {
  const t0 = Date.now();
  try {
    const res = await request<AuthResponse>('/auth/login', { method: 'POST', body: payload, noAuth: true });
    const dt = Date.now() - t0;
    try { console.log('[API] loginWithMpin success', { mobileMasked: payload.mobileNumber.replace(/^(\d{3})\d+(\d{2})$/, '$1***$2'), ms: dt }); } catch {}
    return res.data;
  } catch (err: any) {
    const dt = Date.now() - t0;
    try { console.warn('[API] loginWithMpin fail', { mobileMasked: payload.mobileNumber.replace(/^(\d{3})\d+(\d{2})$/, '$1***$2'), ms: dt, err: err?.message }); } catch {}
    throw err;
  }
}

export async function loginWithGoogle(payload: { 
  firebaseIdToken?: string; 
  googleIdToken?: string; 
  deviceId?: string 
}): Promise<AuthResponse['data']> {
  const t0 = Date.now();
  try {
    const res = await request<AuthResponse>('/auth/login-google', { method: 'POST', body: payload, noAuth: true });
    const dt = Date.now() - t0;
    const tokenType = payload.firebaseIdToken ? 'firebase' : 'google';
    try { console.log('[API] loginWithGoogle success', { ms: dt, tokenType }); } catch {}
    return res.data;
  } catch (err: any) {
    const dt = Date.now() - t0;
    const tokenType = payload.firebaseIdToken ? 'firebase' : 'google';
    try {
      if (err && typeof err === 'object' && 'status' in err) {
        console.warn('[API] loginWithGoogle fail', { ms: dt, tokenType, status: (err as any).status, body: (err as any).body, message: err?.message });
      } else {
        console.warn('[API] loginWithGoogle fail', { ms: dt, tokenType, err: err?.message });
      }
    } catch {}
    // Re-throw a clearer error for UI
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as any).status;
      const serverMsg = (err as any).body?.message || (err as any).message || `HTTP ${status}`;
      throw new Error(`Google login failed (${status}): ${serverMsg}`);
    }
    throw err;
  }
}

export async function createCitizenReporterMobile(payload: {
  mobileNumber: string;
  mpin: string;
  fullName: string;
  deviceId: string;
  pushToken?: string;
  languageId: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    provider?: string;
    timestampUtc?: string; // ISO
    placeId?: string | null;
    placeName?: string | null;
    address?: string | null;
    source?: string;
  };
}): Promise<AuthResponse['data']> {
  // Primary (correct) endpoint for mobile registration
  try {
    const res = await request<AuthResponse>('/auth/create-citizen-reporter/mobile', { method: 'POST', body: payload, noAuth: true });
    return res.data;
  } catch (err: any) {
    // Fallback to legacy path if server not yet updated (404 only)
    if (err && err.status === 404) {
      try { console.warn('[API] mobile citizen endpoint 404, falling back to legacy path'); } catch {}
      const legacy = await request<AuthResponse>('/auth/create-citizen-reporter', { method: 'POST', body: payload, noAuth: true });
      return legacy.data;
    }
    throw err;
  }
}

export async function createCitizenReporterGoogle(payload: {
  firebaseIdToken?: string;
  googleIdToken?: string;
  email?: string;
  languageId: string;
  pushToken?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    provider?: string;
    timestampUtc?: string; // ISO
    placeId?: string | null;
    placeName?: string | null;
    address?: string | null;
    source?: string;
  };
}): Promise<AuthResponse['data']> {
  const t0 = Date.now();
  try {
    const res = await request<AuthResponse>('/auth/create-citizen-reporter/google', { method: 'POST', body: payload, noAuth: true });
    const dt = Date.now() - t0;
    const tokenType = payload.firebaseIdToken ? 'firebase' : 'google';
    try { console.log('[API] createCitizenReporterGoogle success', { ms: dt, tokenType }); } catch {}
    return res.data;
  } catch (err: any) {
    const dt = Date.now() - t0;
    const tokenType = payload.firebaseIdToken ? 'firebase' : 'google';
    try {
      if (err && typeof err === 'object' && 'status' in err) {
        console.warn('[API] createCitizenReporterGoogle fail', { ms: dt, tokenType, status: (err as any).status, body: (err as any).body, message: err?.message });
      } else {
        console.warn('[API] createCitizenReporterGoogle fail', { ms: dt, tokenType, err: err?.message });
      }
    } catch {}
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as any).status;
      const serverMsg = (err as any).body?.message || (err as any).message || `HTTP ${status}`;
      throw new Error(`Citizen Reporter signup failed (${status}): ${serverMsg}`);
    }
    throw err;
  }
}

export const registerGuestUser = async (data: { languageId: string; deviceDetails: any; location?: { latitude: number; longitude: number }; pushToken?: string }): Promise<GuestAuthResponse> => {
  // Build a set of progressively more permissive payload variants. Many backends evolve their schema; this adaptive approach
  // lets us succeed without shipping multiple client updates.
  const languageId = String(data.languageId);
  const deviceId = data.deviceDetails?.deviceId;
  const deviceModel = data.deviceDetails?.deviceModel;
  const pushToken = data.pushToken;
  const platform = Platform.OS;
  const appVersion = (Constants.manifest2 as any)?.extra?.version || (Constants.manifest as any)?.version || Constants.expoConfig?.version || undefined;
  const buildNumber = (Constants.manifest2 as any)?.extra?.buildNumber || (Constants.expoConfig as any)?.ios?.buildNumber || (Constants.expoConfig as any)?.android?.versionCode || undefined;

  const variants: { label: string; body: any }[] = [
    {
      label: 'v1-deviceDetails',
      body: {
        languageId,
        deviceDetails: {
          deviceId,
          deviceModel,
          platform,
          appVersion,
          buildNumber,
          pushToken,
        },
        location: data.location,
      },
    },
    {
      label: 'v2-device',
      body: {
        languageId,
        device: {
          id: deviceId,
          model: deviceModel,
          platform,
          appVersion,
          buildNumber,
          pushToken,
        },
        location: data.location,
      },
    },
    {
      label: 'v3-flat',
      body: {
        languageId,
        deviceId,
        deviceModel,
        platform,
        appVersion,
        buildNumber,
        pushToken,
        location: data.location,
      },
    },
  ];

  const mock = await getMockMode();
  if (mock) {
    return { jwt: 'mock-jwt-token', refreshToken: 'mock-refresh-token', expiresAt: Date.now() + 24 * 3600 * 1000, expiresIn: 24 * 3600, languageId, user: { id: 'guest', role: 'Guest' }, raw: { mock: true } };
  }

  let lastErr: any = null;
  for (let i = 0; i < variants.length; i++) {
    const { label, body } = variants[i];
    try {
      const logBody = JSON.parse(JSON.stringify(body));
      try {
        if (logBody?.deviceDetails?.pushToken) logBody.deviceDetails.pushToken = '[redacted]';
        if (logBody?.device?.pushToken) logBody.device.pushToken = '[redacted]';
        if ('pushToken' in logBody) logBody.pushToken = logBody.pushToken ? '[redacted]' : undefined;
      } catch {}
      console.log(`Registering guest (attempt ${i + 1}/${variants.length} ${label}) → POST`, getBaseUrl() + '/auth/guest', logBody);
      const json = await request<{ success?: boolean; data?: any }>(`/auth/guest`, {
        method: 'POST',
        body,
      });
      const payload = json?.data ?? (json as any);
      const expiresIn: number | undefined = payload?.expiresInSec ?? payload?.expiresIn;
      const expiresAt = payload?.expiresAt ?? (expiresIn ? Date.now() + expiresIn * 1000 : undefined);
      const resolvedLanguageId = payload?.languageId ?? payload?.langId ?? payload?.user?.languageId ?? languageId;
      const user = extractUser(payload, resolvedLanguageId);
      if (!payload?.jwt || !payload?.refreshToken) {
        throw new Error('Guest registration response missing tokens');
      }
  // Legacy guest session flag removed
      console.log('Guest registration success', { attempt: label, jwtPresent: true, userId: user.id, role: user.role });
      return { jwt: payload.jwt, refreshToken: payload.refreshToken, expiresAt, expiresIn, languageId: resolvedLanguageId, user, raw: payload };
    } catch (err: any) {
      lastErr = err;
      const status = (err as any)?.status;
      const body = (err as any)?.body;
      const serverMsg = body?.message || body?.error || err?.message;
      console.warn('Guest registration attempt failed', { attempt: label, status, message: serverMsg });
      // Only retry on validation-ish 400 errors; otherwise break early
      if (!(status === 400 || status === 422)) break;
      // If this was the last attempt we'll surface below
    }
  }

  // All variants failed
  if (mock) {
    console.warn('All guest registration attempts failed; returning mock due to mock mode');
    return { jwt: 'mock-jwt-token', refreshToken: 'mock-refresh-token', expiresAt: Date.now() + 24 * 3600 * 1000, expiresIn: 24 * 3600, languageId, user: { id: 'guest', role: 'Guest' }, raw: { fallback: true } };
  }

  if (lastErr && typeof lastErr === 'object' && 'status' in lastErr) {
    const status = (lastErr as any).status;
    const serverBody = (lastErr as any).body;
    const serverMsg = serverBody?.message || serverBody?.error || (lastErr as any).message || `HTTP ${status}`;
    throw new Error(`Guest registration failed (${status}) after ${variants.length} attempts: ${serverMsg}`);
  }
  throw (lastErr instanceof Error ? lastErr : new Error('Guest registration failed (unknown)'));
};

// Comments API - updated to match actual backend response structure
export type CommentDTO = {
  id: string;
  userId: string;
  articleId: string | null;
  shortNewsId: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    profile: {
      fullName: string;
      profilePhotoUrl: string | null;
    };
  };
  replies: CommentDTO[];
};

const COMMENTS_KEY = 'LOCAL_COMMENTS_STORE';

// getBaseUrl provided by services/http

// Unified comments fetch: supports legacy article-based endpoint and new public shortNewsId query param
export async function getComments(id: string, opts?: { type?: 'article' | 'shortnews' }): Promise<CommentDTO[]> {
  const kind = opts?.type || 'shortnews';
  try {
    if (await getMockMode()) {
      const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
      const all = JSON.parse(raw);
      return (all[id] || []) as CommentDTO[];
    }
    let json: { success?: boolean; data?: CommentDTO[] } | undefined;
    if (kind === 'shortnews') {
      // Public API: /comments?shortNewsId=ID
      json = await request<{ success?: boolean; data: CommentDTO[] }>(`/comments?shortNewsId=${encodeURIComponent(id)}`);
    } else {
      json = await request<{ success?: boolean; data: CommentDTO[] }>(`/comments/article/${encodeURIComponent(id)}`);
    }
    return (json?.data || []) as CommentDTO[];
  } catch {
    const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
    const all = JSON.parse(raw);
    return (all[id] || []) as CommentDTO[];
  }
}

// Post comment with proper payload structure matching backend expectations
export async function postComment(shortNewsId: string, content: string, userId: string, parentId?: string): Promise<CommentDTO> {
  try {
    if (await getMockMode()) throw new Error('mock-mode');
    const body = {
      content,
      userId,
      articleId: null,
      shortNewsId,
      parentId: parentId || null,
    };
    
    // Debug logging to show the exact payload being sent
    console.log('[API] POST /comments payload:', JSON.stringify(body, null, 2));
    console.log('[API] Request details:', {
      endpoint: '/comments',
      method: 'POST',
      shortNewsId,
      content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      userId,
      parentId: parentId || 'null (direct comment)'
    });
    
    const json = await request<{ success?: boolean; data: CommentDTO }>(`/comments`, { method: 'POST', body });
    
    // Debug logging to show the response
    console.log('[API] POST /comments response:', JSON.stringify(json, null, 2));
    
    return json.data as CommentDTO;
  } catch {
    // Create mock response for local fallback
    const mockResponse: CommentDTO = {
      id: `mock_${Date.now()}`,
      userId,
      articleId: null,
      shortNewsId,
      content,
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        id: userId,
        profile: {
          fullName: 'Mock User',
          profilePhotoUrl: 'https://i.pravatar.cc/100',
        },
      },
      replies: [],
    };
    return mockResponse;
  }
}

// -------- Categories API --------
export type CategoryItem = {
  id: string;
  name: string;
  slug?: string;
  iconUrl?: string | null;
  children?: CategoryItem[];
};

const CATEGORIES_CACHE_KEY = (langId: string) => `categories_cache:${langId}`;

async function resolveLanguageId(): Promise<string | undefined> {
  try {
    const t = await loadTokens();
    if (t?.languageId) return t.languageId;
  } catch {}
  try {
    const raw = await AsyncStorage.getItem('selectedLanguage');
    return raw ? (JSON.parse(raw)?.id as string | undefined) : undefined;
  } catch {}
  return undefined;
}

export async function getCategories(languageId?: string): Promise<CategoryItem[]> {
  const langId = languageId || (await resolveLanguageId());
  const safeLangId = langId || 'en';
  const cacheKey = CATEGORIES_CACHE_KEY(safeLangId);
  const cachedRaw = await AsyncStorage.getItem(cacheKey);
  const cached: CategoryItem[] | null = cachedRaw ? (() => { try { return JSON.parse(cachedRaw) as CategoryItem[]; } catch { return null; } })() : null;

  if (await getMockMode()) {
    return cached || [];
  }

  try {
  const params = new URLSearchParams({ languageId: safeLangId });
  const res = await request<any>(`/categories?${params.toString()}`, { noAuth: true });
    const arr = Array.isArray(res)
      ? res
      : Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.categories)
      ? res.categories
      : Array.isArray(res?.data?.items)
      ? res.data.items
      : Array.isArray(res?.data?.categories)
      ? res.data.categories
      : null;
    if (!arr) throw new Error('Invalid categories response');
    const list: CategoryItem[] = (arr as any[]).map((x) => ({
      id: String(x?.id || x?._id || x?.value || x?.key || x?.slug || x?.name),
      name: String(x?.name || x?.title || x?.label || x?.slug || 'Category'),
      slug: x?.slug,
      iconUrl: x?.iconUrl || x?.icon || x?.iconURL || x?.imageUrl || null,
      children: Array.isArray(x?.children)
        ? (x.children as any[]).map((c) => ({
            id: String(c?.id || c?._id || c?.value || c?.key || c?.slug || c?.name),
            name: String(c?.name || c?.title || c?.label || c?.slug || 'Category'),
            slug: c?.slug,
            iconUrl: c?.iconUrl || c?.icon || c?.iconURL || c?.imageUrl || null,
          }))
        : [],
    }));
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
    return list;
  } catch (err) {
    if (cached && Array.isArray(cached)) return cached;
    console.warn('getCategories failed', err);
    return [];
  }
}

// Auth APIs
export type CheckUserResponse = { exists: boolean };
export async function checkUserByMobile(mobile: string): Promise<CheckUserResponse> {
  try {
    return await request<CheckUserResponse>(`/auth/check?mobile=${encodeURIComponent(mobile)}`);
  } catch {
    // Mock: treat numbers ending with even digit as registered
    const last = mobile.trim().slice(-1);
    return { exists: !!last && Number(last) % 2 === 0 };
  }
}

export type LoginResponse = { token: string; role?: string; name?: string };
export async function loginWithMPIN(mobile: string, mpin: string): Promise<LoginResponse> {
  try {
    return await request<LoginResponse>(`/auth/login-mpin`, {
      method: 'POST',
      body: { mobile, mpin },
    });
  } catch {
    // Mock success if mpin === '1234'
    if (mpin === '1234') return { token: 'mock-jwt', role: 'Member', name: 'User' };
    throw new Error('Invalid MPIN');
  }
}

export type RegisterPayload = {
  name: string;
  mobile: string;
  state: string;
  district?: string;
  mandal?: string;
  village?: string;
};
export type RegisterResponse = { ok: boolean; id?: string };
export async function registerUser(data: RegisterPayload): Promise<RegisterResponse> {
  try {
    return await request<RegisterResponse>(`/auth/register`, { method: 'POST', body: data });
  } catch {
    // Mock accept any with state provided
    if (data.state) return { ok: true, id: `${Date.now()}` };
    return { ok: false };
  }
}

// OTP APIs (start/verify) and Guest Upgrade
export type OtpStartPayload = {
  mobile: string;
  purpose: 'link_mobile' | 'login' | 'reset_mpin';
  delivery?: 'sms' | 'whatsapp' | 'push';
  deviceId?: string;
  pushToken?: string; // required if delivery==='push'
};
export type OtpStartResponse = { ok: boolean; nonce: string; ttlSec: number; channel?: 'sms' | 'whatsapp' | 'push' };
export async function startOtp(payload: OtpStartPayload): Promise<OtpStartResponse> {
  try {
    return await request<OtpStartResponse>(`/auth/otp/start`, { method: 'POST', body: payload });
  } catch {
    // Mock: return a fake nonce and 2-minute TTL
    return { ok: true, nonce: `nonce_${Date.now()}`, ttlSec: 120, channel: payload.delivery || 'sms' };
  }
}

export type OtpVerifyPayload = { mobile: string; code: string; purpose: string; nonce: string };
export type OtpVerifyResponse = { ok: boolean; otpToken: string };
export async function verifyOtp(payload: OtpVerifyPayload): Promise<OtpVerifyResponse> {
  try {
    return await request<OtpVerifyResponse>(`/auth/otp/verify`, { method: 'POST', body: payload });
  } catch {
    // Mock: accept code 123456
    if (payload.code === '123456') return { ok: true, otpToken: 'mock-otp-verify-token' };
    throw new Error('Invalid OTP');
  }
}

export type UpgradeGuestPayload = {
  name: string;
  mobile: string;
  state: string;
  district?: string;
  mandal?: string;
  village?: string;
  location?: { lat: number; lng: number; name?: string };
  mpin?: string;
  otpToken: string; // from verifyOtp
};
export type UpgradeGuestResponse = { token: string; refreshToken: string; user: { id: string; role: string; name?: string; mobile?: string } };
export async function upgradeGuest(payload: UpgradeGuestPayload): Promise<UpgradeGuestResponse> {
  try {
    return await request<UpgradeGuestResponse>(`/auth/upgrade`, { method: 'POST', body: payload });
  } catch {
    // Mock: upgrade to member and return new tokens
    return {
      token: 'mock-jwt-member',
      refreshToken: 'mock-refresh-member',
      user: { id: 'user_guest_123', role: 'Member', name: payload.name, mobile: payload.mobile },
    };
  }
}

// ---------- Media Upload + Post Create ----------
export type UploadedMedia = { id: string; url: string; type: 'image' | 'video' };
function guessMime(uri: string | undefined | null, kind: 'image' | 'video'): string {
  if (!uri || typeof uri !== 'string') {
    return kind === 'video' ? 'video/mp4' : 'image/jpeg';
  }
  const lower = uri.toLowerCase();
  if (kind === 'video') {
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  }
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function uploadMedia(file: { uri: string | undefined | null; type: 'image' | 'video'; name?: string; folder?: string }): Promise<UploadedMedia> {
  if (!file?.uri) {
    throw new Error('uploadMedia: missing file.uri');
  }
  // Upload cache to avoid re-uploading same local URI
  const CACHE_KEY = 'uploaded_media_cache_v1';
  async function getFromCache(uri: string): Promise<UploadedMedia | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const map = JSON.parse(raw) as Record<string, UploadedMedia & { ts?: number }>;
      const v = map[uri];
      return v ? { id: v.id, url: v.url, type: v.type } : null;
    } catch { return null; }
  }
  async function setInCache(uri: string, value: UploadedMedia) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, any>) : {};
      map[uri] = { ...value, ts: Date.now() };
      const entries = Object.entries(map);
      if (entries.length > 200) {
        entries.sort((a, b) => (a[1]?.ts || 0) - (b[1]?.ts || 0));
        const pruned = Object.fromEntries(entries.slice(entries.length - 200));
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(pruned));
        return;
      }
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
    } catch {}
  }

  // Use cache if available and type matches
  const cached = await getFromCache(file.uri);
  if (cached && cached.type === file.type) {
    try { console.log('[uploadMedia] cache hit for', file.uri, '→', cached.url); } catch {}
    return cached;
  }

  // Mock-mode: return fake uploaded media
  if (await getMockMode()) {
  const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const placeholder = file.type === 'image' ? 'https://picsum.photos/800' : 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4';
  return { id, url: file.uri || placeholder, type: file.type };
  }

  // Prepare common data
  const inferredName = (() => {
    try {
      const u = String(file.uri || '');
      const last = u.split(/[\\/]/).pop() || '';
      if (last && /\.[A-Za-z0-9]+$/.test(last)) return last;
    } catch {}
    return file.type === 'image' ? 'photo.jpg' : 'video.mp4';
  })();
  const name = file.name || inferredName;
  const mime = guessMime(file.uri, file.type);
  const jwt = await AsyncStorage.getItem('jwt');
  const endpoint = `${getBaseUrl()}/media/upload`;

  // Build strategies to accommodate different backend contracts
  type Strategy = { label: string; build: () => FormData };
  const strategies: Strategy[] = [
    {
      label: "file",
      build: () => {
        const form = new FormData();
        (form as any).append('file', { uri: file.uri, name, type: mime } as any);
        form.append('kind', file.type);
        form.append('filename', name);
        if (file.folder) form.append('folder', file.folder);
        return form;
      },
    },
    {
      label: "image",
      build: () => {
        const form = new FormData();
        (form as any).append('image', { uri: file.uri, name, type: mime } as any);
        form.append('type', file.type);
        form.append('filename', name);
        if (file.folder) form.append('folder', file.folder);
        return form;
      },
    },
    {
      label: "media",
      build: () => {
        const form = new FormData();
        (form as any).append('media', { uri: file.uri, name, type: mime } as any);
        form.append('type', file.type);
        form.append('filename', name);
        if (file.folder) form.append('folder', file.folder);
        return form;
      },
    },
    {
      label: "files[]",
      build: () => {
        const form = new FormData();
        (form as any).append('files[]', { uri: file.uri, name, type: mime } as any);
        form.append('type', file.type);
        form.append('filename', name);
        if (file.folder) form.append('folder', file.folder);
        return form;
      },
    },
  ];

  let lastError: { status?: number; body?: any; message?: string } | null = null;
  for (const s of strategies) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          // Do NOT set Content-Type; RN sets proper multipart boundary automatically
        } as any,
        body: s.build() as any,
      });
      const text = await res.text();
      let json: any = undefined;
      if (text) { try { json = JSON.parse(text); } catch { json = undefined; } }
      if (!res.ok) {
        // Save minimal error and try next strategy
        lastError = { status: res.status, body: json || text, message: (json as any)?.message || (json as any)?.error || String(text).slice(0, 200) };
        try { console.warn(`[uploadMedia] strategy ${s.label} failed`, res.status, typeof json === 'object' ? json : String(text).slice(0, 240)); } catch {}
        continue;
      }
  const payload = (json as any)?.data ?? json;
      const id: string = payload?.key || payload?.id || payload?._id || `${Date.now()}`;
      const url: string = payload?.publicUrl || payload?.url || payload?.secure_url || payload?.location || payload?.fileUrl || payload?.path;
      const type: 'image' | 'video' = file.type;
      if (!url) throw new Error('Upload response missing url');
  const result: UploadedMedia = { id: String(id), url, type };
  try { console.log(`[uploadMedia] strategy ${s.label} succeeded`, { url }); } catch {}
  // Cache success
  setInCache(file.uri, result);
  return result;
    } catch (e: any) {
      // Network or parse error; keep trying next strategy
      lastError = lastError || { message: e?.message || String(e) };
      try { console.warn(`[uploadMedia] strategy ${s.label} threw`, e?.message || e); } catch {}
      continue;
    }
  }
  const msg = lastError?.message || `Upload failed (${lastError?.status || 'unknown'})`;
  throw new Error(msg);
}

export type CreatePostInput = {
  title: string;
  content: string;
  languageId: string;
  category: string;
  media?: UploadedMedia[];
};
export type CreatePostResponse = { id: string; url?: string; raw?: any };
export async function createPost(input: CreatePostInput): Promise<CreatePostResponse> {
  try {
    if (await getMockMode()) {
      return { id: `post_${Date.now()}`, url: undefined, raw: { mock: true, input } };
    }
    const body: any = {
      title: input.title,
      content: input.content,
      languageId: input.languageId,
      category: input.category,
      mediaIds: input.media?.map((m) => m.id),
      media: input.media?.map((m) => ({ url: m.url, type: m.type })), // include for flexible backends
    };
    const json = await request<any>('/posts', { method: 'POST', body });
    const payload = (json as any)?.data ?? json;
    const id: string = payload?.id || payload?._id || `${Date.now()}`;
    const url: string | undefined = payload?.url || payload?.shareUrl || payload?.permalink;
    return { id: String(id), url, raw: payload };
  } catch (err) {
    // If backend not ready, but mock is enabled, return a fake ID
    if (await getMockMode()) {
      return { id: `post_${Date.now()}`, url: undefined, raw: { fallback: true, input } };
    }
    throw err instanceof Error ? err : new Error('Failed to create post');
  }
}

// ---------- ShortNews Create (Citizen Reporter) ----------
export type CreateShortNewsInput = {
  title: string; // max 35 chars
  content: string; // max 60 words
  categoryId: string;
  languageId: string;
  mediaUrls?: string[]; // uploaded URLs
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    provider?: string | null;
    timestampUtc?: string | number | null; // ISO string or epoch ms
    placeId?: string | null;
    placeName?: string | null;
    address?: string | null;
    source?: 'gps' | 'network' | 'fused' | 'manual' | 'unknown' | string;
  };
  role?: 'CITIZEN_REPORTER';
};
export type CreateShortNewsResponse = { id: string; url?: string; raw?: any };
export async function createShortNews(input: CreateShortNewsInput): Promise<CreateShortNewsResponse> {
  const t0 = Date.now();
  try {
    if (await getMockMode()) {
      return { id: `sn_${Date.now()}`, url: undefined, raw: { mock: true, input } };
    }
    const payload: any = {
      title: input.title,
      content: input.content,
      categoryId: input.categoryId,
      languageId: input.languageId,
      mediaUrls: input.mediaUrls,
      // Provide alternative fields for flexible backends
      images: input.mediaUrls,
      imageUrls: input.mediaUrls,
      media: Array.isArray(input.mediaUrls) ? input.mediaUrls.map(u => ({ url: u, type: 'image' })) : undefined,
      category: input.categoryId,
      location: input.location,
      // Some backends expect top-level coordinates; include redundantly for compatibility
      latitude: input.location?.latitude,
      longitude: input.location?.longitude,
      lat: input.location?.latitude,
      lng: input.location?.longitude,
      accuracy: input.location?.accuracyMeters,
      role: input.role || 'CITIZEN_REPORTER',
    };
    if (DEBUG_API) {
      try {
        console.log('[API] createShortNews payload keys', Object.keys(payload));
      } catch {}
    }
    const json = await request<any>('/shortnews', { method: 'POST', body: payload });
    const data = (json as any)?.data ?? json;
    const id: string = data?.id || data?._id || `${Date.now()}`;
    const url: string | undefined = data?.url || data?.shareUrl || data?.permalink;
    const dt = Date.now() - t0;
    try { console.log('[API] createShortNews success', { id, ms: dt, mediaCount: Array.isArray(input.mediaUrls) ? input.mediaUrls.length : 0 }); } catch {}
    return { id: String(id), url, raw: data };
  } catch (err) {
    if (await getMockMode()) {
      return { id: `sn_${Date.now()}`, url: undefined, raw: { fallback: true, input } };
    }
    if (err instanceof HttpError) {
      try {
        const dt = Date.now() - t0;
        console.warn('[API] createShortNews fail', { status: err.status, ms: dt, msg: err.body?.message || err.message });
      } catch {}
      const msg = (err.body?.message) || (err.body?.error) || err.message || 'Failed to create shortnews';
      throw new Error(msg);
    }
    throw err instanceof Error ? err : new Error('Failed to create shortnews');
  }
}

// Optional: check duplicate by title in language (best-effort; backend may not support)
export async function checkDuplicateShortNews(title: string, languageId: string): Promise<boolean> {
  try {
    if (await getMockMode()) return false;
    const params = new URLSearchParams({ title, languageId });
    const res: any = await request<any>(`/shortnews/check-duplicate?${params.toString()}`);
    const ok = (res?.ok ?? res?.success) as boolean | undefined;
    const dup = (res?.duplicate ?? res?.isDuplicate ?? res?.data?.duplicate) as boolean | undefined;
    return Boolean(dup && ok !== false);
  } catch {
    // If endpoint not present, assume not duplicate
    return false;
  }
}

// Role upgrade to CITIZEN_REPORTER (flows similarly to upgradeGuest, but with role hint)
export type UpgradeRolePayload = UpgradeGuestPayload & { role?: 'CITIZEN_REPORTER' };
export async function upgradeToCitizenReporter(payload: UpgradeRolePayload): Promise<UpgradeGuestResponse> {
  try {
    // Try generic upgrade endpoint with role hint; fall back to upgradeGuest
    const res = await request<UpgradeGuestResponse>(`/auth/upgrade`, { method: 'POST', body: { ...payload, role: 'CITIZEN_REPORTER' } as any });
    return res;
  } catch {
    // As a fallback, use upgradeGuest and just treat resulting user as upgraded (backend specific)
    const res = await upgradeGuest(payload);
    // In mock path, ensure role marked as CITIZEN_REPORTER
    if (await getMockMode()) {
      return { ...res, user: { ...(res.user || {}), role: 'CITIZEN_REPORTER' } };
    }
    return res;
  }
}

// -------- MPIN Login (Citizen Reporter) --------
export type CitizenLoginResponse = {
  success?: boolean;
  message?: string;
  data?: {
    jwt: string;
    refreshToken: string;
    expiresIn?: number;
    user?: { userId?: string; id?: string; role?: string; languageId?: string };
    location?: { latitude?: number; longitude?: number };
  };
};
export async function loginCitizenReporter(mobileNumber: string, mpin: string): Promise<{
  jwt: string;
  refreshToken: string;
  expiresIn?: number;
  user?: { id?: string; role?: string; languageId?: string };
  location?: { latitude?: number; longitude?: number };
}> {
  const res = await request<CitizenLoginResponse>(`/auth/login`, {
    method: 'POST',
    body: { mobileNumber, mpin },
  });
  const payload = (res as any)?.data ?? res;
  const jwt = payload?.jwt;
  const refreshToken = payload?.refreshToken;
  if (!jwt || !refreshToken) throw new Error('Login failed: missing tokens');
  const userRaw = payload?.user || {};
  return {
    jwt,
    refreshToken,
    expiresIn: payload?.expiresIn,
    user: { id: userRaw?.userId || userRaw?.id, role: userRaw?.role, languageId: userRaw?.languageId },
    location: payload?.location,
  };
}
