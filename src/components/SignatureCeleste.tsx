import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign } from '../types';

/**
 * SignatureCeleste — illustration signature RÉACTIVE au transit du jour (Piste #3 audit).
 *
 * Chaque jour, la planète mise en avant change selon la position dominante
 * du système solaire. Les orbites et la couleur de fond changent aussi
 * selon le moment de la journée (matin = doré, soir = violet).
 *
 * → Visuellement UNIQUE chaque jour, signature mémorable de l'app.
 */

type DominantTransit = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
type DayMoment = 'dawn' | 'noon' | 'dusk' | 'night';

function getDominantTransit(): DominantTransit {
  // Rotation déterministe basée sur le jour de l'année
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const transits: DominantTransit[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  return transits[dayOfYear % transits.length];
}

function getDayMoment(): DayMoment {
  const h = new Date().getHours();
  if (h < 9) return 'dawn';
  if (h < 17) return 'noon';
  if (h < 21) return 'dusk';
  return 'night';
}

const MOMENT_PALETTE: Record<DayMoment, { glow: string; orbit: string; bgFrom: string; bgTo: string }> = {
  dawn:  { glow: '#FF9F4A', orbit: '#FFB871', bgFrom: '#3D2A4A', bgTo: '#0E0820' },
  noon:  { glow: '#F4D27A', orbit: '#F4D27A', bgFrom: '#1F2845', bgTo: '#0E0820' },
  dusk:  { glow: '#C97A4F', orbit: '#C97A4F', bgFrom: '#3D1F45', bgTo: '#0E0820' },
  night: { glow: '#8B5CF6', orbit: '#8B5CF6', bgFrom: '#1A0F3D', bgTo: '#050214' },
};

const TRANSIT_LABEL: Record<DominantTransit, string> = {
  mercury: 'Mercure',
  venus: 'Vénus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturne',
};

const TRANSIT_GLYPH: Record<DominantTransit, string> = {
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
};

export function SignatureCeleste({ sunSignKey, moonSignKey, risingSignKey }: {
  sunSignKey: string;
  moonSignKey: string;
  risingSignKey: string;
}) {
  const sun = ZODIAC_SIGNS[sunSignKey as ZodiacSign];
  const moon = ZODIAC_SIGNS[moonSignKey as ZodiacSign];
  const rising = ZODIAC_SIGNS[risingSignKey as ZodiacSign];

  const transit = getDominantTransit();
  const moment = getDayMoment();
  const palette = MOMENT_PALETTE[moment];

  return (
    <div className="relative w-full aspect-square max-w-[280px] mx-auto mb-6 animate-fade-in">
      <svg viewBox="0 0 280 280" className="w-full h-full">
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0.5" />
            <stop offset="60%" stopColor={palette.glow} stopOpacity="0.08" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.orbit} stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.3" />
          </linearGradient>
          <radialGradient id="bgFade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.bgFrom} stopOpacity="0.4" />
            <stop offset="100%" stopColor={palette.bgTo} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background changeant selon moment */}
        <circle cx="140" cy="140" r="140" fill="url(#bgFade)" />

        {/* Halo central pulsant */}
        <circle cx="140" cy="140" r="120" fill="url(#centerGlow)" className="animate-pulse-slow" />

        {/* Orbites animées */}
        <circle cx="140" cy="140" r="105" fill="none" stroke="url(#orbitGrad)" strokeWidth="0.5" strokeDasharray="2 4">
          <animateTransform attributeName="transform" type="rotate" from="0 140 140" to="360 140 140" dur="120s" repeatCount="indefinite" />
        </circle>
        <circle cx="140" cy="140" r="75" fill="none" stroke="url(#orbitGrad)" strokeWidth="0.5" strokeDasharray="2 4">
          <animateTransform attributeName="transform" type="rotate" from="360 140 140" to="0 140 140" dur="90s" repeatCount="indefinite" />
        </circle>

        {/* Cercle central signature */}
        <circle cx="140" cy="140" r="50" fill="none" stroke={palette.glow} strokeOpacity="0.2" strokeWidth="0.5" />

        {/* Transit du jour au centre */}
        <g transform="translate(140, 140)">
          <circle r="22" fill={palette.glow} opacity="0.15">
            <animate attributeName="r" values="22;26;22" dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.15;0.25;0.15" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle r="14" fill={palette.glow} opacity="0.95" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="20" fill="#1A1325" fontWeight="bold">{TRANSIT_GLYPH[transit]}</text>
        </g>

        {/* Planètes perso en orbite */}
        {sun && (
          <g transform="translate(140, 35)">
            <circle r="18" fill={sun.color} opacity="0.25" />
            <circle r="11" fill={sun.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="14" fill="#fff">{sun.symbol}</text>
          </g>
        )}

        {moon && (
          <g transform="translate(58, 175)">
            <circle r="16" fill={moon.color} opacity="0.25" />
            <circle r="10" fill={moon.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="13" fill="#fff">{moon.symbol}</text>
          </g>
        )}

        {rising && (
          <g transform="translate(222, 175)">
            <circle r="16" fill={rising.color} opacity="0.25" />
            <circle r="10" fill={rising.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="13" fill="#fff">{rising.symbol}</text>
          </g>
        )}

        {/* Étoiles scintillantes */}
        {[
          [25, 80, 1.2, 0], [255, 90, 1, 1.5], [45, 220, 1.1, 2], [240, 230, 0.8, 0.7],
          [140, 250, 0.6, 1.2], [15, 145, 0.7, 2.5], [265, 145, 0.7, 1.8], [80, 50, 0.5, 3], [200, 60, 0.6, 2.2]
        ].map(([cx, cy, r, delay], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={palette.glow}>
            <animate attributeName="opacity" values="0.3;0.9;0.3" dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>

      {/* Légende dynamique */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around text-[10px] text-night-400 px-2">
        <span className="flex items-center gap-1">
          <span style={{ color: sun?.color }}>{sun?.symbol}</span>
          Soleil
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: moon?.color }}>{moon?.symbol}</span>
          Lune
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: rising?.color }}>{rising?.symbol}</span>
          Asc
        </span>
      </div>

      {/* Transit dominant affiché en overlay */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full glass border border-gold-500/30 backdrop-blur-sm">
        <p className="text-[9px] text-night-300 uppercase tracking-widest font-bold whitespace-nowrap">
          {TRANSIT_LABEL[transit]} · {moment === 'dawn' ? 'Aube' : moment === 'noon' ? 'Jour' : moment === 'dusk' ? 'Crépuscule' : 'Nuit'}
        </p>
      </div>
    </div>
  );
}