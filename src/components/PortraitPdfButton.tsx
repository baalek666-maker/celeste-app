/**
 * PortraitPdfButton — Bouton "📄 Recevoir mon portrait en PDF".
 *
 * Affiche l'état du quota (1 PDF offert + N payants). Le bouton télécharge
 * le PDF si quota dispo, sinon ouvre un mini-modal d'achat (IAP stub).
 * La validation Receipt est un TODO prod : pour l'instant on crédite direct
 * le compteur après confirmation client.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { startConsumableCheckout } from '../lib/payment';
import { toast } from './Toast';

export function PortraitPdfButton() {
  const [status, setStatus] = useState<{
    freeUsed: number; freeQuota: number; paidCount: number; canDownload: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const refresh = () => {
    setLoading(true);
    api.getPortraitPdfStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const handleDownload = async () => {
    if (!status?.canDownload) {
      setShowBuyModal(true);
      return;
    }
    setDownloading(true);
    try {
      const blob = await api.downloadPortraitPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'portrait-astral-celeste.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Portrait téléchargé ✨');
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Téléchargement impossible';
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const handleBuy = async (_source: 'ios' | 'android' | 'stripe') => {
    try {
      // Stripe Checkout → webhook → grant automatique du PDF.
      const r = await startConsumableCheckout('pdf');
      if (!r.success) {
        toast.error(r.error || 'Paiement refusé');
      }
      // Redirection vers Stripe si succès → toast de confirmation géré sur /billing/success.
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Paiement refusé');
    }
  };

  if (loading || !status) {
    return (
      <div className="w-full glass rounded-2xl p-4 animate-pulse">
        <div className="h-4 w-40 bg-night-700/40 rounded" />
      </div>
    );
  }

  const remainingFree = Math.max(0, status.freeQuota - status.freeUsed);
  const label = remainingFree > 0
    ? `📄 Recevoir mon portrait en PDF — offre bienvenue`
    : status.paidCount > 0
      ? `📄 Télécharger mon PDF (${status.paidCount} restant${status.paidCount > 1 ? 's' : ''})`
      : `📄 Recevoir mon portrait en PDF — 9,99€`;

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="w-full glass rounded-2xl p-4 border border-transparent hover:border-gold-500/30 active:scale-[0.99] transition-all disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-cosmic-500/20 border border-gold-500/25 flex items-center justify-center text-xl">
            📄
          </span>
          <div className="flex-1 text-left">
            <p className="text-night-100 text-sm font-medium">{label}</p>
            <p className="text-night-500 text-xs mt-0.5">
              {remainingFree > 0
                ? `1 PDF offert · couverture dorée, ton nom, 3 signes clés`
                : status.paidCount > 0
                  ? `${status.paidCount} PDF déjà acheté${status.paidCount > 1 ? 's' : ''}`
                  : `Téléchargement instantané · lecture à garder`}
            </p>
          </div>
          <span className="text-gold-400 text-xs font-semibold tracking-wide">
            {downloading ? '…' : remainingFree > 0 ? 'GRATUIT' : status.paidCount > 0 ? '↓' : '9,99€'}
          </span>
        </div>
      </button>

      {showBuyModal && (
        <div
          className="fixed inset-0 bg-night-950/80 backdrop-blur-sm z-50 flex items-center justify-center px-5"
          onClick={() => setShowBuyModal(false)}
        >
          <div
            className="w-full max-w-md glass rounded-3xl p-6 border border-gold-500/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-gold-gradient mb-2 tracking-wider">
              Ton portrait en PDF
            </h3>
            <p className="text-night-300 text-sm leading-relaxed mb-5">
              Un beau document à garder, imprimer ou offrir. Couverture dorée, ton nom et tes trois signes (Soleil, Lune, Ascendant).
            </p>
            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-3xl font-bold text-gold-300">9,99 €</span>
              <span className="text-night-500 text-xs">— paiement unique, à vie</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleBuy('ios')}
                className="w-full py-3 rounded-xl bg-night-800 hover:bg-night-700 text-night-100 text-sm border border-night-700 transition-all"
              >
                Acheter sur iOS (App Store)
              </button>
              <button
                onClick={() => handleBuy('android')}
                className="w-full py-3 rounded-xl bg-night-800 hover:bg-night-700 text-night-100 text-sm border border-night-700 transition-all"
              >
                Acheter sur Android (Play Store)
              </button>
              <button
                onClick={() => handleBuy('stripe')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-gold-500/20"
              >
                Payer par carte · 9,99 €
              </button>
            </div>
            <button
              onClick={() => setShowBuyModal(false)}
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

export default PortraitPdfButton;
