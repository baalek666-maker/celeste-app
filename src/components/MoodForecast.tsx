/**
 * MoodForecast — Prévisions d'humeur 14 jours (Piste 5).
 *
 * "Le météo de ton ciel intérieur"
 *
 * - 3 jours offerts (aujourd'hui + J+1 + J+2)
 * - 14 jours pour les premium (paywall inline si non-premium)
 * - Score 0-100 + label FR + emoji + phrase expressive
 * - Curve graphique en haut (mini-chart courbe)
 * - Liste détaillée en dessous
 *
 * Zéro IA, zéro LLM. Score basé sur aspects planétaires réels (trines +
 * sextiles = positif, squares + oppositions = négatif, etc.).
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from './Toast';

interface DayMood {
  date: string;
  score: number;
  label: string;
  emoji: string;
  tone: string;
  phrase: string;
  moonSign: string;
  mercuryRetrograde: boolean;
  highlights: Array<{ aspect: string; planets: [string, string]; nature: string; weight: number }>;
}

const TONE_COLORS: Record<string, string> = {
  tendue: 'text-rose-400',
  contrastée: 'text-amber-400',
  neutre: 'text-slate-400',
  fluide: 'text-emerald-400',
  harmonieuse: 'text-teal-300',
  rayonnante: 'text-gold-400',
};

const TONE_BAR: Record<string, string> = {
  tendue: 'from-rose-600/40 to-rose-500/10',
  contrastée: 'from-amber-600/40 to-amber-500/10',
  neutre: 'from-slate-600/40 to-slate-500/10',
  fluide: 'from-emerald-600/40 to-emerald-500/10',
  harmonieuse: 'from-teal-600/40 to-teal-500/10',
  rayonnante: 'from-gold-600/50 to-gold-400/20',
};

const PLANET_GLYPH: Record<string, string> = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
};

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function dayShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return WEEKDAYS[d.getUTCDay()];
}
function dayNum(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.getUTCDate();
}
function relativeLabel(dateStr: string, index: number): string {
  if (index === 0) return "Aujourd'hui";
  if (index === 1) return 'Demain';
  if (index === 2) return 'Après-demain';
  return '';
}

export default function MoodForecast() {
  const [forecast, setForecast] = useState<DayMood[] | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getMoodForecast()
      .then(data => {
        if (!alive) return;
        setForecast(data.forecast);
        setIsPremium(data.isPremium);
      })
      .catch(err => {
        toast.error(err instanceof Error ? err.message : 'Forecast indisponible');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <section className="glass rounded-3xl p-5 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded mb-4" />
        <div className="h-24 bg-white/5 rounded-xl" />
      </section>
    );
  }
  if (!forecast || forecast.length === 0) return null;

  const selected = forecast[selectedIdx];
  const maxScore = 100;
  const chartW = 300;
  const chartH = 80;
  const padding = 8;
  const stepX = (chartW - padding * 2) / Math.max(1, forecast.length - 1);
  const points = forecast.map((d, i) => ({
    x: padding + i * stepX,
    y: chartH - padding - (d.score / maxScore) * (chartH - padding * 2),
  }));
  const pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${chartH - padding} L${points[0].x},${chartH - padding} Z`;

  return (
    <section className="glass rounded-2xl p-5 mb-6 space-y-4 border border-night-700/20">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-night-100">Météo de ton ciel</h2>
          <p className="text-xs text-night-400">14 jours d'avance sur ton humeur</p>
        </div>
        {!isPremium && (
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-800">
            3j / 14j
          </span>
        )}
      </header>

      {/* Mini-chart courbe */}
      <div className="relative">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="none" style={{ height: 90 }}>
          <defs>
            <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e2c47c" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#e2c47c" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#moodGradient)" />
          <path d={pathD} fill="none" stroke="#e2c47c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={i === selectedIdx ? 4 : 2.5}
                fill={i === selectedIdx ? '#e2c47c' : '#6a6a6a'}
                className="cursor-pointer"
                onClick={() => setSelectedIdx(i)}
              />
            </g>
          ))}
        </svg>
        {/* Jour labels sous la courbe */}
        <div className="flex justify-between text-[9px] text-night-500 mt-1 px-2">
          {forecast.map((d, i) => (
            <button
              key={d.date}
              onClick={() => setSelectedIdx(i)}
              className={`flex flex-col items-center gap-0.5 transition-all ${i === selectedIdx ? 'text-gold-400' : ''}`}
              style={{ flex: 1 }}
            >
              <span>{dayShort(d.date)}</span>
              <span className={i === selectedIdx ? 'font-bold' : ''}>{dayNum(d.date)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Détail jour sélectionné */}
      <div className={`rounded-2xl p-4 bg-gradient-to-br ${TONE_BAR[selected.tone] || 'from-slate-700/40 to-slate-800/10'} border border-white/5`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-night-400">
              {relativeLabel(selected.date, selectedIdx) || `${dayShort(selected.date)} ${dayNum(selected.date)}`}
            </div>
            <div className="text-2xl mt-0.5">
              <span className="mr-2">{selected.emoji}</span>
              <span className="font-display text-xl">{selected.label}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-display ${TONE_COLORS[selected.tone] || 'text-gold-100'}`}>{selected.score}</div>
            <div className="text-[9px] text-night-500 uppercase tracking-widest">/ 100</div>
          </div>
        </div>
        <p className="text-sm text-night-200 leading-relaxed italic">"{selected.phrase}"</p>

        {/* Highlights astro */}
        {selected.highlights.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.highlights.map((h, i) => (
              <span
                key={i}
                className={`text-[10px] px-2 py-1 rounded-full border ${h.nature === 'harmonique' ? 'border-emerald-500/30 text-emerald-300' : 'border-rose-500/30 text-rose-300'}`}
              >
                {PLANET_GLYPH[h.planets[0]]} {h.aspect} {PLANET_GLYPH[h.planets[1]]}
              </span>
            ))}
            {selected.mercuryRetrograde && (
              <span className="text-[10px] px-2 py-1 rounded-full border border-amber-500/30 text-amber-300">
                ☿ rétrograde
              </span>
            )}
            <span className="text-[10px] px-2 py-1 rounded-full border border-violet-500/30 text-violet-300">
              ☽ {selected.moonSign}
            </span>
          </div>
        )}
      </div>

      {/* Paywall CTA pour non-premium */}
      {!isPremium && (
        <div className="rounded-2xl border border-gold-500/20 bg-gold-500/5 p-4 text-center">
          <p className="text-sm text-night-200 mb-3">
            Tu vois 3 jours. <span className="text-gold-300">Débloque 14 jours d'avance</span> pour anticiper tes semaines.
          </p>
          <button
            onClick={() => setShowPaywall(true)}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-gold-500 to-gold-400 text-night-900 text-sm font-semibold hover:brightness-110 transition"
          >
            Voir 14 jours →
          </button>
        </div>
      )}

      {/* Paywall modal (inline) */}
      {showPaywall && (
        <div
          className="fixed inset-0 z-50 bg-night-950/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowPaywall(false)}
        >
          <div
            className="glass rounded-3xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-gold-100 mb-2">Céleste Premium</h3>
            <p className="text-sm text-night-300 mb-4">
              14 jours de prévisions d'humeur, tirages de tarot illimités, portrait astral PDF, et plus encore.
            </p>
            <ul className="space-y-2 text-sm text-night-200 mb-5">
              <li className="flex gap-2"><span className="text-gold-400">✦</span> Mood Forecast 14 jours</li>
              <li className="flex gap-2"><span className="text-gold-400">✦</span> Tarot en croix illimité</li>
              <li className="flex gap-2"><span className="text-gold-400">✦</span> Portrait astral PDF</li>
              <li className="flex gap-2"><span className="text-gold-400">✦</span> Streak freezes offerts</li>
            </ul>
            <a
              href="/premium"
              onClick={e => {
                e.preventDefault();
                window.location.hash = '#premium';
                setShowPaywall(false);
              }}
              className="block text-center px-5 py-3 rounded-full bg-gradient-to-r from-gold-500 to-gold-400 text-night-900 font-semibold"
            >
              Découvrir Premium
            </a>
            <button
              onClick={() => setShowPaywall(false)}
              className="block mx-auto mt-3 text-xs text-night-500 underline"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
