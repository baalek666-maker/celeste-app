import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';

// ─── Types ──────────────────────────────────────────────
interface PlanetPos {
  longitude: number;
  degree?: number;
  sign?: string;
  retrograde?: boolean;
}
interface HouseCusp { number: number; cusp: number; sign: string; }
const ALL_BODIES = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode'] as const;
type BodyKey = typeof ALL_BODIES[number];
interface Aspect { p1: BodyKey | string; p2: BodyKey | string; type: string; angle: number; orb: number; color: string; }
interface NatalData {
  sun?: PlanetPos; moon?: PlanetPos; mercury?: PlanetPos; venus?: PlanetPos;
  mars?: PlanetPos; jupiter?: PlanetPos; saturn?: PlanetPos; uranus?: PlanetPos;
  neptune?: PlanetPos; pluto?: PlanetPos; northNode?: PlanetPos; southNode?: PlanetPos;
  ascendant?: { longitude: number; sign: string; degree: number };
  midheaven?: { longitude: number; sign: string; degree: number };
  houses?: HouseCusp[];
  aspects?: Aspect[];
}

// ─── Visual constants ───────────────────────────────────
const PLANET_META: Record<string, { symbol: string; color: string; label: string }> = {
  sun:       { symbol: '\u2609', color: '#fbbf24', label: 'Soleil' },
  moon:      { symbol: '\u263D', color: '#e2e8f0', label: 'Lune' },
  mercury:   { symbol: '\u263F', color: '#a78bfa', label: 'Mercure' },
  venus:     { symbol: '\u2640', color: '#f472b6', label: 'Venus' },
  mars:      { symbol: '\u2642', color: '#ef4444', label: 'Mars' },
  jupiter:   { symbol: '\u2643', color: '#fb923c', label: 'Jupiter' },
  saturn:    { symbol: '\u2644', color: '#d4a574', label: 'Saturne' },
  uranus:    { symbol: '\u2645', color: '#22d3ee', label: 'Uranus' },
  neptune:   { symbol: '\u2646', color: '#3b82f6', label: 'Neptune' },
  pluto:     { symbol: '\u2647', color: '#9333ea', label: 'Pluton' },
  northNode: { symbol: '\u260A', color: '#cbd5e1', label: 'N. Nord' },
  southNode: { symbol: '\u260B', color: '#64748b', label: 'N. Sud' },
};

const ZODIAC: Array<{ symbol: string; color: string; name: string }> = [
  { symbol: '\u2648', color: '#ef4444', name: 'Belier' },      // Aries
  { symbol: '\u2649', color: '#84cc16', name: 'Taureau' },     // Taurus
  { symbol: '\u264A', color: '#06b6d4', name: 'Gemeaux' },     // Gemini
  { symbol: '\u264B', color: '#3b82f6', name: 'Cancer' },      // Cancer
  { symbol: '\u264C', color: '#f97316', name: 'Lion' },        // Leo
  { symbol: '\u264D', color: '#a3a300', name: 'Vierge' },      // Virgo
  { symbol: '\u264E', color: '#22d3ee', name: 'Balance' },     // Libra
  { symbol: '\u264F', color: '#1e40af', name: 'Scorpion' },    // Scorpio
  { symbol: '\u2650', color: '#dc2626', name: 'Sagittaire' },  // Sagittarius
  { symbol: '\u2651', color: '#65a30d', name: 'Capricorne' },  // Capricorn
  { symbol: '\u2652', color: '#0891b2', name: 'Verseau' },    // Aquarius
  { symbol: '\u2653', color: '#2563eb', name: 'Poissons' },    // Pisces
];

// ─── Geometry helpers ───────────────────────────────────
// All angles: ecliptic longitude relative to Ascendant at 9 o'clock (left)
function lonToXY(lon: number, ascLon: number, radius: number, cx: number, cy: number): [number, number] {
  const rel = lon - ascLon;
  const svgAngle = ((180 - rel) * Math.PI) / 180;
  return [cx + Math.cos(svgAngle) * radius, cy + Math.sin(svgAngle) * radius];
}

// Polar to cartesian in SVG space
function polarToXY(angleDeg: number, radius: number, cx: number, cy: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
}

// Arc path between two angles
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polarToXY(startDeg, r, cx, cy);
  const [x2, y2] = polarToXY(endDeg, r, cx, cy);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// ─── Component ──────────────────────────────────────────
export default function NatalChart({ size }: { size?: number }) {
  const [natal, setNatal] = useState<NatalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rotating, setRotating] = useState(true);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    let mounted = true;
    api.getNatalChart()
      .then(res => { if (mounted) { setNatal(res.natal as NatalData); setLoading(false); } })
      .catch(e => { if (mounted) { setErr(e.message || 'Erreur'); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  // Responsive: measure own width via ResizeObserver (works even during loading)
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (size || !ref.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setContainerW(e.contentRect.width);
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [size]);

  const actualSize = size ?? Math.min(containerW || 300, 340);

  if (loading) {
    return (
      <div ref={ref} className="w-full flex items-center justify-center mb-4" style={{ minHeight: 200 }}>
        <p className="text-night-400 text-sm">Calcul de votre thème natal…</p>
      </div>
    );
  }

  if (err || !natal) {
    return (
      <div ref={ref} className="glass rounded-3xl p-4 mb-4">
        <p className="text-rose-400 text-sm">Thème natal indisponible ({err})</p>
      </div>
    );
  }

  const cx = actualSize / 2;
  const cy = actualSize / 2;
  const outerR = actualSize / 2 - 8;
  const zodiacR = outerR - 18;       // inner edge of zodiac ring
  const tickOuterR = zodiacR;
  const tickInnerR = zodiacR - 12;   // degree ticks zone
  const houseR = tickInnerR;          // house lines start here
  const planetR = tickInnerR - 22;   // planet placement ring
  const aspectR = planetR - 8;
  const centerR = 42;

  const ascLon = natal.ascendant?.longitude ?? 0;

  // Anti-collision: spread planets that are within 4 deg
  const planetEntries = ALL_BODIES
    .filter(p => natal[p]?.longitude != null)
    .map(p => ({ key: p, lon: natal[p]!.longitude, meta: PLANET_META[p] }))
    .sort((a, b) => a.lon - b.lon);

  const spread = [...planetEntries];
  for (let i = 0; i < spread.length; i++) {
    for (let j = i + 1; j < spread.length; j++) {
      let d = Math.abs(spread[i].lon - spread[j].lon);
      if (d > 180) d = 360 - d;
      if (d < 5 && d > 0) {
        const offset = (5 - d) / 2;
        spread[j].lon += offset;
        spread[i].lon -= offset;
      }
    }
  }

  return (
    <div className="glass rounded-3xl p-4 mb-4 animate-fade-in card-glow">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-gold-400 text-xs uppercase tracking-widest">Theme Natal</p>
        <button
          onClick={() => setRotating(r => !r)}
          className="text-night-500 text-xs hover:text-gold-400 transition-colors"
        >
          {rotating ? '\u23F8 Pause' : '\u25B6 Animer'}
        </button>
      </div>

      <div ref={ref} className="relative mx-auto" style={{ width: actualSize, height: actualSize }}>
        <svg
          width={actualSize}
          height={actualSize}
          viewBox={`0 0 ${actualSize} ${actualSize}`}
          className="overflow-visible"
          style={rotating ? { animation: 'natal-spin 300s linear infinite' } : undefined}
        >
          <defs>
            <radialGradient id="natal-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#0c0a1e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#020014" stopOpacity="0.1" />
            </radialGradient>
          </defs>

          {/* Background */}
          <circle cx={cx} cy={cy} r={outerR} fill="url(#natal-bg)" />

          {/* ═══ Zodiac ring ═══ */}
          {ZODIAC.map((sign, i) => {
            const lonStart = i * 30;
            const relStart = lonStart - ascLon;
            const relEnd = relStart + 30;
            const svgStart = 180 - relStart;
            const svgEnd = 180 - relEnd;
            // sign symbol position (midpoint)
            const midRel = relStart + 15;
            const [sx, sy] = lonToXY(lonStart + 15, ascLon, (outerR + zodiacR) / 2, cx, cy);
            // arc background for element color tint
            const arcD = arcPath(cx, cy, outerR, svgStart, svgEnd);
            const arcD2 = arcPath(cx, cy, zodiacR, svgStart, svgEnd);
            return (
              <g key={i}>
                {/* element color band */}
                <path
                  d={`${arcD} L ${polarToXY(svgEnd, zodiacR, cx, cy).join(' ')} ${arcD2.replace('M', 'L')} Z`}
                  fill={sign.color}
                  opacity="0.06"
                />
                {/* sign divider line */}
                <line
                  x1={polarToXY(svgStart, zodiacR, cx, cy)[0]}
                  y1={polarToXY(svgStart, zodiacR, cx, cy)[1]}
                  x2={polarToXY(svgStart, outerR, cx, cy)[0]}
                  y2={polarToXY(svgStart, outerR, cx, cy)[1]}
                  stroke="#475569"
                  strokeWidth="0.4"
                  opacity="0.5"
                />
                {/* sign symbol */}
                <text
                  x={sx}
                  y={sy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={actualSize > 320 ? 15 : 12}
                  fill={sign.color}
                  opacity="0.9"
                  style={{ fontWeight: 600 }}
                >
                  {sign.symbol}
                </text>
              </g>
            );
          })}

          {/* Outer border circles */}
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#d4a574" strokeWidth="1.5" opacity="0.5" />
          <circle cx={cx} cy={cy} r={zodiacR} fill="none" stroke="#475569" strokeWidth="0.8" opacity="0.5" />

          {/* ═══ Degree ticks ═══ */}
          {Array.from({ length: 360 }, (_, deg) => {
            const rel = deg - ascLon;
            const svgAngle = 180 - rel;
            const isMajor = deg % 30 === 0;
            const isMid = deg % 10 === 0;
            const isSmall = deg % 5 === 0;
            const tickLen = isMajor ? 10 : isMid ? 6 : isSmall ? 4 : 2;
            const [x1, y1] = polarToXY(svgAngle, tickOuterR, cx, cy);
            const [x2, y2] = polarToXY(svgAngle, tickOuterR - tickLen, cx, cy);
            if (!isSmall) return null; // only show every 5 deg
            return (
              <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isMajor ? '#d4a574' : '#64748b'}
                strokeWidth={isMajor ? 1 : 0.4}
                opacity={isMajor ? 0.7 : 0.4}
              />
            );
          })}

          {/* ═══ House cusps ═══ */}
          {natal.houses?.map(h => {
            if (h.number === 1 || h.number === 7) return null; // ASC/DESC drawn separately
            const [x1, y1] = lonToXY(h.cusp, ascLon, centerR, cx, cy);
            const [x2, y2] = lonToXY(h.cusp, ascLon, houseR, cx, cy);
            const [tx, ty] = lonToXY(h.cusp + 15, ascLon, houseR - 14, cx, cy);
            return (
              <g key={`house-${h.number}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#d4a574" strokeWidth="0.5" opacity="0.3" strokeDasharray="2 3" />
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                  fontSize="8" fill="#94a3b8" opacity="0.5">
                  {h.number}
                </text>
              </g>
            );
          })}

          {/* ═══ Angular cross: ASC/DSC/MC/IC ═══ */}
          {(() => {
            const descLon = ((ascLon + 180) % 360 + 360) % 360;
            const mcLon = natal.midheaven?.longitude ?? 0;
            const icLon = ((mcLon + 180) % 360 + 360) % 360;
            const angles = [
              { lon: ascLon, label: 'ASC' },
              { lon: descLon, label: 'DSC' },
              { lon: mcLon, label: 'MC' },
              { lon: icLon, label: 'FC' },
            ];
            return angles.map(a => {
              const [x1, y1] = lonToXY(a.lon, ascLon, centerR, cx, cy);
              const [x2, y2] = lonToXY(a.lon, ascLon, outerR, cx, cy);
              const [lx, ly] = lonToXY(a.lon, ascLon, outerR + 6, cx, cy);
              return (
                <g key={a.label}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#fbbf24" strokeWidth="1.2" opacity="0.6" />
                  <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                    fontSize="8" fill="#fbbf24" opacity="0.7" style={{ fontWeight: 700 }}>
                    {a.label}
                  </text>
                </g>
              );
            });
          })()}

          {/* ═══ Inner circle ═══ */}
          <circle cx={cx} cy={cy} r={planetR + 8} fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
          <circle cx={cx} cy={cy} r={centerR} fill="none" stroke="#d4a574" strokeWidth="0.6" opacity="0.4" />

          {/* ═══ Aspect lines ═══ */}
          {natal.aspects?.map((asp, i) => {
            // Cast: le backend peut renvoyer des clés non-littérales (southNode, etc.)
            const p1 = (natal as any)[asp.p1];
            const p2 = (natal as any)[asp.p2];
            if (p1?.longitude == null || p2?.longitude == null) return null;
            const [x1, y1] = lonToXY(p1.longitude, ascLon, aspectR, cx, cy);
            const [x2, y2] = lonToXY(p2.longitude, ascLon, aspectR, cx, cy);
            return (
              <line key={`asp-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={asp.color}
                strokeWidth={asp.orb < 2 ? 1.5 : 1}
                opacity={asp.orb < 2 ? 0.55 : 0.3}
                strokeDasharray={asp.type === 'sextile' ? '4 2' : undefined}
              />
            );
          })}

          {/* ═══ Planets ═══ */}
          {spread.map(p => {
            const [x, y] = lonToXY(p.lon, ascLon, planetR, cx, cy);
            return (
              <g key={p.key} style={{ animation: 'planet-glow 4s ease-in-out infinite' }}>
                {/* glow */}
                <circle cx={x} cy={y} r="13" fill={p.meta.color} opacity="0.12" />
                <circle cx={x} cy={y} r="9" fill={p.meta.color} opacity="0.25" />
                {/* core */}
                <circle cx={x} cy={y} r="7.5" fill="#0c0a1e" stroke={p.meta.color} strokeWidth="1.2" />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  fontSize="10" fill={p.meta.color} style={{ fontWeight: 700 }}>
                  {p.meta.symbol}
                </text>
                {/* degree label */}
                <text x={x} y={y + 15} textAnchor="middle" dominantBaseline="middle"
                  fontSize="6" fill="#94a3b8" opacity="0.7">
                  {natal[p.key]?.degree != null ? `${Math.floor(natal[p.key]!.degree!)}\u00B0` : ''}
                </text>
                {/* retrograde */}
                {natal[p.key]?.retrograde && (
                  <text x={x + 10} y={y - 9} fontSize="7" fill="#ef4444" style={{ fontWeight: 700 }}>
                    {'\u211E'}
                  </text>
                )}
              </g>
            );
          })}

          {/* ═══ Center decoration ═══ */}
          <circle cx={cx} cy={cy} r="3" fill="#fbbf24" opacity="0.5" />
          <circle cx={cx} cy={cy} r="1.5" fill="#fef3c7" />

          {/* Degree markers for ASC */
          (() => {
            const [ax, ay] = lonToXY(ascLon, ascLon, zodiacR, cx, cy);
            return (
              <g>
                <line x1={ax} y1={ay} x2={polarToXY(180, outerR + 2, cx, cy)[0]} y2={polarToXY(180, outerR + 2, cx, cy)[1]}
                  stroke="#fbbf24" strokeWidth="1.5" opacity="0.5" />
              </g>
            );
          })()}
        </svg>

        {/* Center label (static, doesn't rotate) */}
        {!rotating && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-gold-400 text-[10px] uppercase tracking-widest opacity-70">
                {natal.ascendant?.sign}
              </p>
              <p className="text-night-400 text-[8px]">Ascendant</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes natal-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes planet-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>

      {/* Aspect legend */}
      {natal.aspects && natal.aspects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {[
            { t: 'conjunction', s: '\u260C', c: '#fbbf24', fr: 'Conjonction' },
            { t: 'opposition', s: '\u260D', c: '#ef4444', fr: 'Opposition' },
            { t: 'trine', s: '\u25B3', c: '#22d3ee', fr: 'Trigone' },
            { t: 'square', s: '\u25A1', c: '#f97316', fr: 'Carre' },
            { t: 'sextile', s: '\u2606', c: '#4ade80', fr: 'Sextile' },
          ].filter(l => natal.aspects!.some(a => a.type === l.t)).map(l => (
            <div key={l.t} className="flex items-center gap-1 text-[10px]">
              <span style={{ color: l.c }}>{l.s}</span>
              <span className="text-night-400">{l.fr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
