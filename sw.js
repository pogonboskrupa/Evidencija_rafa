// Service worker: omogućava instalaciju aplikacije i rad bez interneta.
//
// Strategija je "mreža prvo, keš kao rezerva". Datoteke nemaju heš u imenu, pa
// bi keš-prvo pristup lako serviralo zastarjelu verziju nakon novog deploya.
// Aplikacija je mala (nekoliko desetina kB), tako da je cijena ovog pristupa
// zanemariva, a ponašanje predvidivo: online uvijek svježe, offline iz keša.

const VERSION = 'v9';
const CACHE = `evidencija-rafa-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

// Relativne putanje se razrješavaju u odnosu na lokaciju service workera, pa
// aplikacija radi i kada je objavljena u poddirektoriju (GitHub Pages).
// Snimci ekrana (screenshots/) se namjerno ne keširaju — koriste ih samo
// prodavnice/instalacioni UI prije instalacije, ne sama aplikacija dok radi.
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/storage.js',
  './js/stats.js',
  './js/forest.js',
  './js/pwa.js',
  './js/keypad.js',
  './manifest.webmanifest',
  './icons/favicon-32.png',
  './icons/favicon-64.png',
  './icons/icon-48.png',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // pojedinačno, da jedna nedostupna datoteka ne sruši cijelu instalaciju
      await Promise.all(
        SHELL.map((path) =>
          cache.add(new Request(path, { cache: 'reload' })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('evidencija-rafa-') && n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      try {
        const response = await Promise.race([fetch(request), timeout(NETWORK_TIMEOUT_MS)]);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;

        // Navigacija bez mreže i bez pogotka u kešu — vrati ljusku aplikacije.
        if (request.mode === 'navigate') {
          const shell = (await cache.match('./index.html')) || (await cache.match('./'));
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});

// Omogućava stranici da zatraži trenutnu aktivaciju nove verzije.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
