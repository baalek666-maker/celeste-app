/**
 * LiveAstroBanner — "Éphémérides vivantes" (Piste 3).
 *
 * Bannière qui affiche l'événement astronomique majeur des prochaines 24h,
 * rafraîchie à chaque ouverture de Home. Si plusieurs événements, on prend
 * le plus proche dans le temps.
 *
 * États :
 *  - Aucun événement → rien ne s'affiche (ne pas polluer Home)
 *  - 1 événement → bannière avec emoji + titre + body court + "dans Xh"
 *  - 2+ événements → carrousel horizontal (swipe)
 *
 * Pas de polling : on charge une seule fois au mount, et on rafraîchit si
 * l'user revient sur Home (App.tsx remount au screen change).
 *
 * Deep-link : tap → ouvre l'écran Horoscope pour le détail.
 */
import { useEffect, useState } from 'react';
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

function eventAccent(type: string): string {
  if (type === 'moon_phase') return 'from-violet-500/30 to-indigo-500/10 border-violet-500/30';
  if (type === 'lunar_eclipse') return 'from-rose-500/30 to-purple-500/10 border-rose-500/40';
  if (type === 'ingress') return 'from-amber-500/30 to-orange-500/10 border-amber-500/30';
  if (type === 'station') return 'from-cyan-500/30 to-blue-500/10 border-cyan-500/30';
  return 'from-gold-500/30 to-gold-400/10 border-gold-500/30';
}

export default function LiveAstroBanner() {
  const [events, setEvents] = useState<AstroEvent[] | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    api.getAstroEvents(24)
      .then(data => {
        if (!alive) return;
        // Trier par proximité temporelle (le plus proche d'abord)
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

  // Pas d'événement → on ne rend rien (ne pas polluer la Home)
  if (!events || events.length === 0) return null;

  const current = events[idx % events.length];
  const hasMultiple = events.length > 1;

  return (
    <section
      className={`rounded-2xl p-4 bg-gradient-to-br ${eventAccent(current.type)} border backdrop-blur-sm`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none mt-0.5 select-none">{current.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] uppercase tracking-widest text-night-400">En direct du ciel</span>
            <span className="w-1 h-1 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-[9px] text-night-500 ml-auto">{relativeTime(current.when)}</span>
          </div>
          <h3 className="font-display text-base text-gold-100 leading-tight">{current.title}</h3>
          <p className="text-xs text-night-200 leading-relaxed mt-1 line-clamp-2">{current.body}</p>
        </div>
      </div>

      {hasMultiple && (
        <div className="flex justify-center gap-1.5 mt-3">
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
