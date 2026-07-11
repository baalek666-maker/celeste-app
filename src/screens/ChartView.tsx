import { useState } from 'react';
import type { User, PlanetPosition, ZodiacSign } from '../types';
import { ZODIAC_SIGNS, ZODIAC_ORDER, PLANET_DATA, formatDegree } from '../data/zodiac';

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

      {/* SVG Chart Wheel */}
      <div className="glass rounded-3xl p-6 mb-6 flex justify-center">
        <svg width="320" height="320" viewBox="0 0 320 320">
          {/* Outer circle */}
          <circle cx="160" cy="160" r="150" fill="none" stroke="rgba(197,160,89,0.25)" strokeWidth="1" />
          <circle cx="160" cy="160" r="135" fill="none" stroke="rgba(197,160,89,0.15)" strokeWidth="0.5" />

          {/* Zodiac sign dividers (12 segments) */}
          {ZODIAC_ORDER.map((sign, i) => {
            const angle = (i * 30 - 90) * Math.PI / 180;
            const x1 = 160 + 135 * Math.cos(angle);
            const y1 = 160 + 135 * Math.sin(angle);
            const x2 = 160 + 150 * Math.cos(angle);
            const y2 = 160 + 150 * Math.sin(angle);
            const textAngle = (i * 30 + 15 - 90) * Math.PI / 180;
            const tx = 160 + 142 * Math.cos(textAngle);
            const ty = 160 + 142 * Math.sin(textAngle);
            return (
              <g key={sign}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(197,160,89,0.3)" strokeWidth="0.5" />
                <text x={tx} y={ty} fill={ZODIAC_SIGNS[sign].color} fontSize="10" textAnchor="middle" dominantBaseline="middle" opacity="0.8">
                  {ZODIAC_SIGNS[sign].symbol}
                </text>
              </g>
            );
          })}

          {/* House dividers — use REAL cusps from chart.houses, not fixed 30° intervals */}
          {chart.houses.map((house, i) => {
            // house.cusp is in absolute degrees (0-360). Convert to SVG angle:
            // subtract 90° so 0° Aries renders at the top (12 o'clock).
            const angle = (house.cusp - 90) * Math.PI / 180;
            const x = 160 + 120 * Math.cos(angle);
            const y = 160 + 120 * Math.sin(angle);
            return (
              <g key={`house-${i}`}>
                <line x1="160" y1="160" x2={x} y2={y} stroke="rgba(197,160,89,0.12)" strokeWidth="0.5" opacity="0.5" />
                {/* house number near the rim */}
                {(() => {
                  const labelAngle = (house.cusp + 15 - 90) * Math.PI / 180;
                  const lx = 160 + 128 * Math.cos(labelAngle);
                  const ly = 160 + 128 * Math.sin(labelAngle);
                  return (
                    <text x={lx} y={ly} fill="rgba(197,160,89,0.5)" fontSize="7" textAnchor="middle" dominantBaseline="middle" opacity="0.6">
                      {i + 1}
                    </text>
                  );
                })()}
              </g>
            );
          })}

          {/* Inner circles */}
          <circle cx="160" cy="160" r="120" fill="none" stroke="rgba(197,160,89,0.1)" strokeWidth="0.5" />
          <circle cx="160" cy="160" r="40" fill="none" stroke="rgba(197,160,89,0.2)" strokeWidth="0.5" opacity="0.5" />

          {/* Planet positions */}
          {chart.positions.map(pos => {
            const signIdx = ZODIAC_ORDER.indexOf(pos.sign);
            const totalDeg = signIdx * 30 + pos.degree;
            const angle = (totalDeg - 90) * Math.PI / 180;
            const radius = 75;
            const x = 160 + radius * Math.cos(angle);
            const y = 160 + radius * Math.sin(angle);
            const planetData = PLANET_DATA[pos.planet];
            return (
              <g key={pos.planet}>
                <circle cx={x} cy={y} r="9" fill="#0a0a0a" stroke={planetData.color} strokeWidth="1" />
                <text x={x} y={y} fill={planetData.color} fontSize="9" textAnchor="middle" dominantBaseline="middle">
                  {planetData.symbol}
                </text>
                {pos.retrograde && (
                  <text x={x + 8} y={y - 8} fill="#ef4444" fontSize="7" textAnchor="middle">℞</text>
                )}
              </g>
            );
          })}

          {/* Center */}
          <circle cx="160" cy="160" r="3" fill="#fbbf24" opacity="0.6" />
        </svg>
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
