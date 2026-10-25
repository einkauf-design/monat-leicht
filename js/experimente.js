// Experimente: Auswahl nach den Eingangsfragen, Vorschlag, eigenes Experiment.
// Alle Experimente sind Einladungen für einen Monat, keine Verbote.

import { inhalt } from './inhalte.js';
import { experimentJetzt, fruehereExperimente, starteExperiment } from './daten.js';
import { hat, gesundheitHat, ohneKaffee, sanftZuerst, profilSignale, erlaubt } from './profil.js';
import { signale } from './rueckblick.js';

export function katalog() {
  return inhalt('experimente.liste', []);
}

export function katalogEintrag(id) {
  return katalog().find((e) => e.id === id);
}

// Passt ein Experiment grundsätzlich? Ohne Kaffee kein Kaffee-Experiment.
function moeglich(e) {
  if (e.braucht === 'kaffee' && ohneKaffee()) return false;
  return erlaubt(e);
}

function punkte(e, alleSignale) {
  let wert = 0;
  for (const regel of e.passt || []) {
    if (regel.frage && hat(regel.frage, regel.wert)) wert += regel.punkte;
    if (regel.gesundheit && gesundheitHat(regel.gesundheit)) wert += regel.punkte;
    if (regel.signal && alleSignale.has(regel.signal)) wert += regel.punkte;
  }
  // Ohne andere Hinweise beginnt der Weg mit dem Kaffee-Experiment.
  if (e.start) wert += 1;
  // Wer Verbote oder strenge Pläne nicht mag, bekommt zuerst die sanftesten Experimente.
  if (sanftZuerst()) wert += (4 - (e.sanft || 2)) * 3;
  return wert;
}

// Alle passenden Experimente in der Reihenfolge, in der die App sie vorschlägt.
// Reserve-Experimente kommen erst nach den anderen.
export function rangfolge() {
  const alleSignale = new Set([...profilSignale(), ...safeSignale()]);
  const jetzt = experimentJetzt();
  const schonGemacht = new Set(fruehereExperimente().map((v) => v.id));
  return katalog()
    .filter(moeglich)
    .map((e, i) => {
      let wert = punkte(e, alleSignale);
      if (schonGemacht.has(e.id)) wert -= 4;
      if (jetzt && jetzt.id === e.id) wert -= 10;
      return { e, wert, i };
    })
    .sort((a, b) => (a.e.reserve ? 1 : 0) - (b.e.reserve ? 1 : 0) || b.wert - a.wert || a.i - b.i)
    .map((x) => x.e);
}

function safeSignale() {
  try {
    return signale();
  } catch {
    return new Set();
  }
}

export function vorschlag(nummer = 0) {
  const liste = rangfolge();
  return liste[nummer % Math.max(1, liste.length)] || null;
}

export function starteAusKatalog(id) {
  const e = katalogEintrag(id);
  if (!e) return;
  starteExperiment({ id: e.id, titel: e.titel, beschreibung: e.beschreibung, info: e.info || null, erinnerung: e.erinnerung || null });
}

export function starteEigenes({ was, wann, woran }) {
  starteExperiment({ id: 'eigen', eigen: true, titel: was, beschreibung: '', wann, woran });
}

// Formulierungen wie „nie“ oder „kein“ bekommen einen sanften Hinweis. Speichern geht trotzdem.
export function klingtNachVerbot(text) {
  const klein = ` ${String(text || '').toLowerCase()} `;
  return inhalt('verbotsWoerter', []).some((wort) => new RegExp(`(^|[^a-zäöüß])${wort.replace(/ /g, '\\s+')}([^a-zäöüß]|$)`).test(klein));
}

export function mittagsErinnerungAktiv() {
  const v = experimentJetzt();
  return Boolean(v && v.erinnerung === 'mittag');
}
