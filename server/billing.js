/**
 * Stripe Billing — Céleste Premium subscriptions.
 *
 * Mode subscription avec trial_period_days sur le Price annuel.
 * Toutes les activations premium passent par le webhook (source de vérité),
 * pas par l'appel client — qui ne peut pas tricher.
 *
 * Variables d'env requises (dans server/.env) :
 *   STRIPE_SECRET_KEY=sk_test_... ou sk_live_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   STRIPE_PRICE_ANNUAL=price_...
 *   STRIPE_PRICE_MONTHLY=price_...
 *
 * Sans ces vars, /api/billing/status renvoie {configured: false} et le
 * frontend affiche un message "paiements en cours de configuration".
 */

import Stripe from 'stripe';
import express from 'express';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL || '';
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || '';

// Client Stripe initialisé seulement si la clé est présente
export const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

export function isStripeConfigured() {
  return Boolean(stripe && STRIPE_WEBHOOK_SECRET && STRIPE_PRICE_ANNUAL && STRIPE_PRICE_MONTHLY);
}

export function getPriceIdForPlan(plan) {
  if (plan === 'yearly' || plan === 'annual') return STRIPE_PRICE_ANNUAL;
  if (plan === 'monthly') return STRIPE_PRICE_MONTHLY;
  return null;
}

const router = express.Router();

// ─── Billing status check (public) ────────────────────────────────────────
/**
 * GET /api/billing/status
 * Renvoie { configured: true|false }. Le frontend affiche le bon message
 * dans le Paywall sans exposer les clés secrètes.
 */
router.get('/status', (req, res) => {
  res.json({ configured: isStripeConfigured() });
});

/**
 * POST /api/billing/restore  (Fix #2 — Restore Purchases)
 *
 * Sur iOS, Apple EXIGE qu'une app avec auto-renewable subscriptions propose
 * un mécanisme "Restore Purchases" sinon REJET App Store Review (Guideline 3.1.5).
 * Sur Android et Web, ce bouton est facultatif mais bon pour l'UX.
 *
 * Sur le web : si l'user a une stripe_customer_id, on fetche ses subscriptions
 * actives chez Stripe et on (ré)applique is_premium + premium_until en DB.
 * Sans Stripe configuré : on renvoie ok=false avec un message clair
 * (l'user n'a rien à restaurer sur cette instance de dev).
 */
router.post('/restore', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Non authentifié.' });

  if (!isStripeConfigured()) {
    // Pas de Stripe configuré : on ne peut pas vérifier les abonnements.
    // Côté UX, le client affiche "Aucun abonnement à restaurer".
    return res.json({
      restored: false,
      configured: false,
      isPremium: false,
      message: 'Le système de paiement n\'est pas configuré sur cette instance.',
    });
  }

  const row = req.db.prepare(
    'SELECT stripe_customer_id, is_premium, premium_until FROM users WHERE id = ?'
  ).get(userId);

  if (!row?.stripe_customer_id) {
    // User n'a jamais payé — rien à restaurer
    return res.json({
      restored: false,
      configured: true,
      isPremium: row?.is_premium ?? false,
      premiumUntil: row?.premium_until ?? null,
      message: 'Aucun abonnement Stripe associé à ce compte.',
    });
  }

  try {
    // Lister les subscriptions actives de ce customer
    const subs = await stripe.subscriptions.list({
      customer: row.stripe_customer_id,
      status: 'all',
      limit: 10,
    });

    const now = Math.floor(Date.now() / 1000);
    const active = subs.data.find(
      (s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'
    );

    if (!active) {
      // Aucune subscription active — on s'assure que le compte n'est plus premium
      req.db.prepare(
        'UPDATE users SET is_premium = 0, premium_until = NULL WHERE id = ?'
      ).run(userId);
      return res.json({
        restored: false,
        configured: true,
        isPremium: false,
        premiumUntil: null,
        message: 'Aucun abonnement actif chez Stripe.',
      });
    }

    // Récupère la période courante et (ré)applique le premium
    const periodEnd = active.current_period_end
      ? active.current_period_end * 1000
      : Date.now() + 30 * 86400000;
    req.db.prepare(
      'UPDATE users SET is_premium = 1, premium_until = ?, stripe_subscription_id = COALESCE(stripe_subscription_id, ?) WHERE id = ?'
    ).run(periodEnd, active.id, userId);

    return res.json({
      restored: true,
      configured: true,
      isPremium: true,
      premiumUntil: periodEnd,
      subscriptionId: active.id,
      status: active.status,
    });
  } catch (err) {
    console.error('[billing] restore error:', err.message);
    return res.status(500).json({ error: 'Restauration impossible. Réessaie dans quelques secondes.' });
  }
});

/**
 * POST /api/billing/create-checkout
 * Body : { plan: 'monthly' | 'yearly' }
 * Crée une session Stripe Checkout (subscription) et renvoie l'URL de redirection.
 *
 * metadata : on stocke { userId, plan } pour que le webhook sache qui activer
 *            sans dépendre du customer_email (l'utilisateur peut payer avec un
 *            email différent de son compte Céleste).
 */
router.post('/create-checkout', async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error: 'Paiements en cours de configuration. Réessaie bientôt.',
      code: 'stripe_not_configured',
    });
  }

  const { plan } = req.body || {};
  const userId = req.user?.id;
  const userEmail = req.user?.email;
  if (!userId) return res.status(401).json({ error: 'Non authentifié.' });

  const priceId = getPriceIdForPlan(plan);
  if (!priceId) return res.status(400).json({ error: 'Plan invalide.' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,
      success_url: `${req.protocol}://${req.get('host')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/billing/cancel`,
      metadata: { userId: String(userId), plan: String(plan) },
      subscription_data: {
        metadata: { userId: String(userId), plan: String(plan) },
        // 7-day free trial on annual plan only (matches Paywall + Settings copy)
        ...(plan === 'yearly' && { trial_period_days: 7 }),
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[billing] create-checkout error:', err.message);
    return res.status(500).json({ error: 'Impossible de créer la session de paiement.' });
  }
});

/**
 * POST /api/billing/portal
 * Crée une session Stripe Customer Portal pour que l'utilisateur puisse
 * gérer / annuler son abonnement.
 */
router.post('/portal', async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Paiements non configurés.' });
  }
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Non authentifié.' });

  const row = req.db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(userId);
  if (!row?.stripe_customer_id) {
    return res.status(400).json({ error: 'Aucun abonnement actif trouvé.' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${req.protocol}://${req.get('host')}/settings`,
    });
    return res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] portal error:', err.message);
    return res.status(500).json({ error: 'Impossible d\'ouvrir le portail.' });
  }
});

/**
 * POST /api/billing/verify-session
 * Vérifie une session Stripe après que l'utilisateur a payé (fallback si
 * le webhook met du temps à arriver). Renvoie l'état premium actuel.
 */
router.post('/verify-session', async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Paiements non configurés.' });
  }
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId requis.' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      subscriptionId: session.subscription || null,
    });
  } catch (err) {
    console.error('[billing] verify-session error:', err.message);
    return res.status(404).json({ error: 'Session introuvable.' });
  }
});

/**
 * Webhook Stripe — source de vérité pour activer le premium.
 * Mounté SANS express.json() (raw body nécessaire pour vérifier la signature).
 */
export function stripeWebhookHandler(req, res, db) {
  if (!isStripeConfigured()) {
    return res.status(503).send('Stripe non configuré.');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[billing] webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotence — éviter de traiter 2x le même event
  const existing = db.prepare('SELECT id FROM stripe_events WHERE id = ?').get(event.id);
  if (existing) {
    return res.json({ received: true, duplicate: true });
  }
  db.prepare('INSERT INTO stripe_events (id, type, received_at) VALUES (?, ?, ?)').run(
    event.id,
    event.type,
    Math.floor(Date.now() / 1000)
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = Number(session.metadata?.userId);
        const plan = session.metadata?.plan || 'monthly';
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (!userId) {
          console.error('[billing] checkout.session.completed sans userId dans metadata');
          break;
        }
        const now = Date.now();
        // P0#3 — monthly remplace weekly (30 jours au lieu de 7).
        const duration = plan === 'yearly' || plan === 'annual'
          ? 365 * 86400000
          : 30 * 86400000;
        const until = now + duration;
        db.prepare(`
          UPDATE users SET
            is_premium = 1,
            premium_until = ?,
            scans_remaining = 999999,
            stripe_customer_id = COALESCE(stripe_customer_id, ?),
            stripe_subscription_id = COALESCE(stripe_subscription_id, ?)
          WHERE id = ?
        `).run(until, customerId || null, subscriptionId || null, userId);
        console.log(`[billing] ✅ Premium activé pour user ${userId} (${plan}) jusqu'à ${new Date(until).toISOString()}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = Number(sub.metadata?.userId);
        if (!userId) break;
        // Si l'abonnement est toujours actif, on garde is_premium.
        // Si statut passe en 'past_due' ou 'unpaid', on ne désactive pas tout de suite
        // (Stripe retente). Seul 'canceled' désactive.
        if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
          db.prepare('UPDATE users SET is_premium = 0, premium_until = NULL WHERE id = ?').run(userId);
          console.log(`[billing] ⛔ Premium désactivé pour user ${userId} (sub ${sub.status})`);
        } else if (sub.status === 'active' || sub.status === 'trialing') {
          const periodEnd = sub.current_period_end ? sub.current_period_end * 1000 : Date.now() + 30 * 86400000;
          db.prepare('UPDATE users SET is_premium = 1, premium_until = ? WHERE id = ?').run(periodEnd, userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = Number(sub.metadata?.userId);
        if (!userId) break;
        db.prepare('UPDATE users SET is_premium = 0, premium_until = NULL WHERE id = ?').run(userId);
        console.log(`[billing] ⛔ Abonnement annulé pour user ${userId}`);
        break;
      }

      default:
        // Event ignoré silencieusement
        break;
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('[billing] webhook processing error:', err.message, err.stack);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
}

export default router;