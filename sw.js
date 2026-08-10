/* ============================================
   KSS Construction PWA Service Worker
   ============================================ */

const CACHE_NAME = 'kss-pwa-v35';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/pages.css',
  '/css/responsive.css',
  '/js/icons.js',
  '/js/store.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/sites2.js',
  '/js/products.js',
  '/js/incoming.js',
  '/js/outgoing.js',
  '/js/site-details2.js',
  '/js/inventory.js',
  '/js/ledger.js',
  '/js/reports.js',
  '/js/returns.js',
  '/js/rentals.js',
  '/js/separateBilling.js',
  '/js/labour.js',
  '/js/labourContracts.js',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install Event - Pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Static pre-cache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event Handler
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests or chrome-extension URLs
  if (req.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Network-First for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open('kss-api-cache').then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cachedRes) => {
            return cachedRes || new Response(JSON.stringify({ offline: true, error: 'Offline mode active' }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Network-First for HTML, JS, and CSS assets to ensure latest code is always served instantly
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req);
      })
  );
});
