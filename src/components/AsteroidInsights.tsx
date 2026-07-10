import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Asteroid = {
  key: string;
  name: string;
  theme: string;
  sign: string;
  degree: number;
  absDeg: number;
};

const SIGN_GLYPHS: Record<string, string> = {
  'Bélier': '♈', 'Taureau': '♉', 'Gémeaux': '♊', 'Cancer': '♋',
  'Lion': '♌', 'Vierge': '♍', 'Balance': '♎', 'Scorpion': '♏',
  'Sagittaire': '♐', 'Capricorne': '♑', 'Verseau': '♒', 'Poissons': '♓'
};

const KEY_ICONS: Record<string, string> = {
  chiron: '🩹',
  ceres: '🌾',
  pallas: '🦉',
  juno: '💍',
  vesta: '🔥'
};

export default function AsteroidInsights() {
  const [data, setData] = useState<{ positions: Asteroid[]; interpretation: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getAsteroids()
      .then(d => setData(d))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="celeste-card mb-6 animate-pulse">
      <div className="h-4 bg-celeste-primary/10 rounded w-1/3 mb-3" />
      <div className="grid grid-cols-5 gap-2">
        {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-celeste-primary/10 rounded" />)}
      </div>
    </div>
  );

  if (err || !data) return (
    <div className="celeste-card mb-6 text-sm text-celeste-text/60">
      Astéroïdes indisponibles {err ? `(${err})` : ''}
    </div>
  );

  return (
    <div className="celeste-card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-celeste-accent flex items-center gap-2">
          <span>✨</span> Astéroïdes natals
        </h3>
        <span className="text-xs text-celeste-text/50">Éléments orbitaux J2000</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {data.positions.map(a => (
          <div key={a.key} className="text-center p-2 bg-celeste-primary/5 rounded-lg" title={`${a.name}: ${a.theme}`}>
            <div className="text-base mb-0.5">{KEY_ICONS[a.key] || '·'}</div>
            <div className="text-[10px] text-celeste-text/60 truncate">{a.name}</div>
            <div className="text-base leading-none my-0.5">{SIGN_GLYPHS[a.sign] || '·'}</div>
            <div className="text-[10px] text-celeste-text/50 font-mono">{a.degree.toFixed(0)}°</div>
          </div>
        ))}
      </div>

      {data.interpretation && (
        <p className="text-xs text-celeste-text/75 leading-relaxed italic">
          {data.interpretation}
        </p>
      )}
    </div>
  );
}