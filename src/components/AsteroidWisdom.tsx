import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Archetype = {
  key: string;
  name: string;
  archetype: string;
  icon: string;
  sign: string;
  degree: number;
  glyph: string;
  title?: string;
  meaning?: string;
  gift?: string;
  shadow?: string;
  practice?: string;
};

type WisdomData = {
  headline: string;
  archetypes: Archetype[];
  generatedAt?: string;
};

export default function AsteroidWisdom() {
  const [data, setData] = useState<WisdomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getAsteroidWisdom()
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return (
    <div className="celeste-card mb-6 animate-pulse">
      <div className="h-4 bg-celeste-primary/10 rounded w-1/2 mb-3" />
      <div className="h-3 bg-celeste-primary/10 rounded w-3/4 mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-celeste-primary/10 rounded-xl" />)}
      </div>
    </div>
  );

  if (err || !data || !data.archetypes || data.archetypes.length === 0) return (
    <div className="celeste-card mb-6 text-sm text-celeste-text/60">
      Blessures & pouvoirs indisponibles {err ? `(${err})` : ''}
    </div>
  );

  return (
    <div className="celeste-card mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🌑</span>
        <h3 className="text-sm font-semibold text-celeste-accent">Blessures & Pouvoirs</h3>
      </div>

      {/* Headline */}
      <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-violet-500/8 to-gold-500/5 border border-gold-500/20">
        <p className="text-sm text-celeste-text leading-relaxed">{data.headline}</p>
      </div>

      {/* Archetype cards */}
      <div className="space-y-2">
        {data.archetypes.map(a => {
          const isOpen = expanded === a.key;
          return (
            <div key={a.key} className="rounded-xl bg-celeste-primary/5 border border-celeste-primary/15 overflow-hidden">
              {/* Collapsed header */}
              <button
                onClick={() => setExpanded(isOpen ? null : a.key)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-celeste-primary/5 transition-colors"
              >
                <span className="text-xl flex-shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-celeste-text truncate">
                    {a.title || a.archetype}
                  </p>
                  <p className="text-xs text-celeste-text/50">
                    {a.name} {a.glyph} {a.sign} · {a.degree}°
                  </p>
                </div>
                <span className={`text-celeste-text/40 transition-transform text-xs ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-celeste-primary/10 pt-2.5">
                  {a.meaning && (
                    <p className="text-sm text-celeste-text/85 leading-relaxed">{a.meaning}</p>
                  )}
                  {a.gift && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gold-300 font-medium mt-0.5">🎁 Don</span>
                      <p className="text-xs text-celeste-text/70 leading-relaxed flex-1">{a.gift}</p>
                    </div>
                  )}
                  {a.shadow && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-rose-300/80 font-medium mt-0.5">⚠ Piège</span>
                      <p className="text-xs text-celeste-text/60 leading-relaxed flex-1">{a.shadow}</p>
                    </div>
                  )}
                  {a.practice && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-emerald-300/80 font-medium mt-0.5">✦ Pratique</span>
                      <p className="text-xs text-celeste-text/70 leading-relaxed flex-1 italic">{a.practice}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
