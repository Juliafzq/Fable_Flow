// UNTO / FLOW — Phase 3 Service Worker (Network-First with no-cache revalidation + Offline Cache)
const CACHE_NAME = 'fable-flow-cache-v87';
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './css/noto-serif-sc.css',
  './js/app.js',
  './js/supabaseSync.js',
  './js/i18n.js',
  './js/tomato3D.js',
  './js/tomatoTop3D.js',
  './js/odometerPhysics.js',
  './js/sensoryEngine.js',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192.png',
  './assets/fonts/eb-garamond-latin.woff2',
  './assets/fonts/eb-garamond-italic-latin.woff2',
  './assets/tomatoes/home-tomato.png',
  './assets/tomatoes/hero-tomato-0.png',
  './assets/tomatoes/hero-tomato-silver.png',
  './assets/tomatoes/grid-tomato-0.png',
  './assets/tomatoes/grid-tomato-1.png',
  './assets/tomatoes/grid-tomato-2.png',
  './assets/tomatoes/grid-tomato-3.png',
  './assets/tomatoes/grid-tomato-4.png',
  './assets/tomatoes/grid-tomato-5.png',
  './assets/tomatoes/grid-tomato-unassigned.png',
  './assets/tomatoes/grid-tomato-silver.png',
  './assets/tomatoes/mini-tomato-0.png',
  './assets/tomatoes/mini-tomato-1.png',
  './assets/tomatoes/mini-tomato-2.png',
  './assets/tomatoes/mini-tomato-3.png',
  './assets/tomatoes/mini-tomato-4.png',
  './assets/tomatoes/mini-tomato-5.png',
  './assets/tomatoes/mini-tomato-grey.png',
  './assets/tomatoes/mini-tomato-silver.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for static image assets (/assets/) so tomato PNGs never re-fetch or flash on UI updates
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // Network-first with cache: 'no-cache' so the root master link always serves the latest build online
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
