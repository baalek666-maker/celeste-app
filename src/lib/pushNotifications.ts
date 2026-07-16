/**
 * PushNotificationService — Notifications natives navigateur (Piste #4).
 *
 * Stratégie : on ne peut pas programmer de notifications différées sans service worker
 * + Push API + backend Firebase. Mais on peut :
 * 1. Demander la permission
 * 2. Programmer des notifications locales dans la session (aujourd'hui)
 * 3. Préparer le terrain pour le push distant (TODO: service worker registration)
 */

const STORAGE_KEY_PERMISSION = 'celeste:push-permission-asked';
const STORAGE_KEY_TIMES = 'celeste:notif-times';

const DEFAULT_TIMES: NotifTime[] = [
  { hour: 7, minute: 30, label: 'morning' },
  { hour: 18, minute: 0, label: 'evening' },
  { hour: 22, minute: 0, label: 'night' },
];

const MESSAGES = {
  morning: [
    'Ton horoscope du matin est prêt ✨',
    'Le ciel a quelque chose à te dire aujourd\'hui',
    'Ton café astral t\'attend ☕',
  ],
  evening: [
    'Ton tarot du soir t\'attend 🃏',
    'Le ciel du soir a une surprise pour toi',
    'Ton rituel du soir ouvre maintenant 🌙',
  ],
  night: [
    'Comment s\'est passée ta journée ? 📔',
    'Ton journal t\'attend pour la rétrospective',
    'Note ce que le ciel t\'a appris aujourd\'hui',
  ],
};

export type NotifTime = { hour: number; minute: number; label: 'morning' | 'evening' | 'night' };

class PushNotificationService {
  private timers: number[] = [];
  private permission: NotificationPermission = 'default';

  async init() {
    if (!('Notification' in window)) return false;

    this.permission = Notification.permission;

    if (this.permission === 'granted') {
      this.scheduleAll();
      return true;
    }

    // Demande une seule fois (pas spammer l'utilisateur)
    const asked = localStorage.getItem(STORAGE_KEY_PERMISSION);
    if (!asked && this.permission === 'default') {
      // On ne demande PAS automatiquement — on attend que l'utilisateur interagisse
      // (Chrome bloque les demandes sans contexte)
    }

    return false;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    this.permission = result;
    localStorage.setItem(STORAGE_KEY_PERMISSION, '1');
    if (result === 'granted') {
      this.scheduleAll();
    }
    return result;
  }

  getPermission(): NotificationPermission {
    return this.permission;
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }

  getConfiguredTimes(): NotifTime[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TIMES);
      if (stored) return JSON.parse(stored);
    } catch { /* silent */ }
    return DEFAULT_TIMES;
  }

  setTimes(times: NotifTime[]) {
    localStorage.setItem(STORAGE_KEY_TIMES, JSON.stringify(times));
    this.clearTimers();
    this.scheduleAll();
  }

  private scheduleAll() {
    this.clearTimers();
    const times = this.getConfiguredTimes();
    times.forEach((t) => this.scheduleNext(t));
  }

  private scheduleNext(time: NotifTime) {
    const now = new Date();
    const next = new Date();
    next.setHours(time.hour, time.minute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const delay = next.getTime() - now.getTime();

    const id = window.setTimeout(() => {
      this.showNotification(time.label);
      // Reprogrammer pour demain
      this.scheduleNext(time);
    }, delay);

    this.timers.push(id);
  }

  private showNotification(label: 'morning' | 'evening' | 'night') {
    if (this.permission !== 'granted') return;
    const messages = MESSAGES[label];
    const text = messages[Math.floor(Math.random() * messages.length)];

    try {
      new Notification('Céleste', {
        body: text,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `celeste-${label}`,
      });
    } catch { /* silent */ }
  }

  private clearTimers() {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers = [];
  }

  /** Démontage (cleanup) — utile pour HMR */
  destroy() {
    this.clearTimers();
  }
}

export const pushService = new PushNotificationService();