import { useEffect, useState } from 'react';
import type { User } from '../types';
import { startCheckout, isStripeConfigured, openBillingPortal } from '../lib/payment';
import { api } from '../lib/api';
import { getUser } from '../lib/storage';

export function Paywall({ onClose, onSubscribe }: {
  onClose: () => void;
  onSubscribe: (u: User) => void;
}) {
  const [plan, setPlan] = useState<'weekly' | 'yearly'>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);

  // Vérifier si Stripe est configuré côté serveur à l'ouverture du paywall
  useEffect(() => {
    isStripeConfigured().then(setConfigured);
  }, []);

  const handleSubscribe = async () => {
    setBusy(true);
    setError('');
    const result = await startCheckout(plan);
    if (!result.success) {
      setError(result.error || 'Erreur inconnue.');
      setBusy(false);
    }
    // Si success, on redirige vers Stripe — pas besoin de setBusy(false).
  };

  const handleManageSubscription = async () => {
    setBusy(true);
    setError('');
    const result = await openBillingPortal();
    if (!result.success) {
      setError(result.error || 'Impossible d\'ouvrir le portail.');
      setBusy(false);
    }
  };

  // ─── Fix #2 — Restaurer mes achats (App Store Guideline 3.1.5) ───────
  // Sur iOS ce bouton est OBLIGATOIRE (sinon rejet App Store). Sans Stripe
  // configuré on remonte un message clair au lieu de planter.
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');

  const handleRestorePurchases = async () => {
    setRestoring(true);
    setRestoreMsg('');
    setError('');
    try {
      const res = await api.restorePurchases();
      if (res.restored && res.isPremium) {
        setRestoreMsg('✓ Abonnement restauré — vous êtes Premium.');
        // P0 #6 — On préserve l'utilisateur existant (email, birthData, natalChart)
        // au lieu de construire un User vide. Seul isPremium/premiumUntil changent.
        const existing = getUser();
        onSubscribe({
          ...existing,
          isPremium: true,
          scansRemaining: 0,
          premiumUntil: res.premiumUntil ?? existing.premiumUntil ?? null,
        });
      } else if (!res.configured) {
        setRestoreMsg('Restauration indisponible — Stripe non configuré.');
      } else {
        setRestoreMsg(res.message || 'Aucun abonnement trouvé pour ce compte.');
      }
    } catch (err: any) {
      setRestoreMsg(`Erreur : ${err?.message || 'restauration impossible'}`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100 relative">
      <div className="max-w-md mx-auto px-5 pt-12 pb-8 min-h-screen flex flex-col relative z-10">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-night-400 hover:text-night-200 transition-colors text-xl">
          ✕
        </button>

        {/* Hero */}
        <div className="text-center mt-4 mb-6 animate-fade-in-scale">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-gold-500/20 to-cosmic-500/20 flex items-center justify-center mb-4 animate-gold-glow">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gold-gradient">Céleste Premium</h1>
          <p className="text-night-300 text-sm max-w-xs mx-auto">
            Débloquez l'astrologie profondément personnelle, chaque jour
          </p>
        </div>

        {/* Configuration warning */}
        {configured === false && (
          <div className="glass border border-amber-500/30 rounded-2xl p-4 mb-6">
            <p className="text-amber-300 text-sm font-semibold mb-1">⚠️ Paiements en configuration</p>
            <p className="text-night-300 text-xs">
              Le système de paiement Stripe n'est pas encore activé sur cette instance.
              Réessaie dans quelques heures.
            </p>
          </div>
        )}

        {/* Features */}
        <div className="space-y-3 mb-8">
          {[
            { icon: '🌅', title: 'Horoscope quotidien personnalisé', desc: "Calculé à partir de VOS planètes, pas de votre seul signe solaire" },
            { icon: '💞', title: 'Compatibilité illimitée', desc: 'Analysez vos relations avec tous les signes' },
            { icon: '📖', title: 'Journal de bord', desc: 'Suivez vos ressentis et observez les cycles' },
            { icon: '🔮', title: 'Transits planétaires', desc: "Comprenez ce que les planètes activent en vous" },
          ].map((f, i) => (
            <div key={f.title} className="glass rounded-2xl p-4 flex items-start gap-3 animate-fade-in card-glow" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
              <div className="text-2xl mt-0.5">{f.icon}</div>
              <div>
                <p className="text-night-100 font-semibold text-sm">{f.title}</p>
                <p className="text-night-400 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div className="space-y-3 mb-6">
          <button onClick={() => setPlan('yearly')}
            className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 text-left ${plan === 'yearly' ? 'border-gold-500/60 glass-gold' : 'border-night-700/50 glass'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-night-100 font-bold">Annuel</p>
                  <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-xs font-medium">-58%</span>
                </div>
                <p className="text-night-400 text-xs mt-0.5">3 jours gratuits, puis 39,99€/an</p>
              </div>
              <div className="text-right">
                <p className="text-night-100 text-lg font-bold">3,33€</p>
                <p className="text-night-400 text-xs">/mois</p>
              </div>
            </div>
          </button>

          <button onClick={() => setPlan('weekly')}
            className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 text-left ${plan === 'weekly' ? 'border-cosmic-500/60 glass' : 'border-night-700/50 glass'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-night-100 font-bold">Hebdomadaire</p>
                <p className="text-night-400 text-xs mt-0.5">6,99€/semaine</p>
              </div>
              <p className="text-night-100 text-lg font-bold">6,99€</p>
            </div>
          </button>
        </div>

        {/* CTA — vrai checkout Stripe */}
        <button onClick={handleSubscribe}
          disabled={busy || configured === false}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-bold text-lg shadow-lg shadow-gold-900/50 transition-all duration-300 hover:scale-[1.01] animate-gold-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
          {busy
            ? 'Redirection…'
            : configured === false
              ? 'Indisponible'
              : plan === 'yearly'
                ? 'Démarrer mon essai gratuit'
                : 'Activer maintenant'}
        </button>

        {error && (
          <p className="text-red-400 text-xs text-center mt-3">{error}</p>
        )}

        <p className="text-night-500 text-xs text-center mt-4">
          {plan === 'yearly'
            ? '3 jours gratuits puis 39,99€/an. Annulez à tout moment. Rappel avant prélèvement.'
            : '6,99€/semaine. Annulez à tout moment.'}
        </p>

        {/* Restore Purchases (Fix #2 — obligatoire App Store Guideline 3.1.5) */}
        <button onClick={handleRestorePurchases}
          disabled={restoring}
          className="w-full mt-4 py-2.5 rounded-xl glass border border-night-700 text-night-200 text-sm hover:border-cosmic-500/50 transition-all disabled:opacity-50">
          {restoring ? 'Restauration…' : '♻️ Restaurer mes achats'}
        </button>
        {restoreMsg && (
          <p className={`text-xs text-center mt-2 ${restoreMsg.startsWith('✓') ? 'text-green-400' : restoreMsg.startsWith('Restauration indisponible') ? 'text-amber-400' : restoreMsg.startsWith('Erreur') ? 'text-red-400' : 'text-night-300'}`}>
            {restoreMsg}
          </p>
        )}

        {/* Manage existing subscription */}
        <button onClick={handleManageSubscription}
          disabled={busy || configured === false}
          className="w-full mt-3 py-2 text-night-400 hover:text-night-200 text-xs underline transition-colors disabled:opacity-50">
          Gérer mon abonnement existant
        </button>

        <p className="text-night-600 text-xs text-center mt-4">
          Contenu de divertissement. Ne constitue pas un conseil médical, financier ou juridique.
        </p>
        <p className="text-night-700 text-xs text-center mt-1">
          Paiement sécurisé par Stripe. Données chiffrées, aucune information bancaire stockée sur nos serveurs.
        </p>
      </div>
    </div>
  );
}