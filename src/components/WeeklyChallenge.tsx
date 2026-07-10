import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Challenge = {
  weekId: string;
  theme: string;
  action: string;
  explanation: string;
  completed: boolean;
  reflectionNote: string | null;
  generatedAt: string;
};

export default function WeeklyChallenge() {
  const [data, setData] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.getWeeklyChallenge()
      .then(d => { setData(d); setNote(d.reflectionNote || ''); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async () => {
    if (!data || submitting) return;
    setSubmitting(true);
    try {
      await api.completeWeeklyChallenge(note.trim());
      setData({ ...data, completed: true, reflectionNote: note.trim() || null });
    } catch (e: any) {
      setErr(e.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="celeste-card mb-6 animate-pulse">
      <div className="h-4 bg-celeste-primary/10 rounded w-2/5 mb-3" />
      <div className="h-3 bg-celeste-primary/10 rounded w-full mb-2" />
      <div className="h-3 bg-celeste-primary/10 rounded w-3/4" />
    </div>
  );

  if (err || !data) return (
    <div className="celeste-card mb-6 text-sm text-celeste-text/60">
      Défi hebdo indisponible {err ? `(${err})` : ''}
    </div>
  );

  return (
    <div className="celeste-card mb-6 border border-gold-500/30 bg-gradient-to-br from-gold-500/5 to-celeste-primary/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-celeste-accent flex items-center gap-2">
          <span>🗓️</span> Défi de la semaine
        </h3>
        <span className="text-xs text-celeste-text/50 font-mono">{data.weekId}</span>
      </div>

      <div className="text-xs uppercase tracking-widest text-gold-300 mb-1">Thème</div>
      <div className="text-base font-bold text-celeste-text mb-2 capitalize">{data.theme}</div>

      <div className="text-xs uppercase tracking-widest text-celeste-text/60 mb-1">Action</div>
      <p className="text-sm text-celeste-text leading-relaxed mb-2 italic">« {data.action} »</p>

      <p className="text-xs text-celeste-text/65 leading-relaxed mb-3 border-l-2 border-gold-500/40 pl-3">
        {data.explanation}
      </p>

      {data.completed ? (
        <div className="mt-3 p-3 rounded-lg bg-celeste-primary/10 border border-celeste-primary/20">
          <div className="text-xs text-gold-300 mb-1 font-semibold">✓ Défi relevé</div>
          {data.reflectionNote && (
            <p className="text-sm text-celeste-text italic">"{data.reflectionNote}"</p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note de réflexion (optionnel, 600 car. max)…"
            maxLength={600}
            className="w-full bg-celeste-bg/50 border border-celeste-primary/20 rounded-lg p-2 text-sm text-celeste-text placeholder:text-celeste-text/40 resize-none focus:outline-none focus:border-gold-500/50"
            rows={3}
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="mt-2 w-full bg-gradient-to-r from-gold-500 to-gold-400 text-celeste-bg font-semibold rounded-lg py-2 text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {submitting ? '…' : "J'ai relevé le défi ✨"}
          </button>
        </div>
      )}
    </div>
  );
}
