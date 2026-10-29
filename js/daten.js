// Fachliche Sicht auf die gespeicherten Dokumente: Tage, Freude-Liste, Experimente, Einstellungen.

import { lies, schreibe, aendere, schluesselMit } from './speicher.js';
import { inhalt } from './inhalte.js';
import { logischerTag, monatKey, neueId, jetztZeit } from './util.js';

/* ---------- Einstellungen (werden zwischen Geräten geteilt) ---------- */

const STANDARD_EINSTELLUNGEN = {
  name: '',
  abendmodusAb: '21:00',
  erinnerungMorgen: '08:00',
  erinnerungAbend: '20:30',
  erinnerungMittag: '12:30',
  erinnerungenAn: false,
  wiegetag: 1,
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
  const ex = experimentJetzt() || experiment(datum.slice(0, 7));
  schreibe(`beobachtung:${datum}-${neueId()}`, {
    datum,
    zeit: jetztZeit(),
    text,
    monat: datum.slice(0, 7),
    experiment: ex.titel,
  });
}

/* ---------- Laufendes Experiment (ab Version 1.3 einen Monat ab Zustimmung) ---------- */

export function plusMonat(datum) {
  const [j, m, t] = datum.split('-').map(Number);
  const d = new Date(j, m, Math.min(t, new Date(j, m + 1, 0).getDate()), 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function experimentJetzt() {
  return lies('versuch', null);
}

export function fruehereExperimente() {
  return lies('versuche', []);
}

export function experimentVorbei(v = experimentJetzt()) {
  return Boolean(v && v.ende && v.ende <= heuteKey());
}

export function starteExperiment(daten) {
  const alt = experimentJetzt();
  if (alt) {
    const frueher = { id: alt.id, titel: alt.titel, start: alt.start, ende: heuteKey() };
    if (alt.erkenntnis?.text) frueher.erkenntnis = alt.erkenntnis;
    schreibe('versuche', [...fruehereExperimente(), frueher]);
  }
  const start = heuteKey();
  schreibe('versuch', { ...daten, start, ende: plusMonat(start) });
}

// Der wievielte Tag des Experiments heute ist, und wie viele Tage es insgesamt hat.
export function experimentTag(v = experimentJetzt()) {
  if (!v?.start || !v?.ende) return null;
  const tage = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
  const von = Math.max(1, tage(v.start, v.ende));
  return { tag: Math.min(von, Math.max(1, tage(v.start, heuteKey()) + 1)), von };
}

// Was sie bei ihrem Experiment herausgefunden hat. Ein leerer Text löscht die Notiz.
export function speichereErkenntnis(text) {
  aendere('versuch', (v) => {
    if (text) v.erkenntnis = { datum: heuteKey(), text };
    else delete v.erkenntnis;
  });
}

export function verlaengereExperiment() {
  aendere('versuch', (v) => {
    v.ende = plusMonat(heuteKey());
    delete v.rueckblickNummer;
  });
}

export function aendereExperiment(fn) {
  aendere('versuch', fn, {});
}

// Wer schon vor Version 1.3 ein Experiment hatte, behält es: Es läuft ab dem Monatsersten weiter.
export function uebernimmAltesExperiment() {
  if (lies('versuch')) return;
  const monate = schluesselMit('experiment:').map((k) => k.slice(11)).sort();
  const nutztApp = schluesselMit('tag:').length > 0 || monate.length > 0;
  if (!nutztApp) return;
  const monat = monate.length ? monate[monate.length - 1] : monatKey();
  const alt = experiment(monat);
  const katalog = inhalt('experimente.liste', []).find((e) => e.titel === alt.titel);
  const start = `${monat}-01`;
  schreibe('versuch', {
    id: katalog ? katalog.id : 'eigen',
    titel: alt.titel,
    beschreibung: alt.beschreibung || '',
    start,
    ende: plusMonat(start) > heuteKey() ? plusMonat(start) : plusMonat(heuteKey().slice(0, 7) + '-01'),
    uebernommen: true,
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

const EINTRAGS_FELDER = ['gewicht', 'einschlafzeit', 'schlafdauer', 'anspannung', 'satz', 'taille', 'koerper', 'offen', 'abgelegt'];

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

export function schluesselTage() {
  return schluesselMit('tag:').map((k) => k.slice(4)).sort();
}
