import type { User, PlanetPosition, ZodiacSign } from '../types';
import { ZODIAC_SIGNS, ZODIAC_ORDER, PLANET_DATA, formatDegree } from '../data/zodiac';

export function ChartView({ user }: { user: User }) {
  if (!user.natalChart) return null;
  const chart = user.natalChart;

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-1 text-gold-gradient">Thème natal</h1>
      <p className="text-night-400 text-sm mb-6">
        {user.birthData?.city}, {user.birthData?.date}
      </p>

      {/* SVG Chart Wheel */}
      <div className="glass rounded-3xl p-6 mb-6 flex justify-center">
        <svg width="320" height="320" viewBox="0 0 320 320">
          {/* Outer circle */}
          <circle cx="160" cy="160" r="150" fill="none" stroke="#383964" strokeWidth="1" />
          <circle cx="160" cy="160" r="135" fill="none" stroke="#383964" strokeWidth="0.5" />

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
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#56589c" strokeWidth="0.5" />
                <text x={tx} y={ty} fill={ZODIAC_SIGNS[sign].color} fontSize="10" textAnchor="middle" dominantBaseline="middle" opacity="0.8">
                  {ZODIAC_SIGNS[sign].symbol}
                </text>
              </g>
            );
          })}

          {/* House dividers */}
          {chart.houses.map((house, i) => {
            const angle = (i * 30 - 90) * Math.PI / 180;
            const x = 160 + 120 * Math.cos(angle);
            const y = 160 + 120 * Math.sin(angle);
            return <line key={i} x1="160" y1="160" x2={x} y2={y} stroke="#2a2b4d" strokeWidth="0.5" opacity="0.5" />;
          })}

          {/* Inner circles */}
          <circle cx="160" cy="160" r="120" fill="none" stroke="#2a2b4d" strokeWidth="0.5" />
          <circle cx="160" cy="160" r="40" fill="none" stroke="#56589c" strokeWidth="0.5" opacity="0.5" />

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
                <circle cx={x} cy={y} r="9" fill="#1e1f3a" stroke={planetData.color} strokeWidth="1" />
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
