/**
 * StreakShieldBadge — Affiche l'état du Streak Freeze en haut de Home.
 *
 * Trois états :
 *  - "loading" → discret, attend la résolution
 *  - "none"    → rien à afficher (streak non protégé, pas de freeze dispo)
 *  - "ready"   → badge or "🛡️ N freeze(s) prêt(s)" + microcopy rassurante
 *
 * Source : `api.getStreakStatus()` (endpoint backend /api/streak).
 * Rafraîchi : à l'ouverture du screen + après un IAP réussi.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface StreakStatus {
  count: number;
  lastDate: string | null;
  freezesAvailable: number;
  nextFreeReset: string | null;
}

export interface StreakShieldBadgeProps {
  /** Streak courant du user (déjà connu côté parent) */
  streak?: number;
  /** Callback pour ouvrir la boutique IAP depuis le badge */
  onBuy?: () => void;
}

export function StreakShieldBadge({ streak = 0, onBuy }: StreakShieldBadgeProps) {
  const [status, setStatus] = useState<StreakStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.getStreakStatus()
      .then((s) => { if (alive) { setStatus(s); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [streak]);

  if (loading || !status) return null;
  if (status.freezesAvailable <= 0) return null;
  if (streak <= 0) return null;

  return (
    <button
      onClick={onBuy}
      className="w-full mb-3 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 transition-all active:scale-[0.98]"
      style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(168,85,247,0.08))',
        border: '1px solid rgba(251,191,36,0.30)',
        boxShadow: '0 0 18px rgba(251,191,36,0.15)',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg leading-none" aria-hidden="true">🛡️</span>
        <div className="text-left">
          <p className="text-gold-200 text-xs font-medium leading-tight">
            {status.freezesAvailable === 1
              ? '1 freeze prêt à protéger ton streak'
              : `${status.freezesAvailable} freezes prêts à protéger ton streak`}
          </p>
          <p className="text-night-400 text-[10px] mt-0.5">
            Un freeze s’active automatiquement si tu rates une journée
          </p>
        </div>
      </div>
      <span className="text-gold-400 text-xs shrink-0">+ 1 · 0,99€</span>
    </button>
  );
}

export default StreakShieldBadge;
