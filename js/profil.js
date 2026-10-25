// Profil: Antworten auf die Eingangsfragen und was die App daraus ableitet.
//
// Die Antworten auf die Fragen 1 bis 9 liegen im Dokument „profil“.
// Die Gesundheitsangaben (Frage 10) liegen getrennt im Dokument „gesundheit“ und nur mit Einwilligung.
// Zurücknehmen der Einwilligung löscht dieses Dokument sofort.

import { lies, schreibe, aendere } from './speicher.js';
import { inhalt } from './inhalte.js';
import { heuteKey, freudeListe, speichereFreude, aendereTag } from './daten.js';
import { neueId } from './util.js';

// Mögliche Zustände einer Eingangsfrage
export const STATUS = { BEANTWORTET: 'beantwortet', NOCH_NICHT: 'nochNicht', NICHT_SAGEN: 'nichtSagen', OHNE: 'ohne' };

export function eingangsfragen() {
  return inhalt('eingangsfragen', []);
}

export function eingangsfrage(id) {
  return eingangsfragen().find((f) => f.id === id || f.nummer === Number(id));
}

export function profil() {
  return { antworten: {}, status: {}, freitext: {}, nachgefragt: {}, ...lies('profil', {}) };
}

export function gesundheit() {
  return lies('gesundheit', null);
}

export function hatEinwilligung() {
  return Boolean(gesundheit()?.einwilligung);
}

/* ---------- Antworten ---------- */

export function antwort(frageId) {
  if (frageId === 'gesundheit') return gesundheit()?.antworten || [];
  return profil().antworten[frageId];
}

export function status(frageId) {
  if (frageId === 'gesundheit') return gesundheit()?.status;
  return profil().status[frageId];
}

// Ist eine bestimmte Antwort gewählt? Funktioniert für Einzel- und Mehrfachauswahl.
export function hat(frageId, option) {
  const wert = antwort(frageId);
  return Array.isArray(wert) ? wert.includes(option) : wert === option;
}

export function speichereAntwort(frageId, wert, zustand = STATUS.BEANTWORTET, freitext) {
  if (frageId === 'gesundheit') {
    if (!hatEinwilligung()) return;
    aendere('gesundheit', (g) => {
      g.antworten = zustand === STATUS.BEANTWORTET ? wert : [];
      g.status = zustand;
    }, {});
    return;
  }
  aendere('profil', (p) => {
    p.antworten ||= {};
    p.status ||= {};
    p.freitext ||= {};
    if (zustand === STATUS.BEANTWORTET) p.antworten[frageId] = wert;
    else delete p.antworten[frageId];
    p.status[frageId] = zustand;
    if (freitext !== undefined) {
      if (freitext) p.freitext[frageId] = freitext;
      else delete p.freitext[frageId];
    }
  }, {});
}

export function markiereProfil(felder) {
  aendere('profil', (p) => Object.assign(p, felder), {});
}

export function stimmeZu() {
  schreibe('gesundheit', { einwilligung: heuteKey(), antworten: [], status: STATUS.OHNE });
}

// Zurücknehmen löscht die Gesundheitsangaben sofort, auf dem Gerät und beim nächsten Abgleich auf dem Server.
export function nimmZustimmungZurueck() {
  schreibe('gesundheit', null);
}

export function loescheAlleAngaben() {
  schreibe('gesundheit', null);
  const p = profil();
  schreibe('profil', { angeboten: p.angeboten || heuteKey() });
}

/* ---------- Ablauf ---------- */

// Fragen, die gerade gestellt werden. Frage 5 entfällt ohne Kaffee.
export function aktiveEingangsfragen() {
  return eingangsfragen().filter((f) => !(f.nurMitKaffee && ohneKaffee()));
}

export function kennenlernenBegonnen() {
  const p = profil();
  return Object.keys(p.status || {}).length > 0;
}

export function kennenlernenFertig() {
  return Boolean(profil().abgeschlossen);
}

export function offeneEingangsfragen() {
  const p = profil();
  return aktiveEingangsfragen().filter((f) => !f.gesundheit && !p.status[f.id]);
}

/* ---------- Was die App daraus ableitet ---------- */

export function ohneKaffee() {
  if (hat('trinken', 'kaum')) return true;
  return status('trinken') === STATUS.BEANTWORTET && !hat('trinken', 'kaffee');
}

export function gesundheitHat(option) {
  return hatEinwilligung() && hat('gesundheit', option);
}

// Sprunghafter Alltag oder ein neurodivergentes Gehirn: kürzere Einträge, Lob, „Später erinnern“.
export function sprunghaft() {
  return hat('alltag', 'sprunghaft') || gesundheitHat('adhs');
}

// „taeglich“, „woche“ (nur an einem Wochentag) oder „aus“
export function gewichtModus() {
  if (hat('gewichtSehen', 'garnicht')) return 'aus';
  if (hat('nichtGeholfen', 'wiegen')) return 'woche';
  return 'taeglich';
}

export function gewichtSichtbar() {
  return gewichtModus() !== 'aus';
}

export function schwerEinschlafen() {
  return hat('schlaf', 'einschlafen');
}

export function ohneMeditation() {
  return hat('nichtGeholfen', 'meditation');
}

export function sanftZuerst() {
  return hat('nichtGeholfen', 'verbote') || hat('nichtGeholfen', 'plaene');
}

export function schichtarbeit() {
  return gesundheitHat('schicht');
}

// Signale aus den Eingangsfragen, zum Beispiel „nebenbei essen“ für „hastig“.
export function profilSignale() {
  const signale = new Set();
  for (const f of eingangsfragen()) {
    for (const [option, signal] of Object.entries(f.setztSignale || {})) {
      if (hat(f.id, option)) signale.add(signal);
    }
  }
  return signale;
}

// Gewichte für Themen in den Rückblicken, abgeleitet aus Frage 1 und Frage 6.
export function themenGewichte() {
  const regeln = inhalt('fragenRegeln', {});
  const gewichte = {};
  const wunsch = eingangsfrage('wunsch');
  for (const [option, themen] of Object.entries(wunsch?.themen || {})) {
    if (hat('wunsch', option)) for (const thema of themen) gewichte[thema] = (gewichte[thema] || 0) + (regeln.themaGewichtWunsch ?? 2);
  }
  if (['einschlafen', 'aufwachen', 'frueh'].some((o) => hat('schlaf', o))) gewichte.schlaf = (gewichte.schlaf || 0) + (regeln.themaGewichtSchlaf ?? 2);
  return gewichte;
}

// Einträge, die bei „hat nicht geholfen“ nicht angeboten werden, tragen „nichtBei“.
export function erlaubt(eintrag) {
  return !(eintrag?.nichtBei || []).some((option) => hat('nichtGeholfen', option));
}

/* ---------- Freude-Plätze aus Frage 8 ---------- */

export function freudeVorschlaege() {
  const vorschlaege = inhalt('freudeVorschlaege', {});
  const liste = freudeListe();
  const ergebnis = [];
  for (const option of antwort('gutTut') || []) {
    const v = vorschlaege[option];
    if (!v) continue;
    const namen = [v.titel, ...(v.auch || [])].map((n) => n.toLowerCase());
    const vorhanden = liste.find((f) => namen.includes(f.titel.toLowerCase()));
    ergebnis.push(vorhanden ? { ...vorhanden, vorhanden: true } : { id: null, titel: v.titel, symbol: v.symbol, pause: v.pause });
    if (ergebnis.length >= 3) break;
  }
  return ergebnis;
}

export function uebernimmFreudeVorschlaege() {
  const vorschlaege = freudeVorschlaege();
  let liste = freudeListe();
  const ids = [];
  for (const v of vorschlaege) {
    if (v.id) {
      ids.push(v.id);
      continue;
    }
    const neu = { id: neueId(), titel: v.titel, symbol: v.symbol, pause: v.pause !== false };
    liste = [...liste, neu];
    ids.push(neu.id);
  }
  if (liste !== freudeListe()) speichereFreude(liste);
  aendereTag(heuteKey(), (t) => {
    t.freudePlaetze = [...new Set([...(t.freudePlaetze || []), ...ids])];
  });
}

/* ---------- Später nachfragen ---------- */

// Ob eine Eingangsfrage, die mit „noch nicht nachgedacht“ beantwortet wurde, jetzt erneut kommen darf.
export function nachfrageMoeglich(nummer, rueckblickNummer, signale) {
  const frage = eingangsfrage(nummer);
  if (!frage?.nochNicht || (frage.nurMitKaffee && ohneKaffee())) return false;
  const p = profil();
  if (p.status[frage.id] !== STATUS.NOCH_NICHT) return false;
  const regeln = inhalt('fragenRegeln', {});
  const bisher = p.nachgefragt?.[frage.id] || [];
  if (bisher.length >= (regeln.nachfrageHoechstens ?? 2)) return false;
  if (bisher.length) return rueckblickNummer - bisher[bisher.length - 1] >= (regeln.nachfrageWiederNach ?? 3);
  if (rueckblickNummer >= (regeln.nachfrageAbRueckblick ?? 4)) return true;
  // Früher, wenn ein passendes Signal aufgetaucht ist.
  return (frage.signale || []).some((s) => signale.has(s));
}

export function merkeNachfrage(frageId, rueckblickNummer) {
  aendere('profil', (p) => {
    p.nachgefragt ||= {};
    const liste = p.nachgefragt[frageId] || [];
    if (!liste.includes(rueckblickNummer)) p.nachgefragt[frageId] = [...liste, rueckblickNummer];
  }, {});
}
