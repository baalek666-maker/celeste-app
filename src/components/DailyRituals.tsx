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
      <div className="celeste-card animate-pulse">
        <div className="h-4 bg-celeste-primary/20 rounded w-1/3 mb-3" />
        <div className="h-16 bg-celeste-primary/10 rounded" />
      </div>
    );
  }

  if (!ritual) return null;

  const both = ritual.completedMorning && ritual.completedEvening;

  return (
    <div className="celeste-card">
      <h3 className="text-lg font-semibold text-celeste-accent mb-3 flex items-center gap-2">
        <span>🌙</span> Rituel du jour
        {both && <span className="ml-auto text-xs text-celeste-success">✓ Journée complétée</span>}
      </h3>

      {/* Morning */}
      <div className={`mb-4 p-3 rounded-lg border transition ${
        ritual.completedMorning
          ? 'bg-celeste-success/10 border-celeste-success/30'
          : 'bg-gradient-to-br from-orange-100/40 to-yellow-50/40 border-orange-200/40'
      }`}>
        <div className="flex items-start gap-2 mb-2">
          <span className="text-2xl">☀️</span>
          <div className="flex-1">
            <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Matin</div>
            <p className="text-sm text-celeste-text mt-1 leading-relaxed">{ritual.morningCard}</p>
          </div>
        </div>
        {!ritual.completedMorning && (
          <button
            onClick={() => complete('morning')}
            disabled={busy === 'morning'}
            className="w-full mt-2 px-3 py-1.5 text-xs font-medium rounded-md bg-celeste-primary text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {busy === 'morning' ? '…' : "J'ai pris ce moment ✓"}
          </button>
        )}
      </div>

      {/* Evening */}
      <div className={`p-3 rounded-lg border transition ${
        ritual.completedEvening
          ? 'bg-celeste-success/10 border-celeste-success/30'
          : 'bg-gradient-to-br from-indigo-100/40 to-purple-50/40 border-indigo-200/40'
      }`}>
        <div className="flex items-start gap-2 mb-2">
          <span className="text-2xl">🌙</span>
          <div className="flex-1">
            <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Soir</div>
            <p className="text-sm text-celeste-text mt-1 leading-relaxed">{ritual.eveningIntention}</p>
          </div>
        </div>
        {!ritual.completedEvening && (
          <button
            onClick={() => complete('evening')}
            disabled={busy === 'evening'}
            className="w-full mt-2 px-3 py-1.5 text-xs font-medium rounded-md bg-celeste-primary text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {busy === 'evening' ? '…' : "Je note cette intention ✓"}
          </button>
        )}
      </div>
    </div>
  );
}