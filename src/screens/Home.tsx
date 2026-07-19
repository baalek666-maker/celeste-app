import { useEffect, useMemo } from 'react';
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

export function Home({ user, onNavigate, isGuest }: { user: User; onNavigate: (s: Screen) => void; isGuest?: boolean }) {
  const streak = user.streak ?? 0;

  useEffect(() => {
    pushService.init();
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

  // v11 — Fond adaptatif total : cosmic-bg-adapt teinté par la couleur du transit dominant.
  // Le fond MOI-MÊME change de teinte (pas un overlay halo comme v10).
  // Calcul mémorisé : getDailyDominantTransit a déjà son cache par jour UTC.
  const transit = useMemo(() => {
    try { return getDailyDominantTransit(); } catch { return 'mercury'; }
  }, []);
  const tintsStyle = transitTints(transit);

  return (
    <div className="cosmic-bg-adapt star-field min-h-screen text-night-100 pb-24" style={tintsStyle}>
      <div className="px-5 pt-12 pb-6 relative z-10">
      <StreakCelebration streak={streak} />
      <StreakShieldBadge streak={streak} onBuy={() => onNavigate('settings')} />

      {/* v8 — 4 BLOCS MAX DANS LE FLUX PRINCIPAL */}
      {/* 1. HERO PREDICTION — phrase qui tue (40% écran, wow effect) */}
      <HeroPrediction chart={chart} sunSignKey={chart.sun} firstName={firstName} streak={streak} />

      {/* PISTE 3 — ÉPHÉMÉRIDES VIVANTES — bannière événement astro du jour */}
      <LiveAstroBanner />

      {/* VAL01 — Aujourd'hui en 10s : carrousel swipeable (énergie + lune + transits) */}
      <TodayIn10s />

      {/* v10 — INTENTION DU JOUR — geste rituel signature (cercle + phrase méditative) */}
      <DailyIntention />

      {/* 2. TAROT — différenciateur vs Co-Star */}
      <DailyTarot />

      {/* 2.b — Tarot premium (tirage en croix 3 cartes, 2,99€) */}
      <TarotCross />

      {/* 3. DAILY ENERGY — mode compact (résumé 1-ligne, pas de redondance avec Hero) */}
      <DailyEnergy compact />

      {/* VAL04 — RITUEL DU SOIR — sommeil + lune + journaling 3 lignes */}
      <EveningRitualCard streak={streak} />

      {/* PISTE 5 — MOOD FORECAST 14j (3j gratuit, 14j premium) */}
      <MoodForecast />

      {/* 4. SIGNATURE FOOTER — fusion astrolabe + CTA explorateur */}
      <SignatureFooter
        sunSignKey={chart.sun}
        moonSignKey={chart.moon}
        risingSignKey={chart.rising}
        onNavigate={onNavigate}
      />

      {/* Panneau SECONDARY collapsable (streak inline + reminder + optin push) */}
      <HomeSecondary streak={streak} onNavigate={onNavigate} />
      </div>
    </div>
  );
}