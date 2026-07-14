// Celeste Service Worker — Push notifications + offline cache (P1 + P9)
// Architecture:
//   - push: reçoit les notifications du serveur (cron quotidien + re-engagement)
//   - notificationclick: ouvre l'app sur la bonne route
//   - fetch: stale-while-revalidate pour les assets statiques (offline-capable)

const CACHE_VERSION = 'celeste-v5';  // bumped: force purge of all v4 caches
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Assets statiques à pré-cacher pour le mode offline
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-72.png',
];

// ─── INSTALL: pré-cache des assets critiques ─────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: nettoie les anciens caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── PUSH: réception des notifications serveur ───────────────────────────
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Céleste', body: event.data ? event.data.text() : 'Nouveau message' };
  }

  const {
    title = '✨ Céleste',
    body = 'Ton horoscope du jour est prêt',
    icon = '/icon-192.png',
    badge = '/badge-72.png',
    tag = 'celeste-daily',
    url = '/',
    data = {},
  } = payload;

  const options = {
    body,
    icon,
    badge,
    tag,
    data: { ...data, url },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── NOTIFICATIONCLICK: ouvre/focus l'app sur la bonne route ──────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if found
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            if ('focus' in client) {
              client.postMessage({ type: 'NAVIGATE', url: targetUrl });
              return client.focus();
            }
          }
        }
        // Open new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── FETCH: stale-while-revalidate pour offline ──────────────────────────
//   - Assets statiques (JS/CSS/fonts): cache-first, revalidate en background
//   - API GET: network-first, fallback cache si offline
//   - POST/PATCH/DELETE: network-only (pas de cache)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET (mutations: never cache)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin (Stripe, CDN images, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip Chrome extension & dev HMR
  if (url.protocol === 'chrome-extension:' || url.pathname.includes('/@vite/') || url.pathname.includes('/__vite')) {
    return;
  }

  // API GET requests → network-first, fallback cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache
          return caches.match(request).then((cached) => cached || new Response(
            JSON.stringify({ error: 'Hors ligne' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          ));
        })
    );
    return;
  }

  // HTML/manifest — network-first (always serve fresh content)
  const isHtml = request.headers.get('accept')?.includes('text/html') || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isHtml || url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Static assets → network-first pour les JS/CSS avec hash (on veut le dernier build)
  // Fallback cache seulement si le réseau échoue
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => undefined);
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response('', { status: 504 })))
  );
});

// ─── MESSAGE: permet au frontend de déclencher skipWaiting (update) ───────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
