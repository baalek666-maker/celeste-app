import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../components/Toast';

type GamificationStatus = Awaited<ReturnType<typeof api.getGamificationStatus>>;

/**
 * XpBar — compact alchemical XP progress bar (top of Home).
 * Shows level badge, title, animated gold progress fill + quests count.
 * Pulses a gold aura while idle and bursts on level-up.
 */
export default function XpBar() {
  const [data, setData] = useState<GamificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [leveledUp, setLeveledUp] = useState(false);
  const prevLevel = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getGamificationStatus()
      .then((d) => {
        if (!active) return;
        if (prevLevel.current != null && d.level > prevLevel.current) {
          setLeveledUp(true);
          window.setTimeout(() => setLeveledUp(false), 2600);
        }
        prevLevel.current = d.level;
        setData(d);
      })
      .catch((err) => { toast.error('Progression indisponible — réessaie dans quelques secondes.'); })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="glass-gold rounded-2xl px-3.5 py-3 mb-5 flex items-center gap-3 animate-pulse">
        <div className="w-12 h-12 rounded-full bg-gold-500/10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gold-500/10 rounded w-1/3" />
          <div className="h-2 bg-gold-500/10 rounded-full w-full" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pct = Math.max(2, Math.min(100, Math.round(data.progressPct) || 0));

  return (
    <div
      className={`glass-gold rounded-2xl px-3.5 py-3 mb-5 flex items-center gap-3 transition-all duration-500 ${
        leveledUp ? 'scale-[1.02] ring-1 ring-gold-300/60' : ''
      }`}
      style={leveledUp ? { boxShadow: '0 0 36px rgba(226,196,124,0.5)' } : undefined}
    >
      {/* ── Level badge ── */}
      <div className="relative shrink-0">
        <div
          className={`w-12 h-12 rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 text-night-950 ${
            leveledUp ? 'animate-scale-in' : ''
          }`}
          style={{ boxShadow: '0 0 14px rgba(197,160,89,0.4), inset 0 1px 0 rgba(255,255,255,0.35)' }}
        >
          <span className="text-[8px] uppercase tracking-wider leading-none opacity-70 font-display">Niv</span>
          <span className="text-lg font-bold leading-none font-display">{data.level}</span>
        </div>
        {leveledUp && (
          <span className="absolute -inset-1 rounded-full border border-gold-300/70 animate-ping pointer-events-none" />
        )}
      </div>

      {/* ── Title + XP + bar ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-xs font-display tracking-wide text-gold-300 truncate">
            {data.levelTitle}
          </span>
          <span className="text-[10px] text-night-400 tabular-nums shrink-0">
            {data.xpIntoLevel}
            <span className="text-night-600">/{data.xpForNext} XP</span>
          </span>
        </div>

        {/* Progress track (no overflow-clip so the gold aura can breathe) */}
        <div className="relative h-2 rounded-full bg-night-800/80 border border-gold-500/15">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out animate-gold-glow"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #b8860b 0%, #d4ae5f 50%, #e2c47c 100%)',
            }}
          >
            {/* travelling sheen, clipped to the pill */}
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <span
                className="block h-full w-full animate-shimmer"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                }}
              />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-night-500">
            ◈ {data.questsCompleted}/{data.questsTotal} quêtes
          </span>
          <span className="text-[10px] text-gold-400/80 tabular-nums">{pct}%</span>
        </div>
      </div>
    </div>
  );
}
