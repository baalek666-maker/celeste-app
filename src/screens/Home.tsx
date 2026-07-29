import { useEffect, useMemo } from 'react';
import type { User } from '../types';
import type { Screen } from '../App';
import StreakCelebration from '../components/StreakCelebration';
import DailyTarot from '../components/DailyTarot';
import TarotCross from '../components/TarotCross';
import EveningRitualCard from '../components/EveningRitualCard';
import MoodForecast from '../components/MoodForecast';
import LiveAstroBanner from '../components/LiveAstroBanner';
import DailyEnergy from '../components/DailyEnergy';
import HeroPrediction from '../components/HeroPrediction';
import DailyIntention from '../components/DailyIntention';
import { SignatureFooter } from '../components/SignatureFooter';
import { HomeSecondary } from '../components/HomeSecondary';
import { TrialBanner } from '../components/TrialBanner';
import { EmailVerificationBanner } from '../components/EmailVerificationBanner';
import { QuickAccessBar } from '../components/QuickAccessBar';
import { pushService } from '../lib/pushNotifications';
import { getDailyDominantTransit, TRANSIT_INFO } from '../lib/dailyTransit';

/**
 * v12 — Home "Dashboard Rituel" (Proposition B)
 *
 * AU-DESSUS DE LA LIGNE DE FLOTTAISON (sans scroller) :
 *   1. HeroPrediction — la phrase qui tue
 *   2. QuickAccessBar — 4 icônes pour sauter vers un rituel
 *
 * EN DESSOUS (scroll) :
 *   3. DailyTarot, DailyEnergy, DailyIntention, EveningRitualCard
 *   4. LiveAstroBanner, TarotCross, MoodForecast
 *   5. SignatureFooter + HomeSecondary
 *
 * Les bannières (Trial, Email, Streak) restent en haut mais discrètes.
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
  const tintsStyle = transitTints(transit);

  return (
    <div className="cosmic-bg-adapt star-field min-h-screen text-night-100 pb-24" style={tintsStyle}>
      <div className="px-5 pt-12 pb-6 relative z-10">

      {/* ── ZONE 1 : AU-DESSUS DE LA LIGNE DE FLOTTAISON ── */}

      {/* Bannières discrètes (n'apparaissent que si nécessaire) */}
      <TrialBanner user={user} onNavigate={(s) => onNavigate(s as Screen)} />
      <EmailVerificationBanner email={user.email} />
      <StreakCelebration streak={streak} />

      {/* v14.9.c — Teaser Portrait Astral : redesign épuré, barre gold à gauche,
          icône User SVG, badge PREMIUM, bouton CTA visible. Cohérent avec TrialBanner. */}
      {!user.isPremium && (
        <div
          onClick={() => onNavigate('astro-portrait' as Screen)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('astro-portrait' as Screen); } }}
          className="relative w-full mb-4 rounded-2xl overflow-hidden bg-night-900 border-t-2 border-cosmic-500/60 cursor-pointer hover:bg-night-800/80 transition-colors animate-fade-in"
          aria-label="Découvrir mon portrait astral"
        >
          {/* Barre gold latérale gauche */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cosmic-400 to-cosmic-600" />

          <div className="px-5 pt-4 pb-4 pl-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-cosmic-400 shrink-0">
                  <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.3" />
                  <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  <path d="M4 21c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                </svg>
                <span className="text-cosmic-300 text-[10px] tracking-[0.2em] font-semibold uppercase">
                  Toi
                </span>
              </div>
              <span className="bg-night-800 text-cosmic-300 border border-cosmic-500/40 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
                Premium
              </span>
            </div>

            <h3 className="text-night-50 text-lg leading-tight font-light mb-1.5" style={{ fontFamily: 'Georgia, "Cormorant Garamond", serif' }}>
              Ton portrait <span className="text-cosmic-300 italic">astral</span>
            </h3>

            <p className="text-night-400 text-xs leading-relaxed mb-4">
              Ce que tes placements disent de toi, en lecture complète.
            </p>

            <div className="flex items-center justify-center gap-2 bg-night-800 border border-cosmic-500/40 text-cosmic-300 text-sm font-semibold py-2.5 rounded-xl">
              Découvrir
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Hero — la phrase qui tue */}
      <HeroPrediction chart={chart} sunSignKey={chart.sun} firstName={firstName} streak={streak} />

      {/* Barre d'accès rapide — 4 rituels */}
      <QuickAccessBar />

      {/* ── ZONE 2 : RITUELS DU JOUR (scroll) ── */}

      {/* Tarot */}
      <div id="home-tarot">
        <DailyTarot />
      </div>

      {/* Énergie du jour */}
      <div id="home-energy">
        <DailyEnergy compact />
      </div>

      {/* Intention du jour */}
      <div id="home-intention">
        <DailyIntention />
      </div>

      {/* Aujourd'hui en 10s — SUPPRIMÉ (carrousel Énergie/Lune/Transits, jugé non nécessaire) */}

      {/* Rituel du soir */}
      <div id="home-ritual">
        <EveningRitualCard streak={streak} />
      </div>

      {/* Tarot premium (croix) */}
      <TarotCross />

      {/* Éphémérides vivantes */}
      <LiveAstroBanner />

      {/* Mood forecast */}
      <MoodForecast />

      {/* ── ZONE 3 : FOOTER ── */}
      <SignatureFooter
        sunSignKey={chart.sun}
        moonSignKey={chart.moon}
        risingSignKey={chart.rising}
        onNavigate={onNavigate}
      />

      <HomeSecondary streak={streak} onNavigate={onNavigate} />
      </div>
    </div>
  );
}