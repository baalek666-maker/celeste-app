import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../components/Toast';

type DailyEnergy = {
  date: string;
  headline: string;
  energy: { score: number; label: string; emoji: string; advice: string };
  goodFor: string[];
  avoid: string[];
  reflectionPrompt: string;
  reflectionText: string;
};

/**
 * v11 — clé localStorage "expanded today" pour le bloc Énergie.
 * On déplie 1× par jour calendaire locale (pas UTC).
 */
function getExpansionKey(): string {
  const d = new Date();
  return `celeste:expanded-energy:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * DailyEnergy — 3 modes :
 * - default : bloc complet (headline + bar + chips goodFor/avoid + réflexion)
 * - compact : 1-ligne résumé, pour éviter la redondance quand HeroPrediction a déjà affiché la headline
 * - v11 expanded-once : si pas encore expanded today → afficher full pendant ~6s puis compact.
 *   Sur la première visite du jour, l'utilisateur voit "transits en clair" (le bloc full avec headline + goodFor/avoid),
 *   puis à la 2e visite ou au refresh, ça redevient compact.
 */
export default function DailyEnergy({ compact = false }: { compact?: boolean } = {}) {
  const [data, setData] = useState<DailyEnergy | null>(null);
  const [loading, setLoading] = useState(true);
  const [reflecting, setReflecting] = useState(false);
  const [savedReflection, setSavedReflection] = useState(false);
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [showReflectZone, setShowReflectZone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * v11 — Si "compact" prop ET qu'on n'a pas encore vu le bloc aujourd'hui,
   * on force l'expansion une fois (puis re-compact après 6s).
   */
  const [expandedOnce, setExpandedOnce] = useState(() => {
    if (!compact) return false;
    try {
      return localStorage.getItem(getExpansionKey()) !== '1';
    } catch { return false; }
  });

  useEffect(() => {
    let alive = true;
    api.getDailyEnergy()
      .then(d => {
        if (!alive) return;
        setData(d);
        if (d.reflectionText) {
          setReflectionDraft(d.reflectionText);
          setSavedReflection(true);
        }
      })
      .catch((err) => { toast.error('Énergie du jour indisponible — tu peux réessayer dans un instant.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // v11 — quand on est en mode "expanded-once", on persiste le flag après 6s
  // pour que la 2e visite soit en compact.
  useEffect(() => {
    if (!expandedOnce) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(getExpansionKey(), '1'); } catch { /* private mode */ }
      setExpandedOnce(false);
    }, 6000);
    return () => clearTimeout(t);
  }, [expandedOnce]);

  const saveReflection = async () => {
    if (!reflectionDraft.trim()) return;
    setReflecting(true);
    try {
      await api.saveReflection(reflectionDraft);
      setSavedReflection(true);
      setShowReflectZone(false);
    } catch { /* silent */ }
    finally { setReflecting(false); }
  };

  // ─── Loading skeleton ─────────────────────────────────
  if (loading) {
    return (
      <div className="glass rounded-3xl p-5 mb-5 animate-pulse">
        <div className="h-3 bg-gold-500/20 rounded w-1/4 mb-3" />
        <div className="h-6 bg-gold-500/10 rounded w-3/4 mb-4" />
        <div className="flex gap-2">
          <div className="h-8 bg-night-700/30 rounded-full w-20" />
          <div className="h-8 bg-night-700/30 rounded-full w-20" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const e = data.energy;

  // ─── MODE COMPACT (v8) — 1-ligne. Mais v11 : si pas encore vu aujourd'hui, on force expanded. ──
  // v11 — expandedOnce est true quand l'utilisateur n'a pas encore vu le bloc aujourd'hui.
  // v11 — effectiveCompact = compact demandé ET pas en mode "first-view today".
    // Si on est en first-view, on saute le mode compact et on affiche le bloc complet (transits en clair).
    const effectiveCompact = compact && !expandedOnce;
    if (effectiveCompact) {
      return (
        <div className="glass rounded-2xl p-3 mb-2 flex items-center gap-3 border border-gold-500/15 animate-fade-in">
          <div className="text-xl flex-shrink-0">{e.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-gold-400 uppercase tracking-widest font-bold">Énergie du jour</span>
              <span className="text-night-500 text-[10px]">{e.score}/10</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.goodFor.slice(0, 2).map((g, i) => (
                <span key={i} className="text-emerald-300 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded-full">+ {g}</span>
              ))}
              {data.avoid.slice(0, 1).map((a, i) => (
                <span key={i} className="text-orange-300 text-[10px] bg-orange-500/10 px-1.5 py-0.5 rounded-full">− {a}</span>
              ))}
            </div>
          </div>
        </div>
      );
    }

  return (
    <div className="glass rounded-3xl p-5 mb-5 stagger-card card-glow animate-fade-in overflow-hidden relative" style={{ animationDelay: '0.05s' }}>
      {/* Subtle energy glow background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${energyColor(e.score)}, transparent 70%)` }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-gold-400 text-xs uppercase tracking-widest font-medium">Énergie du jour</p>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-xs" style={{ opacity: i < Math.ceil(e.score / 2) ? 1 : 0.2 }}>✦</span>
            ))}
          </div>
        </div>

        {/* Headline — the star */}
        <p className="text-night-100 text-[15px] leading-relaxed font-medium mb-4">
          {data.headline}
        </p>

        {/* Energy bar */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{e.emoji}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-night-200 text-xs font-semibold capitalize">{e.label}</span>
              <span className="text-night-500 text-[10px]">{e.score}/10</span>
            </div>
            <div className="h-1.5 rounded-full bg-night-700/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${e.score * 10}%`, background: energyGradient(e.score) }}
              />
            </div>
          </div>
        </div>

        {/* Good for / Avoid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="glass rounded-xl p-2.5 border border-emerald-500/10">
            <p className="text-emerald-400/80 text-[10px] uppercase tracking-wider mb-1.5">Favorable</p>
            <div className="flex flex-wrap gap-1">
              {data.goodFor.map((g, i) => (
                <span key={i} className="text-night-200 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {g}
                </span>
              ))}
            </div>
          </div>
          <div className="glass rounded-xl p-2.5 border border-orange-500/10">
            <p className="text-orange-400/80 text-[10px] uppercase tracking-wider mb-1.5">À éviter</p>
            <div className="flex flex-wrap gap-1">
              {data.avoid.map((a, i) => (
                <span key={i} className="text-night-200 text-[11px] bg-orange-500/10 px-2 py-0.5 rounded-full">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Reflection zone */}
        {!showReflectZone && !savedReflection && (
          <button
            onClick={() => { setShowReflectZone(true); setTimeout(() => textareaRef.current?.focus(), 100); }}
            className="w-full glass-gold rounded-xl py-2.5 px-4 text-left group transition-all hover:scale-[1.01]"
          >
            <p className="text-gold-300 text-xs font-medium mb-0.5">💭 Réflexion du jour</p>
            <p className="text-night-300 text-[11px] leading-snug">{data.reflectionPrompt}</p>
          </button>
        )}

        {showReflectZone && (
          <div className="glass-gold rounded-xl p-4 animate-fade-in">
            <p className="text-gold-300 text-xs font-medium mb-2">💭 {data.reflectionPrompt}</p>
            <textarea
              ref={textareaRef}
              value={reflectionDraft}
              onChange={e => setReflectionDraft(e.target.value)}
              placeholder="Écris ce qui te vient…"
              maxLength={5000}
              rows={4}
              className="w-full bg-night-900/50 text-night-100 text-sm rounded-lg p-3 border border-night-700/50 focus:border-gold-500/40 focus:outline-none resize-none placeholder:text-night-600"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-night-500 text-[10px]">{reflectionDraft.length}/5000</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReflectZone(false)}
                  className="text-night-400 text-xs px-3 py-1.5 rounded-lg hover:text-night-200 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={saveReflection}
                  disabled={!reflectionDraft.trim() || reflecting}
                  className="bg-gold-500/20 text-gold-300 text-xs font-medium px-4 py-1.5 rounded-lg hover:bg-gold-500/30 disabled:opacity-40 transition"
                >
                  {reflecting ? '…' : 'Sauvegarder ✓'}
                </button>
              </div>
            </div>
          </div>
        )}

        {savedReflection && !showReflectZone && (
          <button
            onClick={() => { setShowReflectZone(true); setTimeout(() => textareaRef.current?.focus(), 100); }}
            className="w-full glass rounded-xl p-3 text-left border border-emerald-500/20 transition-all hover:border-emerald-500/40"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-emerald-400 text-xs">✓ Réflexion sauvegardée</span>
              <span className="text-night-500 text-[10px]">· cliquer pour modifier</span>
            </div>
            <p className="text-night-300 text-xs italic line-clamp-2">{reflectionDraft}</p>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function energyColor(score: number): string {
  if (score <= 2) return '#4f6d9e';   // calm blue
  if (score <= 4) return '#7b8fa6';   // muted
  if (score <= 6) return '#c9a84c';   // warm gold
  if (score <= 8) return '#d4794f';   // warm orange
  return '#c84a4a';                    // intense red
}

function energyGradient(score: number): string {
  const c = energyColor(score);
  return `linear-gradient(90deg, ${c}80, ${c})`;
}
