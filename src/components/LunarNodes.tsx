import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Node = { sign: string; degree: number; absDeg: number; role: 'north' | 'south' };

const SIGN_GLYPHS: Record<string, string> = {
  'Bélier': '♈', 'Taureau': '♉', 'Gémeaux': '♊', 'Cancer': '♋',
  'Lion': '♌', 'Vierge': '♍', 'Balance': '♎', 'Scorpion': '♏',
  'Sagittaire': '♐', 'Capricorne': '♑', 'Verseau': '♒', 'Poissons': '♓'
};

export default function LunarNodes() {
  const [data, setData] = useState<{ northNode: Node; southNode: Node; interpretation: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getLunarNodes()
      .then(d => setData(d))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="celeste-card mb-6 animate-pulse">
      <div className="h-4 bg-celeste-primary/10 rounded w-1/3 mb-3" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-16 bg-celeste-primary/10 rounded" />
        <div className="h-16 bg-celeste-primary/10 rounded" />
      </div>
    </div>
  );

  if (err || !data) return (
    <div className="celeste-card mb-6 text-sm text-celeste-text/60">
      Nœuds lunaires indisponibles {err ? `(${err})` : ''}
    </div>
  );

  return (
    <div className="celeste-card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-celeste-accent flex items-center gap-2">
          <span>☊</span> Nœuds lunaires
        </h3>
        <span className="text-xs text-celeste-text/50">Axe karmique</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* North Node — evolution */}
        <div className="text-center p-3 rounded-lg bg-gradient-to-br from-gold-500/15 to-celeste-primary/5 border border-gold-500/30">
          <div className="text-[10px] uppercase tracking-widest text-gold-300 mb-1">Nœud Nord ☊</div>
          <div className="text-xs text-celeste-text/60 mb-1">Mission d'âme</div>
          <div className="text-2xl mb-0.5">{SIGN_GLYPHS[data.northNode.sign] || '·'}</div>
          <div className="text-sm font-semibold text-celeste-text">{data.northNode.sign}</div>
          <div className="text-xs text-celeste-text/50 font-mono">{data.northNode.degree.toFixed(1)}°</div>
        </div>
        {/* South Node — past mastery */}
        <div className="text-center p-3 rounded-lg bg-celeste-primary/5 border border-celeste-primary/20">
          <div className="text-[10px] uppercase tracking-widest text-celeste-text/60 mb-1">Nœud Sud ☋</div>
          <div className="text-xs text-celeste-text/60 mb-1">Confort acquis</div>
          <div className="text-2xl mb-0.5">{SIGN_GLYPHS[data.southNode.sign] || '·'}</div>
          <div className="text-sm font-semibold text-celeste-text">{data.southNode.sign}</div>
          <div className="text-xs text-celeste-text/50 font-mono">{data.southNode.degree.toFixed(1)}°</div>
        </div>
      </div>

      {data.interpretation && (
        <p className="text-xs text-celeste-text/75 leading-relaxed italic border-l-2 border-gold-500/40 pl-3">
          {data.interpretation}
        </p>
      )}
    </div>
  );
}
