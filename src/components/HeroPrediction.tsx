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
    <div className="relative mb-6 px-1 pt-2 pb-8 animate-fade-in">
      {/* Header minimal — une ligne */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {sign && (
            <span className="text-base opacity-80" style={{ color: sign.color }}>{sign.symbol}</span>
          )}
          <span className="text-[11px] text-night-400 tracking-wide">
            {firstName ? `${firstName}` : 'Aujourd\'hui'}
            {sign ? ` · ${sign.name}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data?.energy && (
            <span className="text-[10px] text-night-500">
              {energyEmoji} {energyLabel}
            </span>
          )}
          {streak !== undefined && streak > 0 && (
            <span className="text-[10px] text-night-500">🔥 {streak}j</span>
          )}
        </div>
      </div>

      {/* Streak milestone — discret, seulement aux jalons */}
      {streak !== undefined && streak > 0 && (streak === 7 || streak === 14 || streak === 30 || streak % 30 === 0) && (
        <p className="text-[10px] text-gold-300/70 mb-4 tracking-wide">
          {streak === 7 && 'Une semaine de présence'}
          {streak === 14 && 'Deux semaines — le rythme s\'installe'}
          {streak === 30 && 'Un mois entier'}
          {streak > 30 && streak % 30 === 0 && `${streak / 30} mois de présence`}
        </p>
      )}

      {/* LA PHRASE — sobre, grande, qui respire */}
      {loading ? (
        <div className="space-y-2.5 animate-pulse">
          <div className="h-6 bg-night-700/30 rounded w-full" />
          <div className="h-6 bg-night-700/30 rounded w-5/6" />
        </div>
      ) : (
        <>
          <p className="text-[1.5rem] leading-[1.35] font-medium text-night-50">
            {displayedPhrase}
          </p>

          {subInfo && (
            <p className={`text-[11px] text-night-500 mt-4 transition-opacity duration-700 ${showSubInfo ? 'opacity-100' : 'opacity-0'}`}>
              {subInfo}
            </p>
          )}
        </>
      )}

      {/* Ligne fine de séparation — une seule, discrète */}
      <div className="mt-7 h-px bg-night-700/40" />
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}