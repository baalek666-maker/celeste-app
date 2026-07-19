import { useEffect, useState } from 'react';
import type { User } from '../types';
import { startCheckout, isStripeConfigured, openBillingPortal } from '../lib/payment';
import { api } from '../lib/api';
import { getUser } from '../lib/storage';

export function Paywall({ onClose, onSubscribe }: {
  onClose: () => void;
  onSubscribe: (u: User) => void;
}) {
  // P0#3 — Ancien plan hebdomadaire (6,99€/sem = 363€/an, ratio ×9 annuel)
  // retiré : dark pattern anchoring. Remplacé par un plan mensuel défendable
  // (2,99€/mois ≈ 36€/an, ratio ×1,1 annuel). L'utilisateur peut comparer sans
  // être manipulé. App Store/Play acceptent ; Apple Guideline 3.1.1 respectée.
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);

  // Vérifier si Stripe est configuré côté serveur à l'ouverture du paywall
  useEffect(() => {
    let alive = true;
    isStripeConfigured().then(c => { if (alive) setConfigured(c); });
    return () => { alive = false; };
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

  // ─── P1-7 — Free trial sans CB ────────────────────────────────
  // Bouton "Essayer gratuitement 7 jours" : active le premium immédiatement
  // sans demander de carte bancaire. One-shot (le serveur vérifie trial_started_at).
  // À la fin de l'essai, retombée automatique vers le plan gratuit.
  const [trialBusy, setTrialBusy] = useState(false);

  const handleStartTrial = async () => {
    setTrialBusy(true);
    setError('');
    try {
      const res = await api.startTrial();
      const existing = getUser();
      onSubscribe({
        ...existing,
        isPremium: true,
        scansRemaining: 0,
        premiumUntil: res.trialEndsAt,
        trialStartedAt: Math.floor(Date.now() / 1000),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de démarrer l\'essai.');
    } finally {
      setTrialBusy(false);
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
        setRestoreMsg('✓ Abonnement restauré — tu es Premium.');
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
    } catch (err: unknown) {
      setRestoreMsg(`Erreur : ${err instanceof Error ? err.message : 'restauration impossible'}`);
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
          <p className="text-night-200 text-base max-w-xs mx-auto mb-4 leading-relaxed">
            Tu as déjà ouvert une porte. De l'autre côté, le ciel t'attend.
          </p>

          {/* P0#1 — Proof sociale sans chiffre fabriqué. On invite au mouvement
              plutôt qu'à une fausse masse. VMF-aligned : chaleureux, pas persuasif. */}
          <div className="flex items-center justify-center gap-2 text-xs">
            <div className="flex -space-x-1.5" aria-hidden="true">
              {['♈','♉','♊','♋','♌'].map((s,i)=>(
                <span key={i} className="w-5 h-5 rounded-full bg-night-800 border border-gold-500/30 flex items-center justify-center text-[10px] text-gold-300">{s}</span>
              ))}
            </div>
            <span className="text-night-300 italic">
              Rejoins celles qui ont choisi de regarder le ciel autrement
            </span>
          </div>
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
            { icon: '🌅', title: 'Horoscope vraiment quotidien', desc: "Tes planètes, pas seulement ton signe. Une lecture qui te ressemble." },
            { icon: '💞', title: 'Compatibilité illimitée', desc: 'La chimie astrale avec les personnes qui comptent pour toi' },
            { icon: '📖', title: 'Journal de bord', desc: 'Note tes ressentis et repère les cycles qui reviennent' },
            { icon: '🔮', title: 'Transits du moment', desc: "Ce qui se joue en toi maintenant, décrypté simplement" },
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

        {/* P1-7 — Essai gratuit SANS carte bancaire.
            Offre one-shot de 7 jours premium sans demander de CB.
            Placé AVANT les plans payants : conversion maximale, zéro friction. */}
        <button onClick={handleStartTrial}
          disabled={trialBusy || busy}
          className="w-full p-4 mb-4 rounded-2xl border-2 border-cosmic-500/40 glass-cosmic transition-all duration-300 text-left group hover:border-cosmic-400/60 disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cosmic-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              🎁
            </div>
            <div className="flex-1">
              <p className="text-night-100 font-bold text-sm">Essayer gratuitement 7 jours</p>
              <p className="text-night-400 text-xs mt-0.5">Sans carte bancaire · Accès complet Premium</p>
            </div>
            {trialBusy ? (
              <span className="text-cosmic-300 text-sm animate-pulse">…</span>
            ) : (
              <span className="text-cosmic-300 text-xl">→</span>
            )}
          </div>
        </button>

        {/* Plans */}
        <div className="space-y-3 mb-6">
          {/* P1-6 — Annuel rendu plus incitatif sans changer les prix.
              Ancien badge "2 mois offerts" était mathématiquement faux :
              2,99€×12 = 35,88€/an vs annuel 39,99€ → annuel coûtait 4€ DE PLUS.
              VMF = accuracy-first, pas dark pattern. On met en avant les VRAIS
              bénéfices : essai 7j, prix bloqué, zéro friction. */}
          <button onClick={() => setPlan('yearly')}
            className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 text-left relative ${plan === 'yearly' ? 'border-gold-500/60 glass-gold ring-2 ring-gold-500/20' : 'border-night-700/50 glass'}`}>
            {plan === 'yearly' && (
              <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 text-[10px] font-bold tracking-wide uppercase shadow-md">
                ★ Recommandé
              </span>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-night-100 font-bold">Annuel</p>
                </div>
                <p className="text-night-400 text-xs mt-0.5">7 jours gratuits, puis 39,99€/an</p>
                <p className="text-gold-300/80 text-[11px] mt-1 font-medium">🔒 Prix bloqué 12 mois · Annulation en 2 clics</p>
              </div>
              <div className="text-right">
                <p className="text-night-100 text-lg font-bold">3,33€</p>
                <p className="text-night-400 text-xs">/mois</p>
              </div>
            </div>
          </button>

          <button onClick={() => setPlan('monthly')}
            className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 text-left ${plan === 'monthly' ? 'border-cosmic-500/60 glass' : 'border-night-700/50 glass opacity-80'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-night-100 font-bold">Mensuel</p>
                <p className="text-night-400 text-xs mt-0.5">Sans engagement</p>
              </div>
              <div className="text-right">
                <p className="text-night-100 text-lg font-bold">2,99€</p>
                <p className="text-night-400 text-xs">/mois</p>
              </div>
            </div>
          </button>
        </div>

        {/* P1-6 — Réassurance concrète sur l'essai annuel */}
        {plan === 'yearly' && (
          <div className="glass rounded-2xl p-3 mb-4 border border-gold-500/20 animate-fade-in">
            <p className="text-night-200 text-xs font-semibold mb-2">Pendant tes 7 jours gratuits :</p>
            <ul className="space-y-1.5 text-night-300 text-xs">
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">✓</span>
                <span>Accès complet à toutes les fonctionnalités Premium, sans limite</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">✓</span>
                <span>Tu reçois un rappel 48h avant la fin de l'essai — aucune surprise</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">✓</span>
                <span>Tu annules en 2 clics si ce n'est pas pour toi, sans justification</span>
              </li>
            </ul>
          </div>
        )}

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
                : "S'abonner pour 2,99€/mois"}
        </button>

        {error && (
          <p className="text-red-400 text-xs text-center mt-3">{error}</p>
        )}

        <p className="text-night-500 text-xs text-center mt-4">
          {plan === 'yearly'
            ? '7 jours gratuits puis 39,99€/an. Annule à tout moment. Rappel avant prélèvement.'
            : '2,99€/mois. Annule à tout moment.'}
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