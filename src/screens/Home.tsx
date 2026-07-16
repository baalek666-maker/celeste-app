import type { User } from '../types';
import type { Screen } from '../App';
import { useEffect, useState } from 'react';
import { api, getToken } from '../lib/api';
import { ZODIAC_SIGNS } from '../data/zodiac';
import { calculateNatalChart } from '../lib/astrology';
import StreakCelebration from '../components/StreakCelebration';
import NatalChart from '../components/NatalChart';
import DailyEnergy from '../components/DailyEnergy';
import LunarCycle from '../components/LunarCycle';
import MoodCheckin from '../components/MoodCheckin';

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

      {/* ── 2. Big 3 compact ── */}
      <div className="glass rounded-3xl p-5 mb-5 stagger-card card-glow animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Tes trois astres</p>
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

      {/* ── 2b. Énergie du jour (personalized astro-forecast + reflection) ── */}
      <DailyEnergy />

      {/* ── 2c. Check-in humeur + cycle lunaire ── */}
      <MoodCheckin />
      <LunarCycle />

      {/* ── 2. Horoscope du jour — la star ── */}
      <button
        onClick={() => onNavigate('horoscope')}
        className="w-full glass rounded-3xl p-5 mb-3 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group stagger-card card-glow"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gold-400 text-sm font-medium">Horoscope du jour</p>
            <p className="text-night-300 text-xs mt-0.5">
              {user.isPremium ? "Ta lecture t'attend →" : 'Découvre ta journée →'}
            </p>
          </div>
          <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </button>

      {/* ── 3. Theme natal (roue astronomique precise) ── */}
      <NatalChart />

      {/* ── 5b. Saved profiles preview (P2.3) ── */}
      <SavedProfilesPreview onNavigate={onNavigate} />

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

// ── P2.3: Saved profiles preview on Home ──
type HomeProfile = {
  id: number;
  name: string;
  relation: string;
  birthData: { date: string; time: string; city: string; latitude: number; longitude: number; timezone: number; country?: string };
};

const RELATION_ICONS: Record<string, string> = {
  self: '✨', family: '🌳', friend: '🌟', partner: '💞', child: '🧸', other: '🌀',
};

function SavedProfilesPreview({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [profiles, setProfiles] = useState<HomeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    let cancelled = false;
    api.listProfiles().then(({ profiles }) => {
      if (!cancelled) { setProfiles(profiles); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Don't render if loading or no profiles
  if (loading || profiles.length === 0) return null;

  // Show up to 4 profile avatars in a horizontal scroll
  const visible = profiles.slice(0, 4);
  const extra = profiles.length - visible.length;

  return (
    <button
      onClick={() => onNavigate('settings')}
      className="w-full glass rounded-2xl p-4 mb-3 text-left hover:border-gold-500/30 border border-transparent transition-all duration-300 group stagger-card"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-night-200 text-sm font-medium">Profils enregistrés</p>
        <span className="text-night-500 text-xs group-hover:text-gold-400 transition">Gérer →</span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {visible.map((p) => {
          const chart = calculateNatalChart({ ...p.birthData, country: p.birthData.country ?? '' });
          const sunSign = chart ? ZODIAC_SIGNS[chart.sun] : null;
          return (
            <div
              key={p.id}
              className="flex-shrink-0 flex items-center gap-2 glass rounded-xl px-3 py-2 border border-night-700/50"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={sunSign ? { background: `${sunSign.color}18`, border: `1px solid ${sunSign.color}40` } : undefined}
              >
                {sunSign ? sunSign.symbol : '✦'}
              </div>
              <div className="min-w-0">
                <p className="text-night-100 text-xs font-medium truncate max-w-[80px]">{p.name}</p>
                <p className="text-night-500 text-[10px]">{RELATION_ICONS[p.relation] || '·'} {sunSign?.name || ''}</p>
              </div>
            </div>
          );
        })}
        {extra > 0 && (
          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full glass border border-night-700/50 text-night-400 text-xs font-medium">
            +{extra}
          </div>
        )}
      </div>
    </button>
  );
}
