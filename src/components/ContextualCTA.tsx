import { useMemo } from 'react';
import type { Screen } from '../App';
import { getDailyDominantTransit } from '../lib/dailyTransit';

/**
 * ContextualCTA — bouton contextuel sous la carte de tarot.
 *
 * v9 audit : adapte le CTA au transit dominant du jour.
 * Logique : Mercure → horoscope, Vénus → compatibilité, Mars → explorer,
 * Jupiter → journal, Saturne → settings (rituel ancré).
 */

const CTA: Record<ReturnType<typeof getDailyDominantTransit>, {
  target: Screen;
  icon: string;
  label: string;
  sub: string;
}> = {
  mercury: { target: 'horoscope',    icon: '☿', label: 'Lis ton horoscope',         sub: 'Les mots du jour t\'attendent.' },
  venus:   { target: 'compatibility', icon: '♀', label: 'Vibre avec quelqu\'un',    sub: 'Compare ton ciel à un autre.' },
  mars:    { target: 'explorer',     icon: '♂', label: 'Explore une question',      sub: 'Un geste. Un mouvement. Une réponse.' },
  jupiter: { target: 'journal',      icon: '♃', label: 'Écris ce qui s\'ouvre',     sub: 'Note l\'élargissement, même infime.' },
  saturn:  { target: 'settings',     icon: '♄', label: 'Pose un rituel concret',    sub: 'Un petit geste ancré aujourd\'hui.' },
};

export function ContextualCTA() {
  const config = useMemo(() => {
    const transit = getDailyDominantTransit();
    return CTA[transit];
  }, []);

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('celeste:navigate', { detail: config.target }))}
      className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl glass border border-cosmic-500/30 hover:border-cosmic-500/60 transition-all active:scale-[0.98] text-left animate-fade-in"
    >
      <span className="text-2xl">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-night-50">{config.label}</p>
        <p className="text-[10px] text-night-400 mt-0.5">{config.sub}</p>
      </div>
      <span className="text-cosmic-300 text-lg">→</span>
    </button>
  );
}
