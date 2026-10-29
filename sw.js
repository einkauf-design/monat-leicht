// EMONA leicht – Service Worker
// Sorgt dafür, dass die App ohne Netz startet, Updates automatisch ankommen und Erinnerungen erscheinen.
// Bei jeder neuen Fassung die Nummer in CACHE_NAME erhöhen.

const VERSION = '1.4.0';
// Jede Fassung (jeder Ordner) hat ihren eigenen Zwischenspeicher.
const BEREICH = self.registration.scope;
const CACHE_NAME = `emona-leicht-${VERSION}-${BEREICH}`;

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
  'js/rueckblick.js',
  'js/info.js',
  'js/ablage.js',
  'js/seiten.js',
  'js/profil.js',
  'js/experimente.js',
  'js/notizen.js',
  'js/weg.js',
  'js/wollfaeden.js',
  'js/bildpaare.js',
  'js/ansichten/heute.js',
  'js/ansichten/verlauf.js',
  'js/ansichten/freude.js',
  'js/ansichten/abend.js',
  'js/ansichten/mehr.js',
  'js/ansichten/start.js',
  'js/ansichten/rueckblick.js',
  'js/ansichten/teile.js',
  'js/ansichten/kennenlernen.js',
  'js/ansichten/experiment.js',
  'js/ansichten/angaben.js',
  'js/ansichten/angebot.js',
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
      .then((namen) => Promise.all(namen
        // Alte Fassungen dieses Ordners und die Zwischenspeicher aus Version 1.2 ohne Ordnerangabe werden aufgeräumt.
        .filter((n) => n.startsWith('emona-leicht-') && n !== CACHE_NAME && (n.endsWith(BEREICH) || !n.includes('/')))
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Erst das Netz fragen (dann sind Änderungen sofort da), bei langsamer oder fehlender Verbindung den Zwischenspeicher nehmen.
async function netzZuerst(request) {
  const cache = await caches.open(CACHE_NAME);
  // cache: 'no-cache' umgeht veraltete Dateien im Browser-Zwischenspeicher (Fix 25.10.2026).
  const ausDemNetz = fetch(request, { cache: 'no-cache' }).then((antwort) => {
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

// Welche Erinnerung gerade kommt, erkennt der Service Worker an den eingestellten Zeiten.
// Liegt keine Zeit in der Nähe, ist es die Erinnerung, um die gebeten wurde („Später erinnern“).
async function erinnerungsArt() {
  const jetzt = new Date();
  const minuten = jetzt.getHours() * 60 + jetzt.getMinutes();
  try {
    const ablage = await caches.open('emona-zeiten');
    const antwort = await ablage.match(new URL('erinnerungszeiten.json', BEREICH).href);
    const zeiten = antwort ? await antwort.json() : null;
    if (zeiten) {
      let beste = null;
      for (const [art, zeit] of Object.entries(zeiten)) {
        if (!zeit) continue;
        const [h, m] = zeit.split(':').map(Number);
        const abstand = minuten - (h * 60 + m);
        if (abstand >= -5 && abstand <= 95 && (!beste || abstand < beste.abstand)) beste = { art, abstand };
      }
      return beste ? beste.art : 'spaeter';
    }
  } catch {
    /* weiter mit der Uhrzeit */
  }
  return jetzt.getHours() < 11 ? 'morgen' : jetzt.getHours() < 15 ? 'mittag' : 'abend';
}

async function erinnerungsText() {
  let inhalte = null;
  try {
    const antwort = (await caches.match(new URL('inhalte/inhalte.json', BEREICH).href, { ignoreSearch: true })) || (await fetch('inhalte/inhalte.json'));
    inhalte = await antwort.json();
  } catch {
    /* Ersatztext unten */
  }
  const art = await erinnerungsArt();
  const ersatz = {
    morgen: { titel: 'Guten Morgen.', text: 'Magst du kurz deinen Morgen eintragen?' },
    mittag: { titel: 'Zeit für dein Mittagessen.', text: 'Magst du dir jetzt einen Moment zum Essen nehmen?' },
    abend: { titel: 'Es ist Zeit zum Landen.', text: 'Der Tag darf jetzt leiser werden.' },
    spaeter: { titel: 'Hier ist deine Erinnerung von vorhin.', text: 'Schau einfach vorbei, wenn es gerade passt.' },
  };
  return { art, ...(inhalte?.erinnerungen?.[art] || ersatz[art]) };
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    erinnerungsText().then(({ art, titel, text }) =>
      self.registration.showNotification(titel, {
        body: text,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'emona-erinnerung',
        renotify: false,
        silent: false,
        data: { ziel: `./?erinnerung=${art}#heute`, art },
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      const offen = fenster.find((f) => 'focus' in f && f.url.startsWith(BEREICH));
      if (offen) {
        offen.postMessage({ erinnerung: event.notification.data?.art });
        return offen.focus();
      }
      return self.clients.openWindow(event.notification.data?.ziel || './');
    }),
  );
});
