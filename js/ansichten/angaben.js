// Ansicht „Meine Angaben“: alle Antworten aus dem Kennenlernen ansehen, ändern und löschen.

import { t } from '../inhalte.js';
import { esc, toast } from '../util.js';
import { aktiveEingangsfragen, antwort, status, STATUS, profil, gesundheit, hatEinwilligung, nimmZustimmungZurueck, loescheAlleAngaben, offeneEingangsfragen } from '../profil.js';
import { zeigeSeiten, seitenZuruecksetzen } from '../seiten.js';
import { datumKurz } from '../rueckblick.js';

let loeschenFragen = false;

function antwortText(frage) {
  const zustand = status(frage.id);
  if (zustand === STATUS.NICHT_SAGEN) return t('angaben.nicht_sagen');
  if (zustand === STATUS.NOCH_NICHT) return t('angaben.noch_nicht');
  const wert = antwort(frage.id);
  const liste = Array.isArray(wert) ? wert : wert ? [wert] : [];
  const texte = liste.map((id) => frage.optionen.find((o) => o.id === id)?.text).filter(Boolean);
  const frei = profil().freitext?.[frage.id];
  if (!texte.length && !frei) return t('angaben.keine');
  return [texte.join(', '), frei].filter(Boolean).join('. ');
}

export function verlassen() {
  loeschenFragen = false;
}

export function zeige(wurzel, ctx) {
  const g = gesundheit();
  const gruppen = [{
    id: 'angaben-start',
    bloecke: [
      `<h2>${esc(t('angaben.titel'))}</h2>`,
      `<p class="leise">${esc(t('angaben.text'))}</p>`,
      `<p>${esc(hatEinwilligung() ? t('angaben.einwilligung_ja', { datum: datumKurz(g.einwilligung) }) : t('angaben.einwilligung_nein'))}</p>`,
      hatEinwilligung()
        ? `<button type="button" class="knopf knopf-zweit" data-aktion="zuruecknehmen">${esc(t('angaben.zuruecknehmen'))}</button>`
        : `<a class="knopf-text" href="#kennenlernen/gesundheit">${esc(t('angaben.zustimmen_neu'))}</a>`,
    ],
  }];

  for (const frage of aktiveEingangsfragen({ vertiefung: true })) {
    if (frage.gesundheit && !hatEinwilligung()) continue;
    gruppen.push({
      id: `a-${frage.id}`,
      bloecke: [
        `<h2>${esc(frage.text)}</h2>`,
        `<p class="antwort-anzeige">${esc(antwortText(frage))}</p>`,
        `<a class="knopf knopf-zweit" href="#kennenlernen/${esc(frage.id)}">${esc(t('angaben.aendern'))}</a>`,
      ],
    });
  }

  gruppen.push({
    id: 'angaben-ende',
    mitte: true,
    bloecke: loeschenFragen
      ? [
          `<p>${esc(t('angaben.alles_frage'))}</p>`,
          `<div class="knopf-spalte">
            <button type="button" class="knopf knopf-haupt" data-aktion="alles-ja">${esc(t('angaben.alles_ja'))}</button>
            <button type="button" class="knopf knopf-zweit" data-aktion="alles-nein">${esc(t('angaben.alles_nein'))}</button>
          </div>`,
        ]
      : [
          offeneEingangsfragen().length ? `<a class="knopf knopf-haupt" href="#kennenlernen">${esc(t('angaben.weitermachen'))}</a>` : '',
          `<a class="knopf knopf-zweit" href="#kennenlernen" data-aktion="neu">${esc(t('angaben.neu_beantworten'))}</a>`,
          `<button type="button" class="knopf-text leise-knopf" data-aktion="alles-loeschen">${esc(t('angaben.alles_loeschen'))}</button>`,
        ],
  });

  zeigeSeiten(wurzel, gruppen, { schluessel: 'angaben', zurueck: { text: t('seiten.zurueck'), href: '#mehr' } });

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    switch (ziel.dataset.aktion) {
      case 'zuruecknehmen':
        nimmZustimmungZurueck();
        toast(t('angaben.zurueckgenommen'));
        ctx.zeichne();
        break;
      case 'alles-loeschen':
        loeschenFragen = true;
        ctx.zeichne();
        break;
      case 'alles-nein':
        loeschenFragen = false;
        ctx.zeichne();
        break;
      case 'alles-ja':
        loeschenFragen = false;
        loescheAlleAngaben();
        toast(t('angaben.alles_geloescht'));
        seitenZuruecksetzen('angaben');
        ctx.zeichne();
        break;
      case 'neu':
        seitenZuruecksetzen('kennenlernen');
        break;
    }
  };
}
