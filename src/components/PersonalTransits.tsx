import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import TransitComments from './TransitComments';

type Aspect = {
  transitPlanet: string;
  natalPlanet: string;
  transitPlanetFr: string;
  natalPlanetFr: string;
  transitGlyph: string;
  natalGlyph: string;
  aspect: string;
  aspectFr: string;
  aspectGlyph: string;
  nature: 'tension' | 'harmonique' | 'neutre';
  orb: number;
  exact: boolean;
  transitRetrograde: boolean;
  interpretation: string;
  conseil: string;
};

type TransitsData = {
  date: string;
  headline: string;
  flowScore: number;
  challengeScore: number;
  aspects: Aspect[];
};

const NATURE_STYLE: Record<string, { bg: string; border: string; text: string; label: string; emoji: string }> = {
  tension:    { bg: 'from-rose-500/10 to-orange-500/10',    border: 'border-rose-500/25',    text: 'text-rose-300',    label: 'Défi',      emoji: '⚡' },
  harmonique: { bg: 'from-emerald-500/10 to-teal-500/10',   border: 'border-emerald-500/25', text: 'text-emerald-300', label: 'Flow',      emoji: '✨' },
  neutre:     { bg: 'from-violet-500/10 to-indigo-500/10',   border: 'border-violet-500/25',  text: 'text-violet-300',  label: 'Activation',emoji: '🌑' },
};

export default function PersonalTransits() {
  const [data, setData] = useState<TransitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getPersonalTransits()
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err.message || 'Erreur'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="celeste-card mb-6 animate-pulse">
        <div className="h-4 bg-celeste-primary/10 rounded w-2/3 mb-3" />
        <div className="h-3 bg-celeste-primary/10 rounded w-1/2 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-celeste-primary/10 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="celeste-card mb-6 text-sm text-celeste-text/60">
        Transits indisponibles {error ? `(${error})` : ''}
      </div>
    );
  }

  return (
    <div className="celeste-card mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🌌</span>
        <h3 className="text-sm font-semibold text-celeste-accent">Transits du jour</h3>
        <span className="ml-auto text-xs text-celeste-text/40">{data.aspects.length} aspects actifs</span>
      </div>

      {/* Headline */}
      <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-celeste-primary/8 to-gold-500/5 border border-gold-500/20">
        <p className="text-sm text-celeste-text leading-relaxed">{data.headline}</p>
        {/* Flow vs Challenge bar */}
        <div className="flex items-center gap-2 mt-3">
          {data.challengeScore > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-rose-500/15 text-rose-300">
              ⚡ {data.challengeScore} défi{data.challengeScore >= 2 ? 's' : ''}
            </span>
          )}
          {data.flowScore > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300">
              ✨ {data.flowScore} flow
            </span>
          )}
          {data.flowScore === 0 && data.challengeScore === 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-celeste-primary/10 text-celeste-text/60">
              🌙 journée calme
            </span>
          )}
        </div>
      </div>

      {/* Aspects */}
      <div className="space-y-3">
        {data.aspects.map((a, idx) => {
          const style = NATURE_STYLE[a.nature] || NATURE_STYLE.neutre;
          return (
            <div
              key={`${a.transitPlanet}-${a.aspect}-${a.natalPlanet}-${idx}`}
              className={`rounded-xl bg-gradient-to-br ${style.bg} border ${style.border} p-4`}
            >
              {/* Aspect header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg" title={a.transitPlanetFr}>{a.transitGlyph}</span>
                  {a.transitRetrograde && <span className="text-[9px] text-amber-400 font-mono">℞</span>}
                  <span className={`text-sm font-bold ${style.text}`}>{a.aspectGlyph}</span>
                  <span className="text-lg" title={a.natalPlanetFr}>{a.natalGlyph}</span>
                  <span className="ml-1.5 text-sm text-celeste-text/90">
                    {a.transitPlanetFr} {a.aspectFr} ton {a.natalPlanetFr}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {a.exact && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-300 font-medium">
                      EXACT
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-celeste-bg/40 ${style.text}`}>
                    {style.emoji} {style.label}
                  </span>
                </div>
              </div>

              {/* Interpretation */}
              {a.interpretation && (
                <p className="text-sm text-celeste-text/85 mb-2 leading-relaxed">{a.interpretation}</p>
              )}

              {/* Conseil */}
              {a.conseil && (
                <p className="text-xs text-celeste-text/60 flex items-start gap-1.5">
                  <span className="not-italic">💡</span>
                  <span className="italic">{a.conseil}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* P2#20 — Espace de partage communautaire */}
      {data.date && (
        <TransitComments date={data.date} transitKey={`personal-${data.date}`} />
      )}
    </div>
  );
}
