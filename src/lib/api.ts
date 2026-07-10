/**
 * CÉLESTE API CLIENT
 * 
 * Connects the React frontend to the Express backend.
 * Handles JWT auth, horoscope (LLM), compatibility (LLM), journal, and premium.
 */

import type { BirthData, JournalEntry } from '../types';

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

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
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
    }>('/horoscope', { method: 'POST' }),

  // Compatibility (LLM-powered)
  getCompatibility: (partnerBirthData: BirthData) =>
    apiCall<{
      score: number;
      title: string;
      strengths: string[];
      challenges: string[];
      description: string;
    }>('/compatibility', {
      method: 'POST',
      body: JSON.stringify({ partnerBirthData }),
    }),

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

  // Health check
  health: () => apiCall<{ status: string }>('/health'),
};
