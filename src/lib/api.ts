/**
 * CÉLESTE API CLIENT
 * 
 * Connects the React frontend to the Express backend.
 * Handles JWT auth, horoscope (LLM), compatibility (LLM), journal, and premium.
 */

import type { BirthData, JournalEntry } from '../types';
import { enqueue, drain } from './offlineQueue';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'celeste_jwt';

// ─── Token management ──────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function isMutation(method?: string) {
  const m = (method || 'GET').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror')
  );
}

// ─── HTTP helper ───────────────────────────────────
async function apiCall<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const method = (options.method || 'GET').toUpperCase() as
    | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  // Mutation + offline ⇒ enqueue et renvoie un fake ok
  if (isMutation(method) && typeof navigator !== 'undefined' && !navigator.onLine) {
    let bodyParsed: unknown = undefined;
    if (options.body && typeof options.body === 'string') {
      try { bodyParsed = JSON.parse(options.body); } catch { bodyParsed = options.body; }
    }
    enqueue({
      url: `${API_URL}${path}`,
      method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      body: bodyParsed,
      headers,
    });
    return { ok: true, queued: true, offline: true } as unknown as T;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    // Mutation + échec réseau en cours ⇒ enqueue aussi (mode offline opportuniste)
    if (isMutation(method)) {
      let bodyParsed: unknown = undefined;
      if (options.body && typeof options.body === 'string') {
        try { bodyParsed = JSON.parse(options.body); } catch { bodyParsed = options.body; }
      }
      enqueue({
        url: `${API_URL}${path}`,
        method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        body: bodyParsed,
        headers,
      });
      return { ok: true, queued: true, offline: true } as unknown as T;
    }
    if (isNetworkFailure(err)) throw err;
    throw err;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// À appeler depuis l'app au boot pour drainer la queue si online.
export async function flushOfflineQueue() {
  return drain();
}

// ─── Auth ──────────────────────────────────────────
export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    isPremium: boolean;
    scansRemaining: number;
    birthData?: BirthData | null;
    streak?: number;
  };
}

export const api = {
  // Auth
  register: (email: string, password: string) =>
    apiCall<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    apiCall<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Profile
  saveBirthData: (birthData: BirthData) =>
    apiCall('/profile/birth-data', {
      method: 'POST',
      body: JSON.stringify({ birthData }),
    }),

  getProfile: () =>
    apiCall<{
      id: number;
      email: string;
      isPremium: boolean;
      scansRemaining: number;
      birthData?: BirthData | null;
      premiumUntil?: number | null;
      streak?: number;
    }>('/profile'),

  // Horoscope (LLM-powered, cached server-side per day)
  getHoroscope: () =>
    apiCall<{
      general: string;
      amour: string;
      carriere: string;
      energie: number;
      mood: string;
      luckyNumber: number;
      luckyColor: string;
      scansRemaining?: number | null;
      streak?: number;
    }>('/horoscope', { method: 'POST' }),

  // Compatibility (LLM-powered) — supports romantic/family/friend/colleague contexts
  getCompatibility: (partnerBirthData: BirthData, context: 'romantic' | 'family' | 'friend' | 'colleague' = 'romantic') =>
    apiCall<{
      score: number;
      title: string;
      strengths: string[];
      challenges: string[];
      description: string;
      context?: string;
    }>('/compatibility', {
      method: 'POST',
      body: JSON.stringify({ partnerBirthData, context }),
    }),

  // Week horoscope summary (3 or 7 days)
  getWeekHoroscope: () =>
    apiCall<{
      days: Array<{
        date: string;
        offset: number;
        weekday: string;
        summary: {
          general: string;
          energie: number;
          mood: string;
          luckyColor: string;
        } | null;
        cached: boolean;
        error?: string;
      }>;
      isPremium: boolean;
      rangeDays: number;
      generated: number;
    }>('/horoscope/week', { method: 'GET' }),

  // Journal
  getJournal: () =>
    apiCall<JournalEntry[]>('/journal'),

  saveJournalEntry: (entry: Partial<JournalEntry>) =>
    apiCall('/journal', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  // Premium — DEPRECATED. Use payment.startCheckout() instead.
  // This endpoint now returns 402 (Payment Required) on the server.
  activatePremium: (plan: 'weekly' | 'annual') =>
    apiCall<{ isPremium: boolean; premiumUntil: number }>('/premium/activate', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),

  // Quick check: which sections of today are favorited (for UI stars)
  todayFavorites: () => apiCall<{ sections: string[] }>('/favorites/today'),
  toggleFavorite: (date: string, section: string, content: string) =>
    apiCall<{ ok: boolean; action: 'added' | 'removed'; id: number }>('/favorites', {
      method: 'POST',
      body: { date, section, content },
    }),
  listFavorites: (limit = 100) =>
    apiCall<{ favorites: { id: number; date: string; section: string; content: string; created_at: number }[] }>(`/favorites?limit=${limit}`),
  deleteFavorite: (id: number) =>
    apiCall<{ ok: boolean; deleted: number }>(`/favorites/${id}`, { method: 'DELETE' }),

  // Health check
  health: () => apiCall<{ status: string }>('/health'),

  // Transits of the day (Feature 6)
  getTransitsToday: () => apiCall<{
    date: string;
    transits: Record<string, { sign: string; degree: number; longitude: number; retrograde: boolean }>;
  }>('/transits/today'),

  // Daily Aspects (Feature 9)
  getDailyAspects: () => apiCall<{
    date: string;
    cached: boolean;
    aspects: Array<{
      p1: string; p2: string;
      p1Name: string; p2Name: string;
      p1Glyph: string; p2Glyph: string;
      aspect: string; aspectFr: string; aspectGlyph: string;
      nature: 'tension' | 'harmonique' | 'neutre';
      orb: number;
      interpretation: string;
      conseil: string;
    }>;
  }>('/aspects/today'),

  // ─── Notifications (Web Push) ───────────────────────────
  getVAPIDKey: () => apiCall<{ publicKey: string }>('/notifications/vapid-key'),

  getNotificationStatus: () => apiCall<{
    enabled: boolean;
    subscriptionCount: number;
    hour: number;
    lastSent: string | null;
  }>('/notifications/status'),

  subscribeToNotifications: (data: {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    hour?: number;
  }) => apiCall<{ ok: true }>('/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  unsubscribeFromNotifications: (data: { endpoint?: string }) =>
    apiCall<{ ok: true }>('/notifications/unsubscribe', {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  updateNotificationHour: (hour: number) =>
    apiCall<{ ok: true }>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ hour }),
    }),

  testNotification: () =>
    apiCall<{ sent: number; total: number }>('/notifications/test', {
      method: 'POST',
      body: '{}',
    }),

  // ─── Multi-profiles (Feature 8) ──────────────────────────
  listProfiles: () => apiCall<{
    profiles: {
      id: number;
      name: string;
      relation: string;
      isSelf: boolean;
      birthData: { date: string; time: string; city: string; country?: string; latitude: number; longitude: number; timezone: number };
      createdAt: number;
    }[];
  }>('/profiles'),

  getProfileById: (id: number) => apiCall<{
    id: number;
    name: string;
    relation: string;
    isSelf: boolean;
    birthData: { date: string; time: string; city: string; country?: string; latitude: number; longitude: number; timezone: number };
    createdAt: number;
  }>(`/profiles/${id}`),

  createProfile: (data: {
    name: string;
    relation: string;
    birthData: { date: string; time: string; city: string; country?: string; latitude: number; longitude: number; timezone: number };
    isSelf?: boolean;
  }) => apiCall<{ ok: true; id: number }>('/profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateProfile: (id: number, data: {
    name?: string;
    relation?: string;
    birthData?: { date: string; time: string; city: string; country?: string; latitude: number; longitude: number; timezone: number };
    isSelf?: boolean;
  }) => apiCall<{ ok: true }>(`/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  deleteProfile: (id: number) =>
    apiCall<{ ok: true }>(`/profiles/${id}`, { method: 'DELETE' }),

  // ─── Daily Rituals (Feature A1) ───────────────────────
  getRitualToday: () => apiCall<{
    date: string;
    morningCard: string;
    eveningIntention: string;
    completedMorning: boolean;
    completedEvening: boolean;
  }>('/rituals/today'),

  completeRitual: (period: 'morning' | 'evening') =>
    apiCall<{ ok: true; period: string; date: string }>('/rituals/today/complete', {
      method: 'POST',
      body: JSON.stringify({ period }),
    }),

  getRitualHistory: (days = 7) =>
    apiCall<{
      days: Array<{ date: string; completed_morning: number; completed_evening: number }>;
    }>(`/rituals/history?days=${days}`),

  // ─── Onboarding Progress (Feature A2) ────────────────
  getOnboarding: () => apiCall<{
    steps: Array<{ key: string; label: string; icon: string; completed: boolean }>;
    dismissed: boolean;
    completedCount: number;
    totalCount: number;
  }>('/onboarding/progress'),

  markOnboardingStep: (step: string) =>
    apiCall<{ ok: true; step: string; completed: Record<string, boolean> }>(
      '/onboarding/step',
      { method: 'POST', body: JSON.stringify({ step }) }
    ),

  dismissOnboarding: () =>
    apiCall<{ ok: true }>('/onboarding/dismiss', { method: 'POST' }),

  // ─── Premium Status (Feature A3) ────────────────────
  getPremiumStatus: () => apiCall<{
    isPremium: boolean;
    plan: 'free' | 'monthly' | 'yearly' | 'lifetime';
    premiumUntil: string | null;
    daysRemaining: number | null;
    benefits: string[];
  }>('/premium/status'),

  // ─── Astrological Houses (Feature B1) ─────────────────
  getHouses: () => apiCall<{
    system: string;
    ascendant: { sign: string; degree: number; absDeg: number };
    sunSign: string;
    houses: Array<{
      num: number;
      sign: string;
      degree: number;
      absDeg: number;
      theme: string;
    }>;
    interpretation: string | null;
    generatedAt: string;
  }>('/chart/houses'),

  // ─── Asteroids (Feature B2) ────────────────────────
  getAsteroids: () => apiCall<{
    positions: Array<{
      key: string;
      name: string;
      theme: string;
      sign: string;
      degree: number;
      absDeg: number;
    }>;
    interpretation: string | null;
    generatedAt: string;
  }>('/chart/asteroids'),

  // ─── Lunar Nodes (Feature B3) ──────────────────────
  getLunarNodes: () => apiCall<{
    northNode: { sign: string; degree: number; absDeg: number; role: string };
    southNode: { sign: string; degree: number; absDeg: number; role: string };
    interpretation: string | null;
    generatedAt: string;
  }>('/chart/lunar-nodes'),

  // ─── Weekly Challenge (Feature C3) ─────────────────
  getWeeklyChallenge: () => apiCall<{
    weekId: string;             // 'YYYY-Www' e.g. '2026-28'
    theme: string;              // ex: "Vulnérabilité"
    action: string;             // ex: "Partage un souvenir personnel..."
    explanation: string;        // pourquoi ce défi (astro)
    completed: boolean;
    reflectionNote: string | null;
    generatedAt: string;
  }>('/challenge/week'),
  completeWeeklyChallenge: (note: string) => apiCall<{ ok: true }>('/challenge/week/complete', {
    method: 'POST',
    body: { note }
  }),

  // ─── Moon phase (public — Home widget) ──────────────────
  // Server uses astronomy-engine for ±1h precision. Cached at hour granularity.
  getMoonPhase: () => apiCall<{
    name: string;
    emoji: string;
    description: string;
    age: number;
    date: string;
  }>('/astro/moon-phase'),
};
