import { useEffect, useState } from 'react';
import type { Screen } from '../App';
import { pushService } from '../lib/pushNotifications';

/**
 * HomeSecondary — panneau repliable qui regroupe les widgets de rétention
 * (streak + reminder du soir + optin notifications) sans bloquer le flux principal.
 *
 * Tap pour déplier. Permet de réduire le "scroll fatigue" de la home (audit Piste #1).
 */

export function HomeSecondary({
  streak,
  onNavigate,
}: {
  streak: number;
  onNavigate: (s: Screen) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    setPushEnabled(pushService.isEnabled());
  }, []);

  const optInPush = async () => {
    const ok = await pushService.requestPermission();
    if (ok) {
      setPushEnabled(true);
      // Send welcome notif immediately to prove it works
      await pushService.notifyNow(
        '✦ Rappels Céleste activés',
        '7h30 — matin. 18h — tarot. 22h — rituel. On se voit demain.'
      );
    }
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl glass border border-night-700/40 text-[11px] text-night-400 hover:text-night-200 transition-all"
      >
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
          Plus ({streak > 0 ? `${streak}j streak · ` : ''}{new Date().getHours() < 18 ? 'tarot soir 18h' : 'tarot dispo'})
        </span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>⌃</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {streak > 0 && <StreakInline streak={streak} />}
          <EveningReminderInline />
          {!pushEnabled ? (
            <button
              onClick={optInPush}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl glass border border-cosmic-500/30 text-[11px] text-cosmic-200 hover:border-cosmic-500/50 transition-all text-left"
            >
              <span>🔔</span>
              <span>Activer les rappels quotidiens (7h30 · 18h · 22h)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-gold-500/30 text-[11px] text-gold-300">
              <span>✓</span>
              <span>Rappels activés — on se voit demain à 7h30</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StreakInline({ streak }: { streak: number }) {
  const [weekProgress] = useState(() => {
    const seed = new Date().getDay();
    return Math.min(streak, Math.max(0, seed));
  });

  return (
    <div className="glass rounded-xl p-3 border border-gold-500/20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-sm">
          🔥
        </div>
        <div>
          <p className="text-[10px] text-gold-400 uppercase tracking-widest font-bold">Ton rituel</p>
          <p className="text-xs font-bold text-night-100">{streak} jour{streak > 1 ? 's' : ''} d'affilée</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const filled = i < weekProgress;
          const isToday = i === new Date().getDay() - 1;
          return (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                filled
                  ? 'bg-gold-400 shadow-sm shadow-gold-500/50'
                  : isToday
                    ? 'bg-night-600 border border-gold-500/40'
                    : 'bg-night-700'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function EveningReminderInline() {
  const [hour, setHour] = useState(new Date().getHours());

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const before = hour < 18;
  const text = before
    ? `Ton tarot du soir ouvre à 18h`
    : `Ton tarot du soir est dispo maintenant ✨`;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
      before
        ? 'bg-cosmic-500/10 border-cosmic-500/20'
        : 'bg-gold-500/10 border-gold-500/30'
    }`}>
      <span className="text-sm">{before ? '🌙' : '🌟'}</span>
      <p className={`text-[11px] font-medium ${before ? 'text-cosmic-300' : 'text-gold-300'}`}>
        {text}
      </p>
    </div>
  );
}

/**
 * SmartCTA — Piste D.
 * Tease ce que l'utilisateur va trouver dans Explorer.
 */
export function SmartCTA({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const hour = new Date().getHours();
  const tease =
    hour < 12
      ? { title: 'Ton ciel de l\'après-midi t\'attend', sub: 'Transits, compatibilité, rituels', icon: '☀️' }
      : hour < 18
        ? { title: 'Découvre ce que ton ciel te réserve', sub: 'Transits perso + horoscope de la soirée', icon: '🌅' }
        : { title: 'Ton bilan astro du soir est prêt', sub: 'Transits perso + rituel de clôture', icon: '🌙' };

  return (
    <button
      onClick={() => onNavigate('explorer')}
      className="w-full glass rounded-2xl p-4 mb-3 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group stagger-card flex items-center gap-3"
    >
      <span className="text-2xl">{tease.icon}</span>
      <div className="flex-1">
        <p className="text-night-100 text-sm font-semibold">{tease.title}</p>
        <p className="text-night-400 text-xs">{tease.sub}</p>
      </div>
      <span className="text-night-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all">→</span>
    </button>
  );
}