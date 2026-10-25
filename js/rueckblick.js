// Rückblicke: Immer wenn sieben neue Tage mit Eintrag zusammengekommen sind, entsteht ein Rückblick.
// Gezählt werden Tage mit Eintrag, nicht Kalendertage. Lücken werden nie bewertet.
// Gespeichert werden nur die sieben Tage, die gewählten Fragen und die Antworten.
// Die Beobachtungen werden jedes Mal frisch aus den Einträgen berechnet.

import { lies, schreibe, aendere, schluesselMit } from './speicher.js';
import { inhalt, t } from './inhalte.js';
import { tag, eintragsTage, beobachtungen, experiment, heuteKey, experimentJetzt, fruehereExperimente, experimentVorbei, aendereExperiment } from './daten.js';
import { profilSignale, ohneKaffee, themenGewichte, gewichtSichtbar, eingangsfragen, nachfrageMoeglich, merkeNachfrage } from './profil.js';
import { mittelwert, einschlafMinuten, minutenZuZeit, zahl, plusTage, ausKey } from './util.js';

const PRO_RUECKBLICK = 7;

/* ---------- Lesen ---------- */

export function rueckblicke() {
  return schluesselMit('rueckblick:')
    .map((k) => lies(k))
    .filter((r) => r && r.nummer)
    .sort((a, b) => a.nummer - b.nummer);
}

export function rueckblick(nummer) {
  return lies(`rueckblick:${nummer}`, null);
}

export function ungelesenerRueckblick() {
  return rueckblicke().filter((r) => !r.gelesen).pop() || null;
}

export function markiereGelesen(nummer) {
  const r = rueckblick(nummer);
  if (r && !r.gelesen) aendere(`rueckblick:${nummer}`, (doc) => { doc.gelesen = true; });
}

export function speichereAntworten(nummer, antworten) {
  aendere(`rueckblick:${nummer}`, (doc) => {
    doc.antworten = { ...(doc.antworten || {}), ...antworten };
    for (const [id, text] of Object.entries(doc.antworten)) if (!text) delete doc.antworten[id];
  });
}

export function ordnung(nummer) {
  return inhalt('texte.rueckblick.ordnungszahlen', [])[nummer - 1] || t('rueckblick.ordnung_ersatz', { nummer });
}

export function datumKurz(key) {
  const d = ausKey(key);
  return `${d.getDate()}. ${inhalt('texte.allgemein.monate')[d.getMonth()]}`;
}

/* ---------- Entstehen ---------- */

// Prüft, ob genug neue Tage mit Eintrag da sind, und legt dann einen oder mehrere Rückblicke an.
// Liegen schon viele Einträge vor, werden alle bis auf den neuesten als gelesen markiert.
export function pruefeRueckblicke() {
  const vorhanden = rueckblicke();
  const vergeben = new Set(vorhanden.flatMap((r) => r.tage || []));
  let offen = eintragsTage().filter((d) => !vergeben.has(d));
  let nummer = vorhanden.reduce((m, r) => Math.max(m, r.nummer), 0);
  const neu = [];
  while (offen.length >= PRO_RUECKBLICK) {
    nummer += 1;
    const tage = offen.slice(0, PRO_RUECKBLICK);
    offen = offen.slice(PRO_RUECKBLICK);
    const doc = {
      nummer,
      tage,
      erstellt: heuteKey(),
      fragen: waehleFragen(nummer, tage, [...vorhanden, ...neu]),
      antworten: {},
      gelesen: false,
    };
    neu.push(doc);
  }
  // Ist das Experiment einen Monat gelaufen, fragt der neueste Rückblick, was sie behalten möchte.
  const letzter = neu[neu.length - 1];
  const versuch = experimentJetzt();
  if (letzter && versuch && experimentVorbei(versuch) && !versuch.rueckblickNummer) {
    const frage = { id: 'experiment-behalten', typ: 'experiment', text: t('experimentwahl.behalten_frage', { titel: versuch.titel }) };
    if (letzter.fragen.length >= 3) letzter.fragen[letzter.fragen.length - 1] = frage;
    else letzter.fragen.push(frage);
    letzter.experimentEnde = { id: versuch.id, titel: versuch.titel };
    aendereExperiment((v) => { v.rueckblickNummer = letzter.nummer; });
  }
  neu.forEach((doc, i) => {
    if (i < neu.length - 1) doc.gelesen = true;
    for (const f of doc.fragen) if (f.typ === 'eingang') merkeNachfrage(f.eingangsfrage, doc.nummer);
    schreibe(`rueckblick:${doc.nummer}`, doc);
  });
  return neu;
}

/* ---------- Kennzahlen eines Zeitraums ---------- */

export function kennzahlen(tageListe) {
  const daten = tageListe.map((d) => ({ datum: d, ...tag(d) }));
  const menge = new Set(tageListe);
  const anspannung = daten.map((x) => x.anspannung).filter(Boolean);

  // Anspannung eines Tages und die Einschlafzeit der folgenden Nacht.
  const paare = daten
    .filter((x) => x.anspannung)
    .map((x) => ({ anspannung: x.anspannung, minuten: einschlafMinuten(tag(plusTage(x.datum, 1)).einschlafzeit) }))
    .filter((p) => p.minuten !== null);
  const leichter = paare.filter((p) => p.anspannung <= 2).map((p) => p.minuten);
  const angespannter = paare.filter((p) => p.anspannung >= 4).map((p) => p.minuten);

  const summenTage = daten.filter((x) => (x.summen || []).length).length;
  const beob = beobachtungen().filter((b) => menge.has(b.datum));
  const taillen = daten.filter((x) => typeof x.taille === 'number');

  return {
    anzahlTage: tageListe.length,
    anspannung: mittelwert(anspannung),
    anspannungMin: anspannung.length ? Math.min(...anspannung) : null,
    anspannungMax: anspannung.length ? Math.max(...anspannung) : null,
    anspannungWerte: anspannung.length,
    einschlaf: mittelwert(daten.map((x) => einschlafMinuten(x.einschlafzeit))),
    einschlafLeichter: leichter.length >= 2 ? mittelwert(leichter) : null,
    einschlafAngespannter: angespannter.length >= 2 ? mittelwert(angespannter) : null,
    schlaf: mittelwert(daten.map((x) => x.schlafdauer)),
    summenTage,
    summenAnzahl: daten.reduce((s, x) => s + (x.summen || []).length, 0),
    pausen: daten.reduce((s, x) => s + (x.pausen || 0), 0),
    gewicht: mittelwert(daten.map((x) => x.gewicht)),
    taille: taillen.length ? taillen[taillen.length - 1].taille : null,
    freude: daten.reduce((s, x) => s + (x.freudeGenutzt || []).length, 0),
    koerper: daten.filter((x) => (x.koerper || '').trim()).map((x) => ({ datum: x.datum, text: x.koerper.trim() })),
    beobachtungen: beob,
  };
}

/* ---------- Beobachtungen in Worten ---------- */

export function auswertung(rb) {
  const tage = [...(rb.tage || [])].sort();
  const k = kennzahlen(tage);
  const von = tage[0];
  const bis = tage[tage.length - 1];
  const spanne = Math.round((ausKey(bis) - ausKey(von)) / 86400000) + 1;
  const zeitraum =
    spanne === tage.length
      ? t('rueckblick.zeitraum_folge', { von: datumKurz(von), bis: datumKurz(bis) })
      : t('rueckblick.zeitraum', { von: datumKurz(von), bis: datumKurz(bis), tage: spanne });

  const saetze = [];
  if (k.anspannung !== null) {
    let satz = t('rueckblick.anspannung_schnitt', { wert: zahl(k.anspannung, 1) });
    const vorher = rueckblick(rb.nummer - 1);
    const alt = vorher ? kennzahlen(vorher.tage || []).anspannung : null;
    if (alt !== null) satz += ` ${t('rueckblick.anspannung_vorher', { alt: zahl(alt, 1) })}`;
    if (k.anspannungWerte >= 3) {
      satz += ` ${k.anspannungMax - k.anspannungMin >= 2 ? t('rueckblick.anspannung_spanne') : t('rueckblick.anspannung_aehnlich')}`;
    }
    saetze.push(satz);
  }
  if (k.einschlaf !== null) {
    let satz = t('rueckblick.einschlaf_schnitt', { zeit: minutenZuZeit(k.einschlaf) });
    if (k.einschlafLeichter !== null && k.einschlafAngespannter !== null) {
      satz += k.einschlafAngespannter - k.einschlafLeichter >= 20
        ? ` ${t('rueckblick.einschlaf_spaeter', { spaet: minutenZuZeit(k.einschlafAngespannter), frueh: minutenZuZeit(k.einschlafLeichter) })}`
        : ` ${t('rueckblick.einschlaf_gleich')}`;
    }
    saetze.push(satz);
  }
  if (k.schlaf !== null) {
    saetze.push(t('rueckblick.schlaf_schnitt', { wert: zahl(Math.round(k.schlaf * 2) / 2, 1).replace(/,0$/, '') }));
  }
  {
    let satz = k.summenTage === 0
      ? t('rueckblick.summen_keins')
      : k.summenTage === 1 && k.summenAnzahl === 1
        ? t('rueckblick.summen_ein_tag')
        : t('rueckblick.summen_tage', { tage: k.summenTage, anzahl: k.summenAnzahl });
    if (k.pausen) satz += ` ${k.pausen === 1 ? t('rueckblick.pausen_eins') : t('rueckblick.pausen', { anzahl: k.pausen })}`;
    saetze.push(satz);
  }
  if (k.freude) saetze.push(k.freude === 1 ? t('rueckblick.freude_eins') : t('rueckblick.freude', { anzahl: k.freude }));
  if (k.gewicht !== null && gewichtSichtbar()) saetze.push(`${t('rueckblick.gewicht', { wert: zahl(k.gewicht, 1) })} ${t('rueckblick.gewicht_hinweis')}`);
  if (k.taille !== null) saetze.push(t('rueckblick.taille', { wert: zahl(k.taille, 1).replace(/,0$/, '') }));
  if (k.beobachtungen.length) {
    let satz = k.beobachtungen.length === 1
      ? t('rueckblick.experiment_eins')
      : t('rueckblick.experiment', { anzahl: k.beobachtungen.length });
    const letzte = k.beobachtungen[0].text;
    const kurz = letzte.length > 160 ? `${letzte.slice(0, 157).trim()} …` : letzte;
    satz += ` ${t('rueckblick.experiment_zitat', { text: kurz })}`;
    saetze.push(satz);
  }
  const wenig = k.anspannung === null && k.einschlaf === null && k.schlaf === null && k.gewicht === null;
  return { zeitraum, saetze, koerper: k.koerper, wenig };
}

/* ---------- Signale aus eigenen Worten ---------- */

// Sucht in Antworten, Beobachtungen und Körper-Notizen nach Signalwörtern aus der Inhaltsdatei.
export function signale(bisNummer = Infinity) {
  const texte = [];
  for (const r of rueckblicke()) if (r.nummer < bisNummer) texte.push(...Object.values(r.antworten || {}));
  for (const b of beobachtungen()) texte.push(b.text);
  for (const k of schluesselMit('tag:')) {
    const notiz = lies(k, {}).koerper;
    if (notiz) texte.push(notiz);
  }
  const alles = texte.join(' \n ').toLowerCase();
  const gefunden = profilSignale();
  for (const [name, woerter] of Object.entries(inhalt('signale', {}))) {
    if (name.startsWith('_') || !Array.isArray(woerter)) continue;
    if (woerter.some((w) => alles.includes(w.toLowerCase()))) gefunden.add(name);
  }
  return gefunden;
}

/* ---------- Fragen auswählen ---------- */

const STUFEN = ['hineinfinden', 'wahrnehmen', 'vertiefen'];

// Kleine, gleichbleibende Zufallszahl pro Rückblick und Frage, damit die Auswahl abwechslungsreich ist.
function streuung(nummer, id) {
  let h = 2166136261;
  for (const z of `${nummer}:${id}`) h = Math.imul(h ^ z.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function passt(bed, kontext) {
  let treffer = 0;
  let signal = false;
  for (const [art, wert] of Object.entries(bed || {})) {
    switch (art) {
      case 'nurErsterRueckblick':
        if (kontext.nummer !== 1) return null;
        break;
      case 'abRueckblick':
        if (kontext.nummer < wert) return null;
        break;
      case 'experimentEnthaelt':
        if (!kontext.experimente.some((titel) => titel.includes(String(wert).toLowerCase()))) return null;
        break;
      case 'anspannungAb':
        if (kontext.k.anspannung === null || kontext.k.anspannung < wert) return null;
        break;
      case 'anspannungBis':
        if (kontext.k.anspannung === null || kontext.k.anspannung > wert) return null;
        break;
      case 'einschlafenNach':
        if (kontext.k.einschlaf === null || kontext.k.einschlaf <= einschlafMinuten(wert)) return null;
        break;
      case 'schlafUnter':
        if (kontext.k.schlaf === null || kontext.k.schlaf >= wert) return null;
        break;
      case 'summenTageAb':
        if (kontext.k.summenTage < wert) return null;
        break;
      case 'freudeAb':
        if (kontext.k.freude < wert) return null;
        break;
      case 'freudeBis':
        if (kontext.k.freude > wert) return null;
        break;
      case 'signal':
        if (!kontext.signale.has(wert)) return null;
        signal = true;
        break;
      case 'ohneSignal':
        if (kontext.signale.has(wert)) return null;
        break;
      case 'nachAntwortAuf':
        if (!kontext.beantwortet.has(wert)) return null;
        signal = true;
        break;
      case 'koerperNotizen':
        if (!kontext.koerperNotizen) return null;
        break;
      case 'eingangOffen':
        // Nachfragen zu offenen Eingangsfragen wählt die App gesondert aus.
        return null;
      default:
        return null; // Unbekannte Bedingungen lieber auslassen.
    }
    treffer += 1;
  }
  return { treffer, signal };
}

export function stufeFuer(nummer, antwortenBisher) {
  const r = inhalt('fragenRegeln', {});
  if (nummer < (r.stufeWahrnehmenAbRueckblick ?? 2)) return 1;
  if (nummer >= (r.stufeVertiefenAbRueckblick ?? 4) && antwortenBisher >= (r.stufeVertiefenAbAntworten ?? 4)) return 3;
  return 2;
}

export function waehleFragen(nummer, tage, frueher = rueckblicke()) {
  const regeln = inhalt('fragenRegeln', {});
  const k = kennzahlen(tage);
  const vorher = frueher.filter((r) => r.nummer < nummer);
  const beantwortet = new Set();
  let antwortenBisher = 0;
  const gestellt = {};
  for (const r of vorher) {
    for (const f of r.fragen || []) (gestellt[f.id] ||= []).push(r.nummer);
    for (const [id, text] of Object.entries(r.antworten || {})) {
      if ((text || '').trim()) {
        beantwortet.add(id);
        antwortenBisher += 1;
      }
    }
  }
  const monate = new Set(tage.map((d) => d.slice(0, 7)));
  monate.add(heuteKey().slice(0, 7));
  const kontext = {
    nummer,
    k,
    signale: signale(nummer),
    beantwortet,
    experimente: experimentTitel(tage),
    koerperNotizen: schluesselMit('tag:').some((key) => (lies(key, {}).koerper || '').trim()),
  };
  const stufe = stufeFuer(nummer, antwortenBisher);
  const pause = regeln.pauseNachFrage ?? 2;
  const gewichte = themenGewichte();
  const keinKaffee = ohneKaffee();

  const kandidaten = [];
  for (const frage of inhalt('fragen', [])) {
    const s = STUFEN.indexOf(frage.stufe) + 1;
    if (!s || s > stufe || frage.typ === 'eingang') continue;
    if (keinKaffee && frage.thema === 'kaffee') continue;
    if ((gestellt[frage.id] || []).some((n) => nummer - n <= pause)) continue;
    const p = passt(frage.bedingungen, kontext);
    if (!p) continue;
    let wert = streuung(nummer, frage.id) * 1.5;
    if (s === stufe) wert += 3;
    else if (s === stufe - 1) wert += 1;
    else wert -= 1;
    wert += p.treffer * 1.5;
    if (p.signal) wert += 4;
    if (nummer === 1 && frage.thema === 'kaffee' && frage.bedingungen?.experimentEnthaelt) wert += 4;
    wert += gewichte[frage.thema] || 0;
    // Schon gestellte Fragen treten zurück, dürfen nach einer Weile aber wiederkommen.
    wert -= (gestellt[frage.id] || []).length * 2;
    if (beantwortet.has(frage.id)) wert -= 2;
    kandidaten.push({ frage, wert });
  }
  kandidaten.sort((a, b) => b.wert - a.wert);

  const anzahl = nummer === 1 ? regeln.anzahlErsterRueckblick ?? 2 : regeln.anzahlSpaeter ?? 3;
  const gewaehlt = [];
  const themen = new Set();
  for (const { frage } of kandidaten) {
    if (gewaehlt.length >= anzahl) break;
    if (themen.has(frage.thema)) continue;
    gewaehlt.push(frage);
    themen.add(frage.thema);
  }
  for (const { frage } of kandidaten) {
    if (gewaehlt.length >= anzahl) break;
    if (!gewaehlt.includes(frage)) gewaehlt.push(frage);
  }
  const ergebnis = gewaehlt.map((f) => ({ id: f.id, text: f.text, stufe: f.stufe, thema: f.thema }));

  // Höchstens eine offene Eingangsfrage pro Rückblick, sie nimmt den letzten Platz ein.
  const offen = eingangsfragen().find((f) => nachfrageMoeglich(f.nummer, nummer, kontext.signale));
  if (offen && (regeln.nachfrageProRueckblick ?? 1) > 0) {
    const frage = { id: `e-${offen.id}`, text: offen.nachfrage, typ: 'eingang', eingangsfrage: offen.id, thema: 'eingang' };
    if (ergebnis.length >= anzahl) ergebnis[ergebnis.length - 1] = frage;
    else ergebnis.push(frage);
  }
  return ergebnis;
}

// Titel aller Experimente, die im Zeitraum eines Rückblicks liefen, klein geschrieben.
function experimentTitel(tage) {
  const titel = new Set();
  const jetzt = experimentJetzt();
  if (jetzt) titel.add(jetzt.titel);
  const von = [...tage].sort()[0];
  for (const v of fruehereExperimente()) if (!von || v.ende >= von) titel.add(v.titel);
  if (!jetzt) {
    const monate = new Set(tage.map((d) => d.slice(0, 7)));
    monate.add(heuteKey().slice(0, 7));
    for (const m of monate) titel.add(experiment(m).titel);
  }
  return [...titel].filter(Boolean).map((x) => x.toLowerCase());
}

export function frageText(frage) {
  return inhalt('fragen', []).find((f) => f.id === frage.id)?.text || frage.text;
}

export function antwortenGesamt() {
  return rueckblicke().reduce((s, r) => s + Object.values(r.antworten || {}).filter((x) => (x || '').trim()).length, 0);
}

