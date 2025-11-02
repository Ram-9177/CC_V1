// Lightweight service worker for offline + low-network usage + background sync for attendance writes
const CACHE_VERSION = 'v4';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const BASE = new URL(self.registration.scope).pathname.replace(/\/+$/, '/') || '/';
const core = (p) => (BASE.endsWith('/') ? BASE + p.replace(/^\//, '') : BASE + '/' + p.replace(/^\//, ''));
const CORE_ASSETS = [
  core(''),
  core('index.html'),
  core('manifest.webmanifest'),
  core('icons/icon-192.svg'),
  core('icons/icon-512.svg'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'HostelConnect';
    const options = {
      body: data.body || '',
      icon: core('icons/icon-192.svg'),
      badge: core('icons/icon-192.svg'),
      data: data.data || {},
    };
    // Add actions for meal intents if provided/known
    const d = options.data || {};
    if (d.type === 'MEAL_INTENT_REQUEST') {
      options.actions = [
        { action: 'MEAL_INTENT_YES', title: 'Yes' },
        { action: 'MEAL_INTENT_NO', title: 'No' },
      ];
    } else if (data.actions) {
      try { options.actions = Array.isArray(data.actions) ? data.actions : JSON.parse(data.actions); } catch {}
    } else if (d.actions) {
      try { options.actions = Array.isArray(d.actions) ? d.actions : JSON.parse(d.actions); } catch {}
    }
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // ignore
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const action = event.action;

  // Quick reply for meal intent
  if (data?.type === 'MEAL_INTENT_REQUEST' && (action === 'MEAL_INTENT_YES' || action === 'MEAL_INTENT_NO')) {
    const intent = action === 'MEAL_INTENT_YES' ? 'YES' : 'NO';
    event.waitUntil((async () => {
      try {
        const [apiBase, authToken] = await Promise.all([kvGet('apiBase'), kvGet('authToken')]);
        const url = String(apiBase || '').replace(/\/$/, '') + '/meals/intent';
        const body = { menuId: data.menuId, intent };
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (e) {
        // swallow
      }
    })());
    return; // don't focus/navigate when quick replied
  }

  // Default: focus existing client or open target URL
  const url = data?.url || BASE;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Helper: classify requests
function isHTML(req) {
  return req.headers.get('accept')?.includes('text/html');
}
function isAPI(req) {
  const url = new URL(req.url);
  return url.pathname.startsWith('/attendance') || url.pathname.startsWith('/api');
}
function isAttendanceWrite(req) {
  if (req.method !== 'POST') return false;
  const url = new URL(req.url);
  return (
    url.pathname === '/attendance/mark' ||
    url.pathname === '/attendance/join' ||
    url.pathname === '/attendance/join-by-qr'
  );
}
function isStatic(req) {
  const url = new URL(req.url);
  return url.origin === self.location.origin && (url.pathname.startsWith(BASE + 'assets/') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js'));
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'attendance-sync') {
    event.waitUntil(flushQueue());
  }
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'FLUSH_ATTENDANCE_QUEUE') {
    event.waitUntil(flushQueue());
  }
  if (event?.data?.type === 'GET_ATTENDANCE_QUEUE_COUNT') {
    event.waitUntil((async () => {
      const items = await dbGetAll().catch(() => []);
      try {
        // Reply to the requesting client with the current count
        event?.source?.postMessage?.({ type: 'ATTENDANCE_QUEUE_COUNT', count: items.length || 0 });
      } catch (e) {}
    })());
  }
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event?.data?.type === 'AUTH_TOKEN') {
    const token = event?.data?.token || null;
    event.waitUntil(kvSet('authToken', token));
  }
  if (event?.data?.type === 'CONFIG') {
    const cfg = event?.data?.config || {};
    event.waitUntil(kvSet('apiBase', cfg.apiBase || ''));
  }
});

// Minimal IndexedDB helpers for request queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('attn-queue', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function dbAdd(item) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('outbox').add(item);
  }));
}
function dbGetAll() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const req = tx.objectStore('outbox').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}
function dbDelete(id) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('outbox').delete(id);
  }));
}

// Minimal KV store (separate DB) for auth/config
function openKV() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('app-kv', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function kvSet(key, value) {
  return openKV().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('kv').put(value, key);
  }));
}
function kvGet(key) {
  return openKV().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function queueRequest(req) {
  try {
    const cloned = req.clone();
    const headers = {};
    cloned.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'authorization' || k.toLowerCase() === 'content-type') headers[k] = v;
    });
    const bodyText = await cloned.text();
    await dbAdd({ url: cloned.url, method: cloned.method, headers, body: bodyText, createdAt: Date.now() });
    try { await self.registration.sync.register('attendance-sync'); } catch (e) {}
  } catch (e) {}
}

async function flushQueue() {
  try {
    const items = await dbGetAll();
    if (!items.length) return true;
    for (const item of items) {
      try {
        const res = await fetch(item.url, { method: item.method, headers: item.headers, body: item.body });
        if (res && res.ok) {
          await dbDelete(item.id);
        }
      } catch (e) {
        // network still down; re-register sync and stop early
        try { await self.registration.sync.register('attendance-sync'); } catch (e2) {}
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Intercept attendance writes to queue offline operations
  if (isAttendanceWrite(req)) {
    event.respondWith((async () => {
      try {
        // Try network directly
        const res = await fetch(req.clone());
        return res;
      } catch (e) {
        // Queue and acknowledge as accepted for background sync
        await queueRequest(req);
        return new Response(JSON.stringify({ queued: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // Only handle GET to avoid interfering with other writes
  if (req.method !== 'GET') return;

  // HTML: Network-first with offline fallback
  if (isHTML(req)) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
        return res;
  }).catch(() => caches.match(req).then((res) => res || caches.match(core('index.html'))))
    );
    return;
  }

  // Static assets: Cache-first
  if (isStatic(req)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // APIs (GET): Stale-while-revalidate (low network usage)
  if (isAPI(req)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          return res;
        }).catch(() => cached || Promise.reject('offline')); // use cache when offline
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: pass-through
});
