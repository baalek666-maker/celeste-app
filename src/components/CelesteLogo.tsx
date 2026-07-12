import React from 'react';

/**
 * Céleste — Alchemical Logo
 *
 * A radiant sun (Sol) bearing 12 zodiac spokes, with a crescent moon (Luna)
 * nested at its heart — the alchemical union of gold and silver, sun and moon.
 * Silver sparkles accent the composition.
 *
 * Works at 24px (favicon), 48px (nav), 120px (splash).
 */

export interface CelesteLogoProps {
  /** Pixel size (width = height). Recommended: 24, 48, 120. */
  size?: number;
  className?: string;
  /** When true, the outer zodiac ring slowly rotates while the sun stays fixed. */
  animated?: boolean;
}

// ── Geometry constants ────────────────────────────────────────
const CX = 50;
const CY = 50;

/** Polar → cartesian (0° = top, clockwise). Returns [x, y]. */
function polar(r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

/** Tapered triangular ray (spoke). Sharp tip, splayed base. */
function ray(angleDeg: number, rBase: number, rTip: number, halfWidthDeg: number): string {
  const [x1, y1] = polar(rBase, angleDeg - halfWidthDeg);
  const [xt, yt] = polar(rTip, angleDeg);
  const [x2, y2] = polar(rBase, angleDeg + halfWidthDeg);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} L${xt.toFixed(2)},${yt.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)} Z`;
}

/** Four-pointed sparkle star path. */
function sparkle(cx: number, cy: number, R: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = ((i * 45 - 90) * Math.PI) / 180;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

// Pre-computed geometry (module scope — computed once)
const ZODIAC_RAYS = Array.from({ length: 12 }, (_, i) => ray(i * 30, 38, 47.5, 3.2));
const SUN_RAYS = Array.from({ length: 12 }, (_, i) => ray(i * 30 + 15, 28, 34.5, 2.6));

// Crescent moon (waxing, opens right) — outer Ø c=(50,50) r=15, cut c=(56,50) r=15
// Intersections at x=53, y=50±√(225−9)=50±14.697
const MOON_PATH = 'M53,35.30 A15,15 0 1,0 53,64.70 A15,15 0 0,1 53,35.30 Z';

// ── Component ─────────────────────────────────────────────────
const CelesteLogo: React.FC<CelesteLogoProps> = ({
  size = 48,
  className = '',
  animated = false,
}) => {
  // Unique suffix so multiple instances + gradient ids never collide
  const raw = React.useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '');
  const g = (id: string) => `${id}-${uid}`;

  const spinClass = `cl-spin-${uid}`;
  const kfname = `cl-rotate-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Céleste"
    >
      <defs>
        {/* Aged-gold linear gradient */}
        <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2c47c" />
          <stop offset="50%" stopColor="#c5a059" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>

        {/* Sun radial — bright core to deep gold rim */}
        <radialGradient id={g('sun')} cx="40%" cy="36%" r="68%">
          <stop offset="0%" stopColor="#f7edcf" />
          <stop offset="35%" stopColor="#e2c47c" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>

        {/* Silver gradient */}
        <linearGradient id={g('silver')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#e8e8e8" />
          <stop offset="100%" stopColor="#a8a8a8" />
        </linearGradient>

        {/* Moon — obsidian with faint depth */}
        <radialGradient id={g('moon')} cx="62%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </radialGradient>

        {animated && (
          <style>{`
            .${spinClass} {
              transform-box: view-box;
              transform-origin: 50% 50%;
              animation: ${kfname} 60s linear infinite;
            }
            @keyframes ${kfname} {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            @media (prefers-reduced-motion: reduce) {
              .${spinClass} { animation: none; }
            }
          `}</style>
        )}
      </defs>

      {/* ── Outer zodiac wheel — rotates when animated ── */}
      <g className={animated ? spinClass : undefined}>
        {/* connecting ring (the zodiac belt) */}
        <circle
          cx={CX}
          cy={CY}
          r={42}
          fill="none"
          stroke={`url(#${g('gold')})`}
          strokeWidth={1.1}
          opacity={0.45}
        />
        {/* 12 zodiac rays */}
        <g fill={`url(#${g('gold')})`}>
          {ZODIAC_RAYS.map((d, i) => (
            <path key={`z${i}`} d={d} />
          ))}
        </g>
        {/* tiny silver sign-markers at each ray tip */}
        <g fill={`url(#${g('silver')})`}>
          {Array.from({ length: 12 }, (_, i) => {
            const [x, y] = polar(47.5, i * 30);
            return <circle key={`m${i}`} cx={x} cy={y} r={1.1} />;
          })}
        </g>
      </g>

      {/* ── Radiant sun (fixed) ── */}
      <g>
        {/* 12 flame rays between the zodiac spokes */}
        <g fill={`url(#${g('gold')})`}>
          {SUN_RAYS.map((d, i) => (
            <path key={`s${i}`} d={d} opacity={0.92} />
          ))}
        </g>
        {/* sun disc */}
        <circle
          cx={CX}
          cy={CY}
          r={29}
          fill={`url(#${g('sun')})`}
          stroke="#b8860b"
          strokeWidth={0.7}
        />
        {/* inner filigree ring */}
        <circle
          cx={CX}
          cy={CY}
          r={25}
          fill="none"
          stroke="#c5a059"
          strokeWidth={0.45}
          opacity={0.35}
        />
      </g>

      {/* ── Crescent moon nested in the sun ── */}
      <path
        d={MOON_PATH}
        fill={`url(#${g('moon')})`}
        stroke={`url(#${g('silver')})`}
        strokeWidth={0.8}
      />

      {/* ── Silver sparkle accents ── */}
      <path d={sparkle(73, 27, 4, 1.2)} fill={`url(#${g('silver')})`} opacity={0.95} />
      <path d={sparkle(28, 71, 2.6, 0.8)} fill={`url(#${g('silver')})`} opacity={0.7} />
    </svg>
  );
};

export default CelesteLogo;

// ── FavIcon — simplified, bold, reads at 16–32px ──────────────
export interface FavIconProps {
  size?: number;
  className?: string;
}

export const FavIcon: React.FC<FavIconProps> = ({ size = 32, className = '' }) => {
  const raw = React.useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '');
  const g = (id: string) => `fav-${id}-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Céleste"
    >
      <defs>
        <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2c47c" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
        <radialGradient id={g('sun')} cx="40%" cy="35%" r="72%">
          <stop offset="0%" stopColor="#f7edcf" />
          <stop offset="55%" stopColor="#e2c47c" />
          <stop offset="100%" stopColor="#c5a059" />
        </radialGradient>
      </defs>

      {/* 8 bold rays */}
      <g fill={`url(#${g('gold')})`}>
        {Array.from({ length: 8 }, (_, i) => ray(i * 45, 31, 47.5, 5)).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* sun disc */}
      <circle
        cx={CX}
        cy={CY}
        r={31}
        fill={`url(#${g('sun')})`}
        stroke="#b8860b"
        strokeWidth={1.5}
      />

      {/* crescent moon */}
      <path d={MOON_PATH} fill="#0a0a0a" stroke="#c0c0c0" strokeWidth={1} />
    </svg>
  );
};
