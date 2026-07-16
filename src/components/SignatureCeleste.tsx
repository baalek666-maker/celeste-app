import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign } from '../types';

/**
 * SignatureCeleste — illustration signature de l'app (Piste #5).
 *
 * Composant SVG natif : un astrolabe stylisé avec 3 planètes principales
 * (Soleil, Lune, Ascendant) tournant autour d'un centre doré.
 * C'est NOTRE signature visuelle — reconnaissable entre mille.
 */
export function SignatureCeleste({ sunSignKey, moonSignKey, risingSignKey }: {
  sunSignKey: string;
  moonSignKey: string;
  risingSignKey: string;
}) {
  const sun = ZODIAC_SIGNS[sunSignKey as ZodiacSign];
  const moon = ZODIAC_SIGNS[moonSignKey as ZodiacSign];
  const rising = ZODIAC_SIGNS[risingSignKey as ZodiacSign];

  return (
    <div className="relative w-full aspect-square max-w-[280px] mx-auto mb-6 animate-fade-in">
      <svg viewBox="0 0 280 280" className="w-full h-full">
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F4D27A" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#F4D27A" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#F4D27A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F4D27A" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Halo central */}
        <circle cx="140" cy="140" r="120" fill="url(#centerGlow)" />

        {/* Orbites */}
        <circle cx="140" cy="140" r="105" fill="none" stroke="url(#orbitGrad)" strokeWidth="0.5" strokeDasharray="2 4" />
        <circle cx="140" cy="140" r="75" fill="none" stroke="url(#orbitGrad)" strokeWidth="0.5" strokeDasharray="2 4" />

        {/* Cercles décoratifs */}
        <circle cx="140" cy="140" r="50" fill="none" stroke="#F4D27A" strokeOpacity="0.15" strokeWidth="0.5" />

        {/* Étoile centrale */}
        <g transform="translate(140, 140)">
          <circle r="14" fill="#F4D27A" opacity="0.9" />
          <circle r="22" fill="#F4D27A" opacity="0.15" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="18" fill="#1A1325" fontWeight="bold">✦</text>
        </g>

        {/* Soleil — orbite externe */}
        {sun && (
          <g transform="translate(140, 35)">
            <circle r="18" fill={sun.color} opacity="0.25" />
            <circle r="11" fill={sun.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="14" fill="#fff">{sun.symbol}</text>
          </g>
        )}

        {/* Lune — orbite interne */}
        {moon && (
          <g transform="translate(58, 175)">
            <circle r="16" fill={moon.color} opacity="0.25" />
            <circle r="10" fill={moon.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="13" fill="#fff">{moon.symbol}</text>
          </g>
        )}

        {/* Ascendant — orbite interne droite */}
        {rising && (
          <g transform="translate(222, 175)">
            <circle r="16" fill={rising.color} opacity="0.25" />
            <circle r="10" fill={rising.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="13" fill="#fff">{rising.symbol}</text>
          </g>
        )}

        {/* Étoiles décoratives */}
        {[
          [25, 80, 1], [255, 90, 1.2], [45, 220, 1], [240, 230, 0.8], [140, 250, 0.6], [15, 145, 0.7], [265, 145, 0.7]
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="#F4D27A" opacity="0.6" />
        ))}
      </svg>

      {/* Légende */}
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
    </div>
  );
}