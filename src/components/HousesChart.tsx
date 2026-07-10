import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type House = {
  num: number;
  sign: string;
  degree: number;
  absDeg: number;
  theme: string;
};

const SIGN_GLYPHS: Record<string, string> = {
  'Bélier': '♈', 'Taureau': '♉', 'Gémeaux': '♊', 'Cancer': '♋',
  'Lion': '♌', 'Vierge': '♍', 'Balance': '♎', 'Scorpion': '♏',
  'Sagittaire': '♐', 'Capricorne': '♑', 'Verseau': '♒', 'Poissons': '♓'
};

export default function HousesChart() {
  const [data, setData] = useState<{
    system: string;
    ascendant: { sign: string; degree: number };
    sunSign: string;
    houses: House[];
    interpretation: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getHouses()
      .then(d => setData(d))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="celeste-card mb-6 animate-pulse">
      <div className="h-4 bg-celeste-primary/10 rounded w-1/3 mb-3" />
      <div className="h-3 bg-celeste-primary/10 rounded w-2/3 mb-2" />
      <div className="h-3 bg-celeste-primary/10 rounded w-1/2" />
    </div>
  );

  if (err || !data) return (
    <div className="celeste-card mb-6 text-sm text-celeste-text/60">
      Maisons indisponibles {err ? `(${err})` : ''}
    </div>
  );

  return (
    <div className="celeste-card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-celeste-accent flex items-center gap-2">
          <span>🏠</span> Maisons natales
        </h3>
        <span className="text-xs text-celeste-text/50">{data.system}</span>
      </div>

      {/* Ascendant summary */}
      <div className="mb-3 p-3 bg-celeste-primary/5 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{SIGN_GLYPHS[data.ascendant.sign] || '✨'}</span>
          <div>
            <p className="text-sm font-medium">
              Ascendant {data.ascendant.sign}{' '}
              <span className="text-celeste-text/60">{data.ascendant.degree.toFixed(1)}°</span>
            </p>
            <p className="text-xs text-celeste-text/50">Maison 1 — toi, ton corps, ton style</p>
          </div>
        </div>
        {data.interpretation && (
          <p className="text-sm text-celeste-text/80 italic mt-2 leading-relaxed">
            {data.interpretation}
          </p>
        )}
      </div>

      {/* Houses list (compact 6+6 grid) */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {data.houses.map(h => (
          <div key={h.num} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-celeste-text/50 w-4 text-right">{h.num}</span>
            <span className="text-base">{SIGN_GLYPHS[h.sign] || '·'}</span>
            <span className="flex-1 truncate text-celeste-text/80">{h.theme}</span>
            <span className="text-celeste-text/40 font-mono">{h.degree.toFixed(0)}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}