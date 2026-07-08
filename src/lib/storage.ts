import type { User, BirthData, NatalChart, JournalEntry, HoroscopeEntry } from '../types';

const KEYS = {
  USER: 'celeste_user',
  JOURNAL: 'celeste_journal',
  HOROSCOPE_CACHE: 'celeste_horo_cache',
  ONBOARDED: 'celeste_onboarded',
};

export function getUser(): User {
  const raw = localStorage.getItem(KEYS.USER);
  if (raw) return JSON.parse(raw);
  return {
    email: '', name: '', birthData: null, natalChart: null,
    isPremium: false, scansRemaining: 3, trialStartedAt: null,
    premiumUntil: null, createdAt: Date.now(),
  };
}

export function saveUser(user: User): void {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export function setBirthData(birth: BirthData, chart: NatalChart): User {
  const user = getUser();
  user.birthData = birth;
  user.natalChart = chart;
  saveUser(user);
  return user;
}

export function activatePremium(plan: 'weekly' | 'yearly'): User {
  const user = getUser();
  user.isPremium = true;
  user.scansRemaining = 999;
  const days = plan === 'weekly' ? 7 : 365;
  user.premiumUntil = Date.now() + days * 86400000;
  if (plan === 'yearly') user.trialStartedAt = Date.now();
  saveUser(user);
  return user;
}

export function hasOnboarded(): boolean {
  return localStorage.getItem(KEYS.ONBOARDED) === 'true';
}

export function setOnboarded(): void {
  localStorage.setItem(KEYS.ONBOARDED, 'true');
}

export function logout(): User {
  localStorage.removeItem(KEYS.USER);
  localStorage.removeItem(KEYS.JOURNAL);
  localStorage.removeItem(KEYS.HOROSCOPE_CACHE);
  localStorage.removeItem(KEYS.ONBOARDED);
  return getUser();
}

// Journal
export function getJournal(): JournalEntry[] {
  const raw = localStorage.getItem(KEYS.JOURNAL);
  return raw ? JSON.parse(raw) : [];
}

export function addJournalEntry(entry: JournalEntry): void {
  const entries = getJournal();
  const idx = entries.findIndex(e => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);
  localStorage.setItem(KEYS.JOURNAL, JSON.stringify(entries));
}

// Horoscope cache
export function getCachedHoroscope(date: string): HoroscopeEntry | null {
  const raw = localStorage.getItem(KEYS.HOROSCOPE_CACHE);
  if (!raw) return null;
  const cache = JSON.parse(raw);
  return cache[date] || null;
}

export function cacheHoroscope(date: string, horoscope: HoroscopeEntry): void {
  const raw = localStorage.getItem(KEYS.HOROSCOPE_CACHE);
  const cache = raw ? JSON.parse(raw) : {};
  cache[date] = horoscope;
  localStorage.setItem(KEYS.HOROSCOPE_CACHE, JSON.stringify(cache));
}
