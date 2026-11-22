// Service worker: guarda la "cáscara" de la app para que abra rápido e instale como app.
// Los datos (Supabase) nunca se guardan en caché: siempre van a la red.
const VERSION = 'v2';
const CACHE = `finanzas-${VERSION}`;
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/config.js', './js/core/supabase.js', './js/core/format.js',
  './js/domain/calculos.js', './js/domain/vida.js', './js/data/repositories.js',
  './js/services/AuthService.js', './js/services/FinanzasService.js', './js/services/VidaServices.js',
  './js/ui/dom.js', './js/ui/components.js',
  ...['auth', 'hoy', 'agenda', 'tareas', 'habitos', 'notas', 'universidad', 'trabajo', 'salud', 'mas',
    'resumen', 'movimientos', 'deudas', 'metas'].map((v) => `./js/ui/views/${v}.js`),
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const cacheable = (url) => url.origin === self.location.origin
  || url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');

// Red primero (para recibir actualizaciones), caché si no hay internet.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !cacheable(url)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((r) => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
