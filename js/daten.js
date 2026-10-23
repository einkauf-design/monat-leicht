// Fachliche Sicht auf die gespeicherten Dokumente: Tage, Freude-Liste, Experimente, Einstellungen.

import { lies, schreibe, aendere, schluesselMit } from './speicher.js';
import { inhalt } from './inhalte.js';
import { logischerTag, monatKey, neueId, jetztZeit } from './util.js';

/* ---------- Einstellungen (werden zwischen Geräten geteilt) ---------- */

const STANDARD_EINSTELLUNGEN = {
  name: '',
  abendmodusAb: '21:00',
  erinnerungMorgen: '07:30',
  erinnerungAbend: '21:00',
  erinnerungenAn: false,
};

export function einstellungen() {
  return { ...STANDARD_EINSTELLUNGEN, ...lies('einstellungen', {}) };
}

export function setzeEinstellungen(neu) {
  schreibe('einstellungen', { ...einstellungen(), ...neu });
}

/* ---------- Tage ---------- */

export function heuteKey() {
  return logischerTag();
}

export function tag(datum = heuteKey()) {
  return lies(`tag:${datum}`, {});
}

export function aendereTag(datum, fn) {
  aendere(`tag:${datum}`, fn, {});
}

export function morgenErledigt(t) {
  return t.gewicht !== undefined || t.einschlafzeit !== undefined || t.schlafdauer !== undefined || t.taille !== undefined || t.koerper !== undefined;
}

// Alle Tage mit Einträgen, aufsteigend sortiert.
export function alleTage() {
  return schluesselMit('tag:')
    .map((k) => ({ datum: k.slice(4), ...lies(k, {}) }))
    .sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

// Letzter bekannter Wert eines Feldes, um Formulare vorzubelegen.
export function letzterWert(feld) {
  const tage = alleTage();
  for (let i = tage.length - 1; i >= 0; i--) {
    if (tage[i][feld] !== undefined && tage[i][feld] !== null) return tage[i][feld];
  }
  return null;
}

export function summenFesthalten() {
  aendereTag(heuteKey(), (t) => {
    t.summen = [...(t.summen || []), jetztZeit()];
  });
}

export function pauseGenommen() {
  aendereTag(heuteKey(), (t) => {
    t.pausen = (t.pausen || 0) + 1;
  });
}

/* ---------- Freude-Liste ---------- */

// Solange die Liste nie bearbeitet wurde, gelten die Startwerte aus der Inhaltsdatei.
export function freudeListe() {
  const gespeichert = lies('freude', null);
  if (gespeichert) return gespeichert;
  return inhalt('freudeStartwerte', []).map((f, i) => ({ id: `start-${i}`, ...f }));
}

export function speichereFreude(liste) {
  schreibe('freude', liste);
}

export function neueFreude(titel, symbol, pause = true) {
  speichereFreude([...freudeListe(), { id: neueId(), titel, symbol, pause }]);
}

export function freudeNach(id) {
  return freudeListe().find((f) => f.id === id);
}

export function wechsleFreudePlatz(id) {
  aendereTag(heuteKey(), (t) => {
    const plaetze = new Set(t.freudePlaetze || []);
    if (plaetze.has(id)) plaetze.delete(id);
    else plaetze.add(id);
    t.freudePlaetze = [...plaetze];
  });
}

export function freudeGenossen(id) {
  aendereTag(heuteKey(), (t) => {
    const genutzt = new Set(t.freudeGenutzt || []);
    genutzt.add(id);
    t.freudeGenutzt = [...genutzt];
  });
}

export function freudeZaehler() {
  const zaehler = {};
  for (const t of alleTage()) {
    for (const id of t.freudeGenutzt || []) zaehler[id] = (zaehler[id] || 0) + 1;
  }
  return zaehler;
}

/* ---------- Experiment des Monats ---------- */

export function experiment(monat = monatKey()) {
  const eigenes = lies(`experiment:${monat}`, null);
  if (eigenes) return { monat, ...eigenes, gespeichert: true };
  // Ohne eigenes Experiment wird das letzte übernommen, sonst der Startwert aus der Inhaltsdatei.
  const frueher = schluesselMit('experiment:')
    .map((k) => k.slice(11))
    .filter((m) => m < monat)
    .sort()
    .pop();
  const vorlage = frueher ? lies(`experiment:${frueher}`) : inhalt('experimentStartwert', { titel: '' });
  return { monat, titel: vorlage.titel, beschreibung: vorlage.beschreibung || '', notiz: '', gespeichert: false };
}

export function speichereExperiment(monat, daten) {
  const { titel, beschreibung, notiz } = { ...experiment(monat), ...daten };
  schreibe(`experiment:${monat}`, { titel, beschreibung, notiz });
}

/* ---------- Abendregal ---------- */

export function regalStand() {
  return { regale: 0, sterne: 0, punkte: 0, ...lies('regal', {}) };
}

export function aendereRegal(fn) {
  aendere('regal', (r) => fn({ regale: 0, sterne: 0, punkte: 0, ...r }), {});
}

/* ---------- Beobachtungen zum Experiment (Tagebuch) ---------- */

// Jede Beobachtung ist ein eigenes Dokument, damit nichts überschrieben wird.
export function beobachtungen() {
  return schluesselMit('beobachtung:')
    .map((k) => ({ schluessel: k, ...lies(k, {}) }))
    .filter((b) => b.text)
    .sort((a, b) => (a.datum + (a.zeit || '') < b.datum + (b.zeit || '') ? 1 : -1));
}

export function speichereBeobachtung(text) {
  const datum = heuteKey();
  const ex = experiment(datum.slice(0, 7));
  schreibe(`beobachtung:${datum}-${neueId()}`, {
    datum,
    zeit: jetztZeit(),
    text,
    monat: ex.monat,
    experiment: ex.titel,
  });
}

// Die frühere Monatsnotiz wird einmalig als erste Beobachtung mit dem heutigen Datum übernommen.
// Der feste Schlüssel sorgt dafür, dass das auch auf mehreren Geräten nur einmal geschieht.
export function uebernimmAlteNotizen() {
  for (const k of schluesselMit('experiment:')) {
    const monat = k.slice(11);
    const ex = lies(k, {});
    const ziel = `beobachtung:uebernommen-${monat}`;
    if (!(ex.notiz || '').trim() || lies(ziel)) continue;
    schreibe(ziel, {
      datum: heuteKey(),
      zeit: jetztZeit(),
      text: ex.notiz.trim(),
      monat,
      experiment: ex.titel,
      uebernommen: true,
    });
  }
}

/* ---------- Tage mit Eintrag ---------- */

const EINTRAGS_FELDER = ['gewicht', 'einschlafzeit', 'schlafdauer', 'anspannung', 'satz', 'taille', 'koerper'];

export function hatEintrag(t) {
  return (
    EINTRAGS_FELDER.some((f) => t[f] !== undefined && t[f] !== null && t[f] !== '') ||
    (t.summen || []).length > 0 ||
    (t.freudeGenutzt || []).length > 0
  );
}

// Alle Tage, an denen etwas eingetragen wurde, auch nur eine Beobachtung. Aufsteigend sortiert.
export function eintragsTage() {
  const tage = new Set(alleTage().filter(hatEintrag).map((t) => t.datum));
  for (const b of beobachtungen()) tage.add(b.datum);
  return [...tage].sort();
}
