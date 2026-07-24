// Celeste Service Worker — Push ONLY (no caching, v60)
//
// v60 — KILL SWITCH FINAL.
// Le SW précédent (v50) avait deux handlers `fetch` et continuait de cacher
// le bundle JS, ce qui causait le bug removeChild sur Android (user gardait
// l'ancien bundle en cache). Ce SW NE FAIT QUE push. Plus aucun fetch, plus
// aucun cache, plus aucun offline.

self.addEventListener('install', (event) => {
  event.waitUntil(
    self.skipWaiting()
      .then(() => self.unregister())
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
      .catch(() => undefined)
  );
});

// Note: il n'y a PAS de fetch handler → toutes les requêtes passent
// par le réseau. Cache-Control: no-store du serveur garantit un bundle frais.

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
    icon = '/icons/icon-192.png',
    badge = '/icons/icon-512.png',
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            if ('focus' in client) {
              client.postMessage({
                type: 'NAVIGATE',
                url: targetUrl,
                screen: event.notification.data?.screen,
              });
              return client.focus();
            }
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
