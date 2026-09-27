const CACHE_NAME = 'dossara-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Automatically unregister and bypass on localhost/development
if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.registration.unregister());
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Bypass localhost and development completely
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') return;

  const url = new URL(event.request.url);

  // Only handle http and https requests - ignore blob:, data:, chrome-extension:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Only cache same-origin requests
  if (url.origin !== self.location.origin) return;
  
  // Exclude API routes, Next.js internals, and PDF.js worker scripts
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/') || url.pathname.includes('pdf.worker')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });

        if (cachedResponse) {
          // Revalidate in background, ignore offline errors
          fetchPromise.catch(() => {});
          return cachedResponse;
        }

        return fetchPromise.catch(async () => {
          if (event.request.mode === 'navigate') {
            const indexCached = await cache.match('/');
            if (indexCached) return indexCached;
          }
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        });
      });
    })
  );
});
