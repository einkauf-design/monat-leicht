// Die Seiten rund um das Körper-Barometer, an allen Stellen gleich:
// „Schultern runter“, das Barometer, „Wo spürst du es noch?“, Dank fürs Hinhören und der ruhige Vergleich am Ende eines Experiments.
// Eine Ansicht holt sich die Seiten mit schulternGruppen() und gibt Klicks an schulternAktion() weiter.

import { t, inhalt } from './inhalte.js';
import { esc } from './util.js';
import { infoKnopf } from './info.js';
import { ORTE, speichereBarometer, stufenTexte, experimentVerlauf } from './barometer.js';
import { experimentJetzt } from './daten.js';
import { datumKurz } from './rueckblick.js';

// Neuer Zustand für einen Durchgang. „sofort“ speichert beim Antippen, sonst sammelt der Zustand nur.
export function neuerZustand({ anlass = 'frei', sofort = true } = {}) {
  return { anlass, sofort, stufe: null, orte: [], schluessel: null };
}

// Ein schlichtes Bild: Kopf und Schultern, die mit jeder Stufe etwas höher und gerader werden.
function gesicht(stufe) {
  const y = 41 - stufe * 2;
  const augen = stufe <= 2
    ? '<path d="M17 18q2 2 4 0M27 18q2 2 4 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    : '<circle cx="19" cy="18" r="1.4" fill="currentColor"/><circle cx="29" cy="18" r="1.4" fill="currentColor"/>';
  const mund = ['M19 24q5 3 10 0', 'M19 24q5 2 10 0', 'M19 24.5h10', 'M19.5 24.5h9', 'M20 24.5l2-1 2 1 2-1 2 1'][stufe - 1];
  return `<svg class="barometer-gesicht" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M4 47Q7 ${y} 16 ${y}H32Q41 ${y} 44 47" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="24" cy="19" r="10" fill="var(--flaeche)" stroke="currentColor" stroke-width="1.6"/>
    ${augen}
    <path d="${mund}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// Ein Balken aus fünf Feldern, der sich von weich bis fest füllt. Eine Farbe, keine Bewertung.
function balken(stufe) {
  return `<span class="barometer-balken" aria-hidden="true">${[5, 4, 3, 2, 1].map((i) => `<span class="${i <= stufe ? 'voll' : ''}"></span>`).join('')}</span>`;
}

export function schulternGruppen(praefix, zustand) {
  const stufen = stufenTexte();
  return [
    {
      id: `${praefix}-runter`,
      bloecke: [
        `<h2>${esc(t('barometer.runter_titel'))}</h2>`,
        `<p>${esc(t('barometer.runter_text'))}</p>`,
        `<div class="atem-kreis-flaeche" aria-hidden="true"><div class="atem-kreis"></div></div>`,
        `<p class="leise klein">${esc(t('barometer.runter_hilfe'))}</p>`,
      ],
    },
    {
      // Jede Tippfläche ist ein eigener Block. Auf sehr kleinen Bildschirmen verteilen sie sich so auf zwei Seiten.
      id: `${praefix}-barometer`,
      huelle: `<div class="barometer-liste" role="radiogroup" aria-labelledby="${praefix}-frage"></div>`,
      bloecke: [
        `<h2 id="${praefix}-frage">${esc(t('barometer.frage'))} ${infoKnopf('barometer')}</h2>`,
        ...stufen.map((satz, i) => `
          <button type="button" class="barometer-stufe" role="radio" aria-checked="${zustand.stufe === i + 1}" data-aktion="barometer-stufe" data-wert="${i + 1}">
            ${gesicht(i + 1)}${balken(i + 1)}
            <span class="barometer-satz">${esc(satz)}</span>
          </button>`),
      ],
    },
    {
      id: `${praefix}-wo`,
      bloecke: [
        `<h2>${esc(t('barometer.wo_titel'))}</h2>`,
        `<p class="leise klein">${esc(t('barometer.wo_hilfe'))}</p>`,
        `<div class="auswahl-liste zweispaltig">${ORTE.map((o) => `
          <button type="button" class="auswahl" data-aktion="barometer-ort" data-ort="${o}" aria-pressed="${zustand.orte.includes(o)}">${esc(t(`barometer.orte.${o}`))}</button>`).join('')}</div>`,
        `<button type="button" class="knopf knopf-haupt" data-aktion="barometer-fertig">${esc(t('barometer.wo_fertig'))}</button>`,
      ],
    },
  ];
}

// Dank fürs Hinhören, nie fürs Ergebnis. Dazu, zu welchem Experiment der Eintrag gehört.
export function dankeGruppe(praefix, zustand, { zurueck = '#heute' } = {}) {
  const v = experimentJetzt();
  return {
    id: `${praefix}-danke`,
    bloecke: [
      `<div class="start-zeichen" aria-hidden="true">✦</div>`,
      `<h2>${esc(t('barometer.danke_titel'))}</h2>`,
      zustand.stufe >= 4 ? `<p>${esc(t('barometer.danke_viel'))}</p>` : '',
      `<p class="leise">${esc(t('barometer.danke_punkte'))}</p>`,
      v ? `<p>${esc(t('barometer.danke_experiment', { titel: v.titel }))}</p>` : `<p>${esc(t('barometer.danke_ohne'))}</p>`,
      `<div class="knopf-spalte eng">
        ${v ? '' : `<a class="knopf knopf-zweit" href="#experiment">${esc(t('barometer.experiment_waehlen'))}</a>`}
        <a class="knopf-text" href="${esc(zurueck)}">${esc(t('barometer.zurueck_heute'))}</a>
      </div>`,
    ],
  };
}

// Am Ende eines Experiments: Anfang und letzte Tage nebeneinander, ohne Pfeile und ohne Wertung.
export function vergleichGruppe(v) {
  const verlauf = v ? experimentVerlauf(v) : null;
  if (!verlauf) return null;
  const kurz = inhalt('texte.barometer.kurz', []);
  const karte = (e) => `<li class="vergleich-eintrag">${balken(e.stufe)}<span><span class="vergleich-datum">${esc(datumKurz(e.datum))}, ${esc(e.zeit)}</span><span>${esc(kurz[e.stufe - 1] || '')}</span></span></li>`;
  return {
    id: 'schultern-vergleich',
    bloecke: [
      `<h2>${esc(t('barometer.vergleich_titel'))}</h2>`,
      `<p class="leise klein">${esc(t('barometer.vergleich_text'))}</p>`,
      `<div class="vergleich">
        <div><p class="feld-name">${esc(t('barometer.vergleich_anfang'))}</p><ul class="vergleich-liste">${karte(verlauf.anfang)}</ul></div>
        <div><p class="feld-name">${esc(t('barometer.vergleich_letzte'))}</p>${verlauf.letzte.length
          ? `<ul class="vergleich-liste">${verlauf.letzte.map(karte).join('')}</ul>`
          : `<p class="leise klein">${esc(t('barometer.vergleich_keine'))}</p>`}</div>
      </div>`,
    ],
  };
}

// Verarbeitet einen Klick. Gibt zurück, was passiert ist: 'stufe', 'ort', 'fertig' oder null.
export function schulternAktion(ziel, zustand, wurzel) {
  const aktion = ziel.dataset.aktion;
  if (aktion === 'barometer-stufe') {
    zustand.stufe = Number(ziel.dataset.wert);
    wurzel.querySelectorAll('[data-aktion="barometer-stufe"]').forEach((b) => b.setAttribute('aria-checked', String(b === ziel)));
    if (zustand.sofort) zustand.schluessel = speichereBarometer(zustand);
    return 'stufe';
  }
  if (aktion === 'barometer-ort') {
    const ort = ziel.dataset.ort;
    if (zustand.orte.includes(ort)) zustand.orte = zustand.orte.filter((o) => o !== ort);
    else if (ort === 'nirgends') zustand.orte = ['nirgends'];
    else zustand.orte = [...zustand.orte.filter((o) => o !== 'nirgends'), ort];
    wurzel.querySelectorAll('[data-aktion="barometer-ort"]').forEach((b) => b.setAttribute('aria-pressed', String(zustand.orte.includes(b.dataset.ort))));
    if (zustand.sofort && zustand.schluessel) speichereBarometer(zustand);
    return 'ort';
  }
  if (aktion === 'barometer-fertig') return 'fertig';
  return null;
}
