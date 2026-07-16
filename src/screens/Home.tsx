import type { User } from '../types';
import type { Screen } from '../App';
import StreakCelebration from '../components/StreakCelebration';
import DailyGreeting from '../components/DailyGreeting';
import DailyEnergy from '../components/DailyEnergy';
import DailyRituals from '../components/DailyRituals';

export function Home({ user, onNavigate, isGuest }: { user: User; onNavigate: (s: Screen) => void; isGuest?: boolean }) {
  const streak = user.streak ?? 0;

  // P1.3 — Guest mode: show welcome screen with CTA to create birth chart
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

            <div className="mt-10 text-left space-y-3 max-w-xs mx-auto">
              <p className="text-night-500 text-xs uppercase tracking-widest text-center">Ce qui t'attend</p>
              {[
                { icon: '☉', text: 'Horoscope calculé sur tes vraies planètes' },
                { icon: '☥', text: 'Compatibilité amoureuse détaillée' },
                { icon: '🃏', text: 'Tirage de tarot quotidien' },
              ].map((item) => (
                <div key={item.text} className="glass rounded-xl p-3 flex items-center gap-3 border border-night-800/50">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-night-300 text-xs">{item.text}</span>
                </div>
              ))}
            </div>
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

  const chart = user.natalChart!;
  if (!chart) {
    return (
      <div className="cosmic-bg star-field min-h-screen flex flex-col items-center justify-center text-night-100 px-6">
        <div className="text-4xl mb-4 animate-float-slow">✦</div>
        <h2 className="text-xl font-semibold text-gold-gradient mb-2">Ciel en cours de calibration</h2>
        <p className="text-night-300 text-sm text-center max-w-xs mb-6">
          Une donnée astrale semble incomplète. Reviens dans un instant.
        </p>
        <button
          onClick={() => location.reload()}
          className="glass-gold rounded-full px-6 py-2.5 text-sm text-gold-300 hover:scale-105 transition"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // P3.3 — extract first name from email or displayName for the greeting
  const firstName = (user.name?.split(' ')[0]) || (user.email?.split('@')[0]) || undefined;

  return (
    <div className="px-5 pt-12 pb-6 relative z-10">
      <StreakCelebration streak={streak} />

      {/* ── 1. Signature VMF v2 : "Ton ciel du jour" + salutation personnalisée ── */}
      <DailyGreeting sunSignKey={chart.sun} firstName={firstName} streak={streak} />

      {/* ── 2. La star : l'horoscope/énergie du jour (DailyEnergy) ── */}
      <DailyEnergy />

      {/* ── 3. Ton rituel : action concrète du jour (DailyRituals) ── */}
      <DailyRituals />

      {/* ── 4. Une seule porte d'entrée : Explorer ── */}
      <button
        onClick={() => onNavigate('explorer')}
        className="w-full glass rounded-2xl p-4 mb-3 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group stagger-card flex items-center gap-3"
      >
        <span className="text-xl text-gold-400">◈</span>
        <div className="flex-1">
          <p className="text-night-100 text-sm font-medium">Aller plus loin</p>
          <p className="text-night-400 text-xs">Ton thème, ta compatibilité, ton ciel d'aujourd'hui</p>
        </div>
        <span className="text-night-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all">→</span>
      </button>
    </div>
  );
}