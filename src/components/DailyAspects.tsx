import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Aspect = {
  p1: string; p2: string;
  p1Name: string; p2Name: string;
  p1Glyph: string; p2Glyph: string;
  aspect: string; aspectFr: string; aspectGlyph: string;
  nature: 'tension' | 'harmonique' | 'neutre';
  orb: number;
  interpretation: string;
  conseil: string;
};

const NATURE_STYLE: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  tension:     { bg: 'from-rose-500/20 to-orange-500/20',   text: 'text-rose-300',    label: 'Tension',     emoji: '⚡' },
  harmonique:  { bg: 'from-emerald-500/20 to-teal-500/20',  text: 'text-emerald-300', label: 'Harmonie',    emoji: '✨' },
  neutre:      { bg: 'from-violet-500/20 to-indigo-500/20',  text: 'text-violet-300',  label: 'Conjonction', emoji: '🌑' },
};

export default function DailyAspects() {
  const [aspects, setAspects] = useState<Aspect[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getDailyAspects()
      .then(data => {
        if (cancelled) return;
        setAspects(data.aspects);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || 'Erreur');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-slate-900/50 backdrop-blur border border-slate-800/50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🌌</span>
          <h3 className="text-sm uppercase tracking-wider text-slate-400">Aspects du jour</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !aspects || aspects.length === 0) {
    return null; // silently hide if no data — non critical widget
  }

  return (
    <div className="rounded-2xl bg-slate-900/50 backdrop-blur border border-slate-800/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🌌</span>
        <h3 className="text-sm uppercase tracking-wider text-slate-400">Aspects du jour</h3>
        <span className="ml-auto text-xs text-slate-500">{aspects.length} aspects clés</span>
      </div>

      <div className="space-y-3">
        {aspects.map((a, idx) => {
          const style = NATURE_STYLE[a.nature] || NATURE_STYLE.neutre;
          return (
            <div
              key={`${a.p1}-${a.aspect}-${a.p2}-${idx}`}
              className={`rounded-xl bg-gradient-to-br ${style.bg} border border-slate-700/40 p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg" title={a.p1Name}>{a.p1Glyph}</span>
                  <span className={`text-base font-semibold ${style.text}`}>{a.aspectGlyph}</span>
                  <span className="text-lg" title={a.p2Name}>{a.p2Glyph}</span>
                  <span className="ml-2 text-sm font-medium text-slate-200">
                    {a.p1Name} {a.aspectFr} {a.p2Name}
                  </span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full bg-slate-900/60 ${style.text}`}>
                  {style.emoji} {style.label}
                </span>
              </div>
              {a.interpretation && (
                <p className="text-sm text-slate-200 mb-1 leading-relaxed">
                  {a.interpretation}
                </p>
              )}
              {a.conseil && (
                <p className="text-xs text-slate-400 italic flex items-start gap-1">
                  <span className="not-italic">💡</span>
                  <span>{a.conseil}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}