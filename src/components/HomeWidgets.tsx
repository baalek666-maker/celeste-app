import { useEffect, useState } from 'react';
import type { Screen } from '../App';

interface Streak {
  current: number;
  bestEver: number;
  doneToday: boolean;
}

/**
 * StreakBanner — barre vivante de streak (Piste C).
 *
 * Affiche la progression de la semaine + une raison de revenir demain.
 * Toujours visible au-dessus du contenu.
 */
export function StreakBanner({ streak }: { streak: number }) {
  // Mock local progress (semaine en cours) — sera branché sur API plus tard
  const [weekProgress] = useState(() => {
    const seed = new Date().getDay(); // 0-6
    return Math.min(streak, Math.max(0, seed));
  });

  if (streak < 1) return null;

  return (
    <div className="relative glass rounded-2xl p-3 mb-4 border border-gold-500/25 overflow-hidden animate-fade-in">
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gold-500/15 blur-2xl pointer-events-none" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-base shadow-md shadow-gold-500/40">
            🔥
          </div>
          <div>
            <p className="text-[10px] text-gold-400 uppercase tracking-widest font-bold">Ton rituel</p>
            <p className="text-sm font-bold text-night-100 leading-tight">
              {streak} jour{streak > 1 ? 's' : ''} d'affilée
            </p>
          </div>
        </div>

        {/* Week dots */}
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const filled = i < weekProgress;
            const isToday = i === new Date().getDay() - 1;
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  filled
                    ? 'bg-gold-400 shadow-sm shadow-gold-500/50'
                    : isToday
                      ? 'bg-night-600 border border-gold-500/40 animate-pulse'
                      : 'bg-night-700'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * EveningReminder — Piste F.
 *
 * Si on est avant 18h, on annonce le tirage/rituel du soir.
 * Si on est après 18h, on confirme que c'est dispo maintenant.
 */
export function EveningReminder() {
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
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 border animate-fade-in ${
      before
        ? 'bg-cosmic-500/10 border-cosmic-500/20'
        : 'bg-gold-500/10 border-gold-500/30'
    }`}>
      <span className="text-base">{before ? '🌙' : '🌟'}</span>
      <p className={`text-[11px] font-medium ${before ? 'text-cosmic-300' : 'text-gold-300'}`}>
        {text}
      </p>
    </div>
  );
}

/**
 * SmartCTA — Piste D.
 *
 * Tease ce que l'utilisateur va trouver dans Explorer, au lieu d'un bouton fantôme.
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