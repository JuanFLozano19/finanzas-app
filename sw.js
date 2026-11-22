// Service worker de Rumbo.
// - Archivos de la app: red primero (revalidando), caché si no hay internet.
// - Lecturas de datos (Supabase REST GET): red primero; si no hay internet, la última copia.
// - Escrituras nunca pasan por aquí: si no hay red, la app las guarda en su cola (outbox).
const VERSION = 'v7';
const CACHE = `rumbo-app-${VERSION}`;
const DATOS = 'rumbo-datos';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/styles.css', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATOS).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const esDatos = (url) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/');
const esEstatico = (url) => url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net'
  || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');

async function redPrimero(req, cacheName, opciones) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(opciones ? new Request(req.url, opciones) : req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  } catch (err) {
    const copia = await cache.match(req, { ignoreSearch: cacheName === CACHE });
    if (copia) return copia;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (esDatos(url)) {
    e.respondWith(redPrimero(e.request, DATOS));
  } else if (esEstatico(url)) {
    const propio = url.origin === self.location.origin;
    e.respondWith(redPrimero(e.request, CACHE, propio && e.request.mode !== 'navigate' ? { cache: 'no-cache' } : null));
  }
});

// ---------- Notificaciones push ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Rumbo', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Rumbo', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag: d.tag, data: { url: d.url || './#hoy' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || './#hoy', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
    const abierta = ventanas.find((v) => v.url.startsWith(self.registration.scope));
    if (abierta) { abierta.navigate(destino); return abierta.focus(); }
    return self.clients.openWindow(destino);
  }));
});
