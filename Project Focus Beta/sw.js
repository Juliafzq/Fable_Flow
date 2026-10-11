// Fable / Flow — Phase 3 Service Worker (Network-First with no-cache revalidation + Offline Cache)
const CACHE_NAME = 'fable-flow-cache-v41';
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/supabaseSync.js',
  './js/tomato3D.js',
  './js/odometerPhysics.js',
  './js/sensoryEngine.js',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-512.png',
  './assets/tomatoes/home-tomato.png',
  './assets/tomatoes/hero-tomato-0.png',
  './assets/tomatoes/hero-tomato-silver.png'
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
