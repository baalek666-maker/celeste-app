import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign } from '../types';
import { getDailyHighlightPlanet } from '../lib/dailyHighlight';
import type { NatalChart } from '../types';

type EnergyData = {
  headline: string;
  energy: { score: number; label: string; emoji: string; advice: string };
};

interface PlanetPos {
  planet: string;
  sign: ZodiacSign;
}

/**
 * HeroPrediction — UNE phrase qui tue, façon Co-Star (Piste #1, #3, #5).
 *
 * Prend 40% de l'écran, cite ta planète perso ET interprète.
 * Différenciation vs Co-Star : on cite la planète + le signe + l'interprétation.
 * "Si précise que tu vas te dire : mais comment elle sait ça ?"
 */
export default function HeroPrediction({ chart, sunSignKey, firstName }: {
  chart: NatalChart;
  sunSignKey: string;
  firstName?: string;
}) {
  const [data, setData] = useState<EnergyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.getDailyEnergy()
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const sign = ZODIAC_SIGNS[sunSignKey as ZodiacSign];
  const highlight = getDailyHighlightPlanet(chart);

  // Construction de la phrase signature
  let heroPhrase = '';
  if (data?.headline) {
    heroPhrase = data.headline;
  } else if (highlight) {
    const planetName = capitalize(highlight.planet);
    const signName = ZODIAC_SIGNS[highlight.sign as ZodiacSign]?.name ?? '';
    heroPhrase = `${planetName} en ${signName} éclaire ta journée d'une énergie particulière.`;
  } else {
    heroPhrase = `Le ciel a quelque chose à te dire aujourd'hui${firstName ? `, ${firstName}` : ''}.`;
  }

  const energyEmoji = data?.energy?.emoji ?? '✦';
  const energyLabel = data?.energy?.label ?? '';

  return (
    <div className="relative mb-6 rounded-3xl overflow-hidden border border-gold-500/30 animate-fade-in">
      {/* Background gradient + glow signature */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold-500/15 via-cosmic-500/10 to-night-900 pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gold-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-cosmic-500/20 blur-3xl pointer-events-none" />

      <div className="relative p-6 pb-7">
        {/* Header strip */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {sign && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                style={{ background: `${sign.color}25`, border: `1px solid ${sign.color}60` }}
              >
                <span style={{ color: sign.color }}>{sign.symbol}</span>
              </div>
            )}
            <div>
              <p className="text-[10px] text-gold-400 uppercase tracking-widest font-bold">Aujourd'hui</p>
              <p className="text-[11px] text-night-300">
                {firstName ? `${firstName}, ` : ''}{sunSignKey === 'capricorn' ? 'Capricorne' : sign?.name}
              </p>
            </div>
          </div>

          {data?.energy && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-500/10 border border-gold-500/30">
              <span className="text-base">{energyEmoji}</span>
              <span className="text-[10px] text-gold-300 font-semibold capitalize">{energyLabel}</span>
            </div>
          )}
        </div>

        {/* THE PHRASE — signature mémorable */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-5 bg-night-700/40 rounded w-full" />
            <div className="h-5 bg-night-700/40 rounded w-4/5" />
          </div>
        ) : (
          <p className="text-2xl font-bold text-night-50 leading-tight tracking-tight animate-fade-in">
            {heroPhrase}
          </p>
        )}

        {/* Décoration signature */}
        <div className="mt-5 flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-gold-500/40 to-transparent" />
          <span className="text-gold-400 text-xs">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-cosmic-500/40 to-transparent" />
        </div>

        {/* Sous-titre : la planète qui parle */}
        {highlight && !loading && (
          <p className="text-center text-[11px] text-night-400 mt-3 italic">
            {capitalize(highlight.planet)} te parle aujourd'hui
          </p>
        )}
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}