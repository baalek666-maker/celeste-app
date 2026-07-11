import { useState } from 'react';
import type { User } from '../types';
import { ZODIAC_SIGNS } from '../data/zodiac';
import NatalChart from '../components/NatalChart';
import { PlanetDetailCard } from '../components/PlanetDetailCard';

export function ChartView({ user }: { user: User }) {
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
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'copied' | 'error'>('idle');

  const sunSign = ZODIAC_SIGNS[chart.sun];
  const moonSign = ZODIAC_SIGNS[chart.moon];
  const risingSign = ZODIAC_SIGNS[chart.rising];

  const shareText = `ciel de naissance ☉ ${sunSign.name} ${sunSign.symbol} | ☽ ${moonSign.name} ${moonSign.symbol} | AC ${risingSign.name} ${risingSign.symbol}`;

  const handleShare = async () => {
    setShareStatus('sharing');
    const shareData = {
      title: 'Mon thème astral — Céleste',
      text: `Voici mon ciel de naissance :\n☉ Soleil en ${sunSign.name}\n☽ Lune en ${moonSign.name}\nASC ${risingSign.name}\n\nDécouvrez le vôtre sur Céleste ✨`,
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
    } catch (e: any) {
      // User cancelling the share sheet is not an error
      if (e?.name === 'AbortError') { setShareStatus('idle'); return; }
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
        {user.birthData?.city}, {user.birthData?.date}
      </p>

      {/* Premium natal chart wheel */}
      <div className="mb-2">
        <NatalChart />
      </div>

      {/* Planet Details — clickable expandable cards */}
      <div className="space-y-3 mb-6">
        <p className="text-night-400 text-xs uppercase tracking-widest px-1">Vos planètes en détail</p>
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
