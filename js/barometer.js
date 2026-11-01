// Körper-Barometer: „Wie fühlen sich deine Schultern gerade an?“ (1 ganz weich bis 5 hart wie ein Brett).
//
// Jeder Eintrag ist ein eigenes Dokument „barometer:<datum>-<id>“ und gehört immer zum laufenden Experiment
// („experiment“ = Kennung und Startdatum), ohne Experiment steht dort null. So bekommt jedes Experiment
// das Barometer von selbst. Der Wert am Abend ersetzt die frühere Frage „Wie war dein Tag?“ und landet
// deshalb zusätzlich im Tag als „anspannung“. So laufen alle bisherigen Diagramme und Rückblicke weiter.

import { lies, schreibe, schluesselMit } from './speicher.js';
import { inhalt } from './inhalte.js';
import { heuteKey, experimentJetzt, einstellungen, aendereTag, tag } from './daten.js';
import { neueId, jetztZeit, plusTage, mittelwert, zeitZuMinuten } from './util.js';

export const ORTE = ['kiefer', 'nacken', 'atem', 'bauch', 'haende', 'nirgends'];

// Ein Experiment wird an Kennung und Startdatum erkannt, weil sich Kennungen wiederholen können.
export function experimentSchluessel(v = experimentJetzt()) {
  return v?.id && v?.start ? `${v.id}@${v.start}` : null;
}

export function eintraege() {
  return schluesselMit('barometer:')
    .map((k) => ({ schluessel: k, ...lies(k, {}) }))
    .filter((e) => e.stufe >= 1 && e.stufe <= 5)
    .sort((a, b) => (a.datum + a.zeit < b.datum + b.zeit ? -1 : 1));
}

export function eintraegeAm(datum = heuteKey()) {
  return eintraege().filter((e) => e.datum === datum);
}

// Speichert einen neuen Eintrag oder ergänzt einen bestehenden (zum Beispiel die Orte auf der zweiten Seite).
export function speichereBarometer({ schluessel, stufe, orte = [], anlass = 'frei', experiment }) {
  const key = schluessel || `barometer:${heuteKey()}-${neueId()}`;
  const alt = lies(key, null);
  const eintrag = {
    datum: alt?.datum || heuteKey(),
    zeit: alt?.zeit || jetztZeit(),
    stufe,
    orte: orte.filter((o) => ORTE.includes(o)),
    anlass: alt?.anlass || anlass,
    experiment: alt ? alt.experiment : experiment !== undefined ? experiment : experimentSchluessel(),
  };
  schreibe(key, eintrag);
  // Am Abend ersetzt das Barometer die frühere Anspannungsfrage.
  if (eintrag.anlass === 'abend') aendereTag(eintrag.datum, (t) => { t.anspannung = stufe; });
  return key;
}

/* ---------- Experimente ---------- */

export function fuerExperiment(v) {
  const k = experimentSchluessel(v);
  return k ? eintraege().filter((e) => e.experiment === k) : [];
}

// Der Ausgangspunkt und die letzten Tage eines Experiments, zum ruhigen Nebeneinanderstellen.
export function experimentVerlauf(v, tage = 7) {
  const liste = fuerExperiment(v);
  if (!liste.length) return null;
  const anfang = liste.find((e) => e.anlass === 'start') || liste[0];
  const ab = plusTage(heuteKey(), -(tage - 1));
  const letzte = liste.filter((e) => e !== anfang && e.datum >= ab).reverse().slice(0, 3);
  return { anfang, letzte };
}

/* ---------- Tageszeiten und Muster ---------- */

const ZEITEN = ['morgen', 'mittag', 'nachmittag', 'abend'];

export function tageszeitVon(zeit) {
  const m = zeitZuMinuten(zeit);
  if (m >= 4 * 60 && m < 11 * 60) return 'morgen';
  if (m >= 11 * 60 && m < 14 * 60) return 'mittag';
  if (m >= 14 * 60 && m < 18 * 60) return 'nachmittag';
  return 'abend';
}

// Pro Tageszeit: an wie vielen Tagen der letzten zwei Wochen gefragt wurde und wie oft es Stufe 4 oder 5 war.
export function muster(tage = 14) {
  const ab = plusTage(heuteKey(), -(tage - 1));
  const proZeit = Object.fromEntries(ZEITEN.map((z) => [z, {}]));
  for (const e of eintraege().filter((x) => x.datum >= ab)) {
    const z = tageszeitVon(e.zeit);
    proZeit[z][e.datum] = Math.max(proZeit[z][e.datum] || 0, e.stufe);
  }
  return ZEITEN.map((zeit) => {
    const werte = Object.values(proZeit[zeit]);
    return { zeit, tage: werte.length, fest: werte.filter((w) => w >= 4).length };
  }).filter((m) => m.tage >= 3);
}

// Ein Satz für den Rückblick, nur wenn sich ein deutlicher Unterschied zeigt. Sonst lieber nichts.
export function lockersterMoment(tageListe) {
  const menge = new Set(tageListe);
  const liste = eintraege().filter((e) => menge.has(e.datum));
  if (liste.length < 7) return null;
  const kandidaten = [];
  const nachZeit = ZEITEN.map((z) => ({ art: 'zeit', wert: z, werte: liste.filter((e) => tageszeitVon(e.zeit) === z).map((e) => e.stufe) }))
    .filter((g) => g.werte.length >= 2)
    .map((g) => ({ ...g, mittel: mittelwert(g.werte) }))
    .sort((a, b) => a.mittel - b.mittel);
  if (nachZeit.length >= 2 && nachZeit[1].mittel - nachZeit[0].mittel >= 1) kandidaten.push({ ...nachZeit[0], abstand: nachZeit[1].mittel - nachZeit[0].mittel });
  const mitFreude = liste.filter((e) => (tag(e.datum).freudeGenutzt || []).length).map((e) => e.stufe);
  const ohneFreude = liste.filter((e) => !(tag(e.datum).freudeGenutzt || []).length).map((e) => e.stufe);
  if (mitFreude.length >= 3 && ohneFreude.length >= 3 && mittelwert(ohneFreude) - mittelwert(mitFreude) >= 1) {
    kandidaten.push({ art: 'freude', abstand: mittelwert(ohneFreude) - mittelwert(mitFreude) });
  }
  return kandidaten.sort((a, b) => b.abstand - a.abstand)[0] || null;
}

/* ---------- Erinnerungen ---------- */

export function barometerZeiten() {
  const e = einstellungen();
  return (e.barometerZeiten || []).filter((z) => /^\d{1,2}:\d{2}$/.test(z || ''));
}

// Die letzte eingestellte Zeit von heute, die schon vorbei ist und nach der noch niemand gefragt hat.
export function faelligeErinnerung(jetzt = jetztZeit()) {
  if (!einstellungen().barometerAn) return null;
  const vorbei = barometerZeiten().filter((z) => zeitZuMinuten(z) <= zeitZuMinuten(jetzt)).sort();
  const letzte = vorbei[vorbei.length - 1];
  if (!letzte) return null;
  const danach = eintraegeAm().some((e) => zeitZuMinuten(e.zeit) >= zeitZuMinuten(letzte));
  return danach ? null : letzte;
}

export function stufenTexte() {
  return inhalt('texte.barometer.stufen', []);
}
