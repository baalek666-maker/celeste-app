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
 *   STRIPE_PRICE_WEEKLY=price_...
 *
 * Sans ces vars, /api/billing/status renvoie {configured: false} et le
 * frontend affiche un message "paiements en cours de configuration".
 */

import Stripe from 'stripe';
import express from 'express';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL || '';
const STRIPE_PRICE_WEEKLY = process.env.STRIPE_PRICE_WEEKLY || '';

// Client Stripe initialisé seulement si la clé est présente
export const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

export function isStripeConfigured() {
  return Boolean(stripe && STRIPE_WEBHOOK_SECRET && STRIPE_PRICE_ANNUAL && STRIPE_PRICE_WEEKLY);
}

export function getPriceIdForPlan(plan) {
  if (plan === 'yearly' || plan === 'annual') return STRIPE_PRICE_ANNUAL;
  if (plan === 'weekly') return STRIPE_PRICE_WEEKLY;
  return null;
}

const router = express.Router();

/**
 * POST /api/billing/create-checkout
 * Body : { plan: 'weekly' | 'yearly' }
 * Crée une session Stripe Checkout (subscription) et renvoie l'URL de redirection.
 *
 * metadata : on stocke { userId, plan } pour que le webhook sache qui activer
 *            sans dépendre du customer_email (l'utilisateur peut payer avec un
 *            email différent de son compte Céleste).
 */
router.post('/create-checkout', (req, res) => {
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
    const session = stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,
      success_url: `${req.protocol}://${req.get('host')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/billing/cancel`,
      metadata: { userId: String(userId), plan: String(plan) },
      subscription_data: {
        metadata: { userId: String(userId), plan: String(plan) },
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
        const plan = session.metadata?.plan || 'weekly';
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (!userId) {
          console.error('[billing] checkout.session.completed sans userId dans metadata');
          break;
        }
        const now = Date.now();
        const duration = plan === 'yearly' || plan === 'annual'
          ? 365 * 86400000
          : 7 * 86400000;
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