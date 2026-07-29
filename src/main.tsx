import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import ToastHost from './components/Toast';
import { initSentry, initPostHog, captureError } from './lib/monitoring';

// Service worker désactivé temporairement pour le preview tunnel.
// Le SW intercepte les fetch /api/ et sert du cache obsolète sur les tunnels Cloudflare.

// Init monitoring (lazy, no-op if env vars missing)
initSentry();
initPostHog();

// P1#7 — Capture ?ref=CEL-XXXXXX dès le chargement (avant toute navigation).
// Le code est stocké en localStorage puis envoyé au /register.
import { captureReferralFromURL } from './lib/referral-storage';
captureReferralFromURL();

// Catch uncaught errors that escape React's ErrorBoundary
function _postDebug(payload: unknown) {
  try {
    const body = JSON.stringify({
      name: (payload as Error)?.name || 'Unknown',
      message: (payload as Error)?.message || String(payload),
      stack: (payload as Error)?.stack || '',
      source: 'window',
    });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/_debug_client_error', body);
    else fetch('/api/_debug_client_error', { method: 'POST', body, keepalive: true });
  } catch {}
}
window.addEventListener('error', (e) => { captureError(e.error ?? e.message); _postDebug(e.error ?? e.message); });
window.addEventListener('unhandledrejection', (e) => { captureError(e.reason); _postDebug(e.reason); });

// ROOT-CAUSE-FIX 'UNE ÉTINCELLE' : nettoyage défensif des résidus Google GIS
// (script + iframe + conteneur g_id_*) d'une session précédente. Si l'iframe
// GIS reste dans le DOM alors que React n'est plus en charge de son parent,
// son code interne appelle removeChild au prochain cycle → NotFoundError.
try {
  document.querySelectorAll('script#google-gis-script').forEach(el => el.remove());
  document.querySelectorAll('iframe[src*="accounts.google.com"]').forEach(el => el.remove());
  document.querySelectorAll('[id^="g_id"]').forEach(el => el.remove());
} catch {}

createRoot(document.getElementById('root')!).render(
  // StrictMode désactivé pour debug P0
  <ErrorBoundary>
    {/* Toujours visible, peu importe l'écran (auth/onboarding/home). */}
    <OfflineIndicator />
    {/* ToastHost désactivé pour debug P0 */}
    {/* <ToastHost /> */}
    <App />
  </ErrorBoundary>,
);