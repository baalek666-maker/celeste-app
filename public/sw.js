// Service worker Celeste — push notifications + mode hors ligne
// Stratégies cache : cache-first pour lectures astro (données stables), network-first pour le reste.
const CACHE_VERSION = 'celeste-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Shell critique — nécessaire pour démarrer offline après install PWA
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/favicon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
];

// Endpoints lectures astro : safe à servir offline (cache-first, TTL 24h)
const CACHE_FIRST_PATTERNS = [
  /\/api\/daily(\/|$|\?)/,
  /\/api\/chart\/natal/,
  /\/api\/chart\/transits/,
  /\/api\/horoscope(\/|$|\?)/,
  /\/api\/tarot(\/|$|\?)/,
  /\/api\/rituals\/(today|current)/,
  /\/api\/challenge\/weekly/,
  /\/api\/houses/,
  /\/api\/positions/,
  /\/api\/lunar-nodes/,
  /\/api\/notifications\/vapid-key/,
];

// Actions mutatrices : jamais cache
const NEVER_CACHE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

self.addEventListener('install', (e) => {
  // Precacher la shell + assets PWA (manifest, icônes) — nécessaire pour démarrer offline après install
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] precache partiel:', err.message);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Cleanup anciens caches
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('celeste-') && !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (e) => {
  let data = { title: '✨ Céleste', body: 'Ton horoscope du jour t\'attend.', url: '/' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (err) {
    if (e.data) data.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/badge-72.png',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100],
      tag: 'celeste-daily',
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

function isCacheFirst(url) {
  return CACHE_FIRST_PATTERNS.some((re) => re.test(url.pathname + url.search));
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Offline total : on tente le cache encore une fois (au cas où)
    return cached || Response.json({ offline: true, error: 'no-cache' }, { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return Response.json({ offline: true }, { status: 503 });
  }
}

self.addEventListener('fetch', (e) => {
  const request = e.request;
  const url = new URL(request.url);

  // Ignorer non-GET et les autres origines
  if (NEVER_CACHE_METHODS.includes(request.method)) return;
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/api/')) {
    // Shell statique : cache-first
    e.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((r) => {
          if (r.status === 200) {
            const clone = r.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone).catch(() => {}));
          }
          return r;
        })
      )
    );
    return;
  }

  // API : selon pattern
  if (isCacheFirst(url)) {
    e.respondWith(cacheFirst(request));
  } else {
    e.respondWith(networkFirst(request));
  }
});

// Message channel : permet au client de demander un skip cache, vidage, etc.
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'CLEAR_CACHE') {
    e.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});
