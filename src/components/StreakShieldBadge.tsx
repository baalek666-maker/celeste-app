/**
 * StreakShieldBadge — Affiche l'état du Streak Freeze en haut de Home.
 *
 * Trois états :
 *  - "loading" → discret, attend la résolution
 *  - "none"    → rien à afficher (streak non protégé, pas de freeze dispo)
 *  - "ready"   → badge or "🛡️ N freeze(s) prêt(s)" + microcopy rassurante
 *
 * MON01 — Clic ouvre un modal d'achat inline (iOS/Android/Stripe), plus redirection Settings.
 * Source : `api.getStreakStatus()` (endpoint backend /api/streak).
 * Rafraîchi : à l'ouverture du screen + après un IAP réussi.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../components/Toast';
import { startConsumableCheckout } from '../lib/payment';

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
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buying, setBuying] = useState(false);

  const refresh = () => {
    api.getStreakStatus()
      .then(setStatus)
      .catch((err) => { toast.error('Statut de streak indisponible — réessaie dans un instant.'); })
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [streak]);

  const handleBuyClick = () => {
    // Préfère le modal inline ; fallback vers onBuy (Settings) si fourni
    setShowBuyModal(true);
  };

  const handlePurchase = async (_source: 'ios' | 'android' | 'stripe') => {
    setBuying(true);
    try {
      // Plus de "mark-paid" client-side — tout passe par Stripe Checkout → webhook.
      // startConsumableCheckout redirige vers Stripe ; le webhook crédite le freeze.
      const r = await startConsumableCheckout('freeze');
      if (!r.success) {
        toast.error(r.error || 'Achat refusé');
        setBuying(false);
      }
      // En cas de succès, redirection vers Stripe — pas de toast ici.
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Achat refusé');
      setBuying(false);
    }
  };

  if (loading || !status) return null;
  if (streak <= 0) return null;

  // UX : ne pas afficher le prix sur la Home. Le prix ne doit apparaître que
  // dans le modal d'achat (après clic). La première impression de l'app ne doit
  // pas parler d'argent.
  const noFreezeLeft = status.freezesAvailable <= 0;

  return (
    <>
      <button
        onClick={handleBuyClick}
        className="w-full mb-2 px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 transition-all active:scale-[0.98] glass border border-night-700/30"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm leading-none opacity-70" aria-hidden="true">🛡️</span>
          <p className="text-night-300 text-[11px] leading-tight">
            {noFreezeLeft
              ? `Protège ta série de ${streak} jours`
              : status.freezesAvailable === 1
                ? '1 bouclier prêt'
                : `${status.freezesAvailable} boucliers prêts`}
          </p>
        </div>
        <span className="text-gold-400/70 text-[10px] shrink-0">→</span>
      </button>

      {showBuyModal && (
        <div
          className="fixed inset-0 bg-night-950/80 backdrop-blur-sm z-50 flex items-center justify-center px-5"
          onClick={() => !buying && setShowBuyModal(false)}
        >
          <div
            className="w-full max-w-md glass rounded-3xl p-6 border border-gold-500/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-gold-gradient mb-2 tracking-wider">
              🛡️ Streak Freeze
            </h3>
            <p className="text-night-300 text-sm leading-relaxed mb-5">
              Un jeton magique qui conserve ton streak intact si tu rates une journée.
              S'active automatiquement — aucune action de ta part.
            </p>
            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-3xl font-bold text-gold-300">0,99 €</span>
              <span className="text-night-500 text-xs">— pour 1 freeze</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handlePurchase('ios')}
                disabled={buying}
                className="w-full py-3 rounded-xl bg-night-800 hover:bg-night-700 text-night-100 text-sm border border-night-700 transition-all disabled:opacity-50"
              >
                {buying ? '…' : 'Acheter sur iOS (App Store)'}
              </button>
              <button
                onClick={() => handlePurchase('android')}
                disabled={buying}
                className="w-full py-3 rounded-xl bg-night-800 hover:bg-night-700 text-night-100 text-sm border border-night-700 transition-all disabled:opacity-50"
              >
                {buying ? '…' : 'Acheter sur Android (Play Store)'}
              </button>
              <button
                onClick={() => handlePurchase('stripe')}
                disabled={buying}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-gold-500/20 disabled:opacity-50"
              >
                {buying ? 'Traitement…' : 'Payer par carte · 0,99 €'}
              </button>
            </div>
            <button
              onClick={() => !buying && setShowBuyModal(false)}
              disabled={buying}
              className="w-full mt-3 py-2 text-night-500 hover:text-night-300 text-xs transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default StreakShieldBadge;
