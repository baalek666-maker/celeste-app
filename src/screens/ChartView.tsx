import { useState } from 'react';
import type { User } from '../types';
import { ZODIAC_SIGNS } from '../data/zodiac';
import NatalChart from '../components/NatalChart';
import { PlanetDetailCard } from '../components/PlanetDetailCard';

export function ChartView({ user }: { user: User }) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'copied' | 'error'>('idle');

  if (!user.natalChart) {
    return (
      <div className="px-5 pt-12 pb-4 animate-pulse">
        <div className="h-8 w-48 bg-night-800 rounded mb-2" />
        <div className="h-4 w-32 bg-night-800 rounded mb-8" />
        <div className="glass rounded-3xl p-6 mb-6 flex justify-center">
          <div className="w-80 h-80 rounded-full border-2 border-gold-500/10" />
        </div>
        <div className="h-16 glass rounded-2xl mb-3" />
        <div className="h-16 glass rounded-2xl mb-3" />
        <div className="h-16 glass rounded-2xl mb-3" />
      </div>
    );
  }
  const chart = user.natalChart;
  const sunSign = ZODIAC_SIGNS[chart.sun] ?? ZODIAC_SIGNS.aries;
  const moonSign = ZODIAC_SIGNS[chart.moon] ?? ZODIAC_SIGNS.cancer;
  const risingSign = ZODIAC_SIGNS[chart.rising] ?? ZODIAC_SIGNS.aries;

  const shareText = `ciel de naissance ☉ ${sunSign.name} ${sunSign.symbol} | ☽ ${moonSign.name} ${moonSign.symbol} | AC ${risingSign.name} ${risingSign.symbol}`;

  const handleShare = async () => {
    setShareStatus('sharing');
    const shareData = {
      title: 'Mon thème astral — Céleste',
      text: `Voici mon ciel de naissance :\n☉ Soleil en ${sunSign.name}\n☽ Lune en ${moonSign.name}\nASC ${risingSign.name}\n\nDécouvre le vôtre sur Céleste ✨`,
      url: window.location.origin,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2000);
      } else {
        throw new Error('no share or clipboard');
      }
    } catch (e: unknown) {
      // User cancelling the share sheet is not an error
      if (e instanceof Error && e.name === 'AbortError') { setShareStatus('idle'); return; }
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 2000);
    }
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-gold-gradient">Thème natal</h1>
        <button
          onClick={handleShare}
          disabled={shareStatus === 'sharing'}
          className="glass-gold rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-gold-300 border border-gold-500/20 hover:border-gold-500/40 transition-all disabled:opacity-50"
          aria-label="Partager mon thème astral"
        >
          {shareStatus === 'sharing' ? '…' : shareStatus === 'copied' ? '✓ Copié' : shareStatus === 'error' ? '✕' : '🔗'}
          <span className="hidden xs:inline">{shareStatus === 'idle' ? 'Partager' : ''}</span>
        </button>
      </div>
      <p className="text-night-400 text-sm mb-6">
        {user.birthData ? `${user.birthData.city || ''}, ${user.birthData.date || ''}`.replace(/^,\s$/, '') : ''}
      </p>

      {/* Premium natal chart wheel */}
      <div className="mb-2">
        <NatalChart />
      </div>

      {/* P2 — Mini légende « ? » : planètes + 12 maisons (wow onboarding sec) */}
      <details className="glass rounded-2xl px-4 py-3 mb-6 group">
        <summary className="flex items-center justify-between cursor-pointer text-night-300 text-xs">
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-cosmic-500/20 text-cosmic-300 flex items-center justify-center font-bold">?</span>
            <span>Comment lire ce thème ?</span>
          </span>
          <span className="text-cosmic-400 text-base group-open:rotate-180 transition-transform">▾</span>
        </summary>

        <div className="mt-4 space-y-4 text-xs leading-relaxed">
          {/* Planètes */}
          <div>
            <p className="text-gold-300 font-semibold mb-2 uppercase tracking-wider">Planètes</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-night-300">
              {[
                ['☉', 'Soleil', 'toi profond'],
                ['☽', 'Lune', 'tes émotions'],
                ['☿', 'Mercure', 'ta pensée'],
                ['♀', 'Vénus', 'ton cœur'],
                ['♂', 'Mars', 'ton élan'],
                ['♃', 'Jupiter', 'ton expansion'],
                ['♄', 'Saturne', 'ta structure'],
                ['♅', 'Uranus', 'ta rébellion'],
                ['♆', 'Neptune', 'ton intuition'],
                ['♇', 'Pluton', 'ta mue'],
              ].map(([g, n, hint]) => (
                <div key={g} className="flex items-center gap-1.5">
                  <span className="text-gold-400 w-4 text-center">{g}</span>
                  <span className="text-night-100">{n}</span>
                  <span className="text-night-500">· {hint}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Maisons */}
          <div>
            <p className="text-cosmic-300 font-semibold mb-2 uppercase tracking-wider">Maisons</p>
            <p className="text-night-400 mb-2">12 secteurs de vie, dans l'ordre des aiguilles d'une montre (Maison 1 = Ascendant, à gauche).</p>
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-night-300">
              {[
                'Identité', 'Finances', 'Communication', 'Foyer',
                'Amour', 'Travail', 'Associations', 'Intimité',
                'Voyages', 'Carrière', 'Communauté', 'Spiritualité',
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-cosmic-400 w-5 text-right tabular-nums">{i+1}</span>
                  <span className="text-night-200">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* Planet Details — clickable expandable cards */}
      <div className="space-y-3 mb-6">
        <p className="text-night-400 text-xs uppercase tracking-widest px-1">Tes planètes en détail</p>
        {chart.positions.map(pos => (
          <PlanetDetailCard
            key={pos.planet}
            planet={pos.planet}
            sign={pos.sign}
            degree={pos.degree}
            house={pos.house}
            retrograde={pos.retrograde}
          />
        ))}
      </div>
    </div>
  );
}
