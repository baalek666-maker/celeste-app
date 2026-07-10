import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';

// Service worker : push notifications + cache offline (lecture astro).
// En dev Vite, le SW est servi depuis /sw.js, Vite ne l'intercepte pas.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('SW registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Toujours visible, peu importe l'écran (auth/onboarding/home). */}
      <OfflineIndicator />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
