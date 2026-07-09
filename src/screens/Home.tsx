import type { User } from '../types';
import type { Screen } from '../App';
import { ZODIAC_SIGNS } from '../data/zodiac';
import { elementDescription } from '../lib/astrology';

export function Home({ user, onNavigate }: { user: User; onNavigate: (s: Screen) => void }) {
  if (!user.natalChart) return null;
  const chart = user.natalChart;
  const sun = ZODIAC_SIGNS[chart.sun];
  const moon = ZODIAC_SIGNS[chart.moon];
  const rising = ZODIAC_SIGNS[chart.rising];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="px-5 pt-12 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <p className="text-night-400 text-sm capitalize">{today}</p>
          <h1 className="text-2xl font-bold text-gold-gradient">Bonjour</h1>
        </div>
        <div className="w-11 h-11 rounded-full glass-gold border border-gold-500/20 flex items-center justify-center animate-float-slow">
          <span className="text-xl">{sun.emoji}</span>
        </div>
      </div>

      {/* Big 3 */}
      <div className="glass rounded-3xl p-6 mb-5 animate-scale-in card-glow">
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
        className="w-full glass rounded-3xl p-5 mb-5 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group card-glow">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gold-400 text-sm font-medium">Horoscope du jour</p>
          <span className="text-night-400 text-xs group-hover:text-gold-400 group-hover:translate-x-1 transition-all">→</span>
        </div>
        <p className="text-night-200 text-sm leading-relaxed">
          {user.isPremium
            ? "Votre horoscope personnalisé vous attend."
            : "Découvrez ce que les planètes réservent à VOTRE thème natal aujourd'hui."}
        </p>
        {!user.isPremium && (
          <span className="inline-block mt-2 px-3 py-1 rounded-full bg-gold-500/20 text-gold-300 text-xs font-medium">✦ Premium</span>
        )}
      </button>

      {/* Element Balance */}
      <div className="glass rounded-3xl p-5 mb-5 animate-fade-in">
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
          className="glass rounded-2xl p-4 text-left hover:border-cosmic-500/40 border border-transparent transition-all duration-300 group">
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">⭐</div>
          <p className="text-night-100 font-semibold text-sm">Mon thème natal</p>
          <p className="text-night-400 text-xs">Toutes vos planètes</p>
        </button>
        <button onClick={() => onNavigate('compatibility')}
          className="glass rounded-2xl p-4 text-left hover:border-cosmic-500/40 border border-transparent transition-all duration-300 group">
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">💫</div>
          <p className="text-night-100 font-semibold text-sm">Compatibilité</p>
          <p className="text-night-400 text-xs">Analysez votre couple</p>
        </button>
      </div>
    </div>
  );
}
