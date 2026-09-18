// Service worker: keeps a copy of the app on the phone so it opens offline.
//
// How it works:
// - On first visit it saves every app file into a named cache.
// - Every request is answered from the cache immediately, then refreshed
//   from the network in the background, so the next open gets new files.
// - Bump CACHE_VERSION whenever files change; the old cache is deleted.

const CACHE_VERSION = 'v1';
const CACHE = 'exercise-planner-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './db.js',
  './tags.js',
  './seed.js',
  './app.js',
  './generator.js',
  './workouts.js',
  './backup.js',
  './pwa.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const fromNetwork = fetch(request)
        .then(response => {
          if (response && response.ok) {
            caches.open(CACHE).then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fromNetwork;
    })
  );
});
