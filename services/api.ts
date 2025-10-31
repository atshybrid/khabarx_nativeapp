
import { LANGUAGES, Language } from '@/constants/languages';
// Session semantics simplified: no more automatic guest bootstrap. Reading news is anonymous.
// Authenticated actions require a real jwt issued via MPIN / registration flows.
import { AdItem, Article, FeedItem } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { loadTokens, refreshTokens, saveTokens } from './auth';
import { getDeviceIdentity } from './device';
import { HttpError, getBaseUrl, request } from './http';

// ---- Mock Mode (ON/OFF) ----
// Env override: EXPO_PUBLIC_FORCE_MOCK=true|1|on
// Global disable: EXPO_PUBLIC_DISABLE_MOCK=true|1|on (wins over FORCE_MOCK)
const DISABLE_MOCK = (() => {
  const raw = String(process.env.EXPO_PUBLIC_DISABLE_MOCK ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
const FORCE_MOCK = (() => {
  const raw = String(process.env.EXPO_PUBLIC_FORCE_MOCK ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();
const MOCK_MODE_KEY = 'force_mock_mode';
let mockModeCache: boolean | null = null;
let mockModeReason: 'env' | 'storage' | null = null;
let disableMockWarned = false; // ensure we don't spam the console when DISABLE_MOCK is on

export async function getMockMode(): Promise<boolean> {
  if (DISABLE_MOCK) {
    if (!disableMockWarned) {
      try { console.warn('[API] Mock mode forcibly disabled via EXPO_PUBLIC_DISABLE_MOCK'); } catch {}
      disableMockWarned = true;
    }
    return false;
  }
  if (mockModeCache !== null) return mockModeCache || FORCE_MOCK;
  const v = await AsyncStorage.getItem(MOCK_MODE_KEY);
  mockModeCache = v === '1' || v === 'true' || v === 'on';
  const enabled = (mockModeCache || FORCE_MOCK) === true;
  mockModeReason = FORCE_MOCK ? 'env' : (mockModeCache ? 'storage' : null);
  if (enabled) {
    try { console.warn('[API] Mock mode enabled', { reason: mockModeReason }); } catch {}
  }
  return enabled;
}

export async function setMockMode(enabled: boolean) {
  mockModeCache = enabled;
  await AsyncStorage.setItem(MOCK_MODE_KEY, enabled ? '1' : '0');
  mockModeReason = enabled ? 'storage' : null;
  try { console.warn('[API] setMockMode', { enabled }); } catch {}
}

// API debug flag (mirrors EXPO_PUBLIC_HTTP_DEBUG)
const DEBUG_API = (() => {
  const raw = String(process.env.EXPO_PUBLIC_HTTP_DEBUG ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();

// Extra verbose logging of /shortnews responses (set EXPO_PUBLIC_LOG_SHORTNEWS=1 to enable)
const LOG_SHORTNEWS = (() => {
  const raw = String(process.env.EXPO_PUBLIC_LOG_SHORTNEWS ?? '').toLowerCase();
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

// -------- Preferences (language, device, location) --------
const LAST_SYNC_AT_KEY = 'last_prefs_sync_at';

// Gate initial news load until a first preferences sync has a chance to run (best-effort, timeout-based)
export async function ensureInitialPreferencesSynced(timeoutMs = 2500): Promise<void> {
  try {
    const ts = await AsyncStorage.getItem(LAST_SYNC_AT_KEY);
    if (ts) return; // some sync has happened in the past; don't block
  } catch {}
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ts2 = await AsyncStorage.getItem(LAST_SYNC_AT_KEY);
      if (ts2) return;
    } catch {}
    await new Promise(r => setTimeout(r, 120));
  }
}
export type PreferencesData = {
  user?: {
    id?: string;
    languageId?: string;
    languageCode?: string;
    languageName?: string;
    role?: string;
    isGuest?: boolean;
    status?: string;
  };
  device?: {
    id?: string;
    deviceId?: string;
    deviceModel?: string;
    pushToken?: string; // optional: if backend returns the stored token
    hasPushToken?: boolean;
    location?: {
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
      placeId?: string;
      placeName?: string;
      address?: string;
      source?: string;
    };
  };
  userLocation?: {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    provider?: string;
    timestampUtc?: string;
    placeId?: string;
    placeName?: string;
    address?: string;
    source?: string;
    updatedAt?: string;
  };
};

export async function getUserPreferences(userId?: string): Promise<PreferencesData | null> {
  try {
    let uid = userId?.trim();
    if (!uid) {
      try {
        const t = await loadTokens();
        uid = (t as any)?.user?.id || (t as any)?.user?._id || (t as any)?.user?.userId;
        // fallback: try to decode JWT subject
        if (!uid && t?.jwt) {
          try {
            const parts = t.jwt.split('.');
            if (parts.length >= 2) {
              const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const json = Buffer.from(b64, 'base64').toString('utf8');
              const payload = JSON.parse(json);
              uid = payload?.sub || payload?.userId || payload?.id || payload?.uid || undefined;
            }
          } catch {}
        }
      } catch {}
    }
    if (!uid) {
      if (DEBUG_API) console.warn('[API] getUserPreferences skipped: missing userId');
      return null; // avoid 400 by not calling without userId
    }
    // Include deviceId to allow server to resolve device-bound prefs
    let deviceId: string | undefined;
    try {
      const idObj = await getDeviceIdentity();
      deviceId = idObj?.deviceId;
    } catch {}
    const params = new URLSearchParams({ userId: String(uid) });
    if (deviceId) params.set('deviceId', String(deviceId));
    const endpoint = `/preferences?${params.toString()}`;
    const res = await request<{ success?: boolean; data?: PreferencesData }>(endpoint, { method: 'GET' });
    return (res as any)?.data || (res as any) || null;
  } catch (e) {
    if (DEBUG_API) console.warn('[API] getUserPreferences failed', (e as any)?.message || e);
    return null;
  }
}

export function pickPreferenceLanguage(p: PreferencesData | null): Language | null {
  if (!p?.user) return null;
  const code = p.user.languageCode?.toLowerCase();
  if (!code) return null;
  const found = LANGUAGES.find(l => l.code.toLowerCase() === code);
  if (found) return found;
  // Fallback: synthesize a Language using known props
  const name = p.user.languageName || code.toUpperCase();
  return { id: p.user.languageId || code, name, nativeName: name, code, color: '#888', isRtl: false } as Language;
}

export function pickPreferenceLocation(p: PreferencesData | null): string | null {
  if (!p) return null;
  const loc = p.userLocation || p.device?.location;
  const name = loc?.placeName || loc?.address;
  return name || null;
}

// -------- HRCI Donations: Stories --------
export type DonationStorySummary = {
  id: string;
  title: string;
  heroImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DonationGalleryImage = {
  id: string;
  url: string;
  caption?: string;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DonationStoryDetail = {
  id: string;
  title: string;
  description?: string;
  heroImageUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  images: DonationGalleryImage[];
};

export async function getDonationStories(limit = 20, offset = 0): Promise<{ data: DonationStorySummary[]; total?: number; count?: number }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await request<{ success?: boolean; total?: number; count?: number; data: DonationStorySummary[] }>(`/donations/stories?${params.toString()}`, { method: 'GET' });
  return { data: res.data || [], total: (res as any).total, count: (res as any).count };
}

export async function getDonationStory(id: string): Promise<DonationStoryDetail> {
  const res = await request<{ success?: boolean; data: DonationStoryDetail }>(`/donations/stories/${id}`, { method: 'GET' });
  return (res as any).data || (res as any);
}

export async function uploadDonationStoryImage(
  id: string,
  file: { uri: string; name: string; type: string },
  opts: { caption?: string; isActive?: boolean } = {}
): Promise<{ data: DonationGalleryImage[]; count?: number; skipped?: number }>{
  const fd = new FormData();
  // @ts-ignore - React Native FormData file shape
  fd.append('images', { uri: file.uri, name: file.name, type: file.type });
  if (opts.caption !== undefined) fd.append('caption', String(opts.caption));
  if (opts.isActive !== undefined) fd.append('isActive', String(opts.isActive));
  const res = await request<{ success?: boolean; count?: number; skipped?: number; data: DonationGalleryImage[] }>(
    `/donations/admin/stories/${id}/gallery/upload`,
    { method: 'POST', body: fd }
  );
  return { data: res.data || [], count: (res as any).count, skipped: (res as any).skipped };
}

// Upload multiple images to a story gallery in a single request (max ~10 recommended)
export async function uploadDonationStoryImages(
  id: string,
  files: { uri: string; name: string; type: string }[],
  opts: { caption?: string; isActive?: boolean } = {}
): Promise<{ data: DonationGalleryImage[]; count?: number; skipped?: number }>{
  if (!Array.isArray(files) || files.length === 0) return { data: [], count: 0, skipped: 0 };
  const fd = new FormData();
  const limited = files.slice(0, 10); // enforce soft cap of 10
  for (const f of limited) {
    // @ts-ignore RN FormData file
    fd.append('images', { uri: f.uri, name: f.name, type: f.type });
  }
  if (opts.caption !== undefined) fd.append('caption', String(opts.caption));
  if (opts.isActive !== undefined) fd.append('isActive', String(opts.isActive));
  const res = await request<{ success?: boolean; count?: number; skipped?: number; data: DonationGalleryImage[] }>(
    `/donations/admin/stories/${id}/gallery/upload`,
    { method: 'POST', body: fd }
  );
  return { data: res.data || [], count: (res as any).count, skipped: (res as any).skipped };
}

export async function updateDonationStoryGallery(
  id: string,
  body: { add?: Pick<DonationGalleryImage, 'url' | 'caption' | 'order' | 'isActive'>[]; delete?: string[] }
): Promise<{ data?: any }>{
  const res = await request<{ success?: boolean; data?: any }>(
    `/donations/admin/stories/${id}/gallery`,
    { method: 'PUT', body }
  );
  return res;
}

// Delete a single image from a story gallery
export async function deleteDonationStoryImage(
  id: string,
  imageId: string
): Promise<boolean> {
  if (!id || !imageId) throw new Error('Story id and image id are required');
  try {
    const res = await request<{ success?: boolean } | undefined>(
      `/donations/admin/stories/${encodeURIComponent(id)}/gallery/${encodeURIComponent(imageId)}`,
      { method: 'DELETE' }
    );
    // Treat 2xx with or without body as success
    if (res === undefined) return true; // 204 No Content
    return Boolean((res as any)?.success !== false);
  } catch (e) {
    // Do not silently succeed on errors; surface failure to UI
    if ((e as any)?.status === 204) return true;
    return false;
  }
}

// Create a new donation story (admin)
export type CreateDonationStoryInput = {
  title: string;
  description?: string;
  heroImageUrl?: string;
  isActive?: boolean; // will be forced to true by client by default
};

export async function createDonationStory(input: CreateDonationStoryInput): Promise<DonationStoryDetail> {
  if (!input?.title || !String(input.title).trim()) {
    throw new Error('Title is required');
  }
  const body = {
    title: String(input.title).trim(),
    description: input.description || undefined,
    heroImageUrl: input.heroImageUrl || undefined,
    isActive: true, // per requirement: always true
  } as any;
  const res = await request<{ success?: boolean; data: DonationStoryDetail }>(
    `/donations/admin/stories`,
    { method: 'POST', body }
  );
  return (res as any).data || (res as any);
}

// Update an existing donation story (admin)
export type UpdateDonationStoryInput = {
  title?: string;
  description?: string;
  heroImageUrl?: string;
  isActive?: boolean;
};

export async function updateDonationStory(id: string, input: UpdateDonationStoryInput): Promise<DonationStoryDetail> {
  if (!id) throw new Error('Story id is required');
  const body: any = {};
  if (typeof input.title === 'string') body.title = input.title.trim();
  if (typeof input.description === 'string') body.description = input.description;
  if (typeof input.heroImageUrl === 'string') body.heroImageUrl = input.heroImageUrl;
  if (typeof input.isActive === 'boolean') body.isActive = input.isActive;
  if (!Object.keys(body).length) throw new Error('Nothing to update');
  const res = await request<{ success?: boolean; data: DonationStoryDetail }>(
    `/donations/admin/stories/${encodeURIComponent(id)}`,
    { method: 'PUT', body }
  );
  return (res as any).data || (res as any);
}

// -------- Update Preferences --------
export type UpdatePreferencesInput = {
  languageId?: string;
  languageCode?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    placeId?: string;
    placeName?: string;
    address?: string;
    source?: string;
  };
  pushToken?: string;
  deviceModel?: string;
  forceUpdate?: boolean; // will be forced to true by client
};

export async function updatePreferences(partial: UpdatePreferencesInput, userId?: string): Promise<any> {
  const t = await loadTokens();
  const uid = (userId || (t as any)?.user?.id || (t as any)?.user?._id || (t as any)?.user?.userId)?.toString();
  if (!uid) throw new Error('Cannot update preferences without userId');
  const body: any = { userId: uid, forceUpdate: true };
  if (partial.languageId) body.languageId = partial.languageId;
  if (partial.languageCode) body.languageCode = partial.languageCode;
  if (partial.location) body.location = partial.location;
  if (partial.pushToken) body.pushToken = partial.pushToken;
  // Prefer caller-provided model; else derive a simple model name
  body.deviceModel = partial.deviceModel || (await getDeviceIdentity()).deviceModel;
  return await request<any>('/preferences/update', { method: 'POST', body });
}

// After preferences change, refresh auth/session and local caches
export async function afterPreferencesUpdated(opts: { languageIdChanged?: string | null; languageCode?: string | null } = {}) {
  try {
    // Refresh tokens/session to ensure server-side language/claims propagate
    const next = await refreshTokens();
    // Best-effort: if languageId changed, persist hint in tokens for downstream readers
    if (opts.languageIdChanged) {
      await saveTokens({ ...next, languageId: opts.languageIdChanged });
    }
  } catch (e) {
    if (DEBUG_API) console.warn('[API] afterPreferencesUpdated refreshTokens failed', (e as any)?.message || e);
  }
  // Refresh language-dependent caches (news, etc.)
  try {
    await refreshLanguageDependentCaches(opts.languageCode || undefined);
  } catch (e) {
    if (DEBUG_API) console.warn('[API] refreshLanguageDependentCaches failed', (e as any)?.message || e);
  }
  // Notify UI to refresh language-dependent screens (e.g., News tab)
  try {
    const { emit } = await import('./events');
    emit('news:refresh' as any, { reason: 'language' } as any);
  } catch {}
}

// Resolve effective language from storage/tokens with local-first priority
export async function resolveEffectiveLanguage(): Promise<{ id?: string; code?: string; name?: string }> {
  let id: string | undefined;
  let code: string | undefined;
  let name: string | undefined;
  // 0) Environment override takes highest precedence (useful for QA / hotfix)
  try {
    const envId = String(process.env.EXPO_PUBLIC_FORCE_LANGUAGE_ID ?? '').trim();
    const envCode = String(process.env.EXPO_PUBLIC_FORCE_LANGUAGE_CODE ?? '').trim();
    if (envId) {
      id = envId;
      code = code || envCode || code;
    } else if (envCode) {
      code = envCode;
    }
  } catch {}
  // 1) Prefer local override (set for MEMBER/HRCI_ADMIN)
  try {
    const ll = await AsyncStorage.getItem('language_local');
    if (ll) {
      try { const obj = JSON.parse(ll); id = obj?.id || id; code = obj?.code || code; name = obj?.name || name; } catch {}
    }
  } catch {}
  // 2) Merge with selectedLanguage
  try {
    const raw = await AsyncStorage.getItem('selectedLanguage');
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        id = id || obj?.id; code = code || (obj?.code || obj?.slug); name = name || (obj?.nativeName || obj?.name);
      } catch {}
    }
  } catch {}
  // 3) If missing either piece, map via languages list or tokens
  try {
    const list = await getLanguages();
    if (!id && code) {
      const found = list.find(l => String(l.code).toLowerCase() === String(code).toLowerCase());
      if (found) { id = String(found.id); name = name || found.nativeName || found.name; }
    } else if (id && !code) {
      const found = list.find(l => String(l.id) === String(id));
      if (found) { code = String(found.code); name = name || found.nativeName || found.name; }
    }
  } catch {}
  // 4) tokens fallback if still missing id
  if (!id) {
    try {
      const t = await loadTokens();
      if (t?.languageId) {
        id = t.languageId;
        try {
          const list = await getLanguages();
          const found = list.find(l => String(l.id) === String(id));
          if (found) { code = code || String(found.code); name = name || found.nativeName || found.name; }
        } catch {}
      }
    } catch {}
  }
  return { id, code, name };
}

export async function refreshLanguageDependentCaches(langCode?: string) {
  try {
    let code = langCode;
    if (!code) {
      const eff = await resolveEffectiveLanguage();
      code = eff.code;
    }
    // Default to English if still missing
    code = code || 'en';
    await getNews(code);
  } catch {
    // best-effort
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

// Normalize a single news object into Article
function normalizeArticleFromAny(a: any): Article {
  const tsBase = Date.now();
  const toPlainText = (input: any): string => {
    if (input == null) return '';
    try { return String(input).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); } catch { return ''; }
  };
  let jsonLd: any = a?.jsonLd || a?.jsonld || a?.jsonLD;
  if (jsonLd && typeof jsonLd === 'string') {
    try { jsonLd = JSON.parse(jsonLd); } catch {}
  }
  const collectUrls = (input: any): string[] => {
    const urls: string[] = [];
    const push = (u?: string) => {
      if (!u || typeof u !== 'string') return;
      const trimmed = u.trim();
      if (!trimmed) return;
      if (/^(https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed)) urls.push(trimmed);
    };
    const fromObj = (o: any) => { if (!o || typeof o !== 'object') return; push(o.url || o.src || o.source || o.imageUrl || o.original || o.secure_url || o.secureUrl || o.contentUrl); };
    const walk = (val: any) => { if (!val) return; if (typeof val === 'string') push(val); else if (Array.isArray(val)) val.forEach(walk); else if (typeof val === 'object') fromObj(val); };
    walk(input); return urls;
  };
  const primaryImage: string | undefined = a.primaryImageUrl
    || a.primaryImage || a.featuredImage || a.image || a.imageUrl || a.thumbnail || (() => { const arr = collectUrls(jsonLd?.image); return arr[0]; })();
  const primaryVideo: string | undefined = a.primaryVideoUrl || a.videoUrl || a.video || jsonLd?.video?.contentUrl;
  const jsonLdImages: string[] = collectUrls(jsonLd?.image);
  const mediaUrls: string[] = collectUrls(a?.mediaUrls);
  const imageUrlsField: string[] = collectUrls(a?.imageUrls || a?.images || a?.gallery || a?.photos);
  const seen = new Set<string>(); const allImages: string[] = [];
  const add = (u?: string) => { if (u && !seen.has(u)) { seen.add(u); allImages.push(u); } };
  add(primaryImage); [jsonLdImages, mediaUrls, imageUrlsField].forEach(arr => arr.forEach(add));
  const imagesArr: string[] | undefined = allImages.length ? allImages : undefined;
  const publisherLogo = jsonLd?.publisher?.logo?.url || (a.publisher?.logo?.url);
  const publisherName = jsonLd?.publisher?.name || a.publisher?.name;
  let genId = String(a.id ?? a._id ?? a.guid ?? a.slug ?? a.canonicalUrl ?? a.url ?? a.permalink ?? '');
  if (!genId) {
    const seed = `${a.title || ''}|${a.createdAt || a.publishDate || a.publishedAt || ''}`;
    genId = seed && seed.length ? String(Math.abs(seed.split('').reduce((h: number, c: string) => ((h << 5) - h) + c.charCodeAt(0), 0))) : '';
  }
  if (!genId) genId = `${tsBase}`;
  const rawAuthor = a.author || {};
  const authorFullName = a.authorFullName || rawAuthor.fullName || a.authorName || rawAuthor.name || '';
  const authorProfilePhoto = a.authorProfilePhotoUrl || rawAuthor.profilePhotoUrl || rawAuthor.avatar || '';
  const authorRoleName = a.authorRoleName || rawAuthor.roleName || a.roleName || null;
  const authorPlaceName = a.placeName || rawAuthor.placeName || null;
  const computedTitle = (
    a.title ?? a.headline ?? a.shortTitle ?? a.newsTitle ?? a.metaTitle ?? a.heading ?? a.titleText ?? a.headlineText ?? a.caption ?? a.name ?? a.seo?.metaTitle ?? a.seo?.title ?? ((a.description ?? a.summary ?? '') as string)
  );
  const rawBodyCandidate = (
    a.content ?? a.body ?? a.text ?? a.detail ?? a.story ?? a.contentText ?? a.news ?? a.descriptionText ?? a.shortNews ?? a.shortNewsText ?? a.short_news ?? a.shortnews ?? a.newsText ?? a.news_text ?? a.newsContent ?? a.news_content ?? a.contentHtml ?? a.content_html ?? a.html ?? a.htmlContent ?? a.seo?.description ?? a.description ?? a.summary
  );
  const plainBody = toPlainText(rawBodyCandidate);
  const articleObj: Article = {
    id: genId,
    title: (computedTitle && String(computedTitle).trim()) || 'Untitled',
    summary: a.summary ?? a.description ?? a.shortDescription ?? a.seo?.metaDescription ?? a.seo?.description ?? a.caption ?? '',
    body: plainBody,
    image: imagesArr?.[0],
    images: imagesArr,
    videoUrl: primaryVideo,
    author: {
      id: a.authorId || rawAuthor.id,
      name: authorFullName || '',
      avatar: authorProfilePhoto || publisherLogo || '',
      fullName: authorFullName || '',
      profilePhotoUrl: authorProfilePhoto || '',
      roleName: authorRoleName || null,
      placeName: authorPlaceName || null,
    } as any,
    publisherName,
    publisherLogo,
    category: a.category?.name || a.categoryName || a.category?.title || a.category || 'General',
    createdAt: a.createdAt ?? a.publishDate ?? a.publishedAt ?? jsonLd?.datePublished ?? new Date().toISOString(),
    isRead: Boolean(a.isRead),
    likes: (a.likeCount ?? a.likes) ?? 0,
    dislikes: (a.dislikeCount ?? a.dislikes) ?? 0,
    comments: (a.commentCount ?? a.comments) ?? 0,
    language: a.languageCode || a.inLanguage || a.language,
    tags: a.tags ?? [],
    canonicalUrl: a.canonicalUrl || a.seo?.canonical || jsonLd?.mainEntityOfPage?.['@id'] || jsonLd?.url || undefined,
    metaTitle: a.metaTitle || a.seo?.metaTitle || jsonLd?.headline || undefined,
    metaDescription: a.metaDescription || a.seo?.metaDescription || jsonLd?.description || undefined,
  } as Article;
  if ((articleObj.title || '').trim() === 'Untitled') {
    const synth = (articleObj.body || articleObj.summary || '').trim();
    if (synth) {
      const firstLine = synth.split(/\r?\n/)[0].slice(0, 96);
      if (firstLine) articleObj.title = firstLine;
    }
  }
  return articleObj;
}

export const getNews = async (
  lang: string,
  category?: string,
  cursorOrOptions?: string | { cursor?: string; latitude?: number; longitude?: number; radiusKm?: number }
): Promise<Article[]> => {
  try {
    // Wait briefly for initial preferences sync so language/prefs align before first fetch
    await ensureInitialPreferencesSynced().catch(() => {});
    // If mock mode is forced, skip network and return mock
    if (await getMockMode()) {
      try { console.warn('[API] getNews returning mockArticles due to mock mode', { reason: mockModeReason }); } catch {}
      return mockArticles;
    }

    // Build cache key for offline support
  const key = `news_cache:${lang}:${category || 'all'}`;
    // Correct endpoint: /shortnews with limit and optional cursor
    // Resolve languageId (required by public endpoint) via centralized resolver
    let languageId: string | undefined;
    let languageCode: string | undefined = lang;
    try {
      const eff = await resolveEffectiveLanguage();
      languageId = eff.id;
      languageCode = eff.code || languageCode;
      if (DEBUG_API) {
        try { console.log('[API] getNews: effective language', { languageId, languageCode, fromArg: lang }); } catch {}
      }
    } catch {}
    // Interpret 3rd arg as cursor or options
    let cursor: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;
    let radiusKm: number | undefined;
    if (typeof cursorOrOptions === 'string') {
      cursor = cursorOrOptions;
    } else if (cursorOrOptions && typeof cursorOrOptions === 'object') {
      cursor = cursorOrOptions.cursor;
      latitude = cursorOrOptions.latitude;
      longitude = cursorOrOptions.longitude;
      radiusKm = cursorOrOptions.radiusKm;
    }
    // Helper to add numeric params
    const addNumParam = (params: URLSearchParams, k: string, v?: number) => {
      if (typeof v === 'number' && Number.isFinite(v)) params.set(k, String(v));
    };
    // Attempt calls in compatibility order to handle backend variants
  const tryFetch = async (): Promise<{ json: any; endpoint: string }> => {
      const baseParams = new URLSearchParams({ limit: '10' });
      if (cursor) baseParams.set('cursor', cursor);
      addNumParam(baseParams, 'latitude', latitude);
      addNumParam(baseParams, 'longitude', longitude);
      if (typeof radiusKm === 'number' && Number.isFinite(radiusKm)) {
        const clamped = Math.min(200, Math.max(1, radiusKm));
        baseParams.set('radiusKm', String(clamped));
      }
      const code = (languageCode || lang || '').trim();
      const idStr = (languageId ? String(languageId) : '').trim();

      const attempts: { path: string; params: URLSearchParams }[] = [];
      // Heuristic: if languageId looks like a non-numeric key (e.g., "cmha..."), try it first
      const idLooksNonNumeric = !!idStr && /[A-Za-z]/.test(idStr);
      if (idLooksNonNumeric) {
        const p = new URLSearchParams(baseParams); p.set('languageId', idStr);
        attempts.push({ path: '/shortnews/public', params: p });
      }
      // Then try with language code variants
      if (code) {
        const p1 = new URLSearchParams(baseParams); p1.set('languageCode', code);
        attempts.push({ path: '/shortnews/public', params: p1 });
        const p2 = new URLSearchParams(baseParams); p2.set('language', code);
        attempts.push({ path: '/shortnews/public', params: p2 });
      }
      // If we didn't already try id first (numeric ids may fail on some envs), do it now as a fallback
      if (idStr && !idLooksNonNumeric) {
        const p = new URLSearchParams(baseParams); p.set('languageId', idStr);
        attempts.push({ path: '/shortnews/public', params: p });
      }
      // Legacy compatibility
      if (code) {
        const p = new URLSearchParams(baseParams); p.set('languageCode', code);
        attempts.push({ path: '/news/public', params: p });
      }

      let lastErr: any = null;
      let lastEmptyOk: { json: any; endpoint: string } | null = null;
      for (const att of attempts) {
        const url = `${att.path}?${att.params.toString()}`;
        try {
          const j = await request<any>(url as any, { timeoutMs: 30000, noAuth: true });
          // Determine item count; if empty, try next attempt before accepting
          const candidate = (j as any)?.data ?? (j as any)?.items ?? (j as any)?.data?.items ?? (j as any)?.data?.data ?? null;
          let count = Array.isArray(candidate) ? candidate.length : 0;
          // Mixed feed shape: [{ kind, data }]
          if (Array.isArray(candidate) && candidate.length && typeof candidate[0] === 'object' && 'kind' in (candidate[0] as any) && 'data' in (candidate[0] as any)) {
            const onlyNews = (candidate as any[]).filter((x) => (x?.kind || '').toLowerCase() === 'news');
            count = onlyNews.length;
          }
          if (count > 0) {
            return { json: j, endpoint: url };
          }
          // Remember first empty-success to return if all attempts are empty
          if (!lastEmptyOk) lastEmptyOk = { json: j, endpoint: url };
          if (__DEV__) try { console.warn('[API] getNews attempt returned empty list', url); } catch {}
          continue;
        } catch (e: any) {
          lastErr = e;
          if (__DEV__) try { console.warn('[API] getNews attempt failed', url, (e as any)?.message || e); } catch {}
          // Continue trying other variants
        }
      }
      if (lastEmptyOk) return lastEmptyOk; // all attempts succeeded but empty; let caller decide
      if (lastErr) throw lastErr;
      throw new Error('Failed to fetch shortnews');
    };

    const { json, endpoint } = await tryFetch();
    if (LOG_SHORTNEWS || DEBUG_API) {
      try {
        const bodyPreview = (() => { try { return JSON.stringify(json).slice(0, 4000); } catch { return '(stringify failed)'; } })();
        console.log('[API] shortnews RAW', { endpoint, languageId, languageCode, bodyPreview });
      } catch {}
    }
    if (DEBUG_API || LOG_SHORTNEWS) {
      const keys = json && typeof json === 'object' ? Object.keys(json as any) : [];
      const dataArr = Array.isArray((json as any)?.data) ? (json as any).data : null;
      const itemsArr = Array.isArray((json as any)?.items) ? (json as any).items : null;
      const nestedArr = Array.isArray((json as any)?.data?.items) ? (json as any).data.items : (Array.isArray((json as any)?.data?.data) ? (json as any).data.data : null);
      const arr = dataArr || itemsArr || nestedArr;
      const sample = Array.isArray(arr) && arr.length ? arr[0] : null;
      const sJsonLd = sample?.jsonLd || sample?.jsonld || sample?.jsonLD;
      console.log('[API] /shortnews response', {
        endpoint,
        keys,
        hasDataArray: Array.isArray(dataArr),
        hasItemsArray: Array.isArray(itemsArr),
        hasNestedArray: Array.isArray(nestedArr),
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
  const listRaw = (json as any)?.data ?? (json as any)?.items ?? (json as any)?.data?.items ?? (json as any)?.data?.data ?? null;
    if (!Array.isArray(listRaw)) {
      // Hard fail if unexpected shape; caller decides what to do
      throw new Error('Invalid shortnews response');
    }
    // New mixed feed shape: [{ kind, data }] — filter to news
    if (Array.isArray(listRaw) && listRaw.length && typeof listRaw[0] === 'object' && 'kind' in (listRaw[0] as any) && 'data' in (listRaw[0] as any)) {
      const onlyNews = (listRaw as any[]).filter((x) => (x?.kind || '').toLowerCase() === 'news').map((x) => (x as any).data);
      const normalized = onlyNews.map((a) => normalizeArticleFromAny(a));
      const key = `news_cache:${lang}:${category || 'all'}`;
      try { await AsyncStorage.setItem(key, JSON.stringify(normalized)); } catch {}
      if (!normalized.length) throw new Error('Empty shortnews list');
      return normalized;
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
  const tsBase = Date.now();
  const toPlainText = (input: any): string => {
    if (input == null) return '';
    try {
      const s = String(input);
      // quick strip HTML tags and collapse whitespace
      return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch { return ''; }
  };
  const seenIds = new Set<string>();
  const normalized: Article[] = list.map((a, idx) => {
      let jsonLd: any = (a as any)?.jsonLd || (a as any)?.jsonld || (a as any)?.jsonLD || undefined;
      if (jsonLd && typeof jsonLd === 'string') {
        try { jsonLd = JSON.parse(jsonLd); } catch { /* ignore parse errors */ }
      }
      // Prefer primary media fields from backend; fallback to jsonLd.image
      const primaryImage: string | undefined = a.primaryImageUrl
        || a.primaryImage
        || a.coverImageUrl
        || a.cover
        || a.coverUrl
        || a.featuredImage
        || a.image
        || a.imageUrl
        || a.imageURL
        || a.image_link
        || a.urlToImage
        || a.thumbnail
        || a.thumbnailUrl
        || a.thumbnailImage
        || a.photo
        || a.photoUrl
        || a.heroImage
        || a.heroImageUrl
        || a.poster
        || a.posterUrl
        || (() => {
        const arr = collectUrls(jsonLd?.image);
        return arr[0];
      })();
      const primaryVideo: string | undefined = a.primaryVideoUrl || a.videoUrl || a.video || a.videoLink || jsonLd?.video?.contentUrl;
      // Build media list from many possible fields, de-duplicate, keep primary first
      const jsonLdImages: string[] = collectUrls(jsonLd?.image);
      const mediaUrls: string[] = collectUrls((a as any)?.mediaUrls);
      const imagesField: string[] = collectUrls((a as any)?.images);
      const galleryField: string[] = collectUrls((a as any)?.gallery);
      const photosField: string[] = collectUrls((a as any)?.photos);
      const mediaField: string[] = collectUrls((a as any)?.media);
      const mediaGalleryField: string[] = collectUrls((a as any)?.mediaGallery || (a as any)?.imageGallery);
  const imageUrlsField: string[] = collectUrls((a as any)?.imageUrls || (a as any)?.imagesUrls || (a as any)?.imagesUrl || (a as any)?.thumbnails || (a as any)?.thumbnailImage || (a as any)?.imageURL || (a as any)?.urlToImage || (a as any)?.image_link);
      const seen = new Set<string>();
      const allImages: string[] = [];
      const add = (u?: string) => { if (u && !seen.has(u)) { seen.add(u); allImages.push(u); } };
      add(primaryImage);
      ;[jsonLdImages, mediaUrls, imagesField, galleryField, photosField, mediaField, mediaGalleryField, imageUrlsField].forEach(arr => arr.forEach(add));
      const imagesArr: string[] | undefined = allImages.length ? allImages : undefined;
      const publisherLogo = jsonLd?.publisher?.logo?.url || (a.publisher?.logo?.url);
      const publisherName = jsonLd?.publisher?.name || a.publisher?.name;
  const firstImage = imagesArr?.[0];
      const videoUrl: string | undefined = primaryVideo;
  // Extended author fields (backend may send either nested author.* or flat fields)
  const rawAuthor = (a as any).author || {};
  const authorFullName = (a as any).authorFullName || rawAuthor.fullName || (a as any).fullName;
  const authorProfilePhoto = (a as any).authorProfilePhotoUrl || rawAuthor.profilePhotoUrl || (a as any).profilePhotoUrl;
  const authorRoleName = (a as any).authorRoleName || rawAuthor.roleName || (a as any).roleName;
  const authorPlaceName = (a as any).authorPlaceName || rawAuthor.placeName || (a as any).placeName;
  const authorName = authorFullName || rawAuthor.name || (a as any).authorName || jsonLd?.author?.name || '';
  const authorAvatar = authorProfilePhoto || rawAuthor.avatar || (a as any).authorAvatar || publisherLogo || '';
      // Generate a stable unique id: prefer backend ids; else derive from content; finally fall back to ts+idx
      let genId = String(
        a.id ?? a._id ?? (a.guid || a.slug || a.canonicalUrl || a.url || a.permalink) ?? ''
      );
      if (!genId) {
        const seed = `${a.title || ''}|${a.createdAt || a.publishDate || a.publishedAt || ''}`;
        genId = seed && seed.length ? String(Math.abs(seed.split('').reduce((h: number, c: string) => ((h << 5) - h) + c.charCodeAt(0), 0))) : '';
      }
      if (!genId) genId = `${tsBase}_${idx}`;
      // Ensure uniqueness within this batch
      while (seenIds.has(genId)) {
        genId = `${genId}_${idx}`;
      }
      seenIds.add(genId);

      // Prefer richer title fields; fall back to body-derived text
      const computedTitle = (
        a.title ?? a.headline ?? a.shortTitle ?? a.newsTitle ?? a.metaTitle ??
        a.heading ?? a.titleText ?? a.headlineText ?? a.caption ?? a.name ??
        (a.short_news_title || a.shortNewsTitle || a.newsHeading || a.heading_text || a.title_text) ??
        jsonLd?.headline ?? a.seo?.metaTitle ?? a.seo?.title ??
        ((a.description ?? a.summary ?? '') as string)
      );

      const rawBodyCandidate = (
        a.content ?? a.body ?? a.text ?? a.detail ?? a.story ?? a.contentText ?? a.news ??
        a.descriptionText ?? a.shortNews ?? a.shortNewsText ?? a.short_news ?? a.shortnews ??
        a.newsText ?? a.news_text ?? a.newsContent ?? a.news_content ??
        a.contentHtml ?? a.content_html ?? a.html ?? a.htmlContent ??
        a.seo?.description ?? a.description ?? a.summary
      );
      const plainBody = toPlainText(rawBodyCandidate);

      const articleObj: Article = {
        id: genId,
        title: (computedTitle && String(computedTitle).trim()) || 'Untitled',
        summary: a.summary ?? a.description ?? a.shortDescription ?? a.seo?.metaDescription ?? a.seo?.description ?? a.caption ?? '',
        body: plainBody,
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
        category: a.category?.name || a.categoryName || a.category?.title || a.category || 'General',
        createdAt: a.createdAt ?? a.publishDate ?? a.publishedAt ?? jsonLd?.datePublished ?? new Date().toISOString(),
        isRead: Boolean(a.isRead),
        likes: a.likes ?? 0,
        dislikes: a.dislikes ?? 0,
        comments: a.comments ?? 0,
        language: a.languageCode || a.inLanguage || a.language,
        tags: a.tags ?? [],
  canonicalUrl: (a as any).canonicalUrl || (a.seo?.canonical) || jsonLd?.mainEntityOfPage?.['@id'] || jsonLd?.url || (a as any).url || (a as any).link || undefined,
        metaTitle: (a as any).metaTitle || a.headline || a.shortTitle || a.title || a.seo?.metaTitle || jsonLd?.headline || undefined,
        metaDescription: (a as any).metaDescription || a.summary || a.description || a.seo?.metaDescription || jsonLd?.description || undefined,
      } as Article;
      // If backend didn’t provide a usable title, synthesize one from body/summary
      if ((articleObj.title || '').trim() === 'Untitled') {
        const synth = (articleObj.body || articleObj.summary || '').trim();
        if (synth) {
          const firstLine = synth.split(/\r?\n/)[0].slice(0, 96);
          if (firstLine) articleObj.title = firstLine;
        }
      }
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

export const getNewsFeed = async (
  lang: string,
  category?: string,
  cursorOrOptions?: string | { cursor?: string; latitude?: number; longitude?: number; radiusKm?: number }
): Promise<{ items: FeedItem[]; nextCursor?: string | null; hasMore?: boolean } > => {
  // Reuse the same network logic as getNews but keep kind=ad items too
  await ensureInitialPreferencesSynced().catch(() => {});
  const itemsArticles = await (async () => {
    // Build the correct endpoint with ONLY languageId per backend contract
    let languageId: string | undefined;
    let languageCode: string | undefined;
    try {
      const eff = await resolveEffectiveLanguage();
      languageId = eff.id;
      languageCode = eff.code;
    } catch {}
    if (!languageId) {
      // Do not call backend without languageId; callers must ensure language is chosen
      // For compatibility, allow using languageCode via fallback attempts below
    }
    // Interpret 3rd arg as cursor or options
    let cursor: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;
    let radiusKm: number | undefined;
    if (typeof cursorOrOptions === 'string') {
      cursor = cursorOrOptions;
    } else if (cursorOrOptions && typeof cursorOrOptions === 'object') {
      cursor = cursorOrOptions.cursor;
      latitude = cursorOrOptions.latitude;
      longitude = cursorOrOptions.longitude;
      radiusKm = cursorOrOptions.radiusKm;
    }
    const addNum = (p: URLSearchParams, k: string, v?: number) => {
      if (typeof v === 'number' && Number.isFinite(v)) p.set(k, String(v));
    };
  const tryFetch = async (): Promise<{ json: any; endpoint: string }> => {
      const base = new URLSearchParams({ limit: '10' });
      if (cursor) base.set('cursor', cursor);
      addNum(base, 'latitude', latitude);
      addNum(base, 'longitude', longitude);
      if (typeof radiusKm === 'number' && Number.isFinite(radiusKm)) {
        const clamped = Math.min(200, Math.max(1, radiusKm));
        base.set('radiusKm', String(clamped));
      }
      const code = (languageCode || lang || '').trim();
      const idStr = (languageId ? String(languageId) : '').trim();
  const attempts: { path: string; params: URLSearchParams }[] = [];
  const idLooksNonNumeric = !!idStr && /[A-Za-z]/.test(idStr);
  // Prefer id first if it looks like a real key
  if (idLooksNonNumeric) { const p = new URLSearchParams(base); p.set('languageId', idStr); attempts.push({ path: '/shortnews/public', params: p }); }
  // Then code variants
  if (code) { const p = new URLSearchParams(base); p.set('languageCode', code); attempts.push({ path: '/shortnews/public', params: p }); }
  if (code) { const p = new URLSearchParams(base); p.set('language', code); attempts.push({ path: '/shortnews/public', params: p }); }
  // Finally id if numeric/unknown
  if (idStr && !idLooksNonNumeric) { const p = new URLSearchParams(base); p.set('languageId', idStr); attempts.push({ path: '/shortnews/public', params: p }); }
  // Legacy
  if (code) { const p = new URLSearchParams(base); p.set('languageCode', code); attempts.push({ path: '/news/public', params: p }); }

      let lastErr: any = null;
      let lastEmptyOk: { json: any; endpoint: string } | null = null;
      for (const att of attempts) {
        const url = `${att.path}?${att.params.toString()}`;
        if (LOG_SHORTNEWS || DEBUG_API) {
          try { console.log('[API] getNewsFeed request', { endpoint: url, languageId, languageCode: code, latitude, longitude, radiusKm, cursor }); } catch {}
        }
        try {
          const j = await request<any>(url as any, { timeoutMs: 30000, noAuth: true });
          const candidate = (j as any)?.data ?? (j as any)?.items ?? (j as any)?.data?.items ?? (j as any)?.data?.data ?? null;
          let count = Array.isArray(candidate) ? candidate.length : 0;
          if (Array.isArray(candidate) && candidate.length && typeof candidate[0] === 'object' && 'kind' in (candidate[0] as any) && 'data' in (candidate[0] as any)) {
            const onlyNews = (candidate as any[]).filter((x) => (x?.kind || '').toLowerCase() === 'news');
            count = onlyNews.length;
          }
          if (count > 0) {
            return { json: j, endpoint: url };
          }
          if (!lastEmptyOk) lastEmptyOk = { json: j, endpoint: url };
          if (__DEV__) try { console.warn('[API] getNewsFeed attempt returned empty list', url); } catch {}
          continue;
        } catch (e: any) {
          lastErr = e;
          if (__DEV__) try { console.warn('[API] getNewsFeed attempt failed', url, (e as any)?.message || e); } catch {}
        }
      }
      if (lastEmptyOk) return lastEmptyOk;
      if (lastErr) throw lastErr;
      throw new Error('Failed to fetch shortnews feed');
    };

    const { json, endpoint } = await tryFetch();
    if (LOG_SHORTNEWS || DEBUG_API) {
      try {
        const pageInfo = (json as any)?.pageInfo || null;
        const dataArr = Array.isArray((json as any)?.data) ? (json as any).data : null;
        const itemsArr = Array.isArray((json as any)?.items) ? (json as any).items : null;
        const nestedArr = Array.isArray((json as any)?.data?.items) ? (json as any).data.items : (Array.isArray((json as any)?.data?.data) ? (json as any).data.data : null);
        const arr = dataArr || itemsArr || nestedArr;
        console.log('[API] getNewsFeed response', {
          endpoint,
          hasDataArray: Array.isArray(dataArr),
          hasItemsArray: Array.isArray(itemsArr),
          hasNestedArray: Array.isArray(nestedArr),
          length: Array.isArray(arr) ? arr.length : null,
          pageInfo,
        });
      } catch {}
    }
    const pageInfo = (json as any)?.pageInfo || null;
    const listRaw = (json as any)?.data ?? (json as any)?.items ?? (json as any)?.data?.items ?? (json as any)?.data?.data ?? null;
    const out: { items: FeedItem[]; nextCursor?: string | null; hasMore?: boolean } = { items: [], nextCursor: pageInfo?.nextCursor || null, hasMore: Boolean(pageInfo?.hasMore) };
    if (!Array.isArray(listRaw)) {
      // Old shape: just articles
      const arr = Array.isArray((json as any)?.data) ? (json as any).data : Array.isArray((json as any)?.items) ? (json as any).items : [];
      out.items = arr.map((a: any) => ({ type: 'news', article: normalizeArticleFromAny(a) }));
      return out;
    }
    for (const entry of listRaw) {
      if (entry && typeof entry === 'object' && 'kind' in entry && 'data' in entry) {
        const kind = String(entry.kind || '').toLowerCase();
        if (kind === 'news') {
          out.items.push({ type: 'news', article: normalizeArticleFromAny(entry.data) });
        } else if (kind === 'ad') {
          const d = entry.data || {};
          const mediaUrls: string[] = Array.isArray(d.mediaUrls) ? d.mediaUrls : (d.mediaUrl ? [d.mediaUrl] : []);
          const ad: AdItem = {
            id: String(d.id || `ad_${Math.random().toString(36).slice(2)}`),
            title: d.title || undefined,
            mediaType: d.mediaType || undefined,
            mediaUrls,
            posterUrl: d.posterUrl || undefined,
            clickUrl: d.clickUrl || undefined,
            languageId: d.languageId || undefined,
          };
          out.items.push({ type: 'ad', ad });
        }
      } else {
        // If backend returns plain articles in the same array, treat as news
        out.items.push({ type: 'news', article: normalizeArticleFromAny(entry) });
      }
    }
    return out;
  })();
  return itemsArticles;
};

export const getArticleById = async (id: string): Promise<Article | undefined> => {
  if (!id) return undefined;
  // Mock-mode: keep existing mock behavior
  if (await getMockMode()) {
    return mockArticles.find(article => article.id === id);
  }
  try {
    // 1) Try local caches from any language/category for instant hit
    try {
      const keys = await AsyncStorage.getAllKeys();
      const newsKeys = (keys || []).filter(k => k.startsWith('news_cache:'));
      if (newsKeys.length) {
        const pairs = await AsyncStorage.multiGet(newsKeys);
        for (const [, val] of pairs) {
          if (!val) continue;
          try {
            const arr = JSON.parse(val) as Article[];
            const found = (arr || []).find(a => String(a.id) === String(id));
            if (found) return found;
          } catch {}
        }
      }
    } catch {}

    // 2) Try backend detail endpoints (adaptive)
    const candidates = [
      `/shortnews/${encodeURIComponent(id)}`,
      `/shortnews/item?id=${encodeURIComponent(id)}`,
      `/news/${encodeURIComponent(id)}`,
    ];
    let data: any = null;
    let lastErr: any = null;
    for (const ep of candidates) {
      try {
        const json = await request<any>(ep as any, { noAuth: true, timeoutMs: 20000 });
        // Accept common shapes
        data = (json as any)?.data || (json as any)?.item || (json as any);
        if (data && typeof data === 'object') {
          try { console.log('[API] getArticleById OK', ep); } catch {}
          break;
        }
      } catch (e) {
        lastErr = e;
        try { console.warn('[API] getArticleById failed; trying next', ep, (e as any)?.message || e); } catch {}
      }
      data = null;
    }
    if (!data) {
      if (lastErr) throw lastErr;
      return undefined;
    }

    // Minimal normalization (reuse logic from list where possible)
    const a: any = data;
    let jsonLd: any = a?.jsonLd || a?.jsonld || a?.jsonLD;
    if (jsonLd && typeof jsonLd === 'string') {
      try { jsonLd = JSON.parse(jsonLd); } catch {}
    }
    const firstImage = a.primaryImageUrl || a.coverImageUrl || a.featuredImage || a.image || a.thumbnail || (() => {
      const img = (jsonLd?.image && Array.isArray(jsonLd.image) && jsonLd.image[0]) || undefined;
      return typeof img === 'string' ? img : (img?.url || undefined);
    })();
    const primaryVideo: string | undefined = a.primaryVideoUrl || a.videoUrl || a.video || jsonLd?.video?.contentUrl;
    const authorObj = a.author || {};
    const authorName = a.authorFullName || authorObj.fullName || authorObj.name || jsonLd?.author?.name || '';
    const authorAvatar = a.authorProfilePhotoUrl || authorObj.profilePhotoUrl || authorObj.avatar || '';
    const publisherLogo = jsonLd?.publisher?.logo?.url || (a.publisher?.logo?.url);
    const publisherName = jsonLd?.publisher?.name || a.publisher?.name;
    const article: Article = {
      id: String(a.id || a._id || id),
      title: a.title || jsonLd?.headline || 'Untitled',
      summary: a.summary || a.seo?.metaDescription || a.seo?.description || '',
      body: a.content || a.body || a.seo?.description || '',
      image: firstImage,
      images: Array.isArray(a.images) ? a.images : undefined,
      videoUrl: primaryVideo,
      author: {
        id: a.authorId || authorObj.id,
        name: authorName,
        avatar: authorAvatar,
        fullName: authorName,
        profilePhotoUrl: authorAvatar,
        roleName: authorObj.roleName || null,
        placeName: authorObj.placeName || null,
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
      canonicalUrl: a.canonicalUrl || a.seo?.canonical || jsonLd?.mainEntityOfPage?.['@id'] || jsonLd?.url || undefined,
      metaTitle: a.metaTitle || a.seo?.metaTitle || jsonLd?.headline || undefined,
      metaDescription: a.metaDescription || a.seo?.metaDescription || jsonLd?.description || undefined,
    } as Article;
    return article;
  } catch {
    return undefined;
  }
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
  const src = String(input || '');
  if (!src) return src;
  try {
    const mod: any = await import('sanscript');
    const Sanscript = mod?.default || mod;
    // Evaluate multiple roman schemes and pick the best coverage in target script
    const schemes: string[] = ['itrans', 'hk', 'iast', 'kolkata', 'slp1', 'velthuis', 'wx'];
    const ranges: Record<string, RegExp> = {
      devanagari: /[\u0900-\u097F]/,
      telugu: /[\u0C00-\u0C7F]/,
      tamil: /[\u0B80-\u0BFF]/,
      kannada: /[\u0C80-\u0CFF]/,
    };
    const r = ranges[target];
    let bestOut = '';
    let bestScore = -1;
    let bestScheme = '';
    for (const scheme of schemes) {
      try {
        const out = Sanscript.t(src, scheme as any, target);
        if (typeof out !== 'string' || !out) continue;
        // score: fraction of characters that are in target script vs letters in input
        const totalLetters = (src.match(/[A-Za-z]/g) || []).length || 1;
        const targetChars = (out.match(r) || []).length;
        const score = targetChars / totalLetters;
        if (score > bestScore || (score === bestScore && bestScheme === '')) {
          bestScore = score;
          bestOut = out;
          bestScheme = scheme;
        }
      } catch {}
    }
    if (bestOut && bestOut !== src) {
      if ((process.env.EXPO_PUBLIC_TRANSLIT_DEBUG || '').toString().match(/^(1|true|on|yes)$/i)) {
        try { console.log('[TX] best scheme', bestScheme, 'score', bestScore.toFixed(2), '→', bestOut.slice(0, 32)); } catch {}
      }
      return bestOut;
    }
    // Fallback to ITRANS even if unchanged
    const out = Sanscript.t(src, 'itrans', target);
    return typeof out === 'string' ? out : src;
  } catch {
    // If library not available, return original
    return src;
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
  // Small lexicon overrides for Telugu to match common expectations
  const teluguLexicon: Record<string, string> = target === 'telugu'
    ? {
        nenu: 'నేను',
        mee: 'మీ',
        nee: 'నీ',
        na: 'నా',
        meeru: 'మీరు',
        nagendra: 'నాగేంద్ర',
        reddy: 'రెడ్డి',
      }
    : {};

  for (const ch of chunks) {
    const isLatinWord = /^[A-Za-z]+$/.test(ch);
    const isSkippable = /^(https?:\/\/|\w+[\w.-]*@|`|\*|_|<|```)/.test(ch) || (/[^A-Za-z]/.test(ch) && !isLatinWord);
    if (isSkippable) {
      parts.push(ch);
      lastChar = ch.slice(-1) || lastChar;
      continue;
    }
    if (isLatinWord) {
      // Lexicon override for exact roman token (case-insensitive)
      const lower = ch.toLowerCase();
      const lex = teluguLexicon[lower];
      if (lex) {
        parts.push(lex);
        lastChar = lex.slice(-1) || lastChar;
        continue;
      }
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
  if ((process.env.EXPO_PUBLIC_TRANSLIT_DEBUG || '').toString().match(/^(1|true|on|yes)$/i)) {
    try { console.log('[TX] transliterateText', { code: targetLangCode, target, in: String(content).slice(0, 32), out: result.slice(0, 32) }); } catch {}
  }
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

// Comments API
export type CommentDTO = {
  id: string;
  user: { id: string; name: string; avatar: string };
  text: string;
  createdAt: string;
  likes: number;
  replies?: CommentDTO[];
  parentId?: string | null;
};

const COMMENTS_KEY = 'LOCAL_COMMENTS_STORE';
// Lightweight in-memory cache for comments per shortNewsId to speed up navigation
const COMMENTS_CACHE = new Map<string, CommentDTO[]>();
export function getCachedCommentsByShortNews(shortNewsId: string): CommentDTO[] | undefined {
  return COMMENTS_CACHE.get(shortNewsId);
}
export async function prefetchCommentsByShortNews(shortNewsId: string): Promise<void> {
  try {
    const data = await getCommentsByShortNews(shortNewsId);
    COMMENTS_CACHE.set(shortNewsId, data);
  } catch {
    // ignore prefetch errors
  }
}

// getBaseUrl provided by services/http

export async function getComments(articleId: string): Promise<CommentDTO[]> {
  try {
    if (await getMockMode()) {
      // Always use local storage in mock mode
      const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
      const all = JSON.parse(raw);
      return (all[articleId] || []) as CommentDTO[];
    }
    const json = await request<{ success?: boolean; data: CommentDTO[] }>(`/comments/article/${encodeURIComponent(articleId)}`);
    return (json.data || []) as CommentDTO[];
  } catch {
    // Fallback to local storage
    const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
    const all = JSON.parse(raw);
    return (all[articleId] || []) as CommentDTO[];
  }
}

// Map backend comment shape (content, nested user.profile) into CommentDTO
function mapServerComment(node: any): CommentDTO {
  const name = node?.user?.profile?.fullName || node?.user?.name || 'User';
  // Do not fake avatar; allow UI to fallback to initials when missing
  const avatar = node?.user?.profile?.profilePhotoUrl || node?.user?.avatar || '';
  const children: CommentDTO[] = Array.isArray(node?.replies) ? node.replies.map(mapServerComment) : [];
  return {
    id: String(node?.id || node?._id || Date.now()),
    user: { id: String(node?.userId || node?.user?.id || 'user'), name, avatar },
    text: String(node?.content || node?.text || ''),
    createdAt: String(node?.createdAt || new Date().toISOString()),
    likes: Number(node?.likes || 0),
    replies: children,
    parentId: node?.parentId ?? null,
  };
}

// Fetch comments by shortNewsId from backend: GET /comments?shortNewsId=...
export async function getCommentsByShortNews(shortNewsId: string): Promise<CommentDTO[]> {
  try {
    if (await getMockMode()) {
      const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
      const all = JSON.parse(raw);
      const list = (all[shortNewsId] || []) as CommentDTO[];
      COMMENTS_CACHE.set(shortNewsId, list);
      return list;
    }
    const params = new URLSearchParams({ shortNewsId });
    const json = await request<{ success?: boolean; data: any[] }>(`/comments?${params.toString()}`);
    const arr = Array.isArray(json?.data) ? json.data : [];
    const mapped = arr.map(mapServerComment);
    COMMENTS_CACHE.set(shortNewsId, mapped);
    return mapped;
  } catch {
    const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
    const all = JSON.parse(raw);
    const list = (all[shortNewsId] || []) as CommentDTO[];
    COMMENTS_CACHE.set(shortNewsId, list);
    return list;
  }
}

// -------- Legal / Privacy / Terms --------
export type LegalDoc = {
  id: string;
  title: string;
  content: string; // HTML
  version?: string;
  isActive?: boolean;
  language?: string;
  effectiveAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getPrivacyPolicy(languageCode: string = 'en'): Promise<LegalDoc> {
  // Use backend route /legal/privacy?language=en
  const params = new URLSearchParams({ language: languageCode });
  const json = await request<{ success?: boolean; data?: any }>(`/legal/privacy?${params.toString()}`, { method: 'GET', noAuth: true });
  const data: any = (json as any)?.data ?? json;
  if (!data || typeof data !== 'object') throw new Error('Invalid privacy policy response');
  return {
    id: String(data.id || data._id || 'privacy'),
    title: String(data.title || 'Privacy Policy'),
    content: String(data.content || ''),
    version: data.version,
    isActive: Boolean(data.isActive ?? true),
    language: data.language || languageCode,
    effectiveAt: data.effectiveAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getTerms(languageCode: string = 'en'): Promise<LegalDoc> {
  // Use backend route /legal/terms?language=en
  const params = new URLSearchParams({ language: languageCode });
  const json = await request<{ success?: boolean; data?: any }>(`/legal/terms?${params.toString()}`, { method: 'GET', noAuth: true });
  const data: any = (json as any)?.data ?? json;
  if (!data || typeof data !== 'object') throw new Error('Invalid terms response');
  return {
    id: String(data.id || data._id || 'terms'),
    title: String(data.title || 'Terms & Conditions'),
    content: String(data.content || ''),
    version: data.version,
    isActive: Boolean(data.isActive ?? true),
    language: data.language || languageCode,
    effectiveAt: data.effectiveAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function postComment(articleId: string, text: string, parentId?: string, user?: { id: string; name: string; avatar: string }): Promise<CommentDTO> {
  try {
    if (await getMockMode()) {
      // Short-circuit to local store in mock mode
      throw new Error('mock-mode');
    }
    const json = await request<{ success?: boolean; data: CommentDTO }>(`/comments`, {
      method: 'POST',
      body: { articleId, text, parentId, user },
    });
    return json.data as CommentDTO;
  } catch {
    // Fallback to local storage
    const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
    const all = JSON.parse(raw);
    const newNode: CommentDTO = {
      id: `${Date.now()}`,
      user: user || { id: 'guest', name: 'Guest', avatar: 'https://i.pravatar.cc/100' },
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: [],
    };
    all[articleId] = all[articleId] || [];
    const insert = (list: CommentDTO[], pid?: string): boolean => {
      if (!pid) return false;
      for (const item of list) {
        if (item.id === pid) {
          item.replies = item.replies || [];
          item.replies.push(newNode);
          return true;
        }
        if (item.replies && insert(item.replies, pid)) return true;
      }
      return false;
    };
    if (!parentId) {
      all[articleId].unshift(newNode);
    } else {
      insert(all[articleId], parentId);
    }
    await AsyncStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    return newNode;
  }
}

// Post a comment by shortNewsId to backend: POST /comments { shortNewsId, content, parentId }
export async function postCommentByShortNews(shortNewsId: string, text: string, parentId?: string): Promise<CommentDTO> {
  try {
    if (await getMockMode()) {
      throw new Error('mock-mode');
    }
    // include userId if present in tokens
    let userId: string | undefined;
    try {
      const t = await loadTokens();
      userId = t?.user?.id || t?.user?._id || t?.user?.userId;
    } catch {}
    const json = await request<{ success?: boolean; data: any }>(`/comments`, {
      method: 'POST',
      body: { shortNewsId, content: text, parentId: parentId || undefined, ...(userId ? { userId } : {}) },
    });
    return mapServerComment(json.data);
  } catch {
    const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
    const all = JSON.parse(raw);
    const newNode: CommentDTO = {
      id: `${Date.now()}`,
      user: { id: 'guest', name: 'Guest', avatar: 'https://i.pravatar.cc/100' },
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: [],
      parentId: parentId || null,
    };
    all[shortNewsId] = all[shortNewsId] || [];
    const insert = (list: CommentDTO[], pid?: string): boolean => {
      if (!pid) return false;
      for (const item of list) {
        if (item.id === pid) {
          item.replies = item.replies || [];
          item.replies.push(newNode);
          return true;
        }
        if (item.replies && insert(item.replies, pid)) return true;
      }
      return false;
    };
    if (!parentId) {
      all[shortNewsId].unshift(newNode);
    } else {
      insert(all[shortNewsId], parentId);
    }
    await AsyncStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    return newNode;
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


export async function getCategories(languageId?: string): Promise<CategoryItem[]> {
  // Resolve the effective language and normalize id/code using languages list
  let langId: string | undefined = languageId;
  let langCode: string | undefined;
  try {
    const eff = await resolveEffectiveLanguage();
    langId = langId || eff.id;
    langCode = eff.code;
  } catch {}

  // Normalize provided value: if it's a code, map to id; if it's an id, keep; if neither, try from effective code
  try {
    const langs = await getLanguages();
    if (langId) {
      const byId = langs.find((l) => String(l.id) === String(langId));
      if (!byId) {
        const byCode = langs.find((l) => String(l.code).toLowerCase() === String(langId).toLowerCase());
        if (byCode?.id) {
          try { console.log('[CAT] normalize code→id', { code: langId, id: byCode.id }); } catch {}
          langId = String(byCode.id);
          langCode = byCode.code || langCode;
        }
      } else {
        langCode = langCode || byId.code;
      }
    } else if (!langId && langCode) {
      const byCode = langs.find((l) => String(l.code).toLowerCase() === String(langCode).toLowerCase());
      if (byCode?.id) langId = String(byCode.id);
    }
  } catch {}

  if (!langId && !langCode) {
    try { console.warn('[CAT] getCategories: no language resolved'); } catch {}
    return [];
  }

  // Mock mode short-circuit to cached data (if any)
  const cacheKey = CATEGORIES_CACHE_KEY(String(langId || langCode));
  const cachedRaw = await AsyncStorage.getItem(cacheKey);
  const cached: CategoryItem[] | null = cachedRaw ? (() => { try { return JSON.parse(cachedRaw) as CategoryItem[]; } catch { return null; } })() : null;

  if (await getMockMode()) {
    try { console.log('[CAT] getCategories: mock mode, cached', { lang: langId || langCode, count: cached?.length || 0 }); } catch {}
    return cached || [];
  }

  const parseList = (res: any): any[] | null => {
    const arr = Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.categories)
      ? res.categories
      : Array.isArray(res?.data?.items)
      ? res.data.items
      : Array.isArray(res?.data?.categories)
      ? res.data.categories
      : null;
    return arr || null;
  };

  const toCategoryItems = (arr: any[]): CategoryItem[] =>
    (arr as any[]).map((x) => ({
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

  // Attempt sequence: languageId → language(code) → no param
  const attempts: { label: string; url: string }[] = [];
  if (langId) attempts.push({ label: 'languageId', url: `/categories?${new URLSearchParams({ languageId: String(langId) }).toString()}` });
  if (langCode) attempts.push({ label: 'language', url: `/categories?${new URLSearchParams({ language: String(langCode) }).toString()}` });
  attempts.push({ label: 'fallback', url: `/categories` });

  for (const a of attempts) {
    try {
      try { console.log('[CAT] GET', a.url); } catch {}
      const res = await request<any>(a.url, { noAuth: true });
      const arr = parseList(res);
      if (!arr) {
        try { console.warn('[CAT] invalid response shape', { attempt: a.label, keys: Object.keys(res || {}) }); } catch {}
        continue;
      }
      const list = toCategoryItems(arr);
      if (Array.isArray(list) && list.length > 0) {
        try { await AsyncStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
        try { console.log('[CAT] categories loaded', { attempt: a.label, count: list.length }); } catch {}
        return list;
      }
    } catch (e) {
      try { console.warn('[CAT] attempt failed', { attempt: a.label, message: (e as any)?.message || e }); } catch {}
      continue;
    }
  }

  if (cached && Array.isArray(cached)) return cached;
  return [];
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
export type RegisterResponse = { ok: boolean; id?: string; message?: string };
export async function registerUser(data: RegisterPayload): Promise<RegisterResponse> {
  try {
    const res = await request<any>('/auth/register', { method: 'POST', body: data });
    const payload = (res as any)?.data ?? res;
    const id: string | undefined = payload?.id || payload?._id || payload?.userId;
    const ok: boolean = payload?.ok !== undefined ? !!payload.ok : true;
    return { ok, id, message: payload?.message };
  } catch {
    // Mock accept any with state provided
    if (data.state) return { ok: true, id: `${Date.now()}` };
    return { ok: false, message: 'Registration failed' };
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
  title: string; // max 50 chars
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
  role?: 'CITIZEN_REPORTER' | 'MEMBER' | 'HRCI_ADMIN';
};
export type CreateShortNewsResponse = { id: string; url?: string; raw?: any };
// --- Idempotency & duplicate prevention helpers ---
const SN_INFLIGHT = new Map<string, Promise<CreateShortNewsResponse>>();
const SN_RECENT_KEY = 'shortnews_recent_submissions_v1';
const SN_RECENT_TTL_MS = 2 * 60 * 1000; // 2 minutes window to treat as duplicate

function normalizeWhitespace(s: string): string {
  return String(s || '').replace(/[\s\u00A0\t\r\n]+/g, ' ').trim();
}

function stableShortNewsKey(input: CreateShortNewsInput): string {
  const title = normalizeWhitespace(input.title).toLowerCase();
  const content = normalizeWhitespace(input.content).toLowerCase();
  const categoryId = String(input.categoryId || '');
  const languageId = String(input.languageId || '');
  const media = Array.isArray(input.mediaUrls) ? [...input.mediaUrls].filter(Boolean).map(String).sort() : [];
  // Do NOT include location or timestamps in key to avoid minor changes defeating dedupe
  const obj = { title, content, categoryId, languageId, media };
  const json = JSON.stringify(obj);
  // Simple 32-bit hash
  let h = 2166136261 >>> 0;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'sn_' + (h >>> 0).toString(16);
}

async function loadRecentShortNewsMap(): Promise<Record<string, { ts: number; res: CreateShortNewsResponse }>> {
  try {
    const raw = await AsyncStorage.getItem(SN_RECENT_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, { ts: number; res: CreateShortNewsResponse }>;
    const now = Date.now();
    // prune expired
    for (const k of Object.keys(map)) {
      if (!map[k] || (now - map[k].ts) > SN_RECENT_TTL_MS) delete map[k];
    }
    return map;
  } catch { return {}; }
}

async function saveRecentShortNews(key: string, res: CreateShortNewsResponse) {
  try {
    const now = Date.now();
    const raw = await AsyncStorage.getItem(SN_RECENT_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { ts: number; res: CreateShortNewsResponse }>) : {};
    map[key] = { ts: now, res };
    // Limit map size
    const entries = Object.entries(map);
    if (entries.length > 100) {
      entries.sort((a, b) => a[1].ts - b[1].ts);
      const trimmed = Object.fromEntries(entries.slice(entries.length - 100));
      await AsyncStorage.setItem(SN_RECENT_KEY, JSON.stringify(trimmed));
      return;
    }
    await AsyncStorage.setItem(SN_RECENT_KEY, JSON.stringify(map));
  } catch {}
}

export async function createShortNews(input: CreateShortNewsInput): Promise<CreateShortNewsResponse> {
  const t0 = Date.now();
  try {
    if (await getMockMode()) {
      return { id: `sn_${Date.now()}`, url: undefined, raw: { mock: true, input } };
    }
    // Idempotency: compute stable key for this content
    const idemKey = stableShortNewsKey(input);

    // 1) Return in-flight promise if same payload is already posting
    const inflightExisting = SN_INFLIGHT.get(idemKey);
    if (inflightExisting) {
      try { console.log('[API] createShortNews dedupe: returning in-flight result for', idemKey); } catch {}
      return await inflightExisting;
    }

    // 2) Quick local recent-cache check to avoid rapid re-posts
    const recentMap = await loadRecentShortNewsMap();
    const recent = recentMap[idemKey];
    if (recent && (Date.now() - recent.ts) <= SN_RECENT_TTL_MS) {
      try { console.log('[API] createShortNews dedupe: recent submission found for', idemKey); } catch {}
      return recent.res;
    }
    // Decide effective role: prefer authenticated user's role when allowed
    let effectiveRole: 'CITIZEN_REPORTER' | 'MEMBER' | 'HRCI_ADMIN' = 'CITIZEN_REPORTER';
    try {
      const t = await loadTokens();
      const roleUC = (t?.user?.role || '').toString().trim().toUpperCase();
      if (roleUC === 'CITIZEN_REPORTER' || roleUC === 'MEMBER' || roleUC === 'HRCI_ADMIN') {
        effectiveRole = roleUC as any;
      } else if (input.role) {
        const inUC = input.role.toString().trim().toUpperCase();
        if (inUC === 'CITIZEN_REPORTER' || inUC === 'MEMBER' || inUC === 'HRCI_ADMIN') effectiveRole = inUC as any;
      }
    } catch {}

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
      role: effectiveRole,
    };
    // Provide idempotency key to backend too (header and body), best-effort
    payload.idempotencyKey = idemKey;
    const requestOptions: any = { method: 'POST', body: payload, headers: { 'X-Idempotency-Key': idemKey } };
    if (DEBUG_API) {
      try {
        console.log('[API] createShortNews payload keys', Object.keys(payload));
      } catch {}
    }
    const promise = (async () => {
      try {
        const json = await request<any>('/shortnews', requestOptions);
        const data = (json as any)?.data ?? json;
        const id: string = data?.id || data?._id || `${Date.now()}`;
        const url: string | undefined = data?.url || data?.shareUrl || data?.permalink;
        const dt = Date.now() - t0;
        try { console.log('[API] createShortNews success', { id, ms: dt, mediaCount: Array.isArray(input.mediaUrls) ? input.mediaUrls.length : 0 }); } catch {}
        const res: CreateShortNewsResponse = { id: String(id), url, raw: data };
        // Save recent to avoid re-posting
        saveRecentShortNews(idemKey, res);
        return res;
      } finally {
        // Clear in-flight entry
        SN_INFLIGHT.delete(idemKey);
      }
    })();
    // Register in-flight promise for dedupe of concurrent taps
    SN_INFLIGHT.set(idemKey, promise);
    return await promise;
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
