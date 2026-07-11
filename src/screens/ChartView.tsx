import { useState } from 'react';
import type { User } from '../types';
import { ZODIAC_SIGNS, PLANET_DATA } from '../data/zodiac';
import NatalChart from '../components/NatalChart';

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
        <NatalChart size={340} />
      </div>

      {/* Planet Details */}
      <div className="space-y-3 mb-6">
        {chart.positions.map(pos => {
          const signData = ZODIAC_SIGNS[pos.sign];
          const planetData = PLANET_DATA[pos.planet];
          return (
            <div key={pos.planet} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: `${planetData.color}18`, border: `1px solid ${planetData.color}33` }}>
                <span className="text-xl" style={{ color: planetData.color }}>{planetData.symbol}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-night-100 font-semibold">{planetData.name}</p>
                  {pos.retrograde && <span className="text-xs text-red-400 font-mono">℞ rétrograde</span>}
                </div>
                <p className="text-night-400 text-sm">
                  en <span className="text-night-200">{signData.name}</span> {signData.symbol} · Maison {pos.house}
                </p>
                <p className="text-night-500 text-xs mt-0.5">{planetData.meaning}</p>
              </div>
              <div className="text-right">
                <p className="text-night-300 text-xs font-mono">{Math.floor(pos.degree)}°</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
