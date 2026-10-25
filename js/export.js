// Export der Einträge als CSV oder JSON, damit sie für eine Monatsauswertung gelesen werden können.
// Der Export entsteht direkt auf dem Gerät und funktioniert deshalb auch ohne Netz.

import { alleTage, freudeListe, freudeNach, experiment, einstellungen, regalStand, beobachtungen } from './daten.js';
import { rueckblicke, frageText } from './rueckblick.js';
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
  const kopf = ['datum', 'gewicht_kg', 'taille_cm', 'einschlafzeit', 'schlafdauer_h', 'anspannung_1_bis_5', 'summen', 'summen_anzahl', 'summen_uhrzeiten', 'pausen', 'freude_plaetze', 'freude_genutzt', 'satz', 'koerper', 'beobachtungen'];
  const beob = beobachtungen();
  // Auch Tage, an denen nur eine Beobachtung notiert wurde, bekommen eine Zeile.
  const nachDatum = Object.fromEntries(tageIm(monat).map((tg) => [tg.datum, tg]));
  for (const b of beob) if ((!monat || b.datum.startsWith(monat)) && !nachDatum[b.datum]) nachDatum[b.datum] = { datum: b.datum };
  const zeilen = Object.values(nachDatum).sort((a, b) => (a.datum < b.datum ? -1 : 1)).map((tg) => [
    tg.datum,
    komma(tg.gewicht),
    komma(tg.taille),
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
    tg.koerper || '',
    beob.filter((b) => b.datum === tg.datum).reverse().map((b) => b.text).join(' | '),
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
    beobachtungen: beobachtungen()
      .filter((b) => !monat || b.datum.startsWith(monat))
      .map(({ datum, zeit, text, experiment: titel }) => ({ datum, zeit, text, experiment: titel }))
      .reverse(),
    rueckblicke: rueckblicke()
      .filter((r) => !monat || (r.tage || []).some((d) => d.startsWith(monat)))
      .map((r) => ({
        nummer: r.nummer,
        tage: r.tage,
        fragen: (r.fragen || []).map((f) => ({ id: f.id, frage: frageText(f), antwort: (r.antworten || {})[f.id] || '' })),
      })),
    experimente,
    freudeListe: freudeListe(),
    experimentAktuell: lies('versuch', null),
    fruehereExperimente: lies('versuche', []),
    angaben: lies('profil', null),
    gesundheit: lies('gesundheit', null),
    sammlung: { ...gesamt(), regal: regalStand(), spiele: lies('spiele', {}), erfolge: lies('erfolge', {}) },
    einstellungen: einstellungen(),
  };
  herunterladen(`emona-${monat || 'alle'}-${datumKey()}.json`, JSON.stringify(daten, null, 2), 'application/json');
}
