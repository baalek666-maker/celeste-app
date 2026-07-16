import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type PlanetInHouse = {
  key: string;
  name: string;
  glyph: string;
  sign: string;
  degree: number;
  retrograde?: boolean;
};

type HouseData = {
  num: number;
  theme: string;
  icon: string;
  short: string;
  sign: string;
  activated: boolean;
  natalPlanets: PlanetInHouse[];
  transitPlanets: PlanetInHouse[];
  insight: string;
  action: string;
};

const SIGN_GLYPHS: Record<string, string> = {
  'Bélier': '♈', 'Taureau': '♉', 'Gémeaux': '♊', 'Cancer': '♋',
  'Lion': '♌', 'Vierge': '♍', 'Balance': '♎', 'Scorpion': '♏',
  'Sagittaire': '♐', 'Capricorne': '♑', 'Verseau': '♒', 'Poissons': '♓'
};

export default function ActivatedHouses() {
  const [data, setData] = useState<{ date: string; headline: string; houses: HouseData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getActivatedHouses()
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return (
    <div className="celeste-card mb-6 animate-pulse">
      <div className="h-4 bg-celeste-primary/10 rounded w-1/3 mb-3" />
      <div className="h-3 bg-celeste-primary/10 rounded w-2/3 mb-3" />
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-24 bg-celeste-primary/10 rounded-xl" />)}
      </div>
    </div>
  );

  if (err || !data || !data.houses || data.houses.length === 0) return (
    <div className="celeste-card mb-6 text-sm text-celeste-text/60">
      Maisons activées indisponibles {err ? `(${err})` : ''}
    </div>
  );

  return (
    <div className="celeste-card mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🏠</span>
        <h3 className="text-sm font-semibold text-celeste-accent">Maisons activées</h3>
      </div>

      {/* Headline */}
      <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-celeste-primary/8 to-gold-500/5 border border-gold-500/20">
        <p className="text-sm text-celeste-text leading-relaxed">{data.headline}</p>
      </div>

      {/* Activated houses */}
      <div className="space-y-3">
        {data.houses.map(h => (
          <div key={h.num} className="rounded-xl bg-celeste-primary/5 border border-celeste-primary/15 p-4">
            {/* House header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{h.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-celeste-text">
                    Maison {h.num} <span className="text-celeste-text/50 font-normal">— {h.theme}</span>
                  </p>
                  <p className="text-xs text-celeste-text/50">{SIGN_GLYPHS[h.sign] || ''} {h.sign}</p>
                </div>
              </div>
            </div>

            {/* Planets passing through */}
            {h.transitPlanets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {h.transitPlanets.map(tp => (
                  <span key={tp.key} className="text-xs px-2 py-1 rounded-full bg-gold-500/15 text-gold-200 border border-gold-500/20">
                    {tp.glyph} {tp.name}{tp.retrograde ? ' ℞' : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Natal planets already there */}
            {h.natalPlanets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {h.natalPlanets.map(np => (
                  <span key={np.key} className="text-xs px-2 py-1 rounded-full bg-celeste-primary/10 text-celeste-text/60">
                    {np.glyph} {np.name} (natal)
                  </span>
                ))}
              </div>
            )}

            {/* Insight */}
            <p className="text-sm text-celeste-text/85 leading-relaxed mb-2">{h.insight}</p>

            {/* Action */}
            <p className="text-xs text-celeste-text/60 flex items-start gap-1.5">
              <span className="not-italic">→</span>
              <span className="italic">{h.action}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
