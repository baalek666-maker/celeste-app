import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Step = { key: string; label: string; icon: string; completed: boolean };

export default function OnboardingChecklist({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = () => {
    api.getOnboarding()
      .then(d => {
        setSteps(d.steps);
        setDismissed(d.dismissed);
        setCompletedCount(d.completedCount);
        setTotalCount(d.totalCount);
      })
      .catch(e => console.error('onboarding load:', e));
  };

  useEffect(() => { refresh(); }, []);

  const dismiss = async () => {
    setDismissed(true);
    try { await api.dismissOnboarding(); } catch {}
  };

  if (dismissed) return null;
  if (totalCount === 0) return null;
  if (completedCount === totalCount) return null;

  const pct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="celeste-card mb-6 border-l-4 border-celeste-accent">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-celeste-accent flex items-center gap-2">
          <span>🌟</span> Premiers pas
          <span className="text-xs font-normal text-celeste-text/60">({completedCount}/{totalCount})</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-xs text-celeste-text/50 hover:text-celeste-text"
          >
            {collapsed ? 'Voir' : 'Réduire'}
          </button>
          <button
            onClick={dismiss}
            className="text-xs text-celeste-text/50 hover:text-celeste-text"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-celeste-primary/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-celeste-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {!collapsed && (
        <ul className="space-y-2">
          {steps.map(s => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <span className="text-base">{s.completed ? '✅' : s.icon}</span>
              <span className={s.completed ? 'line-through text-celeste-text/40' : 'text-celeste-text'}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-celeste-text/50 mt-3 italic">
        Découvre Celeste à ton rythme ✨
      </p>
    </div>
  );
}