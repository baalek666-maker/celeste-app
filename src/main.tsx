import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import ToastHost from './components/Toast';

// Service worker désactivé temporairement pour le preview tunnel.
// Le SW intercepte les fetch /api/ et sert du cache obsolète sur les tunnels Cloudflare.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Toujours visible, peu importe l'écran (auth/onboarding/home). */}
      <OfflineIndicator />
      <ToastHost />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);