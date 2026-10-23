// Ansicht „Freude“: die eigene Freude-Liste bearbeiten und Freude-Plätze für heute wählen.

import { t, inhalt } from '../inhalte.js';
import { esc, absaetze, $ } from '../util.js';
import { infoKnopf } from '../info.js';
import {
  freudeListe, speichereFreude, neueFreude, wechsleFreudePlatz, tag, heuteKey, freudeZaehler,
} from '../daten.js';

let bearbeiten = false;

export function zeige(wurzel, ctx) {
  const liste = freudeListe();
  const heute = tag(heuteKey());
  const plaetze = new Set(heute.freudePlaetze || []);
  const genutzt = new Set(heute.freudeGenutzt || []);
  const zaehler = freudeZaehler();
  const symbole = inhalt('freudeSymbole', ['💛']);

  const eintraege = liste
    .map((f) => {
      if (bearbeiten) {
        return `
          <li class="freude-zeile bearbeiten" data-id="${esc(f.id)}">
            <button class="symbol-wahl" data-aktion="symbol" aria-label="${esc(t('freude.symbol_wechseln'))}">${esc(f.symbol || '💛')}</button>
            <input class="freude-eingabe" data-feld="titel" type="text" value="${esc(f.titel)}" maxlength="80" aria-label="${esc(t('freude.titel_aendern'))}">
            <label class="schalter-klein">
              <input type="checkbox" data-feld="pause" ${f.pause ? 'checked' : ''}>
              <span>${esc(t('freude.pause'))}</span>
            </label>
            <button class="knopf-text leise-knopf" data-aktion="loeschen">${esc(t('freude.loeschen'))}</button>
          </li>`;
      }
      const istPlatz = plaetze.has(f.id);
      const anzahl = zaehler[f.id] || 0;
      return `
        <li class="freude-zeile ${istPlatz ? 'ist-platz' : ''}">
          <button class="platz-wahl" data-aktion="platz" data-id="${esc(f.id)}" role="switch" aria-checked="${istPlatz}" aria-label="${esc(f.titel)}. ${esc(t('freude.heute_kurz'))}.">
            <span class="platz-kreis" aria-hidden="true">${genutzt.has(f.id) ? '★' : istPlatz ? '✓' : ''}</span>
          </button>
          <span class="symbol gross" aria-hidden="true">${esc(f.symbol || '💛')}</span>
          <span class="freude-text">
            <span class="freude-titel">${esc(f.titel)}</span>
            <span class="freude-info">
              ${f.pause ? `<span class="marke">🍃 ${esc(t('freude.pause'))}</span>` : ''}
              ${anzahl ? `<span class="marke">${esc(t(anzahl === 1 ? 'freude.zaehler_eins' : 'freude.zaehler', { anzahl }))}</span>` : ''}
            </span>
          </span>
          ${istPlatz ? `<span class="heute-marke">${esc(t('freude.heute'))}</span>` : ''}
        </li>`;
    })
    .join('');

  wurzel.innerHTML = `
    <header class="seiten-kopf">
      <h1>${esc(t('freude.titel'))} ${infoKnopf('freude')}</h1>
      ${absaetze(t('freude.einleitung'), 'leise')}
    </header>
    <section class="karte">
      <div class="karte-kopf">
        <p class="leise klein">${esc(t('freude.pause_hilfe'))}</p>
        <button class="knopf-text" data-aktion="bearbeiten">${esc(bearbeiten ? t('freude.fertig') : t('freude.bearbeiten'))}</button>
      </div>
      <ul class="freude-liste">${eintraege}</ul>
    </section>
    <section class="karte">
      <form class="formular neu-freude" data-form="neu">
        <label class="feld">
          <span class="feld-name">${esc(t('freude.neu_label'))}</span>
          <input name="titel" type="text" maxlength="80" placeholder="${esc(t('freude.neu_platzhalter'))}">
        </label>
        <button class="knopf knopf-haupt" type="submit">${esc(t('freude.hinzufuegen'))}</button>
      </form>
    </section>`;

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    const aktion = ziel.dataset.aktion;
    if (aktion === 'bearbeiten') {
      if (bearbeiten) speichereBearbeitung(wurzel);
      bearbeiten = !bearbeiten;
      ctx.zeichne();
      return;
    }
    if (aktion === 'platz') {
      wechsleFreudePlatz(ziel.dataset.id);
      ctx.zeichne();
      return;
    }
    const zeile = ziel.closest('[data-id]');
    if (!zeile) return;
    if (aktion === 'symbol') {
      const jetzt = symbole.indexOf(ziel.textContent.trim());
      ziel.textContent = symbole[(jetzt + 1) % symbole.length];
      speichereBearbeitung(wurzel);
      return;
    }
    if (aktion === 'loeschen') {
      const eintrag = freudeListe().find((f) => f.id === zeile.dataset.id);
      if (eintrag && confirm(t('freude.loeschen_frage', { titel: eintrag.titel }))) {
        speichereBearbeitung(wurzel);
        speichereFreude(freudeListe().filter((f) => f.id !== zeile.dataset.id));
        ctx.zeichne();
      }
    }
  };

  wurzel.onchange = (e) => {
    if (bearbeiten && e.target.closest('.freude-zeile')) speichereBearbeitung(wurzel);
  };

  wurzel.onsubmit = (e) => {
    e.preventDefault();
    const titel = e.target.titel.value.trim();
    if (!titel) return;
    if (bearbeiten) speichereBearbeitung(wurzel);
    neueFreude(titel, symbole[0] || '💛', true);
    ctx.zeichne();
    $('input[name="titel"]', wurzel)?.focus();
  };
}

function speichereBearbeitung(wurzel) {
  const alt = freudeListe();
  const neu = alt.map((f) => {
    const zeile = wurzel.querySelector(`.freude-zeile[data-id="${CSS.escape(f.id)}"]`);
    if (!zeile) return f;
    const titel = $('[data-feld="titel"]', zeile).value.trim() || f.titel;
    return { ...f, titel, symbol: $('.symbol-wahl', zeile).textContent.trim(), pause: $('[data-feld="pause"]', zeile).checked };
  });
  if (JSON.stringify(neu) !== JSON.stringify(alt)) speichereFreude(neu);
}
