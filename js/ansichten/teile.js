// Gemeinsame Bausteine für mehrere Ansichten.

import { t, inhalt } from '../inhalte.js';
import { esc, ausKey, zahl, toast, zufall } from '../util.js';
import { infoKnopf } from '../info.js';
import { sprunghaft, sichtbareOptionen } from '../profil.js';

export function datumLang(key) {
  const d = ausKey(key);
  return `${inhalt('texte.allgemein.wochentage')[d.getDay()]}, ${d.getDate()}. ${inhalt('texte.allgemein.monate')[d.getMonth()]}`;
}

export function feldKopf(text, info, id = '') {
  return `<span class="feld-kopf"><span class="feld-name"${id ? ` id="${id}"` : ''}>${esc(text)}</span>${info ? infoKnopf(info) : ''}</span>`;
}

export function stundenText(wert) {
  return `${zahl(wert, 2).replace(/,?0+$/, '')} ${t('morgen.stunden')}`;
}

// Nach einem Eintrag: bei sprunghaftem Alltag ein kleines Lob, sonst die übliche Meldung.
export function bestaetige(text, symbol) {
  if (sprunghaft()) toast(zufall(inhalt('texte.lob.saetze', [text])), '💛');
  else if (text) toast(text, symbol);
}

// Wählt Zeilen aus einer Liste, die als Knöpfe dargestellt werden (Eingangsfragen, Nachfragen).
export function auswahlKnoepfe(frage, gewaehlt, aktion = 'option') {
  const liste = Array.isArray(gewaehlt) ? gewaehlt : gewaehlt ? [gewaehlt] : [];
  return sichtbareOptionen(frage)
    .map((o) => `<button type="button" class="auswahl" data-aktion="${aktion}" data-frage="${esc(frage.id)}" data-option="${esc(o.id)}" aria-pressed="${liste.includes(o.id)}">${esc(o.text)}</button>`)
    .join('');
}
