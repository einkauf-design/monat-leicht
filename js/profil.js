// Profil: Antworten auf die Eingangsfragen und was die App daraus ableitet.
//
// Die Antworten liegen im Dokument „profil“.
// Die Gesundheitsangaben (Frage 10) liegen getrennt im Dokument „gesundheit“ und nur mit Einwilligung.
// Dort liegen auch einzelne Antworten anderer Fragen, die etwas über die Gesundheit sagen (Optionen mit „gesundheit“):
// „Wechseljahre“ zählt als Antwort auf Frage 10, „Fachleute wie Therapie“ liegt unter „extra“.
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
  const wert = profil().antworten[frageId];
  const frage = eingangsfrage(frageId);
  const heikel = (frage?.optionen || []).filter((o) => o.gesundheit && gesundheitsWahl(frageId, o));
  if (!heikel.length) return wert;
  const liste = Array.isArray(wert) ? wert : wert ? [wert] : [];
  return [...liste, ...heikel.map((o) => o.id)];
}

// Ist eine Option, die etwas über die Gesundheit sagt, gewählt? Nur mit Einwilligung gespeichert.
function gesundheitsWahl(frageId, option) {
  const g = gesundheit();
  if (!g?.einwilligung) return false;
  if (typeof option.gesundheit === 'string') return (g.antworten || []).includes(option.gesundheit);
  return (g.extra?.[frageId] || []).includes(option.id);
}

// Optionen, die etwas über die Gesundheit sagen, erscheinen nur mit Einwilligung.
export function sichtbareOptionen(frage) {
  return (frage.optionen || []).filter((o) => !o.gesundheit || hatEinwilligung());
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
  // Antworten, die etwas über die Gesundheit sagen, wandern in das Dokument „gesundheit“.
  const frage = eingangsfrage(frageId);
  const heikel = (frage?.optionen || []).filter((o) => o.gesundheit);
  if (heikel.length && (Array.isArray(wert) || zustand !== STATUS.BEANTWORTET)) {
    const gewaehlt = zustand === STATUS.BEANTWORTET ? wert : [];
    if (hatEinwilligung()) {
      aendere('gesundheit', (g) => {
        for (const o of heikel) {
          const an = gewaehlt.includes(o.id);
          if (typeof o.gesundheit === 'string') {
            const liste = new Set(g.antworten || []);
            if (an) liste.add(o.gesundheit);
            else liste.delete(o.gesundheit);
            g.antworten = [...liste];
            if (an) g.status = STATUS.BEANTWORTET;
          } else {
            g.extra ||= {};
            const liste = new Set(g.extra[frageId] || []);
            if (an) liste.add(o.id);
            else liste.delete(o.id);
            g.extra[frageId] = [...liste];
          }
        }
      }, {});
    }
    if (Array.isArray(wert)) wert = wert.filter((id) => !heikel.some((o) => o.id === id));
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
// Ohne Vertiefung: die Fragen des ersten Kennenlernens. Mit Vertiefung: alle, zum Ansehen und Ändern.
export function aktiveEingangsfragen({ vertiefung = false } = {}) {
  return eingangsfragen().filter((f) => !(f.nurMitKaffee && ohneKaffee()) && (vertiefung || !f.vertiefung));
}

// Die Fragen, die seit Version 1.4 dazugekommen sind („Magst du mir noch etwas mehr erzählen?“).
export function mehrFragen() {
  return eingangsfragen().filter((f) => f.mehr);
}

export function offeneMehrFragen() {
  const p = profil();
  return mehrFragen().filter((f) => !p.status[f.id]);
}

// Einmal sanft anbieten, wer das Kennenlernen schon vor den neuen Fragen gemacht hat.
export function mehrAnbieten() {
  const p = profil();
  if (p.mehrAngeboten && p.mehrAngeboten !== heuteKey()) return false;
  return kennenlernenBegonnen() && offeneMehrFragen().length > 0;
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

// Gewichte für Themen in den Rückblicken, abgeleitet aus dem Wunsch, dem Schlaf und den vertiefenden Fragen.
export function themenGewichte() {
  const regeln = inhalt('fragenRegeln', {});
  const gewichte = {};
  for (const frage of eingangsfragen()) {
    const punkte = frage.id === 'wunsch' ? regeln.themaGewichtWunsch ?? 2 : regeln.themaGewichtVertiefung ?? 1;
    for (const [option, themen] of Object.entries(frage.themen || {})) {
      if (hat(frage.id, option)) for (const thema of themen) gewichte[thema] = (gewichte[thema] || 0) + punkte;
    }
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

// Die nächste Frage zum Vertiefen, die noch nie gestellt wurde. Höchstens eine pro Rückblick, mit Abstand.
export function naechsteVertiefung(rueckblickNummer) {
  const regeln = inhalt('fragenRegeln', {});
  if (rueckblickNummer < (regeln.vertiefungAbRueckblick ?? 2)) return null;
  const p = profil();
  const gestellt = mehrFragen().flatMap((f) => p.nachgefragt?.[f.id] || []);
  if (gestellt.length && rueckblickNummer - Math.max(...gestellt) <= (regeln.vertiefungAbstand ?? 1)) return null;
  return mehrFragen().find((f) => !p.status[f.id] && !(p.nachgefragt?.[f.id] || []).length && !(f.nurMitKaffee && ohneKaffee())) || null;
}

export function merkeNachfrage(frageId, rueckblickNummer) {
  aendere('profil', (p) => {
    p.nachgefragt ||= {};
    const liste = p.nachgefragt[frageId] || [];
    if (!liste.includes(rueckblickNummer)) p.nachgefragt[frageId] = [...liste, rueckblickNummer];
  }, {});
}
