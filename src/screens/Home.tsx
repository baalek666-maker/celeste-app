import { useEffect, useMemo, useState } from 'react';
import type { User } from '../types';
import type { Screen } from '../App';
import StreakCelebration from '../components/StreakCelebration';
import StreakShieldBadge from '../components/StreakShieldBadge';
import DailyTarot from '../components/DailyTarot';
import TarotCross from '../components/TarotCross';
import TodayIn10s from '../components/TodayIn10s';
import EveningRitualCard from '../components/EveningRitualCard';
import MoodForecast from '../components/MoodForecast';
import LiveAstroBanner from '../components/LiveAstroBanner';
import DailyEnergy from '../components/DailyEnergy';
import HeroPrediction from '../components/HeroPrediction';
import DailyIntention from '../components/DailyIntention';
import { SignatureFooter } from '../components/SignatureFooter';
import { HomeSecondary } from '../components/HomeSecondary';
import { TrialBanner } from '../components/TrialBanner';
import { pushService } from '../lib/pushNotifications';
import { getDailyDominantTransit, TRANSIT_INFO } from '../lib/dailyTransit';

/**
 * v11 — fond adaptatif total : cosmic-bg teinté par la couleur du transit dominant.
 * Conversion hex → rgba pour alpha 0.06-0.14 sur les 4 ellipses du gradient,
 * plus une base sombre légèrement teintée (différent du noir pur v10).
 */
function transitTints(transit: string): React.CSSProperties {
  const t = TRANSIT_INFO[transit as keyof typeof TRANSIT_INFO];
  if (!t) return {};
  const hex2rgba = (hex: string, a: number) => {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m) return `rgba(184,134,11,${a})`;
    const [r, g, b] = m.map(s => parseInt(s, 16));
    return `rgba(${r},${g},${b},${a})`;
  };
  const accent = t.accent;
  const halo = t.halo;
  return {
    '--tint-a': hex2rgba(accent, 0.14),
    '--tint-b': hex2rgba(halo,   0.10),
    '--tint-c': hex2rgba(accent, 0.08),
    '--tint-d': hex2rgba(halo,   0.06),
    '--tint-base': '#0a0508',
  } as React.CSSProperties;
}

const STORAGE_KEY = 'celeste:home-mode';
type HomeMode = 'focus' | 'full';

function getInitialMode(): HomeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'focus' || saved === 'full') return saved;
  } catch { /* SSR ou localStorage bloqué */ }
  return 'focus';
}

export function Home({ user, onNavigate, isGuest }: { user: User; onNavigate: (s: Screen) => void; isGuest?: boolean }) {
  const streak = user.streak ?? 0;
  // P0-Fix-3 — Mode Focus (défaut) vs Full. Préserve l'intégralité du visuel existant :
  // Mode Focus montre 4 blocs vitaux ; Mode Full (toggle "Voir tous les rituels")
  // affiche l'intégralité de l'expérience v11. Aucun composant n'est modifié,
  // on ne fait que les monter ou démonter via React.
  const [mode, setMode] = useState<HomeMode>(getInitialMode);
  const isFull = mode === 'full';

  useEffect(() => {
    pushService.init();
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* non-fatal */ }
  }, [mode]);

  // v11 — Fond adaptatif total : cosmic-bg-adapt teinté par la couleur du transit dominant.
  // Le fond MOI-MÊME change de teinte (pas un overlay halo comme v10).
  // Calcul mémorisé : getDailyDominantTransit a déjà son cache par jour UTC.
  // NOTE : useMemo doit être appelé AVANT tout early return (règle des Hooks React).
  const transit = useMemo(() => {
    try { return getDailyDominantTransit(); } catch { return 'mercury'; }
  }, []);

  // Guest mode
  if (!user.natalChart) {
    if (isGuest) {
      return (
        <div className="cosmic-bg star-field min-h-screen text-night-100 px-5 pt-16 pb-24 relative">
          <div className="fixed inset-0 aurora-bg pointer-events-none" />
          <div className="relative z-10 text-center">
            <div className="text-5xl mb-6 animate-float-slow">✦</div>
            <h1 className="text-2xl font-bold text-gold-gradient mb-3">Bienvenue sur Céleste</h1>
            <p className="text-night-300 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
              Explore l'app librement. Quand tu seras prêt, crée ton thème natal pour des lectures personnalisées.
            </p>
            <button
              onClick={() => onNavigate('onboarding')}
              className="w-full max-w-xs mx-auto block py-3.5 rounded-2xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-500/30 mb-3"
            >
              Créer mon thème ✨
            </button>
            <button
              onClick={() => onNavigate('journal')}
              className="w-full max-w-xs mx-auto block py-3 rounded-2xl glass border border-night-700 text-night-200 text-sm font-medium transition-all hover:border-gold-500/30 active:scale-[0.98]"
            >
              📔 Tester le journal
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="cosmic-bg star-field min-h-screen flex flex-col items-center justify-center text-night-100 px-6">
        <div className="text-4xl mb-4 animate-float-slow">✦</div>
        <h2 className="text-xl font-semibold text-gold-gradient mb-2">Préparation de ton ciel</h2>
        <p className="text-night-300 text-sm text-center max-w-xs">
          Chargement du thème natal en cours…
        </p>
      </div>
    );
  }

  const chart = user.natalChart as NonNullable<User['natalChart']>;
  const firstName = (user.name?.split(' ')[0]) || (user.email?.split('@')[0]) || undefined;

  // (transit calculé plus haut pour respecter l'ordre des hooks React)
  const tintsStyle = transitTints(transit);

  return (
    <div className="cosmic-bg-adapt star-field min-h-screen text-night-100 pb-24" style={tintsStyle}>
      <div className="px-5 pt-12 pb-6 relative z-10">
      {/* P2-Fix-5 — Bandeau trial "X jours restants". Apparition conditionnelle,
          ne s'affiche PAS quand l'utilisateur a un vrai abonnement payant (>30j). */}
      <TrialBanner user={user} />

      {isFull && (
        <>
          <StreakCelebration streak={streak} />
          <StreakShieldBadge streak={streak} onBuy={() => onNavigate('settings')} />
        </>
      )}

      {/* P0-Fix-3 — Toggle discret entre Focus (4 blocs vitaux) et Full (toute
          l'expérience). Préserve le visuel existant en mode Full. */}
      <div className="flex items-center justify-end mb-3 -mt-1">
        <button
          onClick={() => setMode(isFull ? 'focus' : 'full')}
          aria-pressed={isFull}
          className={`text-[11px] px-3 py-1.5 rounded-full transition-all border ${
            isFull
              ? 'glass-gold border-gold-500/40 text-gold-200'
              : 'glass border-night-700/40 text-night-300 hover:text-night-100 hover:border-cosmic-500/40'
          }`}
        >
          {isFull ? '◐ Mode focus' : '◐ Voir tous les rituels'}
        </button>
      </div>

      {/* 1. HERO PREDICTION — phrase qui tue (40% écran, wow effect) — toujours visible */}
      <HeroPrediction chart={chart} sunSignKey={chart.sun} firstName={firstName} streak={streak} />

      {/* 2. DAILY ENERGY compact — toujours visible (essentiel et court) */}
      <DailyEnergy compact />

      {/* 3. TAROT — différenciateur vs Co-Star — toujours visible */}
      <DailyTarot />

      {/* 4. SIGNATURE FOOTER — astrolabe + CTA explorateur — toujours visible */}
      <SignatureFooter
        sunSignKey={chart.sun}
        moonSignKey={chart.moon}
        risingSignKey={chart.rising}
        onNavigate={onNavigate}
      />

      {/* ─── Mode Full : blocs additionnels repliables pour power users ─── */}
      {isFull && (
        <div className="mt-6 space-y-4 border-t border-night-800/40 pt-6 animate-fade-in">
          <p className="text-night-500 text-[10px] uppercase tracking-widest text-center">
            Tous les rituels du jour
          </p>

          {/* PISTE 3 — Éphémérides vivantes */}
          <LiveAstroBanner />

          {/* VAL01 — Aujourd'hui en 10s */}
          <TodayIn10s />

          {/* v10 — Intention du jour */}
          <DailyIntention />

          {/* 2.b — Tarot premium (tirage en croix 3 cartes, 2,99€) */}
          <TarotCross />

          {/* VAL04 — Rituel du soir */}
          <EveningRitualCard streak={streak} />

          {/* PISTE 5 — Mood Forecast 14j */}
          <MoodForecast />
        </div>
      )}

      {/* Panneau SECONDARY collapsable (reminder soir + optin push) */}
      <HomeSecondary streak={streak} onNavigate={onNavigate} />
      </div>
    </div>
  );
}