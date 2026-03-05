// ============================================================================
// SMG Hostel Service Worker
// ============================================================================
// Lifecycle handlers ensure:
//   - New service worker activates immediately (skipWaiting + clients.claim)
//   - Stale caches from previous versions are purged on activation
// Push / notificationclick handlers below are for background push notifications.

const CACHE_VERSION = 'smg-hostel-v1';

// ---------------------------------------------------------------------------
// Install: claim caches, force activation without waiting for old tabs
// ---------------------------------------------------------------------------
self.addEventListener('install', function (event) {
  // Skip waiting so the new SW activates without requiring all tabs to close.
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
            // Remove any cache that doesn't match the current version prefix
            return name !== CACHE_VERSION && name.startsWith('smg-hostel-');
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    }).then(function () {
      // Take control of all open clients immediately
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

