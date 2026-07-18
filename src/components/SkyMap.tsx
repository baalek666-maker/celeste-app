import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { ZODIAC_ORDER, ZODIAC_SIGNS, PLANET_DATA } from '../data/zodiac';
import SkyMapShare from './SkyMapShare';
import { useExpertMode, degreeInSign, formatDegrees } from '../lib/expert-mode';

interface Transit {
  sign: string;
  degree: number;
  longitude: number;
  retrograde: boolean;
}

interface SkyMapProps {
  size?: number;
}

const PLANET_ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/** Map French sign names from API (e.g. "Cancer") → English keys (e.g. "cancer") */
const FR_TO_EN: Record<string, string> = {};
ZODIAC_ORDER.forEach(en => { FR_TO_EN[ZODIAC_SIGNS[en].name] = en; });

function resolveSignKey(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (ZODIAC_SIGNS[lower as keyof typeof ZODIAC_SIGNS]) return lower;
  if (FR_TO_EN[raw]) return FR_TO_EN[raw];
  if (FR_TO_EN[raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()]) return FR_TO_EN[raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()];
  return null;
}

/**
 * Convert an absolute ecliptic longitude (0-360°) to an SVG angle.
 * Convention: 0° = Aries = left (9 o'clock). Increases counter-clockwise.
 * In SVG, 0° is at 3 o'clock and rotates clockwise, so:
 *   svgAngle = 180 - longitude (in radians)
 */
function lonToSvgAngle(lon: number): number {
  return ((180 - lon) * Math.PI) / 180;
}

function lonToXY(lon: number, radius: number, cx: number, cy: number): [number, number] {
  const a = lonToSvgAngle(lon);
  return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
}

function polarToXY(angleDeg: number, radius: number, cx: number, cy: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polarToXY(startDeg, r, cx, cy);
  const [x2, y2] = polarToXY(endDeg, r, cx, cy);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/**
 * Compute aspects between transiting planets (geometrical).
 * Same definition as backend computeDailyAspects() to stay consistent.
 */
const ASPECT_DEFS = [
  { type: 'conjunction', angle: 0,   orb: 6, color: '#fbbf24' },
  { type: 'opposition',  angle: 180, orb: 6, color: '#ef4444' },
  { type: 'trine',       angle: 120, orb: 5, color: '#22d3ee' },
  { type: 'square',      angle: 90,  orb: 5, color: '#f97316' },
  { type: 'sextile',     angle: 60,  orb: 4, color: '#4ade80' },
];

function computeTransitAspects(transits: Record<string, Transit>) {
  const planets = PLANET_ORDER.filter(p => transits[p]?.longitude != null);
  const out: Array<{ p1: string; p2: string; type: string; orb: number; color: string }> = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = transits[planets[i]].longitude;
      const b = transits[planets[j]].longitude;
      let diff = Math.abs(a - b);
      if (diff > 180) diff = 360 - diff;
      for (const def of ASPECT_DEFS) {
        const delta = Math.abs(diff - def.angle);
        if (delta <= def.orb) {
          out.push({
            p1: planets[i],
            p2: planets[j],
            type: def.type,
            orb: delta,
            color: def.color,
          });
          break; // first matching aspect wins
        }
      }
    }
  }
  return out;
}

export default function SkyMap({ size }: SkyMapProps) {
  const [transits, setTransits] = useState<Record<string, Transit> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expert] = useExpertMode();
  // v13.1.2 — rotation désactivée par défaut pour éviter le débordement
  // diagonal du cercle pendant l'animation. L'utilisateur peut l'activer
  // manuellement via le bouton ▶ Animer si il le souhaite.
  const [rotating, setRotating] = useState(false);
  const [containerW, setContainerW] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Responsive sizing : on écoute la largeur du parent glass ET on retire
  // le padding (p-4 = 16px chaque côté = 32px). Sans ça le SVG 340px déborde
  // sur écrans étroits quand le parent a un padding intérieur.
  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      // Largeur disponible = largeur du parent glass (qui contient le padding)
      const parent = el.parentElement;
      if (!parent) return;
      const styles = window.getComputedStyle(parent);
      const padL = parseFloat(styles.paddingLeft) || 0;
      const padR = parseFloat(styles.paddingRight) || 0;
      const avail = parent.clientWidth - padL - padR;
      // v13.1.3 — cap 300 (au lieu de 400). Le SVG doit tenir dans le cadre glass
      // p-4 (padding 16px chaque côté = 32px en tout). Sur écran 360px, avail = 328px
      // → on prend 300 pour laisser une petite marge visuelle en plus.
      setContainerW(Math.max(220, Math.min(avail, 300)));
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current?.parentElement) {
      ro.observe(containerRef.current.parentElement);
    }
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  // v13.1.3 — size prop : si non fourni, utilise containerW (responsive réel),
  // avec fallback 280 (au lieu de 360 qui faisait déborder sur petits écrans).
  // Cap supérieur 320 pour éviter tout débordement du cadre glass.
  const actualSize = size ?? Math.min(containerW || 280, 320);

  if (loading) {
    return (
      <div ref={containerRef} className="glass rounded-3xl p-4 mb-4 flex items-center justify-center" style={{ minHeight: 200 }}>
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

  // v13.1.2 — Cercle centré, taille maximale SANS rotation.
  //
  // On reprend le viewBox carré d'origine (0, 0, S, S) avec outerR = S/2 - 8
  // qui fait que le cercle remplit quasi-totalement le cadre glass sans
  // déborder. Le bug de débordement venait de l'animation skymap-spin qui
  // faisait tourner le SVG, obligeant à élargir le viewBox pour absorber
  // le débordement diagonal pendant la rotation — mais élargir le viewBox
  // RÉDUIT la taille rendue du cercle. Compromice choisi : on garde la
  // carte GRAND et CENTRÉE, et on garde l'animation mais en disable par
  // défaut (l'utilisateur appuie sur ▶ Animer s'il veut — la rotation est
  // purement décorative, pas fonctionnelle).
  // v13.1.3 — outerR réduit pour garantir que le cercle reste dans le cadre
  // glass + padding interne. Marge 16px (au lieu de 8) pour respirer visuellement.
  const cx = actualSize / 2;
  const cy = actualSize / 2;
  const outerR = actualSize / 2 - 16;
  const zodiacR = outerR - 18;
  const tickOuterR = zodiacR;
  const tickInnerR = zodiacR - 12;
  const planetR = tickInnerR - 22;
  const aspectR = planetR - 8;
  const centerR = 42;

  // Anti-collision: spread planets that are within 5 deg
  const planetEntries = PLANET_ORDER
    .filter(p => transits[p]?.longitude != null)
    .map(p => ({ key: p, lon: transits[p].longitude, meta: PLANET_DATA[p] }))
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

  const transitAspects = computeTransitAspects(transits);

  return (
    <div className="glass rounded-3xl p-4 mb-4 animate-fade-in card-glow">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-gold-400 text-xs uppercase tracking-widest">Carte du ciel · aujourd'hui</p>
        <div className="flex items-center gap-2">
          <p className="text-night-500 text-xs">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
          <button
            onClick={() => setRotating(r => !r)}
            className="text-night-500 text-xs hover:text-gold-400 transition-colors"
          >
            {rotating ? '⏸ Pause' : '▶ Animer'}
          </button>
          <SkyMapShare
            svgRef={svgRef}
            dateLabel={new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          />
        </div>
      </div>

      <div ref={containerRef} className="relative mx-auto overflow-hidden rounded-2xl" style={{ width: actualSize, height: actualSize }}>
        <svg
          ref={svgRef}
          width={actualSize}
          height={actualSize}
          /* v13.1.2 — viewBox carré d'origine, cercle centré et grand.
             La rotation (skymap-spin) cause un débordement diagonal √2 × R
             impossible à clipper sans rétrécir le cercle rendu. On remet
             le viewBox carré (0,0,S,S) avec outerR = S/2 - 8, qui remplit
             quasi-totalement le cadre glass. La rotation reste activable
             manuellement via le bouton ▶ Animer mais désactivée par défaut
             (rotating=false initial state), pour éviter le débordement
             tant que l'utilisateur ne l'a pas explicitement demandée. */
          viewBox={`0 0 ${actualSize} ${actualSize}`}
          preserveAspectRatio="xMidYMid meet"
          className="overflow-hidden"
          style={rotating ? { animation: 'skymap-spin 240s linear infinite' } : undefined}
        >
          <defs>
            <radialGradient id="sky-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#0c0a1e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#020014" stopOpacity="0.1" />
            </radialGradient>
          </defs>

          {/* Background */}
          <circle cx={cx} cy={cy} r={outerR} fill="url(#sky-grad)" />

          {/* ═══ Zodiac ring ═══ */}
          {ZODIAC_ORDER.map((signKey, i) => {
            const sign = ZODIAC_SIGNS[signKey];
            const lonStart = i * 30;
            const svgStart = 180 - lonStart;
            const svgEnd = 180 - (lonStart + 30);
            const arcD = arcPath(cx, cy, outerR, svgStart, svgEnd);
            const arcD2 = arcPath(cx, cy, zodiacR, svgStart, svgEnd);
            const [sx, sy] = lonToXY(lonStart + 15, (outerR + zodiacR) / 2, cx, cy);
            return (
              <g key={signKey}>
                <path
                  d={`${arcD} L ${polarToXY(svgEnd, zodiacR, cx, cy).join(' ')} ${arcD2.replace('M', 'L')} Z`}
                  fill={sign.color}
                  opacity="0.06"
                />
                <line
                  x1={polarToXY(svgStart, zodiacR, cx, cy)[0]}
                  y1={polarToXY(svgStart, zodiacR, cx, cy)[1]}
                  x2={polarToXY(svgStart, outerR, cx, cy)[0]}
                  y2={polarToXY(svgStart, outerR, cx, cy)[1]}
                  stroke="#475569"
                  strokeWidth="0.4"
                  opacity="0.5"
                />
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
            const svgAngle = lonToSvgAngle(deg);
            const isMajor = deg % 30 === 0;
            const isMid = deg % 10 === 0;
            const isSmall = deg % 5 === 0;
            const tickLen = isMajor ? 10 : isMid ? 6 : isSmall ? 4 : 2;
            const [x1, y1] = polarToXY(180 - deg, tickOuterR, cx, cy);
            const [x2, y2] = polarToXY(180 - deg, tickOuterR - tickLen, cx, cy);
            if (!isSmall) return null;
            return (
              <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isMajor ? '#d4a574' : '#64748b'}
                strokeWidth={isMajor ? 1 : 0.4}
                opacity={isMajor ? 0.7 : 0.4}
              />
            );
          })}

          {/* ═══ Inner circle ═══ */}
          <circle cx={cx} cy={cy} r={planetR + 8} fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
          <circle cx={cx} cy={cy} r={centerR} fill="none" stroke="#d4a574" strokeWidth="0.6" opacity="0.4" />

          {/* ═══ Aspect lines ═══ */}
          {transitAspects.map((asp, i) => {
            const p1 = spread.find(s => s.key === asp.p1);
            const p2 = spread.find(s => s.key === asp.p2);
            if (!p1 || !p2) return null;
            const [x1, y1] = lonToXY(p1.lon, aspectR, cx, cy);
            const [x2, y2] = lonToXY(p2.lon, aspectR, cx, cy);
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
            const [x, y] = lonToXY(p.lon, planetR, cx, cy);
            return (
              <g key={p.key} style={{ animation: 'skymap-pulse 3s ease-in-out infinite' }}>
                <circle cx={x} cy={y} r="13" fill={p.meta.color} opacity="0.12" />
                <circle cx={x} cy={y} r="9" fill={p.meta.color} opacity="0.25" />
                <circle cx={x} cy={y} r="7.5" fill="#0c0a1e" stroke={p.meta.color} strokeWidth="1.2" />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  fontSize="10" fill={p.meta.color} style={{ fontWeight: 700 }}>
                  {p.meta.symbol}
                </text>
                {/* degree label */}
                <text x={x} y={y + 15} textAnchor="middle" dominantBaseline="middle"
                  fontSize={expert ? "5.5" : "6"} fill="#94a3b8" opacity={expert ? "0.95" : "0.7"}>
                  {expert ? formatDegrees(transits[p.key].longitude) : `${Math.floor(transits[p.key].degree)}°`}
                </text>
                {/* retrograde */}
                {transits[p.key].retrograde && (
                  <text x={x + 10} y={y - 9} fontSize="7" fill="#ef4444" style={{ fontWeight: 700 }}>
                    ℞
                  </text>
                )}
              </g>
            );
          })}

          {/* ═══ Center decoration ═══ */}
          <circle cx={cx} cy={cy} r="3" fill="#fbbf24" opacity="0.5" />
          <circle cx={cx} cy={cy} r="1.5" fill="#fef3c7" />
        </svg>
      </div>

      <style>{`
        @keyframes skymap-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes skymap-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>

      {/* Aspect legend */}
      {transitAspects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {[
            { t: 'conjunction', s: '☌', c: '#fbbf24', fr: 'Conjonction' },
            { t: 'opposition',  s: '☍', c: '#ef4444', fr: 'Opposition' },
            { t: 'trine',       s: '△', c: '#22d3ee', fr: 'Trigone' },
            { t: 'square',      s: '□', c: '#f97316', fr: 'Carré' },
            { t: 'sextile',     s: '⚹', c: '#4ade80', fr: 'Sextile' },
          ].filter(l => transitAspects.some(a => a.type === l.t)).map(l => (
            <div key={l.t} className="flex items-center gap-1 text-[10px]">
              <span style={{ color: l.c }}>{l.s}</span>
              <span className="text-night-400">{l.fr}</span>
            </div>
          ))}
        </div>
      )}

      {/* Compact planet positions below */}
      <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        {PLANET_ORDER.filter(p => transits[p]).map(p => {
          const t = transits[p];
          const planet = PLANET_DATA[p];
          const signKey = resolveSignKey(t.sign);
          const sign = signKey ? ZODIAC_SIGNS[signKey as keyof typeof ZODIAC_SIGNS] : null;
          if (!sign || !planet) return null;
          return (
            <div key={p} className="flex items-center gap-1 text-night-300">
              <span style={{ color: planet.color }} className="text-sm leading-none">{planet.symbol}</span>
              <span className="truncate">
                {expert ? degreeInSign(t.longitude) : `${sign.symbol} ${Math.floor(t.degree)}°`}
                {t.retrograde && <span className="text-rose-400 ml-0.5">℞</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
