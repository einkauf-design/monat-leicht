// Begrüßung beim allerersten Öffnen: Name und Zugangscode, beides freiwillig.

import { t } from '../inhalte.js';
import { esc } from '../util.js';
import { api, setzeGeraet, sync, vonVorneSynchronisieren } from '../speicher.js';
import { einstellungen, setzeEinstellungen } from '../daten.js';

export function zeige(wurzel, { fertig }) {
  wurzel.innerHTML = `
    <section class="start">
      <div class="start-zeichen" aria-hidden="true">✦</div>
      <h1>${esc(t('start.titel'))}</h1>
      <p>${esc(t('start.text'))}</p>
      <form class="formular karte" data-form="start">
        <label class="feld">
          <span class="feld-name">${esc(t('start.name_label'))}</span>
          <input type="text" name="vorname" maxlength="40" autocomplete="given-name" placeholder="${esc(t('start.name_platzhalter'))}">
        </label>
        <label class="feld">
          <span class="feld-name">${esc(t('start.code_label'))}</span>
          <input type="password" name="code" autocomplete="current-password" placeholder="${esc(t('start.code_platzhalter'))}">
          <span class="feld-hilfe">${esc(t('start.code_hilfe'))}</span>
        </label>
        <p class="hinweis" data-meldung hidden></p>
        <button class="knopf knopf-haupt" type="submit">${esc(t('start.los'))}</button>
      </form>
    </section>`;

  wurzel.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.vorname.value.trim();
    const code = form.code.value.trim();
    const meldung = form.querySelector('[data-meldung]');
    const knopf = form.querySelector('button[type="submit"]');

    if (code) {
      knopf.disabled = true;
      knopf.textContent = t('start.pruefe');
      try {
        await api('pruefen', {}, { code });
        setzeGeraet({ code });
        vonVorneSynchronisieren();
        await sync();
      } catch (fehler) {
        if (fehler.status === 0) {
          setzeGeraet({ code });
          vonVorneSynchronisieren();
          meldung.textContent = t('start.kein_netz');
          meldung.hidden = false;
        } else {
          meldung.textContent = fehler.status === 401 ? t('start.code_falsch') : fehler.message;
          meldung.hidden = false;
          knopf.disabled = false;
          knopf.textContent = t('start.los');
          return;
        }
      }
    }
    // Ein schon auf dem Server gespeicherter Name bleibt erhalten, wenn hier nichts eingetragen wird.
    if (name && name !== einstellungen().name) setzeEinstellungen({ name });
    fertig();
  };
}
