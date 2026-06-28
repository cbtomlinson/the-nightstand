// Reading Genie — service worker (offline app shell)
// Bump CACHE when shipping new assets so clients pick up the update.
const CACHE = 'reading-genie-v8';

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/html.js',
  './js/brand.js',
  './js/config.js',
  './js/supabase.js',
  './js/auth.js',
  './js/store.js',
  './js/data.js',
  './js/ui.js',
  './js/screens.js',
  './js/app.js',
  './assets/vendor/preact.module.js',
  './assets/vendor/hooks.module.js',
  './assets/vendor/htm.module.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // SPA navigations: serve the app shell, fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin assets: cache-first, then update the cache in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Cross-origin (e.g. book covers later): network, fall back to cache if present.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
