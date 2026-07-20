import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign, NatalChart } from '../types';
import { getDailyHighlightPlanet } from '../lib/dailyHighlight';
import { generateSignaturePhrase } from '../lib/signaturePhrases';

/**
 * Typewriter — reveal lettre par lettre en ~1.2s pour donner le wow cinématique
 * au mount. Vitesse adaptative : 60ms/caractère, plafonné à 1.2s total.
 */
function useTypewriter(text: string, enabled: boolean, durationMs = 1200) {
  const [out, setOut] = useState(enabled ? '' : text);
  useEffect(() => {
    if (!enabled || !text) {
      setOut(text);
      return;
    }
    setOut('');
    const step = Math.max(20, Math.floor(durationMs / Math.max(1, text.length)));
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, step);
    return () => clearInterval(id);
  }, [text, enabled, durationMs]);
  return out;
}

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

  // Fric-#8 — Pré-génération locale IMMÉDIATE pour le first value moment.
  // Avant : on attendait l'API LLM (3-15s) avant d'afficher quoi que ce soit.
  // Maintenant : on affiche la phrase locale déterministe (240 combinaisons)
  // dès le mount, puis on swap avec la version API quand elle arrive (si plus précise).

  // 1. Phrase locale — IMMÉDIATE (avant même que l'API réponde)
  let localPhrase = '';
  let localSubInfo: string | null = null;
  if (highlight) {
    const generated = generateSignaturePhrase(sunSignKey, highlight.planet);
    if (generated) {
      localPhrase = generated.text;
      localSubInfo = `${capitalize(generated.planetFr)} te parle aujourd'hui`;
    }
  }
  if (!localPhrase) {
    localPhrase = `Le ciel a quelque chose à te dire aujourd'hui${firstName ? `, ${firstName}` : ''}.`;
  }

  // 2. Phrase API — remplace la locale si elle est assez précise
  let heroPhrase = localPhrase;
  let phraseSource: 'api' | 'generated' | 'fallback' = 'generated';
  let subInfo: string | null = localSubInfo;

  if (data?.headline && data.headline.length > 25) {
    heroPhrase = data.headline;
    phraseSource = 'api';
    // L'API fournit son propre sub via le badge énergie, pas besoin de subInfo local
    subInfo = null;
  }

  const energyEmoji = data?.energy?.emoji ?? '✦';
  const energyLabel = data?.energy?.label ?? '';

  // v10 — Typewriter : la phrase se révèle lettre par lettre au mount (1.2s)
  // pour donner le moment cinématique signature.
  const displayedPhrase = useTypewriter(heroPhrase, !loading);
  // SubInfo arrive 200ms après la fin du typewriter pour séquencer le reveal
  const [showSubInfo, setShowSubInfo] = useState(false);
  useEffect(() => {
    if (loading || !subInfo) {
      setShowSubInfo(false);
      return;
    }
    const step = Math.max(20, Math.floor(1200 / Math.max(1, heroPhrase.length)));
    const totalMs = step * heroPhrase.length + 200;
    const id = setTimeout(() => setShowSubInfo(true), totalMs);
    return () => clearTimeout(id);
  }, [loading, heroPhrase, subInfo]);

  return (
    <div className="relative mb-6 rounded-3xl overflow-hidden border border-gold-500/40 animate-fade-in shadow-2xl shadow-gold-500/10">
      {/* Background gradient + glow signature premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold-500/20 via-cosmic-500/10 to-night-900 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold-500/25 blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cosmic-500/25 blur-3xl pointer-events-none animate-pulse-slow" />

      {/* v12 polish — Mini-thème natal orbital en filigrane arrière-plan.
          Soleil/Lune/Ascendant orbitent doucement avec leurs glyphes et couleurs.
          Opacité très faible pour ne pas distraire de la phrase. */}
      <svg className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/3 opacity-[0.07] pointer-events-none"
           width="320" height="320" viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <radialGradient id="hero-orbit-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx="160" cy="160" r="140" fill="url(#hero-orbit-glow)" />
        {/* 3 orbites concentriques */}
        <circle cx="160" cy="160" r="120" fill="none" stroke="#fbbf24" strokeWidth="0.3" opacity="0.5" />
        <circle cx="160" cy="160" r="80" fill="none" stroke="#a855f7" strokeWidth="0.3" opacity="0.4" />
        <circle cx="160" cy="160" r="45" fill="none" stroke="#c084fc" strokeWidth="0.3" opacity="0.3" />
        {/* Ligne des nœuds */}
        <line x1="20" y1="160" x2="300" y2="160" stroke="#fbbf24" strokeWidth="0.2" opacity="0.3" strokeDasharray="2 4" />
        <line x1="160" y1="20" x2="160" y2="300" stroke="#fbbf24" strokeWidth="0.2" opacity="0.3" strokeDasharray="2 4" />
        {/* Ascendant en rotation lente */}
        {chart.rising && ZODIAC_SIGNS[chart.rising] && (
          <g>
            <circle cx="280" cy="160" r="8" fill="none"
                    stroke={ZODIAC_SIGNS[chart.rising].color} strokeWidth="1" opacity="0.6" />
            <text x="280" y="160" textAnchor="middle" dominantBaseline="central"
                  fontSize="8" fill={ZODIAC_SIGNS[chart.rising].color} opacity="0.7">
              {ZODIAC_SIGNS[chart.rising].symbol}
            </text>
            <animateTransform attributeName="transform" type="rotate"
              from="0 160 160" to="360 160 160" dur="60s" repeatCount="indefinite" />
          </g>
        )}
        {/* Lune en rotation inverse */}
        {chart.moon && ZODIAC_SIGNS[chart.moon] && (
          <g>
            <circle cx="240" cy="160" r="6" fill="none"
                    stroke={ZODIAC_SIGNS[chart.moon].color} strokeWidth="1" opacity="0.6" />
            <text x="240" y="160" textAnchor="middle" dominantBaseline="central"
                  fontSize="6" fill={ZODIAC_SIGNS[chart.moon].color} opacity="0.7">
              {ZODIAC_SIGNS[chart.moon].symbol}
            </text>
            <animateTransform attributeName="transform" type="rotate"
              from="120 160 160" to="-240 160 160" dur="45s" repeatCount="indefinite" />
          </g>
        )}
        {/* Soleil central fixe pulsant */}
        {sunSignKey && ZODIAC_SIGNS[sunSignKey as ZodiacSign] && (
          <g>
            <circle cx="160" cy="160" r="10" fill="none"
                    stroke={ZODIAC_SIGNS[sunSignKey as ZodiacSign].color} strokeWidth="1" opacity="0.5">
              <animate attributeName="r" values="9;11;9" dur="4s" repeatCount="indefinite" />
            </circle>
            <text x="160" y="160" textAnchor="middle" dominantBaseline="central"
                  fontSize="10" fill={ZODIAC_SIGNS[sunSignKey as ZodiacSign].color} opacity="0.6">
              {ZODIAC_SIGNS[sunSignKey as ZodiacSign].symbol}
            </text>
          </g>
        )}
      </svg>

      <div className="relative p-5 pb-6">
        {/* Header strip compact — signe + énergie sur une ligne discrète */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {sign && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ring-1 ring-gold-500/20"
                style={{ background: `${sign.color}25` }}
              >
                <span style={{ color: sign.color }}>{sign.symbol}</span>
              </div>
            )}
            <p className="text-[11px] text-night-300">
              <span className="text-gold-400/80 font-medium">Aujourd'hui</span>
              {firstName ? ` · ${firstName}` : ''}
              {sign ? ` · ${sign.name}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {data?.energy && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20">
                <span className="text-xs">{energyEmoji}</span>
                <span className="text-[10px] text-gold-200/80 capitalize">{energyLabel}</span>
              </div>
            )}

            {streak !== undefined && streak > 0 && (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20"
                title={`${streak} jour${streak > 1 ? 's' : ''} d'affilée`}
              >
                <span className="text-[9px]">🔥</span>
                <span className="text-[9px] text-orange-200/80 font-bold tabular-nums">{streak}j</span>
              </div>
            )}
          </div>
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
              {displayedPhrase}
              {/* Curseur clignotant pendant la frappe */}
              {displayedPhrase.length < heroPhrase.length && (
                <span
                  className="inline-block w-0.5 h-5 ml-0.5 bg-gold-400 align-middle animate-pulse"
                  aria-hidden="true"
                />
              )}
            </p>

            {subInfo && (
              <p
                className={`text-[11px] text-night-400 mt-3 italic flex items-center gap-1.5 transition-opacity duration-700 ${showSubInfo ? 'opacity-100' : 'opacity-0'}`}
              >
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