/**
 * CÉLESTE API CLIENT
 * 
 * Connects the React frontend to the Express backend.
 * Handles JWT auth, horoscope (LLM), compatibility (LLM), journal, and premium.
 */

import type { BirthData, JournalEntry, CompatibilityResult } from '../types';
import { enqueue, drain } from './offlineQueue';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'celeste_jwt';

// Helper: extract message from unknown error
export function errMsg(e: unknown, fallback = 'Une erreur est survenue'): string {
  return e instanceof Error ? e.message : fallback;
}

// ─── Token management ──────────────────────────────
const REFRESH_TOKEN_KEY = 'celeste_refresh';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

// ─── Token refresh (singleton to avoid parallel refresh races) ──
let refreshPromise: Promise<string> | null = null;

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  // Singleton: if a refresh is already in flight, piggyback on it
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      setToken(data.token);
      setRefreshToken(data.refreshToken);
      return data.token as string;
    } catch {
      // Refresh failed — clear everything, user must re-login
      clearToken();
      return '';
    } finally {
      refreshPromise = null;
    }
  })();

  const newToken = await refreshPromise;
  return newToken || null;
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
const DEFAULT_TIMEOUT_MS = 20_000; // 20s pour endpoints classiques
const LLM_TIMEOUT_MS = 90_000;    // 90s pour les endpoints LLM (planet interpretation, horoscope)

async function apiCall<T = any>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  opts: { bypassOfflineQueue?: boolean; __retried?: boolean } = {},
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
  // SAuf pour les opérations critiques (deleteAccount) qui ne doivent JAMAIS
  // être mises en file — elles doivent échouer bruyamment pour que l'utilisateur sache.
  if (!opts.bypassOfflineQueue && isMutation(method) && typeof navigator !== 'undefined' && !navigator.onLine) {
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

  // Timeout via AbortController pour ne pas bloquer l'UI sur un LLM lent
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(tid);
    // Mutation + échec réseau en cours ⇒ enqueue aussi (mode offline opportuniste)
    // Sauf bypass (deleteAccount)
    if (!opts.bypassOfflineQueue && isMutation(method)) {
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
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Requête trop longue (>${Math.round(timeoutMs/1000)}s). Réessayez dans quelques secondes, le serveur calcule.`);
    }
    if (isNetworkFailure(err)) throw err;
    throw err;
  }
  clearTimeout(tid);

  if (!res.ok) {
    // 401 → try refresh once, then retry the original request
    if (res.status === 401 && !opts.__retried) {
      const newToken = await tryRefresh();
      if (newToken) {
        return apiCall<T>(path, {
          ...options,
          headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
        }, timeoutMs, { ...opts, __retried: true } as any);
      }
    }
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
  refreshToken: string;
  user: {
    id: number;
    email: string;
    isPremium: boolean;
    scansRemaining: number;
    birthData?: BirthData | null;
    streak?: number;
  };
}

export type LunarIntention = {
  id: number;
  cycleDate: string;
  phase: string;
  intentionText: string;
  status: 'active' | 'manifested' | 'released';
  reflectionText: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export const api = {
  // Auth — CRITIQUES : bypassOfflineQueue. Si offline, on échoue bruyamment
  // (l'utilisateur ne doit pas croire qu'il est loggué alors que la requête attend).
  register: async (email: string, password: string, ref?: string) => {
    const body: Record<string, string> = { email, password };
    if (ref) body.ref = ref;
    const res = await apiCall<AuthResponse & { refRewardDays?: number }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }, DEFAULT_TIMEOUT_MS, { bypassOfflineQueue: true });
    setToken(res.token);
    setRefreshToken(res.refreshToken);
    return res;
  },

  login: async (email: string, password: string) => {
    const res = await apiCall<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, DEFAULT_TIMEOUT_MS, { bypassOfflineQueue: true });
    setToken(res.token);
    setRefreshToken(res.refreshToken);
    return res;
  },

  logout: async () => {
    const refreshToken = getRefreshToken();
    try {
      await apiCall<{ ok: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }, DEFAULT_TIMEOUT_MS, { bypassOfflineQueue: true });
    } finally {
      // Always clear locally, even if server call fails
      clearToken();
    }
    return { ok: true };
  },

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
      isFallback?: boolean;
    }>('/horoscope', { method: 'POST' }, LLM_TIMEOUT_MS),

  // Daily Tarot draw (cached per day, 1 card per day)
  getDailyTarot: () =>
    apiCall<{
      cardName: string;
      cardId: number;
      roman: string;
      emoji: string;
      isReversed: boolean;
      archetype: string;
      message: string;
      question: string;
      reading: string;
    }>('/tarot/daily', { method: 'GET' }),

  // Compatibility (LLM-powered) — supports romantic/family/friend/colleague contexts
  getCompatibility: (partnerBirthData: BirthData, context: 'romantic' | 'family' | 'friend' | 'colleague' = 'romantic') =>
    apiCall<CompatibilityResult>('/compatibility', {
      method: 'POST',
      body: JSON.stringify({ partnerBirthData, context }),
    }),

  // Horoscope history (v13.1 — J-7 → J passé uniquement, pas de prédiction future)
  getWeekHoroscope: () =>
    apiCall<{
      days: Array<{
        date: string;
        offset: number;
        weekday: string;
        weekdayLong?: string;
        summary: {
          general: string;
          energie: number;
          mood: string;
          luckyColor: string;
        } | null;
        consulted: boolean;
        cached?: boolean;
        error?: string;
      }>;
      isPremium: boolean;
      rangeDays: number;
      consultedCount: number;
      streak: number;
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
  activatePremium: (plan: 'monthly' | 'annual') =>
    apiCall<{ isPremium: boolean; premiumUntil: number }>('/premium/activate', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),

  // Quick check: which sections of today are favorited (for UI stars)
  todayFavorites: () => apiCall<{ sections: string[] }>('/favorites/today'),
  toggleFavorite: (date: string, section: string, content: string) =>
    apiCall<{ ok: boolean; action: 'added' | 'removed'; id: number }>('/favorites', {
      method: 'POST',
      body: JSON.stringify({ date, section, content }),
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

  // Natal chart — full data for premium wheel
  getNatalChart: () => apiCall<{
    natal: Record<string, {
      sign?: string; degree?: number; longitude: number; retrograde?: boolean;
    }> & {
      ascendant?: { sign: string; degree: number; longitude: number };
      midheaven?: { sign: string; degree: number; longitude: number };
      northNode?: { sign: string; degree: number; longitude: number };
      southNode?: { longitude: number };
      houses?: Array<{ number: number; cusp: number; sign: string }>;
      aspects?: Array<{ p1: string; p2: string; type: string; angle: number; orb: number; color: string }>;
    };
  }>('/natal-chart'),

  // Planet interpretation (LLM-generated, cached per user)
  getPlanetInterpretation: (planet: string) => apiCall<{
    planet: string;
    planetName: string;
    symbol: string;
    sign: string;
    element: string;
    degree: number;
    degreeStr: string;
    retrograde: boolean;
    house: number;
    aspects: Array<{ other: string; otherName: string; aspectName: string; text: string; orb: number; color: string }>;
    general: string;
    inSign: string;
    degree_symbolism?: string;
    degree2?: string;
    degreeText?: string;
    temperament: string;
    characterology: string;
    keywords: string[];
  }>(`/natal-chart/planet/${planet}`, {}, LLM_TIMEOUT_MS),

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
    // Fix #6 — TZ navigateur du user pour notif à l'heure LOCALE (sinon UTC brut)
    timezone?: string;
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

  // ─── Billing (Stripe) ─────────────────────────────
  startCheckout: (plan: 'monthly' | 'yearly') => apiCall<{ url: string; sessionId: string }>('/billing/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  }, 30_000),
  openPortal: () => apiCall<{ url: string }>('/billing/portal', {
    method: 'POST',
    body: '{}',
  }, 30_000),

  // Fix #2 — Restore Purchases (obligatoire iOS, App Store Guideline 3.1.5)
  restorePurchases: () => apiCall<{
    restored: boolean;
    configured: boolean;
    isPremium: boolean;
    premiumUntil?: number;
    message?: string;
  }>('/billing/restore', {
    method: 'POST',
    body: '{}',
  }, 30_000),

  // Fix #2 — expose Stripe-configured au client pour afficher le bon message dans le Paywall
  getBillingStatus: () => apiCall<{ configured: boolean }>('/billing/status', {}, 5_000),

  // ─── P0#6 — Email verification (Resend) ─────────────────
  getEmailStatus: () => apiCall<{
    emailVerified: boolean;
    isEmailConfigured: boolean;
  }>('/auth/email-status', {}, 5_000),
  resendVerification: () => apiCall<{ ok: true }>('/auth/resend-verification', {
    method: 'POST',
    body: '{}',
  }, 10_000),

  // ─── P1#7 — Referral program ─────────────────────────────
  getReferralCode: () => apiCall<{
    code: string;
    referralsCount: number;
    daysEarned: number;
    rewardPerReferral: number;
  }>('/referrals/code', {}, 5_000),

  // ─── P0#4 — Streak freeze (IAP) ───────────────────────
  getStreakStatus: () => apiCall<{
    count: number;
    lastDate: string | null;
    freezesAvailable: number;
    nextFreeReset: string | null;
  }>('/streak', {}, 5_000),
  buyStreakFreeze: (quantity = 1) => apiCall<{ ok: true; freezesAvailable: number }>(
    '/streak/freeze',
    { method: 'POST', body: JSON.stringify({ quantity }) },
    15_000
  ),

  // Fix #1 — RGPD Art. 17 (droit à l'effacement)
  deleteAccount: () => apiCall<{ ok: true; deletedAt: string }>('/account', {
    method: 'DELETE',
  }, 15_000, { bypassOfflineQueue: true }),

  // RGPD Art. 20 — portabilité des données
  exportAccount: () => apiCall<Record<string, unknown>>('/account/export', {
    method: 'GET',
  }, 15_000, { bypassOfflineQueue: true }),

  // ─── Daily Energy (personalized astro-forecast + reflection) ──
  getDailyEnergy: () => apiCall<{
    date: string;
    headline: string;
    energy: { score: number; label: string; emoji: string; advice: string };
    goodFor: string[];
    avoid: string[];
    reflectionPrompt: string;
    reflectionText: string;
  }>('/daily-energy', { method: 'GET' }, 30_000),

  saveReflection: (reflectionText: string) => apiCall<{ ok: true }>('/daily-energy/reflection', {
    method: 'POST',
    body: JSON.stringify({ reflectionText }),
  }),

  getDailyEnergyHistory: (limit?: number) => apiCall<{ entries: Array<{ date: string; headline: string; energy_score: number; energy_label: string; energy_emoji: string; reflection_prompt: string; reflection_text: string }> }>('/daily-energy/history' + (limit ? `?limit=${limit}` : ''), { method: 'GET' }),

  // ─── Lunar Cycle (intentions + full moon review) ────────────
  getLunarStatus: () => apiCall<{
    moonPhase: { name: string; emoji: string; description: string; age: number };
    cycleDate: string;
    intentions: LunarIntention[];
    isNewMoonWindow: boolean;
    isFullMoonWindow: boolean;
    isWaning: boolean;
    canSetIntention: boolean;
    canReview: boolean;
  }>('/lunar-cycle/status', { method: 'GET' }),

  setLunarIntention: (intentionText: string) => apiCall<LunarIntention>('/lunar-cycle/intention', {
    method: 'POST',
    body: JSON.stringify({ intentionText }),
  }),

  reviewLunarIntention: (id: number, status: 'manifested' | 'released' | 'active', reflectionText?: string) => apiCall<LunarIntention>(`/lunar-cycle/intention/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, reflectionText }),
  }),

  deleteLunarIntention: (id: number) => apiCall<{ ok: true }>(`/lunar-cycle/intention/${id}`, {
    method: 'DELETE',
  }),

  getLunarHistory: (limit?: number) => apiCall<{ intentions: LunarIntention[] }>('/lunar-cycle/history' + (limit ? `?limit=${limit}` : ''), { method: 'GET' }),

  // ─── Mood Tracker ────────────────────────────────────────────
  moodCheckin: (moodEmoji: string, moodScore: number, energyScore: number, note?: string) => apiCall<{ ok: true; date: string }>('/mood/checkin', {
    method: 'POST',
    body: JSON.stringify({ moodEmoji, moodScore, energyScore, note }),
  }),

  getMoodToday: () => apiCall<{ checkedIn: boolean; moodEmoji?: string; moodScore?: number; energyScore?: number; note?: string }>('/mood/today', { method: 'GET' }),

  getMoodStats: (days?: number) => apiCall<{
    totalCheckins: number;
    avgMood?: number;
    avgEnergy?: number;
    checkins?: Array<{ date: string; mood_emoji: string; mood_score: number; energy_score: number; note?: string }>;
    insights?: {
      type: string;
      bestElement: string;
      bestAvgMood: number;
      worstElement: string;
      worstAvgMood: number;
      insight: string;
    } | null;
  }>('/mood/stats' + (days ? `?days=${days}` : ''), { method: 'GET' }),
  verifySession: (sessionId: string) => apiCall<{ status: string; paymentStatus: string; subscriptionId: string | null }>(`/billing/verify-session`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  }),

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
    body: JSON.stringify({ note })
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

  // ─── Gamification ─────────────────────────────────────────
  getGamificationStatus: () => apiCall<{
    xp: number;
    level: number;
    levelTitle: string;
    xpIntoLevel: number;
    xpForNext: number;
    progressPct: number;
    quests: { quest_key: string; quest_label: string; xp_reward: number; completed: boolean }[];
    badges: { id: string; emoji: string; title: string; desc: string; earned: boolean }[];
    badgesEarned: number;
    badgesTotal: number;
    questsCompleted: number;
    questsTotal: number;
  }>('/gamification/status'),

  completeQuest: (questKey: string) => apiCall<{
    ok: boolean;
    xpAwarded: number;
    newLevel: number;
    leveledUp: boolean;
  }>(`/gamification/quest/${questKey}/complete`, { method: 'POST' }),

  getBadges: () => apiCall<{
    badges: { id: string; emoji: string; title: string; desc: string; earned: boolean; earnedAt: number | null }[];
    earnedCount: number;
    totalCount: number;
  }>('/gamification/badges'),

  // ─── Cosmic Calendar ──────────────────────────────────────
  getCosmicEvents: () => apiCall<{
    events: { date: string; type: string; title: string; description: string; emoji: string }[];
  }>('/astro/events'),

  // ─── Astrological Portrait ────────────────────────────────
  getAstroPortrait: () => apiCall<{
    portrait: string;
    wordCount: number;
    cached: boolean;
  }>('/natal-chart/portrait'),

  // P2#15 — Yearly Recap
  getYearlyRecap: (year?: number) => apiCall<{
    year: number;
    questsCompleted: number;
    xpEarned: number;
    journalEntries: number;
    cardsDrawn: number;
    runesDrawn: number;
    longestStreak: number;
    badgesUnlocked: number;
    moodWord?: string;
    joinedDate: string;
  }>(`/yearly-recap${year ? `?year=${year}` : ''}`),

  // P2#19 — Contenu curated hebdomadaire
  getWeeklyContent: () => apiCall<{
    week_start: string;
    theme: string;
    emoji: string;
    headline: string;
    body: string;
    ritual: string | null;
    reflection: string | null;
    published_at: number;
  }>('/weekly-content'),

  // P2#20 — Transit comments (communauté)
  getTransitComments: (date: string, key: string) => apiCall<Array<{
    id: number;
    display_name: string;
    content: string;
    likes_count: number;
    created_at: number;
    liked: number;
  }>>(`/transit-comments?date=${encodeURIComponent(date)}&key=${encodeURIComponent(key)}`),

  postTransitComment: (date: string, key: string, content: string) => apiCall<{
    id: number;
    display_name: string;
    content: string;
    likes_count: number;
    created_at: number;
    liked: number;
  }>('/transit-comments', {
    method: 'POST',
    body: JSON.stringify({ date, key, content }),
  }),

  deleteTransitComment: (id: number) => apiCall<{ ok: boolean }>(`/transit-comments/${id}`, {
    method: 'DELETE',
  }),

  toggleCommentLike: (id: number) => apiCall<{ liked: boolean }>(`/transit-comments/${id}/like`, {
    method: 'POST',
  }),

  updateDisplayName: (display_name: string) => apiCall<{ ok: boolean; display_name: string }>(
    '/account/display-name',
    { method: 'POST', body: JSON.stringify({ display_name }) }
  ),

  // ─── Horoscope Feedback ───────────────────────────────────
  submitHoroscopeFeedback: (rating: number, note?: string) => apiCall<{ ok: boolean }>('/horoscope/feedback', {
    method: 'POST',
    body: JSON.stringify({ rating, note }),
  }),

  // ─── Personal Transits (refonte "Aspects du jour") ─────────
  getPersonalTransits: () => apiCall<{
    date: string;
    headline: string;
    flowScore: number;
    challengeScore: number;
    aspects: Array<{
      transitPlanet: string;
      natalPlanet: string;
      transitPlanetFr: string;
      natalPlanetFr: string;
      transitGlyph: string;
      natalGlyph: string;
      aspect: string;
      aspectFr: string;
      aspectGlyph: string;
      nature: 'tension' | 'harmonique' | 'neutre';
      orb: number;
      exact: boolean;
      transitRetrograde: boolean;
      interpretation: string;
      conseil: string;
    }>;
  }>('/personal-transits', { method: 'GET' }),

  // ─── Activated Houses (refonte "Maisons natales") ──────────
  getActivatedHouses: () => apiCall<{
    date: string;
    headline: string;
    houses: Array<{
      num: number;
      theme: string;
      icon: string;
      short: string;
      sign: string;
      activated: boolean;
      natalPlanets: Array<{ key: string; name: string; glyph: string; sign: string; degree: number; }>;
      transitPlanets: Array<{ key: string; name: string; glyph: string; sign: string; degree: number; retrograde?: boolean; }>;
      insight: string;
      action: string;
    }>;
  }>('/activated-houses', { method: 'GET' }, LLM_TIMEOUT_MS),

  // ─── Asteroid Wisdom (refonte "Astéroïdes natals") ─────────
  getAsteroidWisdom: () => apiCall<{
    headline: string;
    archetypes: Array<{
      key: string;
      name: string;
      archetype: string;
      icon: string;
      sign: string;
      degree: number;
      glyph: string;
      title?: string;
      meaning?: string;
      gift?: string;
      shadow?: string;
      practice?: string;
    }>;
    generatedAt?: string;
    cached?: boolean;
  }>('/asteroid-wisdom', { method: 'GET' }),
};
