// EMONA leicht – Service Worker
// Sorgt dafür, dass die App ohne Netz startet, Updates automatisch ankommen und Erinnerungen erscheinen.
// Bei jeder neuen Fassung die Nummer in CACHE_NAME erhöhen.

const CACHE_NAME = 'emona-leicht-1.0.0';

const DATEIEN = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'inhalte/inhalte.json',
  'js/app.js',
  'js/util.js',
  'js/inhalte.js',
  'js/speicher.js',
  'js/daten.js',
  'js/belohnung.js',
  'js/regal.js',
  'js/erinnerung.js',
  'js/export.js',
  'js/version.js',
  'js/ansichten/heute.js',
  'js/ansichten/verlauf.js',
  'js/ansichten/freude.js',
  'js/ansichten/abend.js',
  'js/ansichten/mehr.js',
  'js/ansichten/start.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('emona-') && n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Erst das Netz fragen (dann sind Änderungen sofort da), bei langsamer oder fehlender Verbindung den Zwischenspeicher nehmen.
async function netzZuerst(request) {
  const cache = await caches.open(CACHE_NAME);
  const ausDemNetz = fetch(request).then((antwort) => {
    if (antwort.ok) cache.put(request, antwort.clone());
    return antwort;
  });
  const zeitlimit = new Promise((loesen) => setTimeout(loesen, 3000));
  try {
    const schnell = await Promise.race([ausDemNetz, zeitlimit]);
    if (schnell) return schnell;
  } catch {
    /* ohne Netz weiter zum Zwischenspeicher */
  }
  const gespeichert = await cache.match(request, { ignoreSearch: true });
  if (gespeichert) return gespeichert;
  if (request.mode === 'navigate') {
    const start = await cache.match('index.html');
    if (start) return start;
  }
  return ausDemNetz;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(netzZuerst(event.request));
});

/* ---------- Erinnerungen ---------- */

async function erinnerungsText() {
  let inhalte = null;
  try {
    const antwort = (await caches.match('inhalte/inhalte.json', { ignoreSearch: true })) || (await fetch('inhalte/inhalte.json'));
    inhalte = await antwort.json();
  } catch {
    /* Ersatztext unten */
  }
  const art = new Date().getHours() < 14 ? 'morgen' : 'abend';
  const ersatz = { morgen: { titel: 'Guten Morgen', text: '' }, abend: { titel: 'Zeit zum Landen', text: '' } };
  return { art, ...(inhalte?.erinnerungen?.[art] || ersatz[art]) };
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    erinnerungsText().then(({ titel, text }) =>
      self.registration.showNotification(titel, {
        body: text,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'emona-erinnerung',
        renotify: false,
        silent: false,
        data: { ziel: './#heute' },
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      const offen = fenster.find((f) => 'focus' in f);
      if (offen) return offen.focus();
      return self.clients.openWindow(event.notification.data?.ziel || './');
    }),
  );
});
