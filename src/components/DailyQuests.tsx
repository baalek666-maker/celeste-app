import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

type Quest = { quest_key: string; quest_label: string; xp_reward: number; completed: boolean };
type XpToast = { id: number; key: string; xp: number };
type LevelUp = { active: boolean; level: number | null };

interface DailyQuestsProps {
  onQuestCompleted?: (xp: number, leveledUp: boolean) => void;
}

const KEYFRAMES = `
@keyframes dq-xp-rise { 0%{opacity:0;transform:translateY(0) scale(.9)} 18%{opacity:1;transform:translateY(-7px) scale(1.06)} 100%{opacity:0;transform:translateY(-30px) scale(1)} }
@keyframes dq-level-flash { 0%{opacity:0;transform:scale(.92)} 18%{opacity:1;transform:scale(1.04)} 78%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(.98)} }
`;

/** DailyQuests — alchemical quest tracker. Tap to complete; +XP floats up & a level-up flashes gold. */
export default function DailyQuests({ onQuestCompleted }: DailyQuestsProps) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toasts, setToasts] = useState<XpToast[]>([]);
  const [levelUp, setLevelUp] = useState<LevelUp>({ active: false, level: null });

  useEffect(() => {
    let alive = true;
    api.getGamificationStatus()
      .then((d) => { if (alive) setQuests(d.quests ?? []); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const showToast = useCallback((key: string, xp: number) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, key, xp }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800);
  }, []);

  const handleComplete = async (q: Quest) => {
    if (q.completed || busyKey) return;
    let alive = true;
    setBusyKey(q.quest_key);
    try {
      const res = await api.completeQuest(q.quest_key);
      if (!alive) return;
      if (res.ok) {
        setQuests((qs) => qs.map((x) => (x.quest_key === q.quest_key ? { ...x, completed: true } : x)));
        showToast(q.quest_key, res.xpAwarded || q.xp_reward);
        if (res.leveledUp) {
          setLevelUp({ active: true, level: res.newLevel });
          window.setTimeout(() => {
            if (alive) setLevelUp({ active: false, level: null });
          }, 2800);
        }
        onQuestCompleted?.(res.xpAwarded, res.leveledUp);
      }
    } catch (e) {
      console.error('completeQuest:', e);
    } finally {
      if (alive) setBusyKey(null);
    }
  };

  if (loading) return (
    <div className="glass-gold rounded-2xl px-4 py-3 mb-5 animate-pulse">
      <div className="h-3 bg-gold-500/15 rounded w-2/5 mb-3" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-9 bg-gold-500/10 rounded-xl" />)}
      </div>
    </div>
  );
  if (failed || !quests.length) return null;

  const done = quests.filter((q) => q.completed).length;
  const total = quests.length, pct = Math.round((done / total) * 100);
  const flashing = levelUp.active;

  return (
    <div className="relative mb-5">
      <style>{KEYFRAMES}</style>

      {/* ── Level-up celebration flash ── */}
      {flashing && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(226,196,124,0.28), rgba(5,5,5,0.6) 75%)',
            backdropFilter: 'blur(2px)',
            animation: 'dq-level-flash 2.8s ease-out forwards',
          }}
        >
          <div className="text-3xl mb-1 animate-float-slow">✦</div>
          <div className="font-display text-base tracking-[0.2em] text-gold-gradient">NIVEAU SUPÉRIEUR</div>
          {levelUp.level != null && <div className="font-display text-2xl font-bold text-gold-300 mt-0.5">Niv. {levelUp.level}</div>}
        </div>
      )}

      {/* ── Main glass card ── */}
      <div
        className={`glass-gold rounded-2xl px-4 py-3.5 transition-all duration-500 ${flashing ? 'ring-1 ring-gold-300/70' : ''}`}
        style={flashing ? { boxShadow: '0 0 40px rgba(226,196,124,0.5)' } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-[13px] tracking-[0.22em] text-gold-300">QUÊTES DU JOUR</h3>
          <span className="text-[11px] tabular-nums text-night-400">
            <span className="text-gold-400 font-semibold">{done}</span>
            <span className="text-night-600">/{total}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-night-800/80 border border-gold-500/10 overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #b8860b 0%, #d4ae5f 55%, #e2c47c 100%)' }}
          />
        </div>

        {/* Quest rows */}
        <ul className="space-y-1.5">
          {quests.map((q) => {
            const busy = busyKey === q.quest_key;
            return (
              <li key={q.quest_key}>
                <button
                  type="button"
                  onClick={() => handleComplete(q)}
                  disabled={q.completed || busyKey !== null}
                  aria-pressed={q.completed}
                  className={`group relative w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all duration-300 ${
                    q.completed
                      ? 'bg-night-900/30'
                      : 'bg-night-800/30 hover:bg-night-700/50 hover:ring-1 hover:ring-gold-500/25 active:scale-[0.985]'
                  }`}
                >
                  {/* Left: circular checkbox */}
                  <span
                    className={`shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center border transition-all duration-300 ${
                      q.completed
                        ? 'bg-gradient-to-br from-gold-400/45 to-gold-600/35 border-gold-300/60 text-gold-100'
                        : 'border-gold-500/45 group-hover:border-gold-400/80 group-hover:shadow-[0_0_10px_rgba(197,160,89,0.35)]'
                    }`}
                    style={q.completed ? { boxShadow: 'inset 0 0 8px rgba(197,160,89,0.4)' } : undefined}
                  >
                    {q.completed && <span className="text-sm leading-none">✓</span>}
                  </span>

                  {/* Center: label */}
                  <span className={`flex-1 min-w-0 text-sm transition-colors duration-300 truncate ${q.completed ? 'line-through text-night-500' : 'text-night-100'}`}>
                    {q.quest_label}
                  </span>

                  {/* XP badge */}
                  <span className={`shrink-0 text-[10px] font-display tracking-wide px-2 py-0.5 rounded-full border transition-all duration-300 ${
                    q.completed ? 'text-gold-500/40 border-gold-500/15 bg-transparent' : 'text-gold-300 border-gold-500/40 bg-gold-500/10'
                  }`}>
                    +{q.xp_reward} XP
                  </span>

                  {/* Right: checkmark / empty circle */}
                  <span className="shrink-0 w-4 flex items-center justify-center">
                    {q.completed ? (
                      <span className="text-gold-400 text-sm">✓</span>
                    ) : (
                      <span className="block w-3 h-3 rounded-full border border-night-600 group-hover:border-gold-500/50 transition-colors" />
                    )}
                  </span>

                  {/* +XP float toast */}
                  {toasts.filter((t) => t.key === q.quest_key).map((t) => (
                    <span
                      key={t.id}
                      className="pointer-events-none absolute right-14 top-1/2 font-display text-sm font-semibold text-gold-300 drop-shadow-[0_0_6px_rgba(226,196,124,0.6)]"
                      style={{ animation: 'dq-xp-rise 1.8s ease-out forwards' }}
                    >
                      +{t.xp} XP
                    </span>
                  ))}

                  {/* Busy spinner */}
                  {busy && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="block w-3.5 h-3.5 rounded-full border border-gold-500/25 border-t-gold-300 animate-refresh" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {done === total && (
          <p className="mt-3 text-center text-[11px] font-display tracking-[0.18em] text-gold-300/80 animate-fade-in">
            ✦ Quêtes accomplies — à demain ✦
          </p>
        )}
      </div>
    </div>
  );
}
