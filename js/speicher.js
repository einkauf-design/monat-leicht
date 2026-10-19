// Lokaler Speicher und Synchronisation mit der PHP-Schnittstelle.
//
// Alle Daten sind „Dokumente“ mit einem Schlüssel (zum Beispiel „tag:2026-10-19“, „freude“, „regal“).
// Jedes Dokument trägt die Zeit seiner letzten Änderung. Beim Abgleich gewinnt immer die neuere Fassung.
// Änderungen werden sofort lokal gespeichert und später an den Server geschickt.

const LS_DOCS = 'emona.docs';
const LS_AUSSTEHEND = 'emona.ausstehend';
const LS_SEIT = 'emona.seit';
const LS_GERAET = 'emona.geraet';
const LS_ZULETZT = 'emona.zuletzt';

function laden(schluessel, ersatz) {
  try {
    const roh = localStorage.getItem(schluessel);
    return roh ? JSON.parse(roh) : ersatz;
  } catch {
    return ersatz;
  }
}

function sichern(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch (fehler) {
    console.warn('Lokales Speichern nicht möglich', fehler);
  }
}

let docs = laden(LS_DOCS, {});
let ausstehend = new Set(laden(LS_AUSSTEHEND, []));
let seit = laden(LS_SEIT, 0);
let geraet = laden(LS_GERAET, { code: '', server: 'api/index.php' });
let zustand = { art: geraet.code ? 'ausstehend' : 'lokal', zuletzt: laden(LS_ZULETZT, null) };

const beobachter = new Set();
export function beiAenderung(fn) {
  beobachter.add(fn);
  return () => beobachter.delete(fn);
}
function melden(herkunft) {
  for (const fn of beobachter) fn(herkunft);
}

/* ---------- Lesen und Schreiben ---------- */

export function lies(schluessel, ersatz = null) {
  const doc = docs[schluessel];
  if (!doc || doc.wert === null || doc.wert === undefined) return ersatz;
  return doc.wert;
}

export function schreibe(schluessel, wert) {
  const vorher = docs[schluessel]?.zeit ?? 0;
  docs[schluessel] = { wert, zeit: Math.max(Date.now(), vorher + 1) };
  ausstehend.add(schluessel);
  sichern(LS_DOCS, docs);
  sichern(LS_AUSSTEHEND, [...ausstehend]);
  melden('lokal');
  planeSync();
}

// Liest ein Dokument, lässt es von „fn“ verändern und schreibt es zurück.
export function aendere(schluessel, fn, ersatz = {}) {
  const kopie = structuredClone(lies(schluessel, ersatz));
  const ergebnis = fn(kopie);
  schreibe(schluessel, ergebnis === undefined ? kopie : ergebnis);
}

export function schluesselMit(praefix) {
  return Object.keys(docs).filter((k) => k.startsWith(praefix) && docs[k].wert !== null && docs[k].wert !== undefined);
}

export function alleDocs() {
  return docs;
}

/* ---------- Gerät: Zugangscode und Server ---------- */

export function geraetDaten() {
  return { ...geraet };
}

export function setzeGeraet(neu) {
  geraet = { ...geraet, ...neu };
  sichern(LS_GERAET, geraet);
  if (!geraet.code) setzeZustand('lokal');
}

export function syncZustand() {
  return { ...zustand, ausstehend: ausstehend.size };
}

function setzeZustand(art, extra = {}) {
  zustand = { ...zustand, art, ...extra };
  melden('zustand');
}

/* ---------- Schnittstelle ---------- */

export class ApiFehler extends Error {
  constructor(meldung, status) {
    super(meldung);
    this.status = status;
  }
}

export async function api(aktion, daten = {}, { code = geraet.code, roh = false } = {}) {
  let antwort;
  try {
    antwort = await fetch(geraet.server, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...daten, aktion, code }),
      cache: 'no-store',
    });
  } catch {
    throw new ApiFehler('offline', 0);
  }
  if (roh && antwort.ok) return antwort;
  let inhalt = null;
  try {
    inhalt = await antwort.json();
  } catch {
    /* keine JSON-Antwort */
  }
  if (!antwort.ok || !inhalt?.ok) {
    throw new ApiFehler(inhalt?.fehler || `Fehler ${antwort.status}`, antwort.status);
  }
  return inhalt;
}

/* ---------- Synchronisation ---------- */

let syncTimer = null;
let laeuft = null;

export function planeSync(verzoegerung = 1500) {
  if (!geraet.code) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(), verzoegerung);
}

export async function sync() {
  if (!geraet.code) {
    setzeZustand('lokal');
    return;
  }
  if (laeuft) return laeuft;
  laeuft = (async () => {
    const gesendet = {};
    for (const schluessel of ausstehend) {
      if (docs[schluessel]) gesendet[schluessel] = docs[schluessel];
    }
    try {
      const antwort = await api('sync', { docs: gesendet, seit });
      // Erfolgreich verschickte Dokumente sind nicht mehr ausstehend, sofern sie seitdem nicht erneut geändert wurden.
      for (const [schluessel, doc] of Object.entries(gesendet)) {
        if (docs[schluessel]?.zeit === doc.zeit) ausstehend.delete(schluessel);
      }
      let geaendert = false;
      for (const [schluessel, doc] of Object.entries(antwort.docs || {})) {
        const lokal = docs[schluessel];
        if (!lokal || doc.zeit > lokal.zeit) {
          docs[schluessel] = doc;
          ausstehend.delete(schluessel);
          geaendert = true;
        }
      }
      seit = antwort.jetzt;
      sichern(LS_DOCS, docs);
      sichern(LS_AUSSTEHEND, [...ausstehend]);
      sichern(LS_SEIT, seit);
      const zuletzt = Date.now();
      sichern(LS_ZULETZT, zuletzt);
      setzeZustand(ausstehend.size ? 'ausstehend' : 'ok', { zuletzt });
      if (geaendert) melden('server');
    } catch (fehler) {
      setzeZustand(fehler.status === 401 ? 'code' : fehler.status === 0 ? 'ausstehend' : 'fehler');
    } finally {
      laeuft = null;
    }
  })();
  return laeuft;
}

// Beim ersten Anmelden auf einem Gerät soll alles vom Server geholt werden.
export function vonVorneSynchronisieren() {
  seit = 0;
  sichern(LS_SEIT, 0);
  for (const schluessel of Object.keys(docs)) ausstehend.add(schluessel);
  sichern(LS_AUSSTEHEND, [...ausstehend]);
}
