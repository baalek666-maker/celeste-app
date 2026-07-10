import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ZODIAC_ORDER, ZODIAC_SIGNS, PLANET_DATA } from '../data/zodiac';

interface Transit {
  sign: string;
  degree: number;
  longitude: number;
  retrograde: boolean;
}

interface SkyMapProps {
  size?: number; // SVG size in px
}

const PLANET_ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/**
 * Convert an absolute ecliptic longitude (0-360°) to an SVG angle.
 * Convention: 0° = Aries = left (9 o'clock). Increases counter-clockwise.
 * In SVG, 0° is at 3 o'clock and rotates clockwise, so:
 *   svgAngle = 180 - longitude (in radians)
 */
function lonToSvgAngle(lon: number): number {
  // Returns angle in radians for SVG circle position
  return ((180 - lon) * Math.PI) / 180;
}

function lonToXY(lon: number, radius: number, cx: number, cy: number): [number, number] {
  const a = lonToSvgAngle(lon);
  return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
}

export default function SkyMap({ size = 320 }: SkyMapProps) {
  const [transits, setTransits] = useState<Record<string, Transit> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getTransitsToday()
      .then(res => {
        if (mounted) {
          setTransits(res.transits);
          setLoading(false);
        }
      })
      .catch(e => {
        if (mounted) {
          setErr(e.message || 'Erreur de chargement');
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 24;
  const planetOrbit = r - 28;

  if (loading) {
    return (
      <div className="glass rounded-3xl p-4 mb-4 flex items-center justify-center" style={{ height: size }}>
        <p className="text-night-400 text-sm">Chargement de la carte du ciel...</p>
      </div>
    );
  }

  if (err || !transits) {
    return (
      <div className="glass rounded-3xl p-4 mb-4">
        <p className="text-rose-400 text-sm">⚠ Carte du ciel indisponible ({err})</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-4 mb-4 animate-fade-in card-glow">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-gold-400 text-xs uppercase tracking-widest">Carte du ciel · aujourd'hui</p>
        <p className="text-night-500 text-xs">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          style={{ animation: 'skymap-spin 240s linear infinite' }}
        >
          <defs>
            <radialGradient id="sky-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#0f172a" stopOpacity="0.1" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Outer zodiac wheel */}
          <circle cx={cx} cy={cy} r={r} fill="url(#sky-grad)" stroke="#475569" strokeWidth="1" opacity="0.6" />

          {/* 12 sign segments */}
          {ZODIAC_ORDER.map((sign, i) => {
            const lonStart = i * 30;
            const [x1, y1] = lonToXY(lonStart, r, cx, cy);
            const [x2, y2] = lonToXY(lonStart, r - 14, cx, cy);
            return (
              <g key={sign}>
                <line
                  x1={cx + Math.cos(lonToSvgAngle(lonStart)) * (r - 14)}
                  y1={cy + Math.sin(lonToSvgAngle(lonStart)) * (r - 14)}
                  x2={x1}
                  y2={y1}
                  stroke="#475569"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
                <text
                  x={cx + Math.cos(lonToSvgAngle(lonStart + 15)) * (r - 22)}
                  y={cy + Math.sin(lonToSvgAngle(lonStart + 15)) * (r - 22)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="14"
                  fill={ZODIAC_SIGNS[sign].color}
                  opacity="0.85"
                >
                  {ZODIAC_SIGNS[sign].symbol}
                </text>
              </g>
            );
          })}

          {/* Inner planet orbit */}
          <circle cx={cx} cy={cy} r={planetOrbit} fill="none" stroke="#334155" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.5" />

          {/* Center point */}
          <circle cx={cx} cy={cy} r="2" fill="#fbbf24" opacity="0.6" />

          {/* Planets */}
          {PLANET_ORDER.map((p) => {
            const t = transits[p];
            if (!t) return null;
            const [x, y] = lonToXY(t.longitude, planetOrbit, cx, cy);
            const planet = PLANET_DATA[p];
            if (!planet) return null;
            return (
              <g key={p} className="skymap-planet" style={{ animation: 'skymap-pulse 3s ease-in-out infinite' }}>
                <circle cx={x} cy={y} r="11" fill={planet.color} opacity="0.18" />
                <circle cx={x} cy={y} r="5" fill={planet.color} opacity="0.9" />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill="#fff"
                  fontWeight="bold"
                >
                  {planet.symbol}
                </text>
                {t.retrograde && (
                  <text
                    x={x + 8}
                    y={y - 8}
                    fontSize="7"
                    fill="#ef4444"
                    fontWeight="bold"
                  >℞</text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Static legend overlay (counter-rotates so it stays readable) */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none"
          style={{ animation: 'skymap-spin 240s linear infinite reverse' }}
        />
      </div>

      <style>{`
        @keyframes skymap-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes skymap-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* Compact legend below */}
      <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        {PLANET_ORDER.filter(p => transits[p]).map(p => {
          const t = transits[p];
          const planet = PLANET_DATA[p];
          const sign = ZODIAC_SIGNS[t.sign as keyof typeof ZODIAC_SIGNS];
          return (
            <div key={p} className="flex items-center gap-1 text-night-300">
              <span style={{ color: planet.color }} className="text-sm leading-none">{planet.symbol}</span>
              <span className="truncate">
                {sign.symbol} {Math.floor(t.degree)}°
                {t.retrograde && <span className="text-rose-400 ml-0.5">℞</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}