// CACHE_VERSION is replaced at build time - change this value to bust cache
const CACHE_VERSION = '__BUILD_TIME__';
const CACHE_NAME = `corates-landing-${CACHE_VERSION}`;

const APP_SHELL_URL = '/app.html';

const STATIC_ASSETS = [
  '/',
  '/about',
  '/pricing',
  '/terms',
  '/privacy',
  APP_SHELL_URL,
  '/favicon.ico',
  '/icon.png',
  '/jacob.jpeg',
  '/brandy.jpg',
  '/product.png',
];

function stripRedirect(response) {
  if (!response || !response.redirected) return response;
  return response
    .clone()
    .blob()
    .then(
      body =>
        new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        }),
    );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache static routes/assets (best-effort, don't fail install on a single 404)
      await Promise.all(
        STATIC_ASSETS.map(async url => {
          try {
            const response = await fetch(url, { redirect: 'follow' });
            if (response.ok) {
              const responseToCache = await stripRedirect(response);
              await cache.put(url, responseToCache);
            } else {
              console.warn('[SW] Static asset not ok:', url, response.status);
            }
          } catch (err) {
            console.warn('[SW] Static asset fetch failed:', url, err);
          }
        }),
      );

      // Cache built assets by scanning HTML for /_build/... references
      const pagesToScan = ['/', '/about', '/pricing', '/terms', '/privacy', APP_SHELL_URL];
      const discovered = new Set();

      for (const page of pagesToScan) {
        try {
          const pageResponse = await fetch(page, { redirect: 'follow' });
          if (!pageResponse.ok) continue;
          const html = await pageResponse.text();

          // Match SolidStart build assets (e.g. /_build/assets/xyz.js, /_build/xyz.css)
          const matches = html.matchAll(/(?:src|href)=["'](\/_build\/[^"']+)["']/g);
          for (const match of matches) {
            discovered.add(match[1]);
          }
        } catch (err) {
          console.warn('[SW] Failed to scan page:', page, err);
        }
      }

      const buildAssets = [...discovered];
      console.log('[SW] Caching', buildAssets.length, 'build assets');

      for (const url of buildAssets) {
        try {
          const response = await fetch(url, { redirect: 'follow' });
          if (!response.ok) {
            console.warn('[SW] Build asset not ok:', url, response.status);
            continue;
          }

          // Skip caching assets that are actually HTML (some hosts return index/login pages with 200)
          const contentType = (response.headers.get('content-type') || '').toLowerCase();
          if (contentType.includes('html')) {
            console.warn('[SW] Build asset looked like HTML; skipping:', url);
            continue;
          }

          const responseToCache = await stripRedirect(response);
          await cache.put(url, responseToCache);
        } catch (err) {
          console.warn('[SW] Build asset fetch failed:', url, err);
        }
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener('message', event => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

  // Skip API requests
  if (url.hostname === 'api.corates.org') return;

  const isAsset = url.pathname.match(/\.(js|css|map|woff2?|woff|ttf|png|jpg|jpeg|webp|svg|ico)$/);

  // Always try network first for navigations so new deploys update without hard refresh.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const isSameOrigin = request.url.startsWith(self.location.origin);

        try {
          const response = await fetch(request, { redirect: 'follow' });

          // If the server returns 404 for a navigation, serve the SPA shell.
          // This matches the behavior in packages/landing/worker.js.
          if (isSameOrigin && response.status === 404) {
            const appShellResponse = await fetch(APP_SHELL_URL, { redirect: 'follow' });
            if (appShellResponse.ok) {
              const appShellToCache = await stripRedirect(appShellResponse);
              event.waitUntil(
                caches
                  .open(CACHE_NAME)
                  .then(cache => cache.put(APP_SHELL_URL, appShellToCache.clone())),
              );
              return appShellToCache;
            }
          }

          // Cache successful HTML navigations for offline use
          if (isSameOrigin && response.ok) {
            event.waitUntil(
              stripRedirect(response.clone()).then(finalResponse =>
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, finalResponse);
                }),
              ),
            );
          }

          return response;
        } catch {
          // Offline fallback for navigation requests
          const cached =
            (await caches.match(request)) ||
            (await caches.match(APP_SHELL_URL)) ||
            (await caches.match('/'));

          if (!cached) return new Response('Offline', { status: 503 });
          return stripRedirect(cached);
        }
      })(),
    );
    return;
  }

  // Network-first strategy: always try network, fall back to cache if offline
  event.respondWith(
    fetch(request, { redirect: 'follow' })
      .then(response => {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();

        // If this was an asset request but server returned HTML, treat as a failure so we
        // fall through to the cache or a 404 instead of serving HTML with wrong MIME.
        if (isAsset && contentType.includes('html')) {
          console.warn('[SW] Asset request returned HTML; treating as failure:', request.url);
          throw new Error('Asset returned HTML');
        }

        // Cache successful (non-HTML) responses for same-origin requests
        if (
          response.ok &&
          request.url.startsWith(self.location.origin) &&
          !contentType.includes('html')
        ) {
          const responseToCache = Promise.resolve(stripRedirect(response.clone()));

          responseToCache.then(finalResponse => {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, finalResponse);
            });
          });
        }
        return response;
      })
      .catch(async () => {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return (await caches.match('/app.html')) || (await caches.match('/'));
        }
        // For failed asset requests, return a meaningful error
        if (isAsset) {
          return new Response('', { status: 404, statusText: 'Asset not cached' });
        }
        return new Response('Offline', { status: 503 });
      }),
  );
});
