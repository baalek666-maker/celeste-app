import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign } from '../types';
import type { Screen } from '../App';
import { getDailyDominantTransit, TRANSIT_INFO, type TransitKey } from '../lib/dailyTransit';

/**
 * SignatureFooter — fusion de SignatureCeleste + SmartCTA (v8 audit).
 *
 * v8 : utilise les VRAIES éphémérides via astronomy-engine (planète la plus
 * rapide du jour) au lieu d'un dayOfYear % 5 cosmétique.
 */

type DayMoment = 'dawn' | 'noon' | 'dusk' | 'night';

function getDayMoment(): DayMoment {
  const h = new Date().getHours();
  if (h < 9) return 'dawn';
  if (h < 17) return 'noon';
  if (h < 21) return 'dusk';
  return 'night';
}

const MOMENT_GLOW: Record<DayMoment, string> = {
  dawn:  '#FF9F4A',
  noon:  '#F4D27A',
  dusk:  '#C97A4F',
  night: '#8B5CF6',
};

const TRANSIT_GLYPH: Record<TransitKey, string> = {
  mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃', saturn: '♄',
};

function smartTease(hour: number) {
  if (hour < 12)  return { title: "Ton ciel de l'après-midi t'attend", sub: 'Transits · compatibilité · rituels', icon: '☀️' };
  if (hour < 18)  return { title: 'Découvre ce que ton ciel te réserve',     sub: 'Transits perso + horoscope du soir', icon: '🌅' };
  return                  { title: 'Ton bilan astro du soir est prêt',        sub: 'Transits perso + rituel de clôture', icon: '🌙' };
}

export function SignatureFooter({
  sunSignKey, moonSignKey, risingSignKey, onNavigate,
}: {
  sunSignKey: string;
  moonSignKey: string;
  risingSignKey: string;
  onNavigate: (s: Screen) => void;
}) {
  const sun    = ZODIAC_SIGNS[sunSignKey as ZodiacSign];
  const moon   = ZODIAC_SIGNS[moonSignKey as ZodiacSign];
  const rising = ZODIAC_SIGNS[risingSignKey as ZodiacSign];
  const transit = getDailyDominantTransit();
  const moment  = getDayMoment();
  const glow    = MOMENT_GLOW[moment];
  const tease   = smartTease(new Date().getHours());

  return (
    <button
      onClick={() => onNavigate('explorer')}
      className="w-full glass rounded-2xl p-4 mb-4 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group flex items-center gap-4"
    >
      {/* Mini astrolabe compact 88×88 */}
      <div className="relative w-[88px] h-[88px] flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <radialGradient id="fglow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={glow} stopOpacity="0.4" />
              <stop offset="100%" stopColor={glow} stopOpacity="0"   />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#fglow)" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={glow} strokeOpacity="0.4" strokeWidth="0.5" strokeDasharray="2 3">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="80s" repeatCount="indefinite" />
          </circle>
          {sun && (
            <g transform="translate(50, 14)">
              <circle r="7" fill={sun.color} opacity="0.95" />
              <text textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#fff" fontWeight="bold">{sun.symbol}</text>
            </g>
          )}
          {moon && (
            <g transform="translate(20, 64)">
              <circle r="6" fill={moon.color} opacity="0.95" />
              <text textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#fff">{moon.symbol}</text>
            </g>
          )}
          {rising && (
            <g transform="translate(80, 64)">
              <circle r="6" fill={rising.color} opacity="0.95" />
              <text textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#fff">{rising.symbol}</text>
            </g>
          )}
          {/* Transit dominant — calculé via éphémérides */}
          <g transform="translate(50, 50)">
            <circle r="10" fill={glow} opacity="0.2">
              <animate attributeName="r" values="10;13;10" dur="3.5s" repeatCount="indefinite" />
            </circle>
            <text textAnchor="middle" dominantBaseline="central" fontSize="11" fill={glow} fontWeight="bold">{TRANSIT_GLYPH[transit]}</text>
          </g>
        </svg>
        {/* Badge transit */}
        <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-night-900/90 border border-gold-500/30 backdrop-blur-sm">
          <span className="text-[7px] text-gold-300 uppercase tracking-widest font-bold">{TRANSIT_INFO[transit].label}</span>
        </div>
      </div>

      {/* CTA contextuel */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gold-400 uppercase tracking-widest font-bold mb-0.5">Ton ciel du jour</p>
        <p className="text-night-100 text-sm font-semibold leading-tight mb-0.5">{tease.title}</p>
        <p className="text-night-400 text-[11px] truncate">{tease.sub}</p>
      </div>
      <span className="text-lg text-night-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all">→</span>
    </button>
  );
}