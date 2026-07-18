import type { User, BirthData, NatalChart, JournalEntry, HoroscopeEntry } from '../types';

/**
 * Local date as YYYY-MM-DD. Uses local timezone (not UTC) so that
 * streaks, calendar entries, and cache keys match the user's actual day.
 * `new Date().toISOString().split('T')[0]` shifts dates for non-UTC users.
 */
export function localISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const KEYS = {
  USER: 'celeste_user',
  JWT: 'celeste_jwt',
  JOURNAL: 'celeste_journal',
  HOROSCOPE_CACHE: 'celeste_horo_cache',
  ONBOARDED: 'celeste_onboarded',
  OFFLINE_QUEUE: 'celeste:offline_queue:v1',
};

/**
 * Safely parse JSON from localStorage. Returns `fallback` if the value is
 * missing, malformed, or not a string. Prevents the whole app from crashing
 * on corrupted storage (e.g. quota errors, manual edits, partial writes).
 */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    // Guard against JSON.parse returning null or non-object primitives
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_USER: User = {
  email: '', name: '', birthData: null, natalChart: null,
  isPremium: false, scansRemaining: 3, trialStartedAt: null,
  premiumUntil: null, createdAt: Date.now(),
};

export function getUser(): User {
  return safeParse<User | null>(localStorage.getItem(KEYS.USER), DEFAULT_USER) || DEFAULT_USER;
}

export function saveUser(user: User): void {
  try {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
  } catch (err) {
    // QuotaExceededError or storage disabled — silently fail, app keeps working
    console.warn('[storage] Failed to save user:', err);
  }
}

export function setBirthData(birth: BirthData, chart: NatalChart): User {
  const user = getUser();
  user.birthData = birth;
  user.natalChart = chart;
  saveUser(user);
  return user;
}

// ⚠️ REMOVED — use Stripe checkout via /api/billing/create-checkout instead.
// This function used to set isPremium locally, which bypassed the server and
// is no longer functional. Premium is now 100% server-side via Stripe webhook.
// Kept as a stub that returns the current user (for any stray imports) but
// does NOT modify any premium state.
export function activatePremium(_plan: 'monthly' | 'yearly'): User {
  console.warn('[storage] activatePremium() is deprecated and no longer has any effect. Use Stripe checkout.');
  return getUser();
}

export function hasOnboarded(): boolean {
  return localStorage.getItem(KEYS.ONBOARDED) === 'true';
}

export function setOnboarded(): void {
  try {
    localStorage.setItem(KEYS.ONBOARDED, 'true');
  } catch {
    // ignore
  }
}

export function logout(): User {
  try {
    // P0 #1 — Le logout ne supprimait PAS le JWT, donc l'utilisateur
    // restait connecté après reload. Fix : on clear tout maintenant.
    // P0 #7 — On vide aussi la offline queue pour éviter les actions
    // cross-user (un autre login rejouerait les mutations).
    localStorage.removeItem(KEYS.USER);
    localStorage.removeItem(KEYS.JWT);
    localStorage.removeItem(KEYS.JOURNAL);
    localStorage.removeItem(KEYS.HOROSCOPE_CACHE);
    localStorage.removeItem(KEYS.ONBOARDED);
    localStorage.removeItem(KEYS.OFFLINE_QUEUE);
  } catch {
    // ignore
  }
  return getUser();
}

// Journal
export function getJournal(): JournalEntry[] {
  const parsed = safeParse<JournalEntry[] | null>(localStorage.getItem(KEYS.JOURNAL), null);
  return Array.isArray(parsed) ? parsed : [];
}

export function addJournalEntry(entry: JournalEntry): void {
  const entries = getJournal();
  const idx = entries.findIndex(e => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);
  // P0 #13 — Suppression du no-op write (saveUser sans modification réelle).
  try {
    localStorage.setItem(KEYS.JOURNAL, JSON.stringify(entries));
  } catch (err) {
    console.warn('[storage] Failed to save journal entry:', err);
  }
}

// Freemium usage tracking (non-premium users)
const FREE_SCANS = 'celeste_free_scans';       // horoscope consultations
const FREE_COMPAT = 'celeste_free_compat';     // compatibility analyses

function safeReadNumber(key: string): number {
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function getFreeScans(): number {
  return safeReadNumber(FREE_SCANS);
}
export function incrementFreeScans(): number {
  const n = getFreeScans() + 1;
  try { localStorage.setItem(FREE_SCANS, String(n)); } catch { /* ignore */ }
  return n;
}
export function getFreeCompat(): number {
  return safeReadNumber(FREE_COMPAT);
}
export function incrementFreeCompat(): number {
  const n = getFreeCompat() + 1;
  try { localStorage.setItem(FREE_COMPAT, String(n)); } catch { /* ignore */ }
  return n;
}

// Horoscope cache
export function getCachedHoroscope(date: string): HoroscopeEntry | null {
  const cache = safeParse<Record<string, HoroscopeEntry> | null>(
    localStorage.getItem(KEYS.HOROSCOPE_CACHE),
    null
  );
  if (!cache || typeof cache !== 'object') return null;
  return cache[date] || null;
}

export function cacheHoroscope(date: string, horoscope: HoroscopeEntry): void {
  const cache = safeParse<Record<string, HoroscopeEntry> | null>(
    localStorage.getItem(KEYS.HOROSCOPE_CACHE),
    {}
  ) || {};
  cache[date] = horoscope;
  try {
    localStorage.setItem(KEYS.HOROSCOPE_CACHE, JSON.stringify(cache));
  } catch (err) {
    console.warn('[storage] Failed to cache horoscope:', err);
  }
}

// v13 — Le Rituel Quotidien : tracking de "l'horoscope a été lu" sans serveur.
// Sert à cadencer les futures relances (ex : "tu n'as pas fini ton rituel hier")
// et à ne pas re-déclencher la bannière push si déjà lue aujourd'hui.
const READ_KEY = 'celeste_horoscope_read';
export function markHoroscopeRead(date?: string): void {
  try {
    const today = date || localISODate();
    localStorage.setItem(READ_KEY, JSON.stringify({ date: today, ts: Date.now() }));
  } catch { /* ignore */ }
}
export function getLastRead(date: string): { ts: number } | null {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.date === date) return { ts: parsed.ts };
  } catch { /* ignore */ }
  return null;
}
export function wasReadToday(): boolean {
  return getLastRead(localISODate()) !== null;
}