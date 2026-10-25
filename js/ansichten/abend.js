// Ansicht „Abend“: Spiele zum Runterkommen und zum Knobeln, dazu Ideen für einen ruhigen Abend.
// Wer schwer einschläft, sieht die Spiele zum Runterkommen zuerst.

import { t, inhalt } from '../inhalte.js';
import { esc, ganz } from '../util.js';
import { regalStand } from '../daten.js';
import { starteRegal } from '../regal.js';
import { starteWollfaeden } from '../wollfaeden.js';
import { starteBildpaare } from '../bildpaare.js';
import { infoKnopf } from '../info.js';
import { schwerEinschlafen, ohneMeditation, erlaubt } from '../profil.js';
import { zeigeSeiten, textBloecke, merkeSeite } from '../seiten.js';

let imSpiel = false;

export function beschaeftigt() {
  return imSpiel;
}

function runterkommenSeite(stand) {
  return {
    id: 'runterkommen',
    bloecke: [
      `<h2>${esc(t('abend.runterkommen_titel'))}</h2>`,
      `<div class="spiel-karte">
        <h3><span class="symbol" aria-hidden="true">🧺</span> ${esc(t('regal.spielname'))} ${infoKnopf('abendregal')}</h3>
        <p>${esc(t('regal.beschreibung'))}</p>
        <p class="leise klein">${esc(stand.regale ? t('abend.regal_stand', { sterne: ganz(stand.sterne), punkte: ganz(stand.punkte) }) : t('abend.regal_stand_leer'))}</p>
        <button class="knopf knopf-haupt" data-aktion="regal">${esc(stand.regale ? t('abend.regal_weiter') : t('abend.regal_start'))}</button>
      </div>`,
    ],
  };
}

function knobelnSeite() {
  const stufen = inhalt('texte.wollfaeden.stufen', {});
  const groessen = inhalt('texte.bildpaare.groessen', {});
  return {
    id: 'knobeln',
    bloecke: [
      `<h2>${esc(t('abend.knobeln_titel'))}</h2>`,
      `<div class="spiel-karte-kopf">
        <h3><span class="symbol" aria-hidden="true">🧶</span> ${esc(t('wollfaeden.name'))}</h3>
        <p>${esc(t('wollfaeden.beschreibung'))}</p>
      </div>`,
      `<div class="spiel-karte-fuss">
        <p class="feld-name">${esc(t('wollfaeden.stufe_frage'))}</p>
        <div class="knopf-spalte eng">
          ${Object.entries(stufen).map(([id, text]) => `<button class="knopf knopf-zweit" data-aktion="wolle" data-stufe="${esc(id)}">${esc(text)}</button>`).join('')}
        </div>
      </div>`,
      `<div class="spiel-karte-kopf">
        <h3><span class="symbol" aria-hidden="true">🌙</span> ${esc(t('bildpaare.name'))}</h3>
        <p>${esc(t('bildpaare.beschreibung'))}</p>
      </div>`,
      `<div class="spiel-karte-fuss">
        <p class="feld-name">${esc(t('bildpaare.groesse_frage'))}</p>
        <div class="knopf-spalte eng">
          ${Object.entries(groessen).map(([id, text]) => `<button class="knopf knopf-zweit" data-aktion="paare" data-groesse="${esc(id)}">${esc(text)}</button>`).join('')}
        </div>
      </div>`,
    ],
  };
}

function ideenSeiten() {
  return inhalt('runterkommen', [])
    .filter(erlaubt)
    .map((idee, i) => ({
      id: `idee-${i}`,
      bloecke: [
        i === 0 ? `<p class="ueberzeile">${esc(t('abend.ideen_titel'))}</p>` : '',
        `<h2>${idee.symbol ? `<span class="symbol" aria-hidden="true">${esc(idee.symbol)}</span> ` : ''}${esc(idee.titel)} ${idee.info ? infoKnopf(idee.info) : ''}</h2>`,
        ...textBloecke(idee.text),
        idee.schritte?.length ? `<ol class="schritte">${idee.schritte.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '',
        idee.regal ? `<button class="knopf knopf-zweit" data-aktion="zu-spielen">${esc(t('abend.regal_start'))}</button>` : '',
      ],
    }));
}

export function zeige(wurzel, ctx) {
  if (imSpiel) return;
  const stand = regalStand();
  const spiele = schwerEinschlafen() ? [runterkommenSeite(stand), knobelnSeite()] : [knobelnSeite(), runterkommenSeite(stand)];
  const steuerung = zeigeSeiten(wurzel, [
    { id: 'intro', mitte: true, bloecke: [`<h1>${esc(t('abend.titel'))}</h1>`, ...textBloecke(t('abend.einleitung'), 'leise')] },
    ...spiele,
    ...ideenSeiten(),
  ], { schluessel: 'abend' });

  const spielStarten = (start) => {
    imSpiel = true;
    document.body.classList.add('spiel-laeuft');
    start({
      nachSpiel: t('abend.nach_spiel'),
      ohneAtem: ohneMeditation(),
      beenden: () => {
        imSpiel = false;
        document.body.classList.remove('spiel-laeuft');
        ctx.zeichne();
      },
    });
  };

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    const aktion = ziel.dataset.aktion;
    if (aktion === 'zu-spielen') {
      steuerung.gehe('runterkommen');
      return;
    }
    if (aktion === 'regal') {
      merkeSeite('abend', 'runterkommen');
      spielStarten((o) => starteRegal(wurzel, o));
    }
    if (aktion === 'wolle') {
      merkeSeite('abend', 'knobeln');
      spielStarten((o) => starteWollfaeden(wurzel, { ...o, stufe: ziel.dataset.stufe }));
    }
    if (aktion === 'paare') {
      merkeSeite('abend', 'knobeln');
      spielStarten((o) => starteBildpaare(wurzel, { ...o, groesse: Number(ziel.dataset.groesse) }));
    }
  };
}

export function verlassen() {
  imSpiel = false;
  document.body.classList.remove('spiel-laeuft');
}
