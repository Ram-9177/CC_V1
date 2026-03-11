/* global clients */

// Update CACHE_VERSION whenever you push major layout changes.
// Vite-PWA also manages its own internal precache, but this version acts as 
// a secondary guard for the /service-worker.js imported logic.
const CACHE_VERSION = `smg-hostel-v2-${new Date().getTime()}`;

// ---------------------------------------------------------------------------
// Install: claim caches, force activation without waiting for old tabs
// ---------------------------------------------------------------------------
self.addEventListener('install', function () {
  // Requirement 3: Ensure the new service worker takes control immediately
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate: claim all clients immediately, purge old versioned caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            // Requirement 2: Remove outdated caches
            // Clean up any cache that isn't the current constant version
            return name !== CACHE_VERSION;
          })
          .map(function (name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function () {
      // Requirement 3: Use clients.claim() to take control immediately
      return self.clients.claim();
    })
  );
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
self.addEventListener('push', function(event) {
  let data = { title: 'New Notification', body: 'You have a new update.', url: '/' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('Push payload parse error:', e);
  }

  const options = {
    body: data.body,
    icon: '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    tag: 'smg-hostel-notification',
    renotify: true,
    data: {
      url: data.url
    }
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if any client is focused.
      const isFocused = windowClients.some((client) => client.focused);
      if (isFocused) {
          // App is already open and focused; handle visually with in-app toasts.
          return;
      }
      return self.registration.showNotification(data.title, options);
    })
  );
});

// ---------------------------------------------------------------------------
// Notification click
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === urlToOpen) {
          matchingClient = windowClient;
          break;
        }
      }

      if (matchingClient) {
        return matchingClient.focus();
      } else {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

