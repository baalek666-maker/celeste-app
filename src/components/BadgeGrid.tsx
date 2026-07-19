import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../components/Toast';

type Badge = {
  id: string; emoji: string; title: string; desc: string;
  earned: boolean; earnedAt: number | null;
};

/** Diagonal shimmer highlight that glides across each gold medallion. */
const SWEEP = `@keyframes bg-sweep { 0%{transform:translateX(-130%) skewX(-16deg)} 55%,100%{transform:translateX(260%) skewX(-16deg)} }`;

/**
 * BadgeGrid — the trophy case.
 * Earned badges glow gold with a shimmer sweep; locked ones stay silhouetted.
 * Tap or hover an earned badge to reveal its description.
 */
export default function BadgeGrid({ badges }: { badges?: Badge[] }) {
  const [list, setList] = useState<Badge[]>(badges ?? []);
  const [earned, setEarned] = useState(0);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(!badges);

  useEffect(() => {
    if (badges) {
      setList(badges);
      setEarned(badges.filter((b) => b.earned).length);
      setTotal(badges.length);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    api.getBadges()
      .then((d) => {
        if (!alive) return;
        setList(d.badges ?? []);
        setEarned(d.earnedCount ?? 0);
        setTotal(d.totalCount ?? 0);
      })
      .catch((err) => { toast.error('Badges indisponibles — réessaie dans quelques secondes.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [badges]);

  const pct = total ? Math.round((earned / total) * 100) : 0;

  if (loading) return (
    <div className="glass-gold rounded-2xl px-4 py-3.5 mb-5 animate-pulse">
      <div className="h-3 bg-gold-500/15 rounded w-1/3 mb-3" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="mx-auto w-14 h-14 rounded-full bg-gold-500/10" />)}
      </div>
    </div>
  );
  if (!list.length) return null;

  return (
    <div className="relative mb-5">
      <style>{SWEEP}</style>
      <div className="glass-gold rounded-2xl px-4 py-3.5">
        {/* ── Header + count ── */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-[13px] tracking-[0.22em] text-gold-gradient">RÉALISATIONS</h3>
          <span className="text-[11px] tabular-nums text-night-400">
            <span className="text-gold-400 font-semibold">{earned}</span>
            <span className="text-night-600">/{total || '—'}</span>
          </span>
        </div>

        {/* ── Progress bar ── */}
        <div className="h-1 rounded-full bg-night-800/80 border border-gold-500/10 overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #b8860b 0%, #d4ae5f 55%, #e2c47c 100%)' }}
          />
        </div>

        {/* ── Medallion grid ── */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {list.map((b) => {
            const open = active === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onMouseEnter={() => b.earned && setActive(b.id)}
                onMouseLeave={() => setActive(null)}
                onClick={() => b.earned && setActive((a) => (a === b.id ? null : b.id))}
                onFocus={() => b.earned && setActive(b.id)}
                onBlur={() => setActive(null)}
                aria-label={`${b.title} — ${b.earned ? 'débloqué' : 'verrouillé'}`}
                className="group relative flex flex-col items-center gap-1.5 focus:outline-none"
              >
                <span
                  className={`relative flex items-center justify-center w-14 h-14 rounded-full overflow-hidden transition-all duration-300 ${
                    b.earned
                      ? 'bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 ring-1 ring-gold-200/70 animate-gold-glow group-hover:scale-105'
                      : 'bg-night-800 ring-1 ring-night-700'
                  }`}
                  style={b.earned ? { boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.3)' } : undefined}
                >
                  {b.earned ? (
                    <>
                      <span className="relative z-10 text-2xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{b.emoji}</span>
                      <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent" style={{ animation: 'bg-sweep 3.8s ease-in-out infinite' }} />
                    </>
                  ) : (
                    <>
                      <span className="text-xl text-night-600 grayscale opacity-60">{b.emoji}</span>
                      <span className="absolute bottom-0.5 right-0.5 text-[9px] leading-none">🔒</span>
                    </>
                  )}
                </span>

                <span className={`text-[10px] leading-tight text-center font-display tracking-wide ${b.earned ? 'text-gold-300/90' : 'text-night-500'}`}>
                  {b.title}
                </span>

                {/* Tooltip / popover */}
                {b.earned && open && (
                  <span role="tooltip" className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2.5 rounded-xl glass-dark border border-gold-500/40 text-center animate-fade-in-scale pointer-events-none">
                    <span className="block text-[10px] font-display tracking-widest text-gold-300 mb-0.5">{b.title}</span>
                    <span className="block text-[11px] text-night-200 leading-snug">{b.desc}</span>
                    {b.earnedAt && (
                      <span className="block mt-1 text-[9px] text-gold-500/70 tabular-nums">
                        {new Date(b.earnedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {earned === total && total > 0 && (
          <p className="mt-3 text-center text-[11px] font-display tracking-[0.18em] text-gold-300/80 animate-fade-in">
            ✦ Maîtrise céleste accomplie ✦
          </p>
        )}
      </div>
    </div>
  );
}
