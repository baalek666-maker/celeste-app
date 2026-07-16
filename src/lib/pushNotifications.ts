/**
 * pushNotifications.ts — rappels quotidiens persistants via Service Worker (Piste #4 audit).
 *
 * Stratégie :
 * 1. Demande permission à l'utilisateur (après interaction, contexte = bouton opt-in)
 * 2. Enregistre /sw.js (déjà présent dans public/, gère push + notificationclick + offline cache)
 * 3. Schedule des notifications aux heures clés : 7h30 (matin), 18h (tarot soir), 22h (rituel coucher)
 * 4. Notification immédiate via registration.showNotification() — survit à la fermeture de l'onglet
 *
 * Pas de backend Firebase requis — tout en local via Service Worker.
 */

const STORAGE_KEY = 'celeste_push_enabled';
const TIMES_KEY = 'celeste_push_times';

export interface NotifTime {
  hour: number;
  minute: number;
  label: string;
  title: string;
  body: string;
  tag: string;
}

export const DEFAULT_TIMES: NotifTime[] = [
  { hour: 7, minute: 30, label: 'Matin', title: '✦ Ton ciel du matin', body: "Ouvre Céleste, ton horoscope du jour t'attend.", tag: 'celeste-morning' },
  { hour: 18, minute: 0, label: 'Soir', title: '🌙 Ton tarot du soir est prêt', body: 'Le voile se lève. Tire ta carte.', tag: 'celeste-evening' },
  { hour: 22, minute: 0, label: 'Nuit', title: '🌌 Rituel du coucher', body: 'Trois lignes dans ton journal pour sceller la journée.', tag: 'celeste-night' },
];

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private scheduledTimers: number[] = [];
  private enabled = false;

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!('Notification' in window)) return;

    // Restore state
    this.enabled = localStorage.getItem(STORAGE_KEY) === '1';

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      console.warn('[push] SW registration failed', e);
      return;
    }

    if (this.enabled && Notification.permission === 'granted') {
      this.scheduleAll();
    }
  }

  isEnabled(): boolean {
    return this.enabled && Notification.permission === 'granted';
  }

  getPermission(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'granted') {
      this.enable();
      return true;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      this.enable();
      return true;
    }
    return false;
  }

  disable(): void {
    this.enabled = false;
    localStorage.removeItem(STORAGE_KEY);
    this.clearTimers();
  }

  /** Notification immédiate (debug + opt-in confirmation). */
  async notifyNow(title: string, body: string, url = '/'): Promise<void> {
    if (!this.registration || Notification.permission !== 'granted') return;
    // vibrate est valide sur SW NotificationOptions mais absent du DOM lib → cast global
    const opts = {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-512.png',
      tag: 'celeste-immediate',
      data: { url },
      vibrate: [100, 50, 100],
    } as unknown as NotificationOptions;
    await this.registration.showNotification(title, opts);
  }

  /** Reprogramme tous les timers. À appeler au boot + après changement d'heure. */
  scheduleAll(times: NotifTime[] = this.getStoredTimes()): void {
    this.clearTimers();
    if (!this.isEnabled()) return;

    times.forEach((t) => {
      const ms = this.msUntilNext(t.hour, t.minute);
      const id = window.setTimeout(() => {
        this.fireScheduled(t);
        // Re-schedule pour demain
        this.scheduleSingle(t);
      }, ms);
      this.scheduledTimers.push(id);
    });

    console.info(`[push] ${times.length} notifs programmées (prochain dans ${Math.round(this.msUntilNext(times[0]?.hour ?? 7, times[0]?.minute ?? 30) / 60000)}min)`);
  }

  getStoredTimes(): NotifTime[] {
    try {
      const raw = localStorage.getItem(TIMES_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* fallback */ }
    return DEFAULT_TIMES;
  }

  setTimes(times: NotifTime[]): void {
    localStorage.setItem(TIMES_KEY, JSON.stringify(times));
    if (this.enabled) this.scheduleAll(times);
  }

  // ─── PRIVÉS ───────────────────────────────────────────────────────────

  private enable(): void {
    this.enabled = true;
    localStorage.setItem(STORAGE_KEY, '1');
    this.scheduleAll();
    // Notification de bienvenue
    this.notifyNow('✦ Céleste activé', 'Tes rappels quotidiens sont en place. À demain matin.');
  }

  private scheduleSingle(t: NotifTime): void {
    const ms = this.msUntilNext(t.hour, t.minute);
    const id = window.setTimeout(() => {
      this.fireScheduled(t);
      this.scheduleSingle(t); // re-arm
    }, ms);
    this.scheduledTimers.push(id);
  }

  private async fireScheduled(t: NotifTime): Promise<void> {
    if (!this.registration) return;
    // vibrate est valide sur SW NotificationOptions mais absent du DOM lib → cast global
    const opts = {
      body: t.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-512.png',
      tag: t.tag,
      data: { url: '/' },
      vibrate: [100, 50, 100],
    } as unknown as NotificationOptions;
    await this.registration.showNotification(t.title, opts);
  }

  private clearTimers(): void {
    this.scheduledTimers.forEach((id) => clearTimeout(id));
    this.scheduledTimers = [];
  }

  private msUntilNext(hour: number, minute: number): number {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
  }
}

export const pushService = new PushNotificationService();