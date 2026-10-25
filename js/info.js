// Info-Zeichen: Ein kleines „i“ hinter Aufgaben und Messwerten öffnet einen kurzen Hintergrundtext aus der Inhaltsdatei.
// Der Text wird auf Seiten mit ein bis zwei Absätzen verteilt. Die Quellen stehen auf der letzten Seite.

import { t, inhalt } from './inhalte.js';
import { esc } from './util.js';
import { zeigeSeiten, seitenZuruecksetzen } from './seiten.js';
import { gesundheitHat, hat } from './profil.js';

export function infoKnopf(id) {
  if (!inhalt(`infos.${id}`)) return '';
  return `<button type="button" class="info-knopf" data-info="${esc(id)}" aria-label="${esc(t('info.knopf'))}">i</button>`;
}

// Passendes Info-Thema für ein Experiment, zum Beispiel „kaffee“, wenn Kaffee im Titel vorkommt.
export function infoFuerExperiment(titel) {
  const klein = (titel || '').toLowerCase();
  for (const [wort, id] of Object.entries(inhalt('infoStichworte', {}))) {
    if (klein.includes(wort)) return id === 'kaffee' && hat('kaffeewirkung', 'ruhig') ? 'kaffeeRuhig' : id;
  }
  return 'experiment';
}

let dialog = null;

function absaetze(text) {
  return String(text || '').split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);
}

function gruppenFuer(id, info) {
  const teile = absaetze(info.text);
  // Persönliche Ergänzungen, zum Beispiel in den Wechseljahren.
  const zusatz = info.zusatz || {};
  if (zusatz.wechseljahre && gesundheitHat('wechseljahre')) teile.push(zusatz.wechseljahre);
  if (zusatz.schilddruese && (gesundheitHat('schilddruese') || gesundheitHat('medikamente'))) teile.push(zusatz.schilddruese);

  const gruppen = [];
  for (let i = 0; i < teile.length; i += 2) {
    const bloecke = teile.slice(i, i + 2).map((a) => `<p>${esc(a)}</p>`);
    if (i === 0) bloecke.unshift(`<h2>${esc(info.titel)}</h2>`);
    gruppen.push({ id: `${id}-${i}`, bloecke });
  }
  const quellen = info.quellen || [];
  gruppen.push({
    id: `${id}-quellen`,
    bloecke: [
      `<p class="info-hinweis">${esc(t('info.hinweis'))}</p>`,
      ...(quellen.length ? [`<p class="feld-name">${esc(t('info.quellen_titel'))}</p>`, ...quellen.map((q) => `<p class="quelle">${esc(q)}</p>`)] : []),
      `<button type="button" class="knopf knopf-zweit" data-info-schliessen>${esc(t('info.schliessen'))}</button>`,
    ],
  });
  return gruppen;
}

function oeffne(id) {
  const info = inhalt(`infos.${id}`);
  if (!info) return;
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'info-fenster';
    dialog.addEventListener('click', (e) => {
      // Ein Tipp neben das Fenster oder auf „Schließen“ schließt es.
      if (e.target === dialog || e.target.closest('[data-info-schliessen]')) dialog.close();
    });
    document.body.appendChild(dialog);
  }
  dialog.innerHTML = `
    <div class="info-inhalt">
      <button type="button" class="info-zu knopf-text" data-info-schliessen>${esc(t('info.schliessen'))}</button>
      <div class="info-seiten"></div>
    </div>`;
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  seitenZuruecksetzen(`info-${id}`);
  zeigeSeiten(dialog.querySelector('.info-seiten'), gruppenFuer(id, info), { schluessel: `info-${id}` });
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
