import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign, NatalChart } from '../types';
import { getDailyHighlightPlanet } from '../lib/dailyHighlight';
import { generateSignaturePhrase } from '../lib/signaturePhrases';

type EnergyData = {
  headline: string;
  energy: { score: number; label: string; emoji: string; advice: string };
};

/**
 * HeroPrediction — UNE phrase qui tue (Piste #1, #3, #5 audit + Piste #2 générateur).
 *
 * Hiérarchie de fallback :
 * 1. Headline API DailyEnergy (si précise et présente)
 * 2. Phrase générée (240 combinaisons signe × planète × moment)
 * 3. Phrase fallback universelle
 */
export default function HeroPrediction({ chart, sunSignKey, firstName, streak }: {
  chart: NatalChart;
  sunSignKey: string;
  firstName?: string;
  streak?: number;
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

  // Piste #2 — Génération de la phrase signature
  let heroPhrase = '';
  let phraseSource: 'api' | 'generated' | 'fallback' = 'fallback';
  let subInfo: string | null = null;

  if (data?.headline && data.headline.length > 25) {
    // 1. API DailyEnergy si la headline est assez parlante
    heroPhrase = data.headline;
    phraseSource = 'api';
  } else if (highlight) {
    // 2. Générateur local (240 combinaisons)
    const generated = generateSignaturePhrase(sunSignKey, highlight.planet);
    if (generated) {
      heroPhrase = generated.text;
      phraseSource = 'generated';
      subInfo = `${capitalize(generated.planetFr)} te parle aujourd'hui`;
    }
  }

  if (!heroPhrase) {
    // 3. Fallback universel (ne devrait pas arriver souvent)
    heroPhrase = `Le ciel a quelque chose à te dire aujourd'hui${firstName ? `, ${firstName}` : ''}.`;
  }

  const energyEmoji = data?.energy?.emoji ?? '✦';
  const energyLabel = data?.energy?.label ?? '';

  return (
    <div className="relative mb-6 rounded-3xl overflow-hidden border border-gold-500/40 animate-fade-in shadow-2xl shadow-gold-500/10">
      {/* Background gradient + glow signature premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold-500/20 via-cosmic-500/10 to-night-900 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold-500/25 blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cosmic-500/25 blur-3xl pointer-events-none animate-pulse-slow" />

      <div className="relative p-6 pb-7">
        {/* Header strip — signe + énergie */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            {sign && (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ring-1 ring-gold-500/30"
                style={{ background: `${sign.color}30`, borderColor: `${sign.color}60` }}
              >
                <span style={{ color: sign.color }}>{sign.symbol}</span>
              </div>
            )}
            <div>
              <p className="text-[10px] text-gold-400 uppercase tracking-widest font-bold">Aujourd'hui</p>
              <p className="text-[11px] text-night-200">
                {firstName ? `${firstName}, ` : ''}{sign?.name}
              </p>
            </div>
          </div>

          {data?.energy && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-500/15 border border-gold-500/40 backdrop-blur-sm">
              <span className="text-base">{energyEmoji}</span>
              <span className="text-[10px] text-gold-200 font-semibold capitalize">{energyLabel}</span>
            </div>
          )}

          {/* Chantier D (v8) — streak badge visible chaque jour, pas seulement aux milestones */}
          {streak !== undefined && streak > 0 && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 animate-flame-flicker"
              title={`${streak} jour${streak > 1 ? 's' : ''} d'affilée — reviens chaque jour pour entretenir le fil`}
            >
              <span className="text-[10px]">🔥</span>
              <span className="text-[10px] text-orange-200 font-bold tabular-nums">{streak}j</span>
            </div>
          )}
        </div>

        {/* v9 — streak milestone ribbon (7, 14, 30j+) */}
        {streak !== undefined && streak > 0 && (streak === 7 || streak === 14 || streak === 30 || streak % 30 === 0) && (
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-gold-300 animate-fade-in">
            <span>✦</span>
            <span className="uppercase tracking-widest">
              {streak === 7 && 'Une semaine de présence'}
              {streak === 14 && 'Deux semaines — le rythme s\'installe'}
              {streak === 30 && 'Un mois entier — tu fais partie du ciel'}
              {streak > 30 && streak % 30 === 0 && `${streak / 30} mois de présence`}
            </span>
            <span>✦</span>
          </div>
        )}

        <style>{`
          @keyframes flame-flicker {
            0%, 100% { box-shadow: 0 0 8px rgba(251, 146, 60, 0.3); }
            50%      { box-shadow: 0 0 16px rgba(251, 146, 60, 0.6); }
          }
          .animate-flame-flicker {
            animation: flame-flicker 2.5s ease-in-out infinite;
          }
        `}</style>

        {/* THE PHRASE — signature mémorable */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-5 bg-night-700/40 rounded w-full" />
            <div className="h-5 bg-night-700/40 rounded w-4/5" />
          </div>
        ) : (
          <>
            <p className="text-[1.65rem] leading-[1.2] font-bold text-night-50 tracking-tight animate-fade-in">
              {heroPhrase}
            </p>

            {subInfo && (
              <p className="text-[11px] text-night-400 mt-3 italic flex items-center gap-1.5">
                <span className="text-gold-400">✦</span>
                {subInfo}
              </p>
            )}
          </>
        )}

        {/* Décoration signature */}
        <div className="mt-5 flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-gold-500/50 to-transparent" />
          <span className="text-gold-400 text-xs">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-cosmic-500/50 to-transparent" />
        </div>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}