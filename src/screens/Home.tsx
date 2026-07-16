import { useEffect } from 'react';
import type { User } from '../types';
import type { Screen } from '../App';
import StreakCelebration from '../components/StreakCelebration';
import DailyTarot from '../components/DailyTarot';
import DailyEnergy from '../components/DailyEnergy';
import HeroPrediction from '../components/HeroPrediction';
import { SignatureFooter } from '../components/SignatureFooter';
import { HomeSecondary } from '../components/HomeSecondary';
import { pushService } from '../lib/pushNotifications';

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

  return (
    <div className="px-5 pt-12 pb-6 relative z-10">
      <StreakCelebration streak={streak} />

      {/* v8 — 4 BLOCS MAX DANS LE FLUX PRINCIPAL */}
      {/* 1. HERO PREDICTION — phrase qui tue (40% écran, wow effect) */}
      <HeroPrediction chart={chart} sunSignKey={chart.sun} firstName={firstName} streak={streak} />

      {/* 2. TAROT — différenciateur vs Co-Star */}
      <DailyTarot />

      {/* 3. DAILY ENERGY — mode compact (résumé 1-ligne, pas de redondance avec Hero) */}
      <DailyEnergy compact />

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
  );
}