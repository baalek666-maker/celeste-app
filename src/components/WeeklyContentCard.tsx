/**
 * P2#19 — Carte contenu hebdomadaire curated.
 *
 * Affiche le contenu éditorial de la semaine (thème lunaison, saison,
 * rétrograde…) en haut de l'écran Horoscope. Le contenu est publié par
 * l'équipe via /api/admin/weekly-content ; l'API public ne renvoie que les
 * entrées déjà publiées.
 *
 * Silencieux : si aucune entrée publiée → rien ne s'affiche (pas d'erreur
 * visible pour l'utilisateur·rice).
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface WeeklyContent {
  week_start: string;
  theme: string;
  emoji: string;
  headline: string;
  body: string;
  ritual: string | null;
  reflection: string | null;
  published_at: number;
}

function formatWeekLabel(weekStart: string): string {
  try {
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('fr-FR', opts)} – ${end.toLocaleDateString('fr-FR', opts)}`;
  } catch {
    return '';
  }
}

export default function WeeklyContentCard() {
  const [data, setData] = useState<WeeklyContent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getWeeklyContent()
      .then(d => { if (alive) setData(d); })
      .catch(() => undefined); // silent : 404 si pas de contenu
    return () => { alive = false; };
  }, []);

  if (!data) return null;

  return (
    <div className="glass rounded-3xl p-4 mb-4 animate-fade-in border border-gold-500/15">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none mt-0.5" aria-hidden>{data.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-gold-400 text-[10px] uppercase tracking-widest mb-0.5">
            Cette semaine · {formatWeekLabel(data.week_start)}
          </p>
          <h3 className="text-night-50 font-serif text-lg leading-tight">{data.theme}</h3>
          <p className="text-night-200 text-sm mt-1 leading-relaxed">{data.headline}</p>
        </div>
      </div>

      <button
        onClick={() => setOpen(o => !o)}
        className="text-gold-400 text-xs mt-3 hover:text-gold-300 transition-colors"
        aria-expanded={open}
      >
        {open ? '‹ Replier' : 'Lire le texte ›'}
      </button>

      {open && (
        <div className="mt-3 space-y-3 animate-fade-in">
          <p className="text-night-200 text-sm leading-relaxed whitespace-pre-line">{data.body}</p>

          {data.ritual && (
            <div className="rounded-2xl bg-gold-500/8 border border-gold-500/15 p-3">
              <p className="text-gold-400 text-[10px] uppercase tracking-widest mb-1">✦ Rituel de la semaine</p>
              <p className="text-night-100 text-sm leading-relaxed">{data.ritual}</p>
            </div>
          )}

          {data.reflection && (
            <div className="rounded-2xl bg-night-900/40 p-3 border border-white/[0.04]">
              <p className="text-night-400 text-[10px] uppercase tracking-widest mb-1">Question à méditer</p>
              <p className="text-night-100 text-sm italic leading-relaxed">{data.reflection}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
