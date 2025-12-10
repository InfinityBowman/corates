/* eslint-env serviceworker */
const CACHE_NAME = 'corates-landing-v3';

const STATIC_ASSETS = [
  '/',
  '/about',
  '/terms',
  '/privacy',
  '/app.html',
  '/favicon.ico',
  '/icon.png',
  '/jacob.jpeg',
  '/brandy.jpg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache static assets first
      await cache.addAll(STATIC_ASSETS);

      // Cache all built assets
      try {
        const manifestResponse = await fetch('/_build/assets/');
        if (manifestResponse.ok) {
          // Fetch the directory listing or use a known pattern
          // Since we can't list directories, we'll extract from spa-shell and main pages
          const pagesToScan = ['/', '/app.html', '/about', '/terms', '/privacy'];
          const allAssets = new Set();

          for (const page of pagesToScan) {
            try {
              const pageResponse = await fetch(page);
              if (pageResponse.ok) {
                const html = await pageResponse.text();
                const matches = html.matchAll(/(?:src|href)=["']((?:\/_build)?\/assets\/[^"']+)["']/g);
                for (const match of matches) {
                  allAssets.add(match[1]);
                }
              }
            } catch (err) {
              console.warn('[SW] Failed to scan page:', page, err);
            }
          }

          // Cache all discovered assets
          const assetArray = Array.from(allAssets);
          console.log('[SW] Caching', assetArray.length, 'build assets:', assetArray);

          for (const url of assetArray) {
            try {
              const response = await fetch(url);
              if (response.ok) {
                await cache.put(url, response);
                console.log('[SW] Cached:', url);
              } else {
                console.warn('[SW] Failed to cache (not ok):', url, response.status);
              }
            } catch (err) {
              console.warn('[SW] Failed to fetch:', url, err);
            }
          }
        }
      } catch (error) {
        console.error('[SW] Failed to cache build assets:', error);
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!request.url.startsWith('http')) return;

  // Check if this is a JS/CSS asset
  const isAsset = url.pathname.match(/\.(js|css|woff2?|ttf)$/);

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        event.waitUntil(
          fetch(request)
            .then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, response);
                });
              }
            })
            .catch(() => {}),
        );
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then(response => {
          // Cache successful responses for same-origin requests
          // Always cache JS/CSS assets and other same-origin requests
          if (response.ok && request.url.startsWith(self.location.origin)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return offline fallback for navigation requests
          if (request.mode === 'navigate') {
            // Serve cached app.html (SPA shell) for unknown routes
            return caches.match('/app.html') || caches.match('/');
          }
          // For failed asset requests, return a meaningful error
          if (isAsset) {
            return new Response('', { status: 404, statusText: 'Asset not cached' });
          }
          return new Response('Offline', { status: 503 });
        });
    }),
  );
});
