// Info-Zeichen: Ein kleines „i“ hinter Aufgaben und Messwerten öffnet einen kurzen Hintergrundtext aus der Inhaltsdatei.

import { t, inhalt } from './inhalte.js';
import { esc, absaetze } from './util.js';

export function infoKnopf(id) {
  if (!inhalt(`infos.${id}`)) return '';
  return `<button type="button" class="info-knopf" data-info="${esc(id)}" aria-label="${esc(t('info.knopf'))}">i</button>`;
}

// Passendes Info-Thema für ein Experiment, zum Beispiel „kaffee“, wenn Kaffee im Titel vorkommt.
export function infoFuerExperiment(titel) {
  const klein = (titel || '').toLowerCase();
  for (const [wort, id] of Object.entries(inhalt('infoStichworte', {}))) {
    if (klein.includes(wort)) return id;
  }
  return 'experiment';
}

let dialog = null;

function oeffne(id) {
  const info = inhalt(`infos.${id}`);
  if (!info) return;
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'info-fenster';
    dialog.addEventListener('click', (e) => {
      // Ein Tipp neben das Fenster oder auf den Knopf schließt es.
      if (e.target === dialog || e.target.closest('[data-info-schliessen]')) dialog.close();
    });
    document.body.appendChild(dialog);
  }
  dialog.innerHTML = `
    <div class="info-inhalt">
      <h2>${esc(info.titel)}</h2>
      ${absaetze(info.text)}
      <p class="info-hinweis">${esc(t('info.hinweis'))}</p>
      <button type="button" class="knopf knopf-zweit" data-info-schliessen>${esc(t('info.schliessen'))}</button>
    </div>`;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  dialog.querySelector('.info-inhalt').scrollTop = 0;
}

export function infoAktivieren() {
  document.addEventListener('click', (e) => {
    const knopf = e.target.closest('[data-info]');
    if (!knopf) return;
    e.preventDefault();
    e.stopPropagation();
    oeffne(knopf.dataset.info);
  }, true);
}
