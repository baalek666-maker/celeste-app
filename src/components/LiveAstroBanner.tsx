/**
 * LiveAstroBanner — "Éphémérides vivantes".
 *
 * Bannière qui affiche l'événement astronomique majeur des prochaines 24h.
 *
 * États :
 *  - Aucun événement → rien ne s'affiche
 *  - 1 événement → bannière simple
 *  - 2+ événements → swipe horizontal + tap pour avancer + dots
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

interface AstroEvent {
  type: string;
  title: string;
  body: string;
  emoji: string;
  when: string;
}

function relativeTime(isoWhen: string): string {
  const now = Date.now();
  const then = new Date(isoWhen).getTime();
  const diffMs = then - now;
  const diffH = Math.round(diffMs / 3_600_000);
  if (diffH < 0) {
    const absH = Math.abs(diffH);
    if (absH < 1) return "Il y a quelques minutes";
    if (absH < 24) return `Il y a ${absH}h`;
    return `Il y a ${Math.floor(absH / 24)}j`;
  }
  if (diffH < 1) return "En cours";
  if (diffH === 1) return "Dans 1h";
  if (diffH < 24) return `Dans ${diffH}h`;
  return `Dans ${Math.floor(diffH / 24)}j`;
}

export default function LiveAstroBanner() {
  const [events, setEvents] = useState<AstroEvent[] | null>(null);
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    api.getAstroEvents(24)
      .then(data => {
        if (!alive) return;
        const sorted = [...data.events].sort((a, b) => {
          const ta = Math.abs(Date.now() - new Date(a.when).getTime());
          const tb = Math.abs(Date.now() - new Date(b.when).getTime());
          return ta - tb;
        });
        setEvents(sorted);
      })
      .catch(() => { if (alive) setEvents([]); });
    return () => { alive = false; };
  }, []);

  if (!events || events.length === 0) return null;

  const current = events[idx % events.length];
  const hasMultiple = events.length > 1;

  const next = () => setIdx(i => (i + 1) % events.length);
  const prev = () => setIdx(i => (i - 1 + events.length) % events.length);

  return (
    <section
      className="rounded-2xl p-4 mb-6 glass border border-night-700/20 select-none cursor-pointer"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (delta < -40 && hasMultiple) next();
        else if (delta > 40 && hasMultiple) prev();
        touchStartX.current = null;
      }}
      onClick={() => { if (hasMultiple) next(); }}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none mt-0.5">{current.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] uppercase tracking-widest text-night-500">En direct du ciel</span>
            <span className="w-1 h-1 rounded-full bg-rose-400/80 animate-pulse" />
            <span className="text-[9px] text-night-600 ml-auto">{relativeTime(current.when)}</span>
          </div>
          <h3 className="text-sm font-medium text-night-100 leading-tight">{current.title}</h3>
          <p className="text-xs text-night-300 leading-relaxed mt-1 line-clamp-2">{current.body}</p>
        </div>
        {hasMultiple && (
          <span className="text-night-600 text-xs mt-1">›</span>
        )}
      </div>

      {hasMultiple && (
        <div className="flex justify-center gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
          {events.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1 rounded-full transition-all ${i === idx ? 'w-6 bg-gold-400' : 'w-1 bg-white/20'}`}
              aria-label={`Événement ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}