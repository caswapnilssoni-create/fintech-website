/* TaxMitra Marketing Site — Service Worker.
   Strategy: stale-while-revalidate for static assets (HTML/CSS/JS/images),
   so calculators work offline once visited. Always tries network first
   but falls back to cache on offline. */

const CACHE = 'taxmitra-site-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/favicon.svg',
  '/offline.html',
  '/calculators/',
  '/income-tax-calculator/',
  '/gst-calculator/',
  '/emi-calculator/',
  '/sip-calculator/',
  '/ppf-calculator/',
  '/hra-calculator/',
  '/nps-calculator/',
  '/fd-calculator/',
  '/salary-calculator/',
  '/epf-calculator/',
  '/home-loan-emi-calculator/',
  '/compound-interest-calculator/',
  '/assets/calc.css',
  '/assets/calc.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // best-effort precache; ignore failures (e.g. a URL doesn't exist yet)
      Promise.all(PRECACHE_URLS.map((u) => cache.add(u).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Don't intercept Formspree, Google Analytics, fonts.googleapis, or other 3rd-party calls
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Don't cache the portal subdomain
  if (url.hostname.startsWith('app.')) return;

  // Stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || fresh || cache.match('/offline.html');
      })
    )
  );
});
