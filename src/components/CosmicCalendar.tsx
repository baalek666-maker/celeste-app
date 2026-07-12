import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type CosmicEvent = {
  date: string;       // ISO '2026-07-14'
  type: string;       // 'new_moon' | 'full_moon' | 'ingress' …
  title: string;
  description: string;
  emoji: string;
};

const MONTHS_FR = [
  'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc',
];

/** Format '2026-07-14' → '14 Juil'. Pure-string, timezone-safe. */
function formatDateFr(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS_FR[parseInt(m, 10) - 1]}`;
}

/** Local YYYY-MM-DD (no UTC drift). */
function todayIso(): string {
  const n = new Date();
  const mm = String(n.getMonth() + 1).padStart(2, '0');
  const dd = String(n.getDate()).padStart(2, '0');
  return `${n.getFullYear()}-${mm}-${dd}`;
}

export default function CosmicCalendar() {
  const [events, setEvents] = useState<CosmicEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getCosmicEvents()
      .then((d) => setEvents(d.events.slice(0, 8)))
      .catch((e) => setErr(e.message));
  }, []);

  // ── Loading skeleton ──
  if (!events) {
    if (err) {
      return (
        <div className="celeste-card mb-6 text-sm text-night-300/70">
          Calendrier céleste indisponible {err ? `(${err})` : ''}
        </div>
      );
    }
    return (
      <div className="celeste-card mb-6 animate-pulse">
        <div className="h-3 bg-gold-500/15 rounded w-2/3 mb-5" />
        <ul className="space-y-4">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex gap-4">
              <div className="w-11 h-11 rounded-full bg-gold-500/10 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-2.5 bg-night-300/10 rounded w-1/5" />
                <div className="h-3 bg-night-300/10 rounded w-2/5" />
                <div className="h-3 bg-night-300/10 rounded w-4/5" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (events.length === 0) return null;

  const today = todayIso();

  return (
    <div className="celeste-card mb-6">
      <h3 className="text-[11px] uppercase tracking-[0.28em] text-gold-400 mb-5 flex items-center gap-2">
        <span className="text-gold-500">✦</span>
        Prochaines étapes célestes
      </h3>

      <div className="relative">
        {/* vertical gold connector */}
        <div className="absolute left-[22px] top-3 bottom-3 w-px bg-gradient-to-b from-gold-500/60 via-gold-600/25 to-transparent pointer-events-none" />

        <ul className="space-y-4">
          {events.map((ev, i) => {
            const isToday = ev.date === today;
            return (
              <li key={`${ev.date}-${i}`} className="relative flex gap-4 items-start">
                {/* emoji node sitting on the connector */}
                <div
                  className={`relative z-10 shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl glass-gold border transition-colors ${
                    isToday ? 'border-gold-400 shadow-[0_0_18px_rgba(197,160,89,0.55)]' : 'border-gold-500/40'
                  }`}
                >
                  <span>{ev.emoji}</span>
                </div>

                {/* glass event card */}
                <div
                  className={`flex-1 rounded-xl p-3 transition-colors ${
                    isToday
                      ? 'glass-gold ring-1 ring-gold-400/60 shadow-[0_0_22px_rgba(197,160,89,0.22)]'
                      : 'glass'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gold-400/90">
                      {formatDateFr(ev.date)}
                    </span>
                    {isToday && (
                      <span className="text-[9px] uppercase tracking-[0.18em] text-gold-300 bg-gold-500/15 rounded-full px-1.5 py-px">
                        ◆ Aujourd'hui
                      </span>
                    )}
                  </div>
                  <div className="font-display text-gold-300 text-sm leading-tight mb-1">
                    {ev.title}
                  </div>
                  <p className="text-xs text-night-200/70 leading-relaxed font-body">
                    {ev.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
