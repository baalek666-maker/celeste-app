import { useEffect, useState } from 'react';
import { pushService } from '../lib/pushNotifications';

/**
 * NotificationOptin — petite carte non-intrusive qui propose d'activer
 * les notifications. Apparaît seulement après 1-2 visites (pas de spam).
 */
export function NotificationOptin() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pushService.isSupported()) return;
    if (pushService.getPermission() !== 'default') return;

    // Afficher seulement si l'utilisateur a déjà visité la home 2+ fois
    const visits = parseInt(localStorage.getItem('celeste:visits') ?? '0', 10);
    localStorage.setItem('celeste:visits', String(visits + 1));
    if (visits < 1) return;

    // Délai 3s après l'arrivée sur la home
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const handleAccept = async () => {
    await pushService.requestPermission();
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('celeste:push-permission-asked', '1');
    setShow(false);
  };

  return (
    <div className="relative glass rounded-2xl p-4 mb-4 border border-cosmic-500/30 animate-fade-in overflow-hidden">
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-cosmic-500/20 blur-2xl pointer-events-none" />

      <div className="relative flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-night-100 mb-1">
            Laisse le ciel venir à toi
          </p>
          <p className="text-[11px] text-night-300 leading-relaxed mb-3">
            Active les rappels : ton horoscope du matin à 7h30, ton tarot du soir à 18h.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Activer
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 rounded-xl glass border border-night-700 text-night-300 text-xs transition-all hover:border-night-600"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}