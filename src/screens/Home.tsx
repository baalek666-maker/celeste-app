import type { User } from '../types';
import type { Screen } from '../App';
import { ZODIAC_SIGNS } from '../data/zodiac';
import StreakCelebration from '../components/StreakCelebration';
import DailyTarot from '../components/DailyTarot';
import SkyMap from '../components/SkyMap';

export function Home({ user, onNavigate }: { user: User; onNavigate: (s: Screen) => void }) {
  const streak = user.streak ?? 0;

  // Safe early return if natal chart not hydrated yet
  if (!user.natalChart) {
    return (
      <div className="cosmic-bg star-field min-h-screen flex flex-col items-center justify-center text-night-100 px-6">
        <div className="text-4xl mb-4 animate-float-slow">✦</div>
        <h2 className="text-xl font-semibold text-gold-gradient mb-2">Préparation de votre ciel</h2>
        <p className="text-night-300 text-sm text-center max-w-xs">
          Chargement du thème natal en cours…
        </p>
      </div>
    );
  }

  const chart = user.natalChart!;
  const sun = ZODIAC_SIGNS[chart.sun];
  const moon = ZODIAC_SIGNS[chart.moon];
  const rising = ZODIAC_SIGNS[chart.rising];

  // Guard: if any Big 3 sign is missing/invalid, show fallback instead of crashing
  if (!sun || !moon || !rising) {
    return (
      <div className="cosmic-bg star-field min-h-screen flex flex-col items-center justify-center text-night-100 px-6">
        <div className="text-4xl mb-4 animate-float-slow">✦</div>
        <h2 className="text-xl font-semibold text-gold-gradient mb-2">Ciel en cours de calibration</h2>
        <p className="text-night-300 text-sm text-center max-w-xs mb-6">
          Une donnée astrale semble incomplète. Revenez dans un instant.
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
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="px-5 pt-12 pb-6 relative z-10">
      <StreakCelebration streak={streak} />

      {/* ── 1. Header minimaliste ── */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <p className="text-night-400 text-sm capitalize">{today}</p>
          <h1 className="text-2xl font-bold text-gold-gradient">Bonjour</h1>
        </div>
        <div className="flex items-center gap-2">
          {streak >= 2 && (
            <span className="text-xs text-gold-400 font-semibold bg-gold-500/10 px-3 py-1.5 rounded-full border border-gold-500/30 flex items-center gap-1">
              🔥 {streak}j
            </span>
          )}
          <div className="w-11 h-11 rounded-full glass-gold border border-gold-500/20 flex items-center justify-center animate-float-slow">
            <span className="text-xl">{sun.emoji}</span>
          </div>
        </div>
      </div>

      {/* ── 2. Tarot du jour (gamification) ── */}
      <DailyTarot />

      {/* ── 3. Big 3 compact ── */}
      <div className="glass rounded-3xl p-5 mb-5 stagger-card card-glow animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Votre triplet astral</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '☉', sub: 'Soleil', sign: sun },
            { label: '☽', sub: 'Lune', sign: moon },
            { label: '↑', sub: 'Ascendant', sign: rising },
          ].map(({ label, sub, sign }) => (
            <div key={sub} className="text-center">
              <div
                className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-1.5 transition-transform hover:scale-110"
                style={{ background: `${sign.color}18`, border: `1px solid ${sign.color}40` }}
              >
                <span className="text-xl" style={{ color: sign.color }}>{sign.symbol}</span>
              </div>
              <p className="text-night-400 text-[10px] uppercase tracking-wider">{sub}</p>
              <p className="text-night-100 font-semibold text-xs">{sign.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Carte du ciel (SkyMap) ── */}
      <SkyMap size={300} />

      {/* ── 5. Horoscope preview ── */}
      <button
        onClick={() => onNavigate('horoscope')}
        className="w-full glass rounded-3xl p-5 mb-3 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group stagger-card card-glow"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gold-400 text-sm font-medium">Horoscope du jour</p>
            <p className="text-night-300 text-xs mt-0.5">
              {user.isPremium ? 'Votre lecture vous attend →' : 'Découvrez votre journée →'}
            </p>
          </div>
          <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </button>

      {/* ── 6. Explorer link ── */}
      <button
        onClick={() => onNavigate('explorer')}
        className="w-full glass rounded-2xl p-4 text-left hover:border-gold-500/30 border border-transparent transition-all duration-300 group flex items-center gap-3"
      >
        <span className="text-xl text-gold-400">◈</span>
        <div className="flex-1">
          <p className="text-night-100 text-sm font-medium">Explorer</p>
          <p className="text-night-400 text-xs">Thème natal, compatibilité, aspects, rituels…</p>
        </div>
        <span className="text-night-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all">→</span>
      </button>
    </div>
  );
}
