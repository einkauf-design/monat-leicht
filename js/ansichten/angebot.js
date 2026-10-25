// Einmaliges Angebot für Frauen, die die App schon nutzen: die Eingangsfragen jetzt oder später.

import { t } from '../inhalte.js';
import { esc, toast } from '../util.js';
import { heuteKey } from '../daten.js';
import { markiereProfil, profil } from '../profil.js';
import { zeigeSeiten, seitenZuruecksetzen } from '../seiten.js';

export function zeige(wurzel) {
  zeigeSeiten(wurzel, [{
    id: 'angebot',
    mitte: true,
    bloecke: [
      '<div class="start-zeichen" aria-hidden="true">✦</div>',
      `<h1>${esc(t('kennenlernen.angebot_titel'))}</h1>`,
      `<p>${esc(t('kennenlernen.angebot_text'))}</p>`,
      `<div class="knopf-spalte">
        <a class="knopf knopf-haupt" href="#kennenlernen" data-aktion="jetzt">${esc(t('kennenlernen.angebot_jetzt'))}</a>
        <button type="button" class="knopf knopf-zweit" data-aktion="spaeter">${esc(t('kennenlernen.angebot_spaeter'))}</button>
      </div>`,
    ],
  }], { schluessel: 'angebot' });

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    markiereProfil({ angeboten: profil().angeboten || heuteKey() });
    if (ziel.dataset.aktion === 'jetzt') seitenZuruecksetzen('kennenlernen');
    if (ziel.dataset.aktion === 'spaeter') {
      toast(t('kennenlernen.angebot_spaeter_hinweis'));
      location.hash = '#heute';
    }
  };
}
