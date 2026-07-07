// The Nightstand — service worker
//
// Strategy: NETWORK-FIRST for everything on our own origin.
//   - Every load asks the server for fresh files, bypassing the browser's
//     10-minute GitHub Pages HTTP cache (cache:'no-cache' → ETag revalidation,
//     so unchanged files come back as cheap 304s). Deploys show up on the
//     very next launch instead of "wait ten minutes and hard-refresh".
//   - The cache is the FALLBACK: if the network is slow (>3.5s) or down, we
//     serve the last good copy, so the app still opens offline. The network
//     can never hang boot — the race guarantees an answer.
//   - Cross-origin requests (Supabase, Open Library, cover images) are not
//     intercepted at all. The worker must never sit between the app and its
//     data.
//
// Bump CACHE on strategy changes only — content updates flow through
// automatically because we're network-first.
const CACHE = 'nightstand-v9';
const NETWORK_TIMEOUT_MS = 3500;

// Best-effort warm-up of the shell (individually, so one miss can't fail the
// install). Runtime caching keeps all of this fresh afterward anyway.
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
  './js/advisor.js',
  './js/admin.js',
  './js/lib/openlibrary.js',
  './js/lib/goodreads.js',
  './js/lib/storygraph.js',
  './assets/vendor/preact.module.js',
  './assets/vendor/hooks.module.js',
  './assets/vendor/htm.module.js',
  './assets/vendor/supabase.umd.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-maskable.svg',
  './data/kindle-authors.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(CORE.map((u) => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first with cached fallback. `key` is what we store/look up under —
// navigations all map to ./index.html (hash routes never reach the server).
function networkFirst(req, key) {
  return caches.open(CACHE).then((cache) => {
    const network = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok) cache.put(key, res.clone()).catch(() => {});
      return res;
    });
    const timer = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
    return Promise.race([network, timer])
      .then((res) => res || cache.match(key).then((cached) => cached || network))
      .catch(() => cache.match(key).then((cached) => {
        if (cached) return cached;
        throw new Error('offline and not cached');
      }));
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase & friends: hands off

  const key = req.mode === 'navigate' ? './index.html' : req;
  event.respondWith(networkFirst(req, key));
});
