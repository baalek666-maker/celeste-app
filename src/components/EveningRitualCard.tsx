/**
 * EveningRitualCard — Carte "Rituel du soir" enrichie.
 *
 * VAL04 — Combine 3 modules pour créer un rituel du soir signature :
 *  1. 🌙 Lune du soir (phase + conseil calme)
 *  2. 😴 Conseil sommeil basé sur transits du soir (déduit depuis daily energy)
 *  3. ✍️ Micro-journaling (3 lignes : gratitude / release / intention)
 *
 * Push 21h configuré dans pushNotifications.ts → atterre ici.
 * Source : api.getLunarStatus() + api.getDailyEnergy() + api.saveJournalEntry()
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from './Toast';

interface Props {
  /** Streak pour微-motivation */
  streak?: number;
}

export default function EveningRitualCard({ streak = 0 }: Props) {
  const [moonEmoji, setMoonEmoji] = useState('🌙');
  const [moonName, setMoonName] = useState('');
  const [moonHint, setMoonHint] = useState('');
  const [sleepAdvice, setSleepAdvice] = useState('');
  const [energyEmoji, setEnergyEmoji] = useState('✨');
  const [gratitude, setGratitude] = useState('');
  const [release, setRelease] = useState('');
  const [intention, setIntention] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completedEvening, setCompletedEvening] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.getLunarStatus(),
      api.getDailyEnergy(),
      api.getRitualToday(),
    ]).then(([moonR, energyR, ritualR]) => {
      if (!alive) return;
      if (moonR.status === 'fulfilled') {
        setMoonEmoji(moonR.value.moonPhase.emoji);
        setMoonName(moonR.value.moonPhase.name);
        setMoonHint(
          moonR.value.isNewMoonWindow
            ? 'Nouvelle lune — relâche, ne force rien ce soir.'
            : moonR.value.isFullMoonWindow
              ? 'Pleine lune — libère ce qui pèse avant de dormir.'
              : (moonR.value.moonPhase.description || '').slice(0, 90)
        );
      }
      if (energyR.status === 'fulfilled') {
        const e = energyR.value;
        setEnergyEmoji(e.energy.emoji);
        // Déduire un conseil sommeil selon l'énergie du jour
        const score = e.energy.score;
        if (score >= 75) setSleepAdvice('Journée intense — ton corps a besoin de calme avant le lit. Pas d\'écrans 30 min.');
        else if (score >= 50) setSleepAdvice('Énergie correcte — une douche tiède aidera à faire baisser la température corporelle.');
        else setSleepAdvice('Énergie basse — sois doux avec toi. Une tisane, un livre, pas d\'obligation.');
      }
      if (ritualR.status === 'fulfilled') {
        setCompletedEvening(ritualR.value.completedEvening);
        // Pré-remplir l'intention du soir si pas encore notée
        if (!intention && ritualR.value.eveningIntention) {
          setIntention(ritualR.value.eveningIntention);
        }
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const allFilled = gratitude.trim() && release.trim() && intention.trim();

  const save = async () => {
    if (!allFilled || saving) return;
    setSaving(true);
    try {
      // Combiner les 3 lignes en une entrée de journal taguée "rituel-soir"
      const content = `🌙 Rituel du soir\n\n✦ Gratitude : ${gratitude.trim()}\n✦ Je libère : ${release.trim()}\n✦ Demain : ${intention.trim()}`;
      await api.saveJournalEntry({ content, mood: 'soir' } as any);
      // Marquer le rituel evening comme complete
      await api.completeRitual('evening');
      setSaved(true);
      setCompletedEvening(true);
      toast.success('🌙 Rituel scellé. Bonne nuit.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-3xl p-5 mb-4 border border-cosmic-500/20 animate-pulse">
        <div className="h-5 w-40 bg-cosmic-500/15 rounded mb-4" />
        <div className="h-20 bg-cosmic-500/10 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="relative glass rounded-3xl p-5 mb-4 border border-cosmic-500/25 overflow-hidden stagger-card card-glow animate-fade-in">
      {/* Halo nocturne */}
      <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cosmic-400 to-cosmic-600 flex items-center justify-center text-lg shadow-lg shadow-cosmic-500/40">
            🌙
          </div>
          <div>
            <p className="text-[10px] text-cosmic-300 uppercase tracking-widest font-semibold">Rituel du soir</p>
            <h3 className="text-base font-bold text-night-100 leading-tight">Trois lignes avant de dormir</h3>
          </div>
        </div>
        {completedEvening && (
          <span className="text-[10px] text-cosmic-300 font-semibold bg-cosmic-500/15 px-2.5 py-1 rounded-full border border-cosmic-400/40">
            ✓ Scellé
          </span>
        )}
      </div>

      {/* 1. Lune du soir */}
      <div className="relative mb-3 p-3 rounded-2xl bg-cosmic-500/8 border border-cosmic-500/25">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{moonEmoji}</span>
          <p className="text-[10px] uppercase tracking-widest text-cosmic-300 font-bold">Lune</p>
        </div>
        <p className="text-sm font-semibold text-night-100">{moonName}</p>
        {moonHint && <p className="text-xs text-night-300 mt-0.5 leading-relaxed">{moonHint}</p>}
      </div>

      {/* 2. Conseil sommeil */}
      <div className="relative mb-4 p-3 rounded-2xl bg-indigo-500/8 border border-indigo-500/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{energyEmoji}</span>
          <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">Sommeil</p>
        </div>
        <p className="text-xs text-night-200 leading-relaxed">{sleepAdvice}</p>
      </div>

      {/* 3. Micro-journaling — 3 champs */}
      <div className="relative space-y-2.5">
        <p className="text-[10px] uppercase tracking-widest text-gold-400 font-bold mb-2">✍️ Trois lignes</p>
        <div>
          <label className="text-[10px] text-night-400">✦ Gratitude — une chose aujourd'hui</label>
          <input
            type="text"
            value={gratitude}
            onChange={(e) => setGratitude(e.target.value)}
            placeholder="Je suis reconnaissant(e) pour…"
            disabled={completedEvening}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-night-900/60 border border-cosmic-500/25 text-sm text-night-100 placeholder:text-night-600 focus:outline-none focus:border-cosmic-400/60 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-[10px] text-night-400">✦ Je libère — ce qui pèse</label>
          <input
            type="text"
            value={release}
            onChange={(e) => setRelease(e.target.value)}
            placeholder="Je laisse partir…"
            disabled={completedEvening}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-night-900/60 border border-cosmic-500/25 text-sm text-night-100 placeholder:text-night-600 focus:outline-none focus:border-cosmic-400/60 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-[10px] text-night-400">✦ Demain — une intention</label>
          <input
            type="text"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="Demain je…"
            disabled={completedEvening}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-night-900/60 border border-cosmic-500/25 text-sm text-night-100 placeholder:text-night-600 focus:outline-none focus:border-cosmic-400/60 disabled:opacity-60"
          />
        </div>
      </div>

      {/* CTA */}
      {!completedEvening && (
        <button
          onClick={save}
          disabled={!allFilled || saving}
          className="relative w-full mt-4 px-4 py-2.5 text-sm font-semibold uppercase tracking-wider rounded-xl bg-gradient-to-r from-cosmic-400 to-cosmic-600 text-night-100 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition shadow-md shadow-cosmic-500/30"
        >
          {saving ? '…' : saved ? '✓ Scellé' : 'Sceller mon rituel 🌙'}
        </button>
      )}

      {streak > 0 && completedEvening && (
        <p className="text-center text-[10px] text-night-500 mt-3">
          🔥 Streak de {streak} jours — la constance paie.
        </p>
      )}
    </div>
  );
}
