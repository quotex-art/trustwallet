/* Trust Wallet - Service Worker — native offline */
const CACHE_NAME = 'trust-wallet-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './native.js',
  './manifest.webmanifest',
  './assets/trust-wallet.svg',
  './assets/icons/icon192.png',
  './assets/icons/icon512.png',
  './assets/icons/icon180.png',
  './assets/icons/bitcoin.png',
  './assets/icons/ethereum.png',
  './assets/icons/binance.png',
  './assets/icons/usdt.png',
  './assets/icons/solana.png',
  './assets/icons/monero.png',
  './binance-icon-seeklogo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.url.includes('api.binance.com') || req.url.includes('api.coingecko.com')) return;

  // Navigation — return index.html for SPA (like official app)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const c = res.clone();
        caches.open(CACHE_NAME).then((cc) => cc.put('./index.html', c)).catch(()=>{});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
