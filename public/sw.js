const CACHE_NAME = 'yaa-pos-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/src/main.tsx',
  '/src/index.css'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, hot reload, chrome-extension, and Firebase / API endpoints
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.href.includes('chrome-extension') ||
    !url.protocol.startsWith('http') ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/node_modules/') ||
    url.search.includes('import')
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached asset immediately if available, but fetch fresh copy in background to update cache (Stale-While-Revalidate)
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          console.log('[Service Worker] Fetch failed, serving cached fallback');
        });

      return cachedResponse || fetchPromise;
    })
  );
});
