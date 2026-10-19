// Export der Einträge als CSV oder JSON, damit sie für eine Monatsauswertung gelesen werden können.
// Der Export entsteht direkt auf dem Gerät und funktioniert deshalb auch ohne Netz.

import { alleTage, freudeListe, freudeNach, experiment, einstellungen, regalStand } from './daten.js';
import { schluesselMit, lies } from './speicher.js';
import { herunterladen, datumKey } from './util.js';
import { gesamt } from './belohnung.js';

export function verfuegbareMonate() {
  const monate = new Set(alleTage().map((tg) => tg.datum.slice(0, 7)));
  return [...monate].sort().reverse();
}

function tageIm(monat) {
  return alleTage().filter((tg) => !monat || tg.datum.startsWith(monat));
}

function feld(wert) {
  const text = wert === null || wert === undefined ? '' : String(wert);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const komma = (n) => (typeof n === 'number' ? String(n).replace('.', ',') : '');

export function exportiereCsv(monat = '') {
  const kopf = ['datum', 'gewicht_kg', 'einschlafzeit', 'schlafdauer_h', 'anspannung_1_bis_5', 'summen', 'summen_anzahl', 'summen_uhrzeiten', 'pausen', 'freude_plaetze', 'freude_genutzt', 'satz'];
  const zeilen = tageIm(monat).map((tg) => [
    tg.datum,
    komma(tg.gewicht),
    tg.einschlafzeit || '',
    komma(tg.schlafdauer),
    tg.anspannung || '',
    (tg.summen || []).length ? 'ja' : 'nein',
    (tg.summen || []).length,
    (tg.summen || []).join(' '),
    tg.pausen || 0,
    (tg.freudePlaetze || []).map((id) => freudeNach(id)?.titel || id).join(', '),
    (tg.freudeGenutzt || []).map((id) => freudeNach(id)?.titel || id).join(', '),
    tg.satz || '',
  ]);
  const csv = '﻿' + [kopf, ...zeilen].map((z) => z.map(feld).join(';')).join('\r\n');
  herunterladen(`emona-${monat || 'alle'}-${datumKey()}.csv`, csv, 'text/csv;charset=utf-8');
}

export function exportiereJson(monat = '') {
  const experimente = {};
  for (const k of schluesselMit('experiment:')) {
    const m = k.slice(11);
    if (!monat || m === monat) experimente[m] = lies(k);
  }
  if (monat && !experimente[monat]) experimente[monat] = experiment(monat);
  const daten = {
    exportiert: new Date().toISOString(),
    zeitraum: monat || 'alle',
    hinweis: 'Tage beginnen um 4 Uhr. Die Einschlafzeit steht am Morgen danach und gehört zur Nacht nach dem Vortag.',
    tage: tageIm(monat),
    experimente,
    freudeListe: freudeListe(),
    sammlung: { ...gesamt(), regal: regalStand(), erfolge: lies('erfolge', {}) },
    einstellungen: einstellungen(),
  };
  herunterladen(`emona-${monat || 'alle'}-${datumKey()}.json`, JSON.stringify(daten, null, 2), 'application/json');
}
