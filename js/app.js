// EMONA leicht – Start der App: Navigation, Abendmodus, Sammlung im Kopf, Service Worker.

import { ladeInhalte, inhalt, t } from './inhalte.js';
import { $, esc, ganz, rattern, toast, sternchen, zeitZuMinuten } from './util.js';
import { beiAenderung, sync, syncZustand } from './speicher.js';
import { einstellungen } from './daten.js';
import { gesamt, pruefeErfolge } from './belohnung.js';
import * as heute from './ansichten/heute.js';
import * as verlauf from './ansichten/verlauf.js';
import * as freude from './ansichten/freude.js';
import * as abend from './ansichten/abend.js';
import * as mehr from './ansichten/mehr.js';
import * as start from './ansichten/start.js';

const ANSICHTEN = { heute, verlauf, freude, abend, mehr };
const SYMBOLE = {
  heute: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
  verlauf: '<path d="M4 19h16"/><path d="M5 15l4-4 4 3 6-7"/>',
  freude: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  abend: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  mehr: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
};

let aktuell = 'heute';
let abendmodusAn = false;
let angezeigt = null;
let wurzel;

/* ---------- Abendmodus ---------- */

function istAbend(jetzt = new Date()) {
  const ab = zeitZuMinuten(einstellungen().abendmodusAb) ?? 21 * 60;
  const minuten = jetzt.getHours() * 60 + jetzt.getMinutes();
  return minuten >= ab || minuten < 5 * 60;
}

function modusPruefen() {
  const neu = istAbend();
  document.documentElement.dataset.modus = neu ? 'abend' : 'tag';
  const farbe = getComputedStyle(document.documentElement).getPropertyValue('--hintergrund').trim();
  $('meta[name="theme-color"]')?.setAttribute('content', farbe || (neu ? '#1b1418' : '#f6efe2'));
  if (neu !== abendmodusAn) {
    abendmodusAn = neu;
    if (aktuell === 'heute' && wurzel && !document.activeElement?.matches('input, textarea, select')) zeichne();
  }
}

/* ---------- Kopfzeile mit Sternen und Punkten ---------- */

function kopfAktualisieren() {
  const summe = gesamt();
  const sterne = $('#kopf-sterne');
  const punkte = $('#kopf-punkte');
  if (!angezeigt) {
    sterne.textContent = ganz(summe.sterne);
    punkte.textContent = ganz(summe.punkte);
  } else {
    rattern(punkte, angezeigt.punkte, summe.punkte);
    rattern(sterne, angezeigt.sterne, summe.sterne, 600);
    if (summe.sterne > angezeigt.sterne) sternchen(sterne.parentElement, 3);
  }
  angezeigt = summe;

  const z = syncZustand();
  const punkt = $('#sync-punkt');
  punkt.dataset.zustand = z.art;
  punkt.title = { lokal: t('mehr.sync_lokal'), ok: t('mehr.sync_ok'), ausstehend: t('mehr.sync_ausstehend'), fehler: t('mehr.sync_fehler'), code: t('mehr.sync_code_falsch') }[z.art] || '';
}

/* ---------- Navigation ---------- */

function baueNavigation() {
  $('#navigation').innerHTML = Object.keys(ANSICHTEN)
    .map(
      (name) => `
      <a href="#${name}" class="nav-punkt" data-ansicht="${name}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${SYMBOLE[name]}</svg>
        <span>${esc(t(`nav.${name}`))}</span>
      </a>`,
    )
    .join('');
}

function ctx() {
  return {
    zeichne,
    abendmodus: () => abendmodusAn,
    modusPruefen,
  };
}

export function zeichne() {
  ANSICHTEN[aktuell].zeige(wurzel, ctx());
}

function route() {
  const name = location.hash.slice(1);
  const neu = ANSICHTEN[name] ? name : 'heute';
  if (neu !== aktuell && ANSICHTEN[aktuell].verlassen) ANSICHTEN[aktuell].verlassen();
  aktuell = neu;
  // Eine frische Fläche, damit keine Ereignisse der vorherigen Ansicht hängen bleiben.
  const frisch = wurzel.cloneNode(false);
  wurzel.replaceWith(frisch);
  wurzel = frisch;
  for (const a of document.querySelectorAll('.nav-punkt')) {
    if (a.dataset.ansicht === aktuell) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  wurzel.classList.add('neu-geoeffnet');
  setTimeout(() => frisch.classList.remove('neu-geoeffnet'), 700);
  zeichne();
  window.scrollTo({ top: 0 });
}

/* ---------- Änderungen und Erfolge ---------- */

let erfolgTimer = null;
function nachAenderung(herkunft) {
  if (herkunft === 'zustand') {
    kopfAktualisieren();
    return;
  }
  clearTimeout(erfolgTimer);
  erfolgTimer = setTimeout(() => {
    const neu = pruefeErfolge();
    kopfAktualisieren();
    // Erfolge, die durch Daten vom Server entstehen, werden still gesammelt.
    if (herkunft === 'server') return;
    neu.forEach((erfolg, i) => setTimeout(() => toast(t('erfolge.neu', { titel: erfolg.titel }), erfolg.symbol), 1600 + i * 4000));
  }, 300);
  // Daten vom Server: Ansicht neu zeichnen, solange gerade nicht getippt oder gespielt wird.
  if (herkunft === 'server') {
    const tippt = document.activeElement?.matches('input, textarea, select');
    const spielt = ANSICHTEN[aktuell].beschaeftigt?.();
    if (!tippt && !spielt) zeichne();
  }
}

/* ---------- Service Worker und Updates ---------- */

function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let neuLaden = false;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
  // Eine neue Version wird still geladen, sobald die App im Hintergrund ist.
  const hatteKontrolle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteKontrolle) return;
    if (document.visibilityState === 'hidden') location.reload();
    else neuLaden = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (neuLaden && document.visibilityState === 'hidden') location.reload();
  });
}

/* ---------- Start ---------- */

async function los() {
  wurzel = $('#inhalt');
  try {
    await ladeInhalte();
  } catch {
    wurzel.innerHTML = '<p class="karte">Ich konnte die Inhalte gerade nicht laden. Bitte prüf deine Verbindung und öffne die App noch einmal.</p>';
    return;
  }
  document.title = inhalt('app.name');
  $('#app-name').textContent = inhalt('app.name');
  $('#kopf-sterne').parentElement.setAttribute('aria-label', t('belohnung.sterne'));
  $('#kopf-punkte').parentElement.setAttribute('aria-label', t('belohnung.punkte'));
  $('#sync-punkt').setAttribute('aria-label', t('status.sync_punkt'));
  baueNavigation();
  modusPruefen();
  setInterval(modusPruefen, 30 * 1000);
  kopfAktualisieren();
  beiAenderung(nachAenderung);

  const offlineHinweis = () => {
    if (!navigator.onLine) toast(t('status.offline'));
    else sync();
  };
  window.addEventListener('online', offlineHinweis);
  window.addEventListener('offline', offlineHinweis);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      modusPruefen();
      sync();
      if (aktuell === 'heute' && !document.activeElement?.matches('input, textarea, select')) zeichne();
    }
  });

  const starten = () => {
    try { localStorage.setItem('emona.gestartet', '1'); } catch { /* ohne Speicher geht es trotzdem */ }
    document.body.classList.remove('erststart');
    window.addEventListener('hashchange', route);
    route();
  };

  let gestartet = false;
  try { gestartet = localStorage.getItem('emona.gestartet') === '1'; } catch { /* egal */ }
  if (!gestartet) {
    document.body.classList.add('erststart');
    start.zeige(wurzel, { fertig: starten });
  } else {
    starten();
    sync();
  }
  registriereServiceWorker();
}

los();
