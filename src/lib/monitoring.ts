/**
 * CÉLESTE MONITORING — Sentry (errors) + PostHog (analytics)
 *
 * Both SDKs are lazy-loaded and optional. If env vars are not set, they no-op.
 * This keeps the bundle small and avoids crashes if monitoring is not configured.
 *
 * Configuration (in .env):
 *   VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
 *   VITE_POSTHOG_KEY=phc_xxx
 *   VITE_POSTHOG_HOST=https://app.posthog.com
 */

import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────
interface SentryModule {
  init: (opts: any) => void;
  captureException: (err: unknown, opts?: any) => void;
  ErrorBoundary: any; // React class component
}

// ─── Lazy loaders (dynamic import) ────────────────
let _sentry: SentryModule | null = null;
let _sentryPromise: Promise<void> | null = null;
let _posthog: any = null;
let _posthogPromise: Promise<void> | null = null;

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://app.posthog.com';

export function isSentryEnabled() { return !!SENTRY_DSN; }
export function isPostHogEnabled() { return !!POSTHOG_KEY; }

// ─── Sentry ───────────────────────────────────────
export async function initSentry() {
  if (!SENTRY_DSN || _sentry) return;
  if (_sentryPromise) return _sentryPromise;

  _sentryPromise = (async () => {
    try {
      const Sentry = await import('@sentry/react');
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        // Don't send PII
        beforeSend(event: any) {
          if (event.request?.data) {
            delete event.request.data.password;
            delete event.request.data.refreshToken;
          }
          return event;
        },
      });
      _sentry = Sentry as unknown as SentryModule;
      console.info('[monitoring] Sentry initialized');
    } catch (e) {
      console.warn('[monitoring] Sentry failed to load:', e);
    }
  })();
  return _sentryPromise;
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (_sentry) {
    _sentry.captureException(error, context ? { extra: context } : undefined);
  } else {
    console.error('[captureError]', error, context);
  }
}

export function getSentryErrorBoundary(): ReactNode | null {
  // Returns the Sentry.ErrorBoundary component if available, null otherwise
  if (_sentry?.ErrorBoundary) return _sentry.ErrorBoundary;
  return null;
}

// ─── PostHog ──────────────────────────────────────
export async function initPostHog() {
  if (!POSTHOG_KEY || _posthog) return;
  if (_posthogPromise) return _posthogPromise;

  _posthogPromise = (async () => {
    try {
      const { default: posthog } = await import('posthog-js');
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: false, // Privacy-first: no auto-capture of all clicks
        capture_pageview: true,
        disable_session_recording: true, // No session replay
        persistence: 'localStorage',
        loaded: (ph: any) => {
          console.info('[monitoring] PostHog initialized');
        },
      });
      _posthog = posthog;
    } catch (e) {
      console.warn('[monitoring] PostHog failed to load:', e);
    }
  })();
  return _posthogPromise;
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (_posthog) {
    _posthog.capture(event, properties);
  }
}

export function identifyUser(userId: string | number, traits?: Record<string, unknown>) {
  if (_posthog) {
    _posthog.identify(String(userId), traits);
  }
  if (_sentry) {
    _sentry.captureException; // just ensure it's loaded
    // Note: Sentry.setUser is not in our minimal type; skip if not available
  }
}

export function resetUser() {
  if (_posthog) _posthog.reset();
}
