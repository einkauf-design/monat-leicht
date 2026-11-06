// KI-Begleitung (seit 1.8.0): Gespräch „Frag mich“ und Vorschlag für die nächste Woche im Rückblick.
//
// Ohne ausdrückliche Zustimmung (Dokument „begleitung“) geht nichts an den Server.
// Mit Zustimmung stellt die App einen kurzen Kontext aus Kennenlernen, Experiment und den letzten Einträgen zusammen.
// Das Gespräch liegt im Dokument „begleitung-chat“ und wird wie alles andere zwischen ihren Geräten abgeglichen.

import { lies, schreibe, aendere, api } from './speicher.js';
import { t } from './inhalte.js';
import {
  einstellungen, alleTage, beobachtungen, experimentJetzt, experimentTag, fruehereExperimente, heuteKey, hatEintrag,
} from './daten.js';
import { eingangsfragen, antwort, status, STATUS, profil, gesundheit, hatEinwilligung, gewichtSichtbar } from './profil.js';
import { rueckblicke, auswertung } from './rueckblick.js';
import { zahl } from './util.js';

const MAX_NACHRICHTEN = 80;

/* ---------- Zustimmung ---------- */

export function begleitungErlaubt() {
  return Boolean(lies('begleitung', null)?.einwilligung);
}

export function stimmeBegleitungZu() {
  schreibe('begleitung', { einwilligung: heuteKey() });
}

// Zurücknehmen löscht auch das bisherige Gespräch.
export function nimmBegleitungZurueck() {
  schreibe('begleitung', null);
  schreibe('begleitung-chat', null);
}

/* ---------- Status vom Server ---------- */

let statusCache = null;
export async function begleitungStatus(neu = false) {
  if (statusCache && !neu) return statusCache;
  try {
    statusCache = await api('ki_status');
  } catch {
    statusCache = { aktiv: false, offline: true };
  }
  return statusCache;
}

// Für die Startseite: Die Kachel „Frag mich etwas“ erscheint erst, wenn der Server die Begleitung eingeschaltet hat.
export function begleitungBekanntAktiv() {
  return Boolean(statusCache?.aktiv);
}

/* ---------- Gespräch ---------- */

export function gespraech() {
  return lies('begleitung-chat', { nachrichten: [] }).nachrichten || [];
}

function merke(rolle, text) {
  aendere('begleitung-chat', (doc) => {
    doc.nachrichten = [...(doc.nachrichten || []), { rolle, text, zeit: Date.now() }].slice(-MAX_NACHRICHTEN);
  }, { nachrichten: [] });
}

export async function frage(text) {
  const verlauf = gespraech().slice(-12).map(({ rolle, text: inhalt }) => ({ rolle, text: inhalt }));
  merke('ich', text);
  let ergebnis;
  try {
    ergebnis = await api('ki_chat', { einwilligung: begleitungErlaubt(), kontext: kontext(), verlauf, nachricht: text });
  } catch (fehler) {
    // Ohne Antwort bleibt ihre Nachricht im Eingabefeld statt im Gespräch.
    aendere('begleitung-chat', (doc) => { doc.nachrichten = (doc.nachrichten || []).slice(0, -1); }, { nachrichten: [] });
    throw fehler;
  }
  merke('ki', ergebnis.text);
  return ergebnis.text;
}

/* ---------- Vorschlag für die nächste Woche im Rückblick ---------- */

export async function wochenVorschlag(rb) {
  const a = auswertung(rb);
  const extra = [
    `Ihr ${rb.nummer}. Rückblick (${a.zeitraum})`,
    ...a.saetze,
    ...Object.values(rb.antworten || {}).filter(Boolean).map((x) => `Ihre Antwort im Rückblick: ${x}`),
  ].join('\n');
  const ergebnis = await api('ki_woche', { einwilligung: begleitungErlaubt(), kontext: `${kontext(rb.tage)}\n\nDiese Woche:\n${extra}` });
  aendere(`rueckblick:${rb.nummer}`, (doc) => {
    doc.vorschlag = { text: ergebnis.text, datum: heuteKey() };
  });
  return ergebnis.text;
}

/* ---------- Kontext ---------- */

function antwortText(frage) {
  const zustand = status(frage.id);
  if (zustand === STATUS.NICHT_SAGEN) return 'möchte sie nicht sagen';
  if (zustand === STATUS.NOCH_NICHT) return 'weiß sie noch nicht';
  const wert = antwort(frage.id);
  const liste = Array.isArray(wert) ? wert : wert ? [wert] : [];
  return liste.map((id) => frage.optionen?.find((o) => o.id === id)?.text).filter(Boolean).join(', ');
}

function tagZeile(d) {
  const teile = [];
  if (d.anspannung) teile.push(`Anspannung ${d.anspannung}/5`);
  if (d.einschlafzeit) teile.push(`eingeschlafen ${d.einschlafzeit}`);
  if (typeof d.schlafdauer === 'number') teile.push(`${zahl(d.schlafdauer, 1)} Std. Schlaf`);
  if (gewichtSichtbar() && typeof d.gewicht === 'number') teile.push(`Gewicht ${zahl(d.gewicht, 1)} kg`);
  if (typeof d.taille === 'number') teile.push(`Taille ${zahl(d.taille, 1)} cm`);
  if (d.offen) teile.push(`abends offen im Kopf ${d.offen}/5`);
  if ((d.summen || []).length) teile.push(`${d.summen.length}× Gedanken abgelegt`);
  if ((d.freudeGenutzt || []).length) teile.push(`${d.freudeGenutzt.length}× Freude`);
  if ((d.koerper || '').trim()) teile.push(`Körper: „${d.koerper.trim()}“`);
  if ((d.satz || '').trim()) teile.push(`Satz zum Tag: „${d.satz.trim()}“`);
  return teile.length ? `${d.datum}: ${teile.join('; ')}` : '';
}

export function kontext(tageAuswahl = null) {
  const zeilen = [];
  const name = einstellungen().name?.trim();
  zeilen.push(`Vorname: ${name || 'unbekannt'}. Heute ist ${heuteKey()}.`);

  const p = profil();
  const kennen = [];
  for (const frage of eingangsfragen()) {
    if (frage.gesundheit) continue;
    const text = antwortText(frage);
    const frei = (p.freitext?.[frage.id] || '').trim();
    if (!text && !frei) continue;
    kennen.push(`${frage.text} → ${text || '–'}${frei ? ` (eigene Worte: „${frei}“)` : ''}`);
  }
  if (hatEinwilligung()) {
    const g = gesundheit();
    const frage = eingangsfragen().find((f) => f.gesundheit);
    const liste = (g?.antworten || []).map((id) => frage?.optionen?.find((o) => o.id === id)?.text || id);
    if (liste.length) kennen.push(`Gesundheit (von ihr freigegeben): ${liste.join(', ')}`);
  }
  if (kennen.length) zeilen.push('', 'Aus dem Kennenlernen:', ...kennen);
  if (!gewichtSichtbar()) zeilen.push('', 'Wichtig: Sie möchte ihr Gewicht nicht sehen. Sprich Gewicht nicht an.');

  const v = experimentJetzt();
  if (v) {
    const stand = experimentTag(v);
    zeilen.push('', `Laufendes Experiment: „${v.titel}“${stand ? `, Tag ${stand.tag} von ${stand.von}` : ''}.`);
    if (v.erkenntnis?.text) zeilen.push(`Ihre Erkenntnis dazu: „${v.erkenntnis.text}“`);
  }
  const frueher = fruehereExperimente().filter((e) => e.erkenntnis?.text);
  if (frueher.length) {
    zeilen.push('', 'Was sie in früheren Experimenten herausgefunden hat:');
    for (const e of frueher.slice(-5)) zeilen.push(`„${e.titel}“: ${e.erkenntnis.text}`);
  }

  const menge = tageAuswahl ? new Set(tageAuswahl) : null;
  const tage = alleTage().filter(hatEintrag).filter((d) => !menge || menge.has(d.datum)).slice(-7);
  const tagZeilen = tage.map(tagZeile).filter(Boolean);
  if (tagZeilen.length) zeilen.push('', 'Ihre letzten Einträge:', ...tagZeilen);

  const beob = beobachtungen().slice(0, 5);
  if (beob.length) {
    zeilen.push('', 'Ihre letzten Beobachtungen im Tagebuch:');
    for (const b of beob) zeilen.push(`${b.datum}: „${b.text.slice(0, 400)}“`);
  }

  const letzter = rueckblicke().pop();
  if (letzter?.vorschlag?.text && !tageAuswahl) zeilen.push('', `Dein letzter Wochenvorschlag an sie (${letzter.vorschlag.datum}):`, letzter.vorschlag.text);

  return zeilen.join('\n');
}

export function fehlerText(fehler) {
  if (fehler?.message === 'offline') return t('begleitung.offline');
  return fehler?.message || t('begleitung.fehler');
}
