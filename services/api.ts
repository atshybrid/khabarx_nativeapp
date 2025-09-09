
import { Article } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

export const getNews = async (lang: string, category?: string): Promise<Article[]> => {
  try {
  const params = new URLSearchParams({ lang });
  if (category) params.set('category', category);
  const res = await fetch(`${getBaseUrl()}/news?${params.toString()}`);
    if (!res.ok) throw new Error('Failed');
    const json = await res.json();
    const list = (json.data || []) as any[];
    // Normalize to Article shape with safe defaults
    const normalized: Article[] = list.map((a) => ({
      id: String(a.id ?? a._id ?? Date.now()),
      title: a.title ?? 'Untitled',
      summary: a.summary ?? '',
      body: a.body ?? '',
      image: a.image || 'https://picsum.photos/800/1200',
      author: {
        id: a.author?.id,
        name: a.author?.name ?? 'Unknown',
        avatar: a.author?.avatar || 'https://i.pravatar.cc/100'
      },
      category: a.category ?? 'General',
      createdAt: a.createdAt ?? new Date().toISOString(),
      isRead: Boolean(a.isRead),
      likes: a.likes ?? 0,
      dislikes: a.dislikes ?? 0,
      comments: a.comments ?? 0,
      language: a.language,
      tags: a.tags ?? [],
    }));
    return normalized;
  } catch (e) {
    console.warn('getNews failed; falling back to mockArticles', e);
    return mockArticles;
  }
};

export const getArticleById = async (id: string): Promise<Article | undefined> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockArticles.find(article => article.id === id);
}

export const registerGuestUser = async (data: { languageId: string; deviceDetails: any }) => {
  try {
    console.log('Registering guest user with data:', data);
    const res = await fetch(`${getBaseUrl()}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: data.deviceDetails?.deviceId,
        languageId: data.languageId,
        platform: Platform.OS,
        deviceModel: data.deviceDetails?.deviceModel,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Map server response to expected shape
    return { jwt: json.token as string, refreshToken: json.refreshToken as string };
  } catch (e) {
    console.warn('registerGuestUser failed; returning mock tokens', e);
    return { jwt: 'mock-jwt-token', refreshToken: 'mock-refresh-token' };
  }
};

// Comments API
export type CommentDTO = {
  id: string;
  user: { id: string; name: string; avatar: string };
  text: string;
  createdAt: string;
  likes: number;
  replies?: CommentDTO[];
};

const COMMENTS_KEY = 'LOCAL_COMMENTS_STORE';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
// Resolve dev host from Expo's hostUri when available (works on LAN/USB devices)
const devHost = (Constants.expoConfig?.hostUri ?? '').split(':')[0];
const defaultHost = devHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
const getBaseUrl = () => ENV_URL || `http://${defaultHost}:3000`;

export async function getComments(articleId: string): Promise<CommentDTO[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/comments?articleId=${encodeURIComponent(articleId)}`);
    if (!res.ok) throw new Error('Failed');
    const json = await res.json();
    return json.data as CommentDTO[];
  } catch {
    // Fallback to local storage
    const raw = (await AsyncStorage.getItem(COMMENTS_KEY)) || '{}';
    const all = JSON.parse(raw);
    return (all[articleId] || []) as CommentDTO[];
  }
}

export async function postComment(articleId: string, text: string, parentId?: string, user?: { id: string; name: string; avatar: string }): Promise<CommentDTO> {
  try {
    const res = await fetch(`${getBaseUrl()}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, text, parentId, user }),
    });
    if (!res.ok) throw new Error('Failed');
    const json = await res.json();
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

// Auth APIs
export type CheckUserResponse = { exists: boolean };
export async function checkUserByMobile(mobile: string): Promise<CheckUserResponse> {
  try {
    const res = await fetch(`${getBaseUrl()}/auth/check?mobile=${encodeURIComponent(mobile)}`);
    if (!res.ok) throw new Error('Failed');
    return (await res.json()) as CheckUserResponse;
  } catch {
    // Mock: treat numbers ending with even digit as registered
    const last = mobile.trim().slice(-1);
    return { exists: !!last && Number(last) % 2 === 0 };
  }
}

export type LoginResponse = { token: string; role?: string; name?: string };
export async function loginWithMPIN(mobile: string, mpin: string): Promise<LoginResponse> {
  try {
    const res = await fetch(`${getBaseUrl()}/auth/login-mpin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, mpin }),
    });
    if (!res.ok) throw new Error('Failed');
    return (await res.json()) as LoginResponse;
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
    const res = await fetch(`${getBaseUrl()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed');
    return (await res.json()) as RegisterResponse;
  } catch {
    // Mock accept any with state provided
    if (data.state) return { ok: true, id: `${Date.now()}` };
    return { ok: false };
  }
}
