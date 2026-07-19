/**
 * StreakShopRow — Ligne "Boutique IAP" pour acheter un Streak Freeze (0,99€).
 *
 * Affichée dans SettingsMenu sous le PremiumBadge. Deux états :
 *  - States < freezes disponibles → simple ligne d'info (combien de jetons prêts).
 *  - Pas connecté → message "Connecte-toi pour utiliser cette option".
 *
 * L'IAP passe par `api.buyStreakFreeze()` qui crédite le compteur côté serveur.
 * La validation App Store / Play Store Receipt doit être branchée en prod —
 * pour l'instant, c'est un "trust me bro" côté serveur, à durcir avant mise en prod.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from './Toast';

export interface StreakShopRowProps {
  isGuest?: boolean;
}

export function StreakShopRow({ isGuest = false }: StreakShopRowProps) {
  const [freezesAvailable, setFreezesAvailable] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const refresh = () => {
    if (isGuest) { setLoading(false); return; }
    api.getStreakStatus()
      .then((s) => { setFreezesAvailable(s.freezesAvailable ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(refresh, [isGuest]);

  const handleBuy = async () => {
    setBuying(true);
    try {
      const res = await api.buyStreakFreeze(1);
      setFreezesAvailable(res.freezesAvailable);
      toast.success(`Freeze ajouté ! Total : ${res.freezesAvailable}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Achat indisponible';
      toast.error(msg);
    } finally {
      setBuying(false);
    }
  };

  if (isGuest) {
    return (
      <div className="w-full glass rounded-2xl p-4 flex items-center gap-3 opacity-70 border border-transparent">
        <span className="w-9 h-9 rounded-xl bg-night-700/40 flex items-center justify-center text-night-300">🛡️</span>
        <div className="flex-1">
          <p className="text-night-200 text-sm font-medium">Streak Freeze</p>
          <p className="text-night-500 text-xs mt-0.5">
            Connecte-toi pour protéger ton streak.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full glass rounded-2xl p-4 border border-transparent hover:border-gold-500/30 transition-all">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-cosmic-500/20 border border-gold-500/25 flex items-center justify-center text-lg">
          🛡️
        </span>
        <div className="flex-1">
          <p className="text-night-100 text-sm font-medium">Streak Freeze</p>
          <p className="text-night-500 text-xs mt-0.5">
            {loading ? 'Chargement…'
              : freezesAvailable === 0
                ? 'Aucun freeze prêt. Rachète un joker si tu rates une journée.'
                : `${freezesAvailable} freeze${freezesAvailable > 1 ? 's' : ''} prêt${freezesAvailable > 1 ? 's' : ''}.`}
          </p>
        </div>
        <button
          onClick={handleBuy}
          disabled={buying}
          className="px-3 py-2 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold text-xs transition-all hover:scale-[1.04] active:scale-[0.96] disabled:opacity-50 shadow-md shadow-gold-500/20"
        >
          {buying ? '…' : '+1 · 0,99€'}
        </button>
      </div>
      <button
        onClick={() => setShowInfo(v => !v)}
        className="mt-2 text-night-500 hover:text-gold-400 text-[10px] underline-offset-2 hover:underline transition-colors"
      >
        {showInfo ? 'Masquer les détails' : 'Comment ça marche ?'}
      </button>
      {showInfo && (
        <div className="mt-3 pt-3 border-t border-night-700/40 space-y-1.5">
          <p className="text-night-400 text-xs leading-relaxed">
            Un <span className="text-gold-300">freeze</span> protège ton streak si tu rates une journée.
          </p>
          <p className="text-night-400 text-xs leading-relaxed">
            Tu reçois <span className="text-gold-300">1 freeze gratuit par mois</span>.
            Si tu les consommes tous, rachète-en un pour 0,99 €.
          </p>
          <p className="text-night-500 text-[10px] leading-relaxed mt-1.5">
            Astuce : la connexion quotidienne garde ton streak vivant sans avoir besoin d'un freeze.
          </p>
        </div>
      )}
    </div>
  );
}

export default StreakShopRow;
