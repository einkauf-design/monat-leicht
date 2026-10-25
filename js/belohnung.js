// Sterne, Punkte und kleine Erfolge. Alles wird aus den Einträgen berechnet,
// damit nichts verloren gehen kann und nichts „abreißt“. Belohnt wird Zeit für dich, nie das Gewicht.

import { lies, schreibe, schluesselMit } from './speicher.js';
import { inhalt } from './inhalte.js';
import { alleTage, regalStand, beobachtungen } from './daten.js';
import { antwortenGesamt } from './rueckblick.js';
import { einschlafMinuten, datumKey } from './util.js';

export function statistik() {
  const tage = alleTage();
  let freudeGenutzt = 0;
  let pausen = 0;
  let abende = 0;
  for (const tag of tage) {
    freudeGenutzt += (tag.freudeGenutzt || []).length;
    pausen += tag.pausen || 0;
    if (tag.anspannung) abende += 1;
  }
  // Beobachtungen aus dem Tagebuch; alte Monatsnotizen zählen mit, bis sie übernommen sind.
  const alteNotizen = schluesselMit('experiment:').filter((k) => (lies(k, {}).notiz || '').trim()).length;
  const notizen = Math.max(beobachtungen().length, alteNotizen);
  const spiele = lies('spiele', {});
  const eigene = [lies('versuch', null), ...lies('versuche', [])].filter((v) => v && v.id === 'eigen').length;
  return { tage, freudeGenutzt, pausen, abende, notizen, antworten: antwortenGesamt(), regal: regalStand(), spiele, eigene };
}

export function gesamt(s = statistik()) {
  const b = inhalt('belohnungen', {});
  const erfolge = Object.keys(lies('erfolge', {})).length;
  return {
    sterne: s.regal.sterne + s.freudeGenutzt + erfolge + (s.spiele.wollfaeden?.sterne || 0) + (s.spiele.bildpaare?.sterne || 0),
    punkte:
      s.regal.punkte +
      (s.spiele.wollfaeden?.punkte || 0) +
      (s.spiele.bildpaare?.punkte || 0) +
      s.freudeGenutzt * (b.punkteFreudePlatz ?? 10) +
      s.pausen * (b.punktePause ?? 5) +
      s.abende * (b.punkteAbend ?? 5),
  };
}

function fortschritt(erfolg, s) {
  switch (erfolg.art) {
    case 'fruehEingeschlafen': {
      const grenze = einschlafMinuten(erfolg.grenze);
      return s.tage.filter((tag) => tag.einschlafzeit && einschlafMinuten(tag.einschlafzeit) < grenze).length;
    }
    case 'langGeschlafen':
      return s.tage.filter((tag) => (tag.schlafdauer || 0) >= erfolg.stunden).length;
    case 'freudeGenutzt':
      return s.freudeGenutzt;
    case 'wollfaeden':
      return s.spiele.wollfaeden?.geloest || 0;
    case 'bildpaare':
      return s.spiele.bildpaare?.geloest || 0;
    case 'eigenesExperiment':
      return s.eigene;
    case 'pausen':
      return s.pausen;
    case 'abende':
      return s.abende;
    case 'regale':
      return s.regal.regale;
    case 'experimentNotiz':
      return s.notizen;
    case 'rueckblickAntwort':
      return s.antworten;
    default:
      return 0;
  }
}

// Prüft, ob neue kleine Erfolge erreicht sind, speichert sie und gibt die neuen zurück.
export function pruefeErfolge() {
  const s = statistik();
  const erreicht = lies('erfolge', {});
  const neu = [];
  for (const erfolg of inhalt('erfolge', [])) {
    if (erreicht[erfolg.id]) continue;
    if (fortschritt(erfolg, s) >= erfolg.anzahl) {
      erreicht[erfolg.id] = datumKey();
      neu.push(erfolg);
    }
  }
  if (neu.length) schreibe('erfolge', erreicht);
  return neu;
}

export function erreichteErfolge() {
  const erreicht = lies('erfolge', {});
  return inhalt('erfolge', [])
    .filter((e) => erreicht[e.id])
    .map((e) => ({ ...e, datum: erreicht[e.id] }))
    .sort((a, b) => (a.datum < b.datum ? 1 : -1));
}

export function offeneErfolgeAnzahl() {
  const erreicht = lies('erfolge', {});
  return inhalt('erfolge', []).filter((e) => !erreicht[e.id]).length;
}
