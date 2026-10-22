// Ansicht „Abend“: Ideen zum Runterkommen und das Abendregal.

import { t, inhalt } from '../inhalte.js';
import { esc, absaetze, ganz } from '../util.js';
import { regalStand } from '../daten.js';
import { starteRegal } from '../regal.js';

let imSpiel = false;

export function beschaeftigt() {
  return imSpiel;
}

export function zeige(wurzel, ctx) {
  if (imSpiel) return;
  const stand = regalStand();
  const ideen = inhalt('runterkommen', [])
    .map(
      (idee) => `
      <li class="idee">
        <details>
          <summary>
            ${idee.symbol ? `<span class="symbol gross" aria-hidden="true">${esc(idee.symbol)}</span>` : ''}
            <span class="idee-titel">${esc(idee.titel)}</span>
          </summary>
          <div class="idee-inhalt">
            ${absaetze(idee.text)}
            ${idee.schritte?.length ? `<ol class="schritte">${idee.schritte.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
            ${idee.regal ? `<button class="knopf knopf-zweit" data-aktion="regal">${esc(t('abend.regal_start'))}</button>` : ''}
          </div>
        </details>
      </li>`,
    )
    .join('');

  wurzel.innerHTML = `
    <header class="seiten-kopf">
      <h1>${esc(t('abend.titel'))}</h1>
      ${absaetze(t('abend.einleitung'), 'leise')}
    </header>

    <section class="karte karte-regal" aria-labelledby="regal-titel">
      <h2 id="regal-titel"><span class="symbol" aria-hidden="true">🧺</span> ${esc(t('abend.regal_titel'))}</h2>
      ${absaetze(t('abend.regal_text'))}
      <p class="leise">${esc(stand.regale ? t('abend.regal_stand', { sterne: ganz(stand.sterne), punkte: ganz(stand.punkte) }) : t('abend.regal_stand_leer'))}</p>
      <button class="knopf knopf-haupt" data-aktion="regal">${esc(stand.regale ? t('abend.regal_weiter') : t('abend.regal_start'))}</button>
    </section>

    <section class="karte" aria-labelledby="ideen-titel">
      <h2 id="ideen-titel">${esc(t('abend.ideen_titel'))}</h2>
      <ul class="ideen">${ideen}</ul>
    </section>`;

  wurzel.onclick = (e) => {
    if (!e.target.closest('[data-aktion="regal"]')) return;
    imSpiel = true;
    document.body.classList.add('spiel-laeuft');
    window.scrollTo({ top: 0 });
    starteRegal(wurzel, {
      beenden: () => {
        imSpiel = false;
        document.body.classList.remove('spiel-laeuft');
        ctx.zeichne();
      },
    });
  };
}

export function verlassen() {
  imSpiel = false;
  document.body.classList.remove('spiel-laeuft');
}
