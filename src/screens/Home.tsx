import { useEffect, useMemo } from 'react';
import type { User } from '../types';
import type { Screen } from '../App';
import StreakCelebration from '../components/StreakCelebration';
import DailyTarot from '../components/DailyTarot';
import EveningRitualCard from '../components/EveningRitualCard';
import MoodForecast from '../components/MoodForecast';
import DailyEnergy from '../components/DailyEnergy';
import { DailyHero } from '../components/DailyHero';
import DailyIntention from '../components/DailyIntention';
import { SignatureFooter } from '../components/SignatureFooter';
import { HomeSecondary } from '../components/HomeSecondary';
import { TrialBanner } from '../components/TrialBanner';
import { EmailVerificationBanner } from '../components/EmailVerificationBanner';
import { pushService } from '../lib/pushNotifications';
import { getDailyDominantTransit, TRANSIT_INFO } from '../lib/dailyTransit';
import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign } from '../types';

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
              className="w-full max-w-xs mx-auto block py-3.5 rounded-2xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold transition-colors duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-500/30 mb-3"
            >
              Créer mon thème ✨
            </button>
            <button
              onClick={() => onNavigate('journal')}
              className="w-full max-w-xs mx-auto block py-3 rounded-2xl glass border border-night-700 text-night-200 text-sm font-medium transition-colors duration-200 ease-out hover:border-gold-500/30 active:scale-[0.98]"
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
  // v15 — jamais le préfixe e-mail (« Bonjour audit.test.16389 ») : prénom ou rien.
  const firstName = (user.name?.split(' ')[0]) || undefined;
  const tintsStyle = transitTints(transit);

  return (
    <div className="cosmic-bg-adapt star-field min-h-screen text-night-100 pb-24" style={tintsStyle}>
      <div className="px-5 pt-12 pb-6 relative z-10">

      {/* ── ZONE 1 : AU-DESSUS DE LA LIGNE DE FLOTTAISON ── */}

      {/* Bannières discrètes (n'apparaissent que si nécessaire) */}
      <TrialBanner user={user} onNavigate={(s) => onNavigate(s as Screen)} />
      <EmailVerificationBanner email={user.email} />
      <StreakCelebration streak={streak} />

      {/* v14.9.e — Bloc Portrait Astral SUPPRIMÉ de Home. La page dédiée reste
          accessible via la nav. Mais on n'inonde plus l'accueil avec. */}

      {/* v14.9.h — DailyHero : Logo + Bonjour + badge NASA + carte aperçu transit.
          S'inspire de la landing pour donner du poids visuel au haut de page. */}
      <DailyHero
        firstName={firstName}
        sunSignName={ZODIAC_SIGNS[chart.sun as ZodiacSign]?.name}
        sunSignGlyph={ZODIAC_SIGNS[chart.sun as ZodiacSign]?.symbol}
        sunSignColor={ZODIAC_SIGNS[chart.sun as ZodiacSign]?.color}
      />

      {/* v14.9.h — Intention DESCENDUE en Zone 2 (entre Tarot et Énergie).
          Le hero porte maintenant le hook transit (concret). L'intention
          devient une respiration méditative entre 2 rituels actifs. */}

      {/* v15 — Raccourcis : l'essentiel en 1 clic (compatibilité était à 3 clics) */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {([
          { s: 'horoscope', icon: '☉', label: 'Mon horoscope' },
          { s: 'compatibility', icon: '♡', label: 'Compatibilité' },
          { s: 'chart', icon: '✦', label: 'Mon thème' },
        ] as { s: Screen; icon: string; label: string }[]).map(a => (
          <button key={a.s} onClick={() => onNavigate(a.s)}
            className="glass rounded-2xl py-3 px-2 flex flex-col items-center gap-1 border border-night-700/60 hover:border-gold-500/40 active:scale-95 transition-all">
            <span className="text-gold-300 text-xl leading-none">{a.icon}</span>
            <span className="text-night-200 text-[12px] font-medium">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ── ZONE 2 : RITUELS DU JOUR (scroll) ── */}

      {/* Tarot */}
      <div id="home-tarot">
        <DailyTarot />
      </div>

      {/* Intention du jour — respiration méditative */}
      <div id="home-intention">
        <DailyIntention />
      </div>

      {/* Énergie du jour */}
      <div id="home-energy">
        <DailyEnergy compact />
      </div>

      {/* Aujourd'hui en 10s — SUPPRIMÉ (carrousel Énergie/Lune/Transits, jugé non nécessaire) */}

      {/* Rituel du soir */}
      <div id="home-ritual">
        <EveningRitualCard streak={streak} />
      </div>

      {/* v15 — Croix de tarot et éphémérides retirées de l'accueil (12 blocs → 8).
          Toujours accessibles depuis Explorer. */}

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