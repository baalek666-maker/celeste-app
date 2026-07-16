import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Ritual = {
  date: string;
  morningCard: string;
  eveningIntention: string;
  completedMorning: boolean;
  completedEvening: boolean;
};

export default function DailyRituals() {
  const [ritual, setRitual] = useState<Ritual | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'morning' | 'evening' | null>(null);

  useEffect(() => {
    let alive = true;
    api.getRitualToday()
      .then(d => { if (alive) setRitual(d); })
      .catch(e => { if (alive) console.error('ritual load:', e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const complete = async (period: 'morning' | 'evening') => {
    if (!ritual) return;
    let alive = true;
    setBusy(period);
    try {
      await api.completeRitual(period);
      if (!alive) return;
      setRitual({
        ...ritual,
        completedMorning: period === 'morning' ? true : ritual.completedMorning,
        completedEvening: period === 'evening' ? true : ritual.completedEvening
      });
    } catch (e) {
      if (alive) console.error('ritual complete:', e);
    } finally {
      if (alive) setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-3xl p-5 border border-gold-500/20 animate-pulse">
        <div className="h-5 w-32 bg-gold-500/15 rounded mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 bg-gold-500/10 rounded-2xl" />
          <div className="h-28 bg-cosmic-500/10 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!ritual) return null;

  const both = ritual.completedMorning && ritual.completedEvening;

  return (
    <div className="relative glass rounded-3xl p-5 mb-4 border border-gold-500/25 overflow-hidden stagger-card card-glow animate-fade-in">
      {/* Halo doré en arrière-plan */}
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />

      {/* Header signature */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-lg shadow-lg shadow-gold-500/40">
            🕯️
          </div>
          <div>
            <p className="text-[10px] text-gold-400 uppercase tracking-widest font-semibold">Ton rituel</p>
            <h3 className="text-base font-bold text-night-100 leading-tight">Matin & soir</h3>
          </div>
        </div>
        {both ? (
          <span className="text-[10px] text-cosmic-300 font-semibold bg-cosmic-500/15 px-2.5 py-1 rounded-full border border-cosmic-400/40 animate-fade-in">
            ✦ Journée scellée
          </span>
        ) : (
          <span className="text-[10px] text-night-500 font-medium">
            {Number(ritual.completedMorning) + Number(ritual.completedEvening)}/2
          </span>
        )}
      </div>

      <div className="relative grid grid-cols-2 gap-2.5">
        {/* Matin */}
        <div className={`relative rounded-2xl p-3 border transition-all duration-300 overflow-hidden ${
          ritual.completedMorning
            ? 'bg-gold-500/10 border-gold-500/40'
            : 'bg-gradient-to-br from-amber-900/20 via-gold-500/5 to-transparent border-gold-500/30 hover:border-gold-400/50'
        }`}>
          {/* Glow matinal */}
          {!ritual.completedMorning && (
            <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />
          )}

          <div className="relative flex items-center justify-between mb-2">
            <span className="text-xl">{ritual.completedMorning ? '✓' : '☀️'}</span>
            <span className="text-[9px] uppercase tracking-widest text-amber-300/80 font-bold">Matin</span>
          </div>

          <p className={`relative text-xs leading-relaxed italic ${ritual.completedMorning ? 'text-night-500 line-through' : 'text-night-100'}`}>
            «&nbsp;{ritual.morningCard}&nbsp;»
          </p>

          {!ritual.completedMorning && (
            <button
              onClick={() => complete('morning')}
              disabled={busy === 'morning'}
              className="relative w-full mt-2.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition shadow-md shadow-gold-500/30"
            >
              {busy === 'morning' ? '…' : "C'est fait ✓"}
            </button>
          )}
        </div>

        {/* Soir */}
        <div className={`relative rounded-2xl p-3 border transition-all duration-300 overflow-hidden ${
          ritual.completedEvening
            ? 'bg-cosmic-500/15 border-cosmic-400/40'
            : 'bg-gradient-to-br from-cosmic-700/30 via-indigo-500/10 to-transparent border-cosmic-500/40 hover:border-cosmic-400/60'
        }`}>
          {/* Glow nocturne */}
          {!ritual.completedEvening && (
            <div className="absolute -top-8 -left-8 w-20 h-20 rounded-full bg-indigo-400/15 blur-2xl pointer-events-none" />
          )}

          <div className="relative flex items-center justify-between mb-2">
            <span className="text-xl">{ritual.completedEvening ? '✓' : '🌙'}</span>
            <span className="text-[9px] uppercase tracking-widest text-cosmic-300 font-bold">Soir</span>
          </div>

          <p className={`relative text-xs leading-relaxed italic ${ritual.completedEvening ? 'text-night-500 line-through' : 'text-night-100'}`}>
            «&nbsp;{ritual.eveningIntention}&nbsp;»
          </p>

          {!ritual.completedEvening && (
            <button
              onClick={() => complete('evening')}
              disabled={busy === 'evening'}
              className="relative w-full mt-2.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg bg-gradient-to-r from-cosmic-400 to-cosmic-600 text-night-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition shadow-md shadow-cosmic-500/30"
            >
              {busy === 'evening' ? '…' : "Je note ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}