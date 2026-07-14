/**
 * Payment integration layer — Céleste Premium.
 *
 * Backend: Stripe Checkout (mode='subscription') via /api/billing/create-checkout.
 * Le webhook Stripe active is_premium en DB après paiement confirmé.
 *
 * Si le backend n'a pas Stripe configuré (variables d'env manquantes),
 * `isStripeConfigured()` renvoie false et le Paywall affiche un message
 * "paiements en cours de configuration" au lieu de planter.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || '';
const TOKEN_KEY = 'celeste_jwt';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export type Plan = 'weekly' | 'yearly';

export interface CheckoutResult {
  success: boolean;
  recoverable: boolean;
  error?: string;
  demoUsed?: boolean;
  configured?: boolean;
}

/**
 * Lance le tunnel de paiement.
 * - Web : redirige vers Stripe-hosted Checkout (URL sécurisée fournie par le backend)
 * - Natif (Capacitor) : à brancher sur le plugin RevenueCat (TODO quand iOS/Android)
 *
 * Ne throw jamais — renvoie un objet CheckoutResult.
 */
let checkoutInProgress = false;

export async function startCheckout(plan: Plan): Promise<CheckoutResult> {
  // Anti double-soumission : si un checkout est déjà en cours, on bloque
  if (checkoutInProgress) {
    return {
      success: false,
      recoverable: true,
      error: 'Redirection vers le paiement en cours…',
    };
  }
  checkoutInProgress = true;

  const token = getToken();
  if (!token) {
    checkoutInProgress = false;
    return {
      success: false,
      recoverable: false,
      error: 'Connecte-toi avant de t\'abonner.',
    };
  }

  try {
    const resp = await fetch(`${API_URL}/api/billing/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    });

    const data = await resp.json().catch(() => ({} as Record<string, unknown>));

    if (resp.status === 503 || data.code === 'stripe_not_configured') {
      checkoutInProgress = false;
      return {
        success: false,
        recoverable: true,
        configured: false,
        error: 'Les paiements ne sont pas encore configurés sur cette instance.',
      };
    }

    if (!resp.ok) {
      checkoutInProgress = false;
      return {
        success: false,
        recoverable: true,
        error: data.error || `Erreur serveur (${resp.status})`,
      };
    }

    if (data.url) {
      // Valider que l'URL est bien une URL Stripe ou https (anti open redirect)
      try {
        const parsed = new URL(data.url);
        if (parsed.protocol !== 'https:') {
          checkoutInProgress = false;
          return { success: false, recoverable: true, error: 'URL de paiement non sécurisée.' };
        }
        // Accepte stripe.com, checkout.stripe.com, et le domaine du backend
        const isStripe = parsed.hostname.endsWith('.stripe.com') || parsed.hostname.endsWith('.stripe.network');
        const isLocalApi = parsed.origin === API_URL;
        if (!isStripe && !isLocalApi) {
          checkoutInProgress = false;
          return { success: false, recoverable: true, error: 'URL de paiement non reconnue.' };
        }
      } catch {
        checkoutInProgress = false;
        return { success: false, recoverable: true, error: 'URL de paiement invalide.' };
      }
      // Redirection vers Stripe Checkout
      window.location.href = data.url;
      return { success: true, recoverable: false };
    }

    checkoutInProgress = false;
    return {
      success: false,
      recoverable: true,
      error: 'Réponse serveur inattendue (pas d\'URL de paiement).',
    };
  } catch (err) {
    checkoutInProgress = false;
    return {
      success: false,
      recoverable: true,
      error: err instanceof Error ? err.message : 'Erreur réseau.',
    };
  }
}

/**
 * Ouvre le portail client Stripe pour gérer l'abonnement (annuler, CB).
 * Redirige le navigateur.
 */
export async function openBillingPortal(): Promise<CheckoutResult> {
  const token = getToken();
  if (!token) {
    return { success: false, recoverable: false, error: 'Non connecté.' };
  }
  try {
    const resp = await fetch(`${API_URL}/api/billing/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await resp.json().catch(() => ({} as Record<string, unknown>));
    if (resp.status === 503) {
      return { success: false, recoverable: true, configured: false, error: 'Paiements non configurés.' };
    }
    if (resp.status === 400 && data.error?.includes('Aucun')) {
      return { success: false, recoverable: false, error: 'Aucun abonnement actif.' };
    }
    if (!resp.ok) {
      return { success: false, recoverable: true, error: data.error || `Erreur ${resp.status}` };
    }
    if (data.url) {
      // Valider l'URL (anti open redirect)
      try {
        const parsed = new URL(data.url);
        if (parsed.protocol !== 'https:') {
          return { success: false, recoverable: true, error: 'URL non sécurisée.' };
        }
        const isStripe = parsed.hostname.endsWith('.stripe.com') || parsed.hostname.endsWith('.stripe.network');
        if (!isStripe && parsed.origin !== API_URL) {
          return { success: false, recoverable: true, error: 'URL non reconnue.' };
        }
      } catch {
        return { success: false, recoverable: true, error: 'URL invalide.' };
      }
      window.location.href = data.url;
      return { success: true, recoverable: false };
    }
    return { success: false, recoverable: true, error: 'Portail indisponible.' };
  } catch (err) {
    return { success: false, recoverable: true, error: err instanceof Error ? err.message : 'Erreur réseau.' };
  }
}

/**
 * Vérifie côté client si Stripe est configuré sur le backend.
 * Utilisé pour afficher le bon message dans le Paywall.
 */
export async function isStripeConfigured(): Promise<boolean> {
  try {
    const resp = await fetch(`${API_URL}/api/billing/status`);
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.configured === true;
  } catch {
    return false;
  }
}

/**
 * Vérifie l'état d'une session Stripe après paiement.
 * Utilisé sur la page de retour /billing/success.
 */
export async function verifyCheckoutSession(sessionId: string): Promise<{
  status: 'paid' | 'unpaid' | 'unknown';
  subscriptionId: string | null;
}> {
  const token = getToken();
  if (!token) return { status: 'unknown', subscriptionId: null };
  try {
    const resp = await fetch(`${API_URL}/api/billing/verify-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId }),
    });
    if (!resp.ok) return { status: 'unknown', subscriptionId: null };
    const data = await resp.json();
    return {
      status: data.paymentStatus === 'paid' ? 'paid' : 'unpaid',
      subscriptionId: data.subscriptionId || null,
    };
  } catch {
    return { status: 'unknown', subscriptionId: null };
  }
}