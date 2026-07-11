// No-op service worker : désactivé pour debug.
// Permet d'écraser un ancien SW actif sur le même domaine (tunnel Pinggy).
// Toute la logique de cache / push est désactivée. Voir src/lib/useNotifications.ts
// pour la logique push réelle (à réactiver une fois l'app stable en prod).
self.addEventListener('install', () => {
  // Prendre le contrôle immédiatement sans cache
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Nettoyer tous les caches existants
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Laisser passer toutes les requêtes au réseau (no cache, no intercept).
self.addEventListener('fetch', (event) => {
  // network-only, pas de respondWith → le browser utilise le réseau normalement
  return;
});