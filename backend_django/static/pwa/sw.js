const CACHE_VERSION = 'hc-v1';
const APP_SHELL = [
  '/',
  '/login/',
  '/register/',
  '/attendance/',
  '/colleges/',
  '/events/',
  '/gate-passes/',
  '/gate-scans/',
  '/meals/',
  '/messages/',
  '/metrics/',
  '/notices/',
  '/notifications/',
  '/reports/',
  '/rooms/',
  '/users/',
  '/profile/',
  '/static/js/app.js',
  '/static/pwa/manifest.json',
  '/static/pwa/icon.svg',
  '/static/pwa/offline.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin === self.location.origin) {
    if (request.headers.get('accept')?.includes('text/html')) {
      event.respondWith(
        fetch(request).then(res => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, resClone));
          return res;
        }).catch(() => caches.match(request).then(r => r || caches.match('/static/pwa/offline.html')))
      );
      return;
    }

    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(res => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, resClone));
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(request, resClone));
        return res;
      }).catch(() => caches.match(request))
    );
  }
});
