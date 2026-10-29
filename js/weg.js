// „Mein Weg“: was gerade läuft und was bisher passiert ist.
// Sammelt die Ereignisse aus Tagen, Experimenten, Beobachtungen, Rückblicken und kleinen Erfolgen.

import { t } from './inhalte.js';
import { alleTage, hatEintrag, experimentJetzt, fruehereExperimente, beobachtungen, eintragsTage, experimentTag } from './daten.js';
import { rueckblicke, ordnung, eintraegeBisRueckblick } from './rueckblick.js';
import { erreichteErfolge } from './belohnung.js';

// Reihenfolge an einem Tag: Neues zuerst, der Start der App ganz unten.
const RANG = { erkenntnis: 0, rueckblick: 1, erfolg: 2, beobachtung: 3, ende: 4, beginn: 5, start: 6 };

export function stand() {
  const v = experimentJetzt();
  return {
    experiment: v,
    tag: experimentTag(v),
    eintraege: eintragsTage().length,
    bisRueckblick: eintraegeBisRueckblick(),
  };
}

export function ereignisse() {
  const liste = [];
  const ersterTag = alleTage().find(hatEintrag)?.datum || eintragsTage()[0];
  if (ersterTag) liste.push({ art: 'start', datum: ersterTag, symbol: '🌱', titel: t('weg.ereignis_start') });

  const experimente = [...fruehereExperimente().map((e) => ({ ...e, vorbei: true })), ...(experimentJetzt() ? [experimentJetzt()] : [])];
  for (const e of experimente) {
    if (!e.start) continue;
    liste.push({ art: 'beginn', datum: e.start, symbol: '🧪', titel: t('weg.ereignis_beginn', { titel: e.titel }) });
    if (e.vorbei && e.ende) {
      liste.push({ art: 'ende', datum: e.ende, symbol: '🌿', titel: t('weg.ereignis_ende', { titel: e.titel }), text: e.erkenntnis?.text });
    } else if (e.erkenntnis?.text) {
      liste.push({ art: 'erkenntnis', datum: e.erkenntnis.datum, symbol: '💡', titel: t('weg.ereignis_erkenntnis', { titel: e.titel }), text: e.erkenntnis.text });
    }
  }

  for (const b of [...beobachtungen()].reverse()) {
    liste.push({ art: 'beobachtung', datum: b.datum, symbol: '✍️', titel: t('weg.ereignis_beobachtung'), text: b.text, kurz: true });
  }
  for (const rb of rueckblicke()) {
    if (!rb.erstellt) continue;
    liste.push({ art: 'rueckblick', datum: rb.erstellt, symbol: '✨', titel: t('weg.ereignis_rueckblick', { ordnung: ordnung(rb.nummer) }), link: `#rueckblick/${rb.nummer}` });
  }
  for (const e of [...erreichteErfolge()].reverse()) {
    liste.push({ art: 'erfolg', datum: e.datum, symbol: e.symbol || '⭐', titel: e.titel });
  }

  // Alles wurde in zeitlicher Reihenfolge gesammelt. Bei gleichem Tag und gleicher Art steht das Spätere oben.
  return liste
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => (a.datum !== b.datum ? (a.datum < b.datum ? 1 : -1) : RANG[a.art] - RANG[b.art] || b.i - a.i));
}
