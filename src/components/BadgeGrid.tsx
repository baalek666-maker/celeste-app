import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../components/Toast';

type Badge = {
  id: string; emoji: string; title: string; desc: string;
  earned: boolean; earnedAt: number | null;
  reward?: string; action?: string;
};

/**
 * BadgeGrid — la vitrine des réalisations.
 *
 * Chaque badge affiche maintenant sa RÉCOMPENSE (ce que tu gagnes) et
 * son ACTION (ce qu'il faut faire pour le débloquer).
 *
 * Section "Prochain objectif" : le badge verrouillé le plus proche,
 * avec l'action concrète à accomplir.
 */
export default function BadgeGrid({ badges }: { badges?: Badge[] }) {
  const [list, setList] = useState<Badge[]>(badges ?? []);
  const [earned, setEarned] = useState(0);
  const [total, setTotal] = useState(0);
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
      .catch(() => { toast.error('Badges indisponibles — réessaie dans quelques secondes.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [badges]);

  const pct = total ? Math.round((earned / total) * 100) : 0;
  const nextBadge = list.find(b => !b.earned);

  if (loading) return (
    <div className="glass rounded-2xl px-4 py-3.5 mb-5 animate-pulse border border-night-700/20">
      <div className="h-3 bg-night-700/40 rounded w-1/3 mb-3" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="mx-auto w-12 h-12 rounded-full bg-night-700/30" />)}
      </div>
    </div>
  );
  if (!list.length) return null;

  return (
    <div className="mb-5">
      <div className="glass rounded-2xl px-4 py-4 border border-night-700/20">
        {/* Header + count */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-widest text-night-400">Réalisations</h3>
          <span className="text-[11px] tabular-nums text-night-400">
            <span className="text-gold-400 font-semibold">{earned}</span>
            <span className="text-night-600">/{total || '—'}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-night-800/60 overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-gold-500 to-gold-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Prochain objectif — action concrète */}
        {nextBadge && (
          <div className="mb-4 p-3 rounded-xl bg-night-800/30 border border-night-700/30">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base opacity-50">{nextBadge.emoji}</span>
              <span className="text-xs text-night-200 font-medium">{nextBadge.title}</span>
            </div>
            <p className="text-[11px] text-night-400 leading-relaxed">{nextBadge.action || nextBadge.desc}</p>
            {nextBadge.reward && (
              <p className="text-[11px] text-gold-400/80 mt-1">🎁 {nextBadge.reward}</p>
            )}
          </div>
        )}

        {/* Badge grid */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {list.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1.5">
              <span
                className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                  b.earned
                    ? 'bg-gradient-to-br from-gold-400/30 to-gold-600/20 border border-gold-400/40'
                    : 'bg-night-800/50 border border-night-700/40'
                }`}
              >
                <span className={`text-xl ${b.earned ? '' : 'opacity-30 grayscale'}`}>{b.emoji}</span>
                {!b.earned && <span className="absolute bottom-0 right-0 text-[9px]">🔒</span>}
              </span>
              <span className={`text-[10px] text-center leading-tight ${b.earned ? 'text-gold-300/80' : 'text-night-500'}`}>
                {b.title}
              </span>
              {/* Récompense affichée sous le badge si débloqué */}
              {b.earned && b.reward && (
                <span className="text-[9px] text-gold-500/60 text-center leading-tight">{b.reward}</span>
              )}
            </div>
          ))}
        </div>

        {earned === total && total > 0 && (
          <p className="mt-4 text-center text-xs text-gold-300/70">
            ✦ Maîtrise céleste accomplie ✦
          </p>
        )}
      </div>
    </div>
  );
}