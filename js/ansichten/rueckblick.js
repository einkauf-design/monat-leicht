// Ansicht „Rückblick“: was in sieben Einträgen sichtbar wird, und zwei bis drei freiwillige Fragen.

import { t, inhalt } from '../inhalte.js';
import { esc, absaetze, toast, ausKey } from '../util.js';
import { infoKnopf } from '../info.js';
import { rueckblick, auswertung, markiereGelesen, speichereAntworten, ordnung, frageText } from '../rueckblick.js';

function datumLang(key) {
  const d = ausKey(key);
  return `${inhalt('texte.allgemein.wochentage')[d.getDay()]}, ${d.getDate()}. ${inhalt('texte.allgemein.monate')[d.getMonth()]}`;
}

export function zeige(wurzel, ctx) {
  const nummer = Number(ctx.param);
  const rb = rueckblick(nummer);
  if (!rb) {
    wurzel.innerHTML = `
      <section class="karte">
        <p>${esc(t('rueckblick.nicht_gefunden'))}</p>
        <a class="knopf knopf-zweit" href="#verlauf">${esc(t('rueckblick.zurueck'))}</a>
      </section>`;
    return;
  }
  markiereGelesen(nummer);
  const a = auswertung(rb);
  const antworten = rb.antworten || {};

  wurzel.innerHTML = `
    <header class="seiten-kopf">
      <a class="knopf-text zurueck-link" href="#verlauf">← ${esc(t('rueckblick.zurueck'))}</a>
      <h1>${esc(t('rueckblick.titel', { ordnung: ordnung(nummer) }))}</h1>
      <p class="leise">${esc(a.zeitraum)}</p>
    </header>

    <section class="karte" aria-labelledby="rb-sichtbar">
      <h2 id="rb-sichtbar">${esc(t('rueckblick.beobachtungen_titel'))} ${infoKnopf('rueckblick')}</h2>
      <p class="leise">${esc(t('rueckblick.einleitung'))}</p>
      ${a.saetze.map((satz) => `<p>${esc(satz)}</p>`).join('')}
      ${a.wenig ? `<p>${esc(t('rueckblick.wenig'))}</p>` : ''}
    </section>

    ${a.koerper.length ? `
    <section class="karte" aria-labelledby="rb-koerper">
      <h2 id="rb-koerper">${esc(t('rueckblick.koerper_titel'))}</h2>
      <ul class="beobachtungen">
        ${a.koerper.map((k) => `
          <li class="beobachtung">
            <p class="beobachtung-datum">${esc(t('experiment.eintrag_datum', { datum: datumLang(k.datum) }))}</p>
            ${absaetze(k.text, 'beobachtung-text')}
          </li>`).join('')}
      </ul>
    </section>` : ''}

    ${(rb.fragen || []).length ? `
    <section class="karte karte-fragen" aria-labelledby="rb-fragen">
      <h2 id="rb-fragen">${esc(t('rueckblick.fragen_titel'))}</h2>
      ${absaetze(t('rueckblick.fragen_text'), 'leise')}
      <form class="formular" data-form="antworten">
        ${rb.fragen.map((f, i) => `
          <label class="feld">
            <span class="feld-name frage">${esc(frageText(f))}</span>
            <textarea name="${esc(f.id)}" rows="3" maxlength="2000" placeholder="${esc(t('rueckblick.antwort_platzhalter'))}" data-frage="${i}">${esc(antworten[f.id] || '')}</textarea>
          </label>`).join('')}
        <button class="knopf knopf-haupt" type="submit">${esc(t('rueckblick.speichern'))}</button>
      </form>
    </section>` : ''}

    <section class="karte karte-ruhig">
      <p>${esc(t('rueckblick.abschluss'))}</p>
      <a class="knopf knopf-zweit" href="#verlauf">${esc(t('rueckblick.zurueck'))}</a>
    </section>`;

  wurzel.onsubmit = (e) => {
    e.preventDefault();
    const neu = {};
    for (const feld of e.target.querySelectorAll('textarea')) neu[feld.name] = feld.value.trim();
    speichereAntworten(nummer, neu);
    toast(t('rueckblick.gespeichert'), '🌱');
  };
}
