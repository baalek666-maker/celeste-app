import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export type NotificationStatus = {
  enabled: boolean;
  subscriptionCount: number;
  hour: number;
  lastSent: string | null;
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
};

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers non supportés');
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  return existing || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export function useNotifications(): {
  status: NotificationStatus | null;
  loading: boolean;
  error: string;
  subscribe: (hour?: number) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updateHour: (hour: number) => Promise<boolean>;
  test: () => Promise<{ sent: number; total: number } | null>;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  const refresh = useCallback(async () => {
    if (!supported) {
      setStatus({ enabled: false, subscriptionCount: 0, hour: 9, lastSent: null, supported: false, permission: 'unsupported' });
      return;
    }
    try {
      const s = await api.getNotificationStatus();
      setStatus({ ...s, supported: true, permission: Notification.permission });
    } catch (err: any) {
      setError(err?.message || 'Erreur chargement statut');
    }
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async (hour?: number): Promise<boolean> => {
    if (!supported) { setError('Notifications non supportées sur ce navigateur'); return false; }
    setLoading(true); setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setError('Permission refusée'); return false; }
      const reg = await registerServiceWorker();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { publicKey } = await api.getVAPIDKey();
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const json = sub.toJSON();
      await api.subscribeToNotifications({
        subscription: { endpoint: json.endpoint!, keys: json.keys as any },
        hour,
      });
      await refresh();
      return true;
    } catch (err: any) {
      setError(err?.message || 'Erreur abonnement');
      return false;
    } finally { setLoading(false); }
  }, [supported, refresh]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    setLoading(true); setError('');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribeFromNotifications({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      } else {
        await api.unsubscribeFromNotifications({});
      }
      await refresh();
      return true;
    } catch (err: any) {
      setError(err?.message || 'Erreur désabonnement');
      return false;
    } finally { setLoading(false); }
  }, [supported, refresh]);

  const updateHour = useCallback(async (hour: number): Promise<boolean> => {
    try {
      await api.updateNotificationHour(hour);
      await refresh();
      return true;
    } catch (err: any) {
      setError(err?.message || 'Erreur mise à jour heure');
      return false;
    }
  }, [refresh]);

  const test = useCallback(async () => {
    try { return await api.testNotification(); }
    catch (err: any) { setError(err?.message || 'Erreur test'); return null; }
  }, []);

  return { status, loading, error, subscribe, unsubscribe, updateHour, test, refresh };
}