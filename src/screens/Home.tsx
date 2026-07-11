import { useEffect, useMemo, useState } from 'react';
import type { User } from '../types';
import type { Screen } from '../App';
import { ZODIAC_SIGNS } from '../data/zodiac';
import { elementDescription } from '../lib/astrology';
import { api } from '../lib/api';
import DailyAspects from '../components/DailyAspects';
import DailyRituals from '../components/DailyRituals';
import OnboardingChecklist from '../components/OnboardingChecklist';
import HousesChart from '../components/HousesChart';
import AsteroidInsights from '../components/AsteroidInsights';
import LunarNodes from '../components/LunarNodes';
import WeeklyChallenge from '../components/WeeklyChallenge';
import StreakCelebration from '../components/StreakCelebration';

const DAILY_QUOTES = [
  'Les étoiles ne brillent jamais plus fort qu\'en pleine obscurité.',
  'Votre chemin se dessine à chaque pensée, à chaque choix.',
  'Le ciel vous murmure ce que votre cœur sait déjà.',
  'Aujourd\'hui est une page blanche sous un ciel infini.',
  'Soyez l\'énergie que vous voulez attirer.',
  'La lune ne s\'excuse jamais d\'avoir des phases. Ni vous.',
  'Faites confiance au timing de l\'univers.',
  'Ce que vous cherchez cherche aussi vous.',
  'Chaque fin porte en elle un nouveau commencement.',
  'Votre intuition connaît le chemin avant votre esprit.',
];

// Deterministic daily quote (stable across re-renders, changes each day).
// Date-keyed so it rotates at midnight instead of staying stuck on a stale value.
function getDailyQuote(): string {
  const now = new Date();
  const seed = Number(now.getFullYear()) * 372 + (now.getMonth() + 1) * 31 + now.getDate();
  return DAILY_QUOTES[seed % DAILY_QUOTES.length];
}

// Local fallback when the backend is unreachable. Same algorithm as
// server.js MOON_PHASES — kept in sync. Age: days since last new moon.
function getMoonPhaseLocal(date: Date = new Date()): { name: string; emoji: string; description: string } {
  // Conway approximation — accurate within ±1 day.
  let y = date.getFullYear();
  let m = date.getMonth() + 1;
  let d = date.getDate();
  if (m < 3) { y -= 1; m += 12; }
  m += 1;
  let c = 365.25 * y;
  let e = 30.6 * m;
  let jd = c + e + d - 694039.09;
  jd /= 29.5305882;
  const b = Math.floor(jd);
  jd -= b;
  const phaseIndex = Math.round(jd * 8) % 8;
  const phases = [
    { name: 'Nouvelle Lune', emoji: '🌑', description: 'Temps des nouveaux commencements' },
    { name: 'Premier croissant', emoji: '🌒', description: 'Intention et croissance' },
    { name: 'Premier quartier', emoji: '🌓', description: 'Action et décision' },
    { name: 'Gibbeuse croissante', emoji: '🌔', description: 'Affinement et ajustement' },
    { name: 'Pleine Lune', emoji: '🌕', description: 'Illumination et clarté' },
    { name: 'Gibbeuse décroissante', emoji: '🌖', description: 'Gratitude et partage' },
    { name: 'Dernier quartier', emoji: '🌗', description: 'Lâcher prise et pardon' },
    { name: 'Dernier croissant', emoji: '🌘', description: 'Introspection et repos' },
  ];
  return phases[phaseIndex];
}

// Daily streak tracking — increments when visiting on consecutive days
// (server-side authoritative, see server.js updateStreak()).
// Local helper kept for backward compat with any stray callers; prefer user.streak from server.
function updateStreak(): number {
  const KEY = 'celeste_streak';
  let data: { count: number; lastVisit: string };
  try {
    data = JSON.parse(localStorage.getItem(KEY) || '{"count":0,"lastVisit":""}');
  } catch {
    data = { count: 0, lastVisit: '' };
  }
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let count = data.count || 0;
  if (data.lastVisit === today) {
    // already counted today — no change
  } else if (data.lastVisit === yesterday) {
    count = count + 1;
  } else {
    count = 1;
  }
  localStorage.setItem(KEY, JSON.stringify({ count, lastVisit: today }));
  return count;
}

export { updateStreak };

export function Home({ user, onNavigate }: { user: User; onNavigate: (s: Screen) => void }) {
  // Hooks MUST be called unconditionally — Rules of Hooks.
  // useMemo with [] would freeze at mount and not rotate at midnight.
  // Recomputing on each render is fine — DAILY_QUOTES lookup is O(1).
  const dailyQuote = useMemo(() => getDailyQuote(), [Date.now() / 86400000 | 0]);
  // Streak comes from the server (authoritative — increments on first
  // horoscope view of the day). Falls back to 0 if not yet hydrated.
  const streak = user.streak ?? 0;

  // Moon phase: try server (astronomy-engine precise), fallback to local.
  const [moonPhase, setMoonPhase] = useState<{ name: string; emoji: string; description: string }>(
    () => getMoonPhaseLocal()
  );
  useEffect(() => {
    let cancelled = false;
    api.getMoonPhase()
      .then(p => { if (!cancelled) setMoonPhase({ name: p.name, emoji: p.emoji, description: p.description }); })
      .catch(() => { /* keep local fallback */ });
    return () => { cancelled = true; };
  }, []);

  // Safe early return AFTER all hooks — replaced "return null" by a visible
  // diagnostic so we never silently ship a black screen again. See TG convo
  // 2026-07-11: post-login black screen = Home rendered null because user.natalChart
  // wasn't hydrated fast enough.
  if (!user.natalChart) {
    return (
      <div className="cosmic-bg star-field min-h-screen flex flex-col items-center justify-center text-night-100 px-6">
        <div className="text-4xl mb-4 animate-float-slow">✦</div>
        <h2 className="text-xl font-semibold text-gold-gradient mb-2">Préparation de votre ciel</h2>
        <p className="text-night-300 text-sm text-center max-w-xs">
          Chargement du thème natal en cours — cela prend généralement 1 à 2 secondes.
        </p>
        <p className="text-night-500 text-xs mt-4 text-center max-w-xs">
          Connecté : {user.email}.{user.birthData
            ? ' Données de naissance détectées.'
            : ' Aucune donnée de naissance — complétez l\'onboarding.'}
        </p>
      </div>
    );
  }

  const chart = user.natalChart;
  const sun = ZODIAC_SIGNS[chart.sun];
  const moon = ZODIAC_SIGNS[chart.moon];
  const rising = ZODIAC_SIGNS[chart.rising];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // stagger delays
  const d = (i: number) => ({ animationDelay: `${0.05 * i}s` });

  return (
    <div className="px-5 pt-12 relative z-10">
      <StreakCelebration streak={streak} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <p className="text-night-400 text-sm capitalize">{today}</p>
          <h1 className="text-2xl font-bold text-gold-gradient">Bonjour</h1>
        </div>
        <div className="flex items-center gap-2">
          {streak >= 2 ? (
            <span className="text-xs text-gold-400 font-semibold bg-gold-500/10 px-3 py-1.5 rounded-full border border-gold-500/30 flex items-center gap-1">
              🔥 {streak} jours
            </span>
          ) : streak >= 1 ? (
            <span className="text-xs text-gold-400 font-medium bg-gold-500/10 px-3 py-1.5 rounded-full border border-gold-500/30">
              ✨ Premier jour
            </span>
          ) : null}
          <div className="w-11 h-11 rounded-full glass-gold border border-gold-500/20 flex items-center justify-center animate-float-slow">
            <span className="text-xl">{sun.emoji}</span>
          </div>
        </div>
      </div>

      {/* Message of the day */}
      <div className="glass-frost rounded-3xl p-5 mb-5 stagger-card card-glow flex items-start gap-3" style={d(1)}>
        <div className="w-9 h-9 rounded-full glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-base">✦</span>
        </div>
        <div>
          <p className="text-night-400 text-[10px] uppercase tracking-widest mb-1">Message du jour</p>
          <p className="text-night-100 text-sm italic leading-relaxed">{dailyQuote}</p>
        </div>
      </div>

      {/* Moon phase widget */}
      <div className="glass rounded-3xl p-5 mb-5 stagger-card card-glow flex items-center gap-4 animate-fade-in" style={d(2)}>
        <div className="text-4xl flex-shrink-0" aria-hidden="true">{moonPhase.emoji}</div>
        <div>
          <p className="text-night-400 text-[10px] uppercase tracking-widest mb-1">Phase de la Lune</p>
          <p className="text-night-100 font-semibold text-sm">{moonPhase.name}</p>
          <p className="text-night-300 text-xs leading-relaxed mt-0.5">{moonPhase.description}</p>
        </div>
      </div>

      {/* Subtle premium banner (non-intrusive) */}
      {!user.isPremium && (
        <button
          onClick={() => onNavigate('paywall')}
          className="w-full glass rounded-2xl px-4 py-3 mb-5 flex items-center justify-between stagger-card hover:border-gold-500/30 border border-transparent transition-all duration-300"
          style={d(3)}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-gold-400 text-sm">✦</span>
            <div className="text-left">
              <p className="text-night-100 text-xs font-medium">Passez Premium</p>
              <p className="text-night-500 text-[11px]">Horoscope & compatibilité illimitées</p>
            </div>
          </div>
          <span className="text-gold-400 text-xs">Découvrir →</span>
        </button>
      )}

      {/* Big 3 */}
      <div className="glass rounded-3xl p-6 mb-5 stagger-card card-glow" style={d(4)}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-4">Votre triplet astral</p>
        <div className="grid grid-cols-3 gap-3">
          {[{ label: 'Soleil', sign: sun },
            { label: 'Lune', sign: moon },
            { label: 'Ascendant', sign: rising }].map(({ label, sign }) => (
            <div key={label} className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-2 transition-transform hover:scale-110"
                   style={{ background: `${sign.color}18`, border: `1px solid ${sign.color}40`, boxShadow: `0 0 16px ${sign.color}15` }}>
                <span className="text-2xl" style={{ color: sign.color }}>{sign.symbol}</span>
              </div>
              <p className="text-night-400 text-xs">{label}</p>
              <p className="text-night-100 font-semibold text-sm">{sign.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Horoscope Preview */}
      <button onClick={() => onNavigate('horoscope')}
        className="w-full glass rounded-3xl p-5 mb-5 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group stagger-card card-glow" style={d(5)}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-gold-400 text-sm font-medium">Horoscope du jour</p>
          <span className="text-night-400 text-xs group-hover:text-gold-400 group-hover:translate-x-1 transition-all">→</span>
        </div>
        <p className="text-night-200 text-sm leading-relaxed">
          {user.isPremium
            ? "Votre horoscope personnalisé vous attend."
            : "Découvrez ce que les planètes réservent à VOTRE thème natal aujourd'hui."}
        </p>
      </button>

      {/* Element Balance */}
      <div className="glass rounded-3xl p-5 mb-5 stagger-card" style={d(6)}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Votre énergie dominante</p>
        <div className="flex items-end gap-3 mb-3">
          {(['fire', 'earth', 'air', 'water'] as const).map(el => {
            const colors = { fire: '#ef4444', earth: '#22c55e', air: '#fbbf24', water: '#6366f1' };
            const labels = { fire: 'Feu', earth: 'Terre', air: 'Air', water: 'Eau' };
            const count = chart.elements[el];
            const pct = Math.max(10, Math.round((count / 10) * 100));
            return (
              <div key={el} className="flex-1">
                <div className="h-16 rounded-xl glass relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 rounded-xl transition-all duration-700"
                       style={{ height: `${pct}%`, background: `linear-gradient(to top, ${colors[el]}, ${colors[el]}aa)` }} />
                </div>
                <p className="text-center text-night-400 text-xs mt-1">{labels[el]}</p>
                <p className="text-center text-night-200 text-sm font-bold">{count}</p>
              </div>
            );
          })}
        </div>
        <p className="text-night-300 text-sm leading-relaxed">{elementDescription(chart.elements)}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => onNavigate('chart')}
          className="glass rounded-2xl p-4 text-left hover:border-cosmic-500/40 border border-transparent transition-all duration-300 group stagger-card" style={d(7)}>
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">⭐</div>
          <p className="text-night-100 font-semibold text-sm">Mon thème natal</p>
          <p className="text-night-400 text-xs">Toutes vos planètes</p>
        </button>
        <button onClick={() => onNavigate('compatibility')}
          className="glass rounded-2xl p-4 text-left hover:border-cosmic-500/40 border border-transparent transition-all duration-300 group stagger-card" style={d(8)}>
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">💫</div>
          <p className="text-night-100 font-semibold text-sm">Compatibilité</p>
          <p className="text-night-400 text-xs">Analysez votre couple</p>
        </button>
      </div>

      {/* Onboarding (Feature A2) */}
      <div className="stagger-card" style={d(0)}>
        <OnboardingChecklist />
      </div>
      {/* Daily Aspects (Feature 9) */}
      <div className="mb-6 stagger-card" style={d(9)}>
        <DailyAspects />
      </div>
      {/* Daily Rituals (Feature A1) */}
      <div className="mb-6 stagger-card" style={d(10)}>
        <DailyRituals />
      </div>
      {/* Astrological Houses (Feature B1) */}
      <div className="mb-6 stagger-card" style={d(11)}>
        <HousesChart />
      </div>
      {/* Asteroid Insights (Feature B2) */}
      <div className="mb-6 stagger-card" style={d(12)}>
        <AsteroidInsights />
      </div>
      {/* Lunar Nodes (Feature B3) */}
      <div className="mb-6 stagger-card" style={d(13)}>
        <LunarNodes />
      </div>
      {/* Weekly Challenge (Feature C3) */}
      <div className="mb-6 stagger-card" style={d(14)}>
        <WeeklyChallenge />
      </div>
    </div>
  );
}
