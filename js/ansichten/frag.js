// Ansicht „Frag mich“ (seit 1.8.0): ein ruhiges Gespräch mit der KI-Begleitung.
// Die erste Seite zeigt immer nur den letzten Austausch und das Eingabefeld, damit auf dem Handy nichts gescrollt werden muss.
// Das frühere Gespräch steht auf den folgenden Seiten, neueste zuerst.

import { t } from '../inhalte.js';
import { esc, toast } from '../util.js';
import { zeigeSeiten, textBloecke } from '../seiten.js';
import {
  begleitungErlaubt, stimmeBegleitungZu, begleitungStatus, gespraech, frage, fehlerText,
} from '../begleitung.js';
import { geraetDaten } from '../speicher.js';

let wartet = false;
let entwurf = '';

function nachrichtBlock(n) {
  const klasse = n.rolle === 'ki' ? 'chat-ki' : 'chat-ich';
  const wer = n.rolle === 'ki' ? t('begleitung.wer_ki') : t('begleitung.wer_ich');
  return `<div class="chat-nachricht ${klasse}"><span class="chat-wer">${esc(wer)}</span>${textBloecke(n.text).join('')}</div>`;
}

function seiteEinfach(id, titel, text, knopf = '') {
  return { id, mitte: true, bloecke: ['<div class="start-zeichen" aria-hidden="true">✦</div>', `<h1>${esc(titel)}</h1>`, ...textBloecke(text), knopf] };
}

export function zeige(wurzel, ctx) {
  const zurueck = { text: t('seiten.zurueck'), href: '#heute' };

  if (!geraetDaten().code) {
    zeigeSeiten(wurzel, [seiteEinfach('ohne-code', t('begleitung.titel'), t('begleitung.ohne_code'))], { schluessel: 'frag', zurueck });
    return;
  }

  if (!begleitungErlaubt()) {
    zeigeSeiten(wurzel, [{
      id: 'zustimmung',
      bloecke: [
        `<h1>${esc(t('begleitung.titel'))}</h1>`,
        ...textBloecke(t('begleitung.zustimmung_text')),
        `<div class="knopf-spalte eng">
          <button type="button" class="knopf knopf-haupt" data-aktion="zustimmen">${esc(t('begleitung.zustimmen'))}</button>
          <a class="knopf-text" href="#heute">${esc(t('begleitung.lieber_nicht'))}</a>
        </div>`,
      ],
    }], { schluessel: 'frag-zustimmung', zurueck });
    wurzel.onclick = (e) => {
      if (e.target.closest('[data-aktion="zustimmen"]')) {
        stimmeBegleitungZu();
        toast(t('begleitung.zugestimmt'), '💛');
        ctx.zeichne();
      }
    };
    return;
  }

  const nachrichten = gespraech();
  const letzte = [];
  // Der letzte Austausch: ihre letzte Nachricht und die Antwort darauf.
  for (let i = nachrichten.length - 1; i >= 0 && letzte.length < 2; i--) {
    letzte.unshift(nachrichten[i]);
    if (nachrichten[i].rolle === 'ich') break;
  }
  const frueher = nachrichten.slice(0, nachrichten.length - letzte.length).reverse();

  const vorschlaege = nachrichten.length ? [] : t('begleitung.vorschlaege').split('|');
  const gruppen = [{
    id: 'jetzt',
    bloecke: [
      `<h1>${esc(t('begleitung.titel'))}</h1>`,
      ...(letzte.length ? letzte.map(nachrichtBlock) : [`<p class="leise">${esc(t('begleitung.leer'))}</p>`]),
      wartet ? `<p class="chat-wartet" aria-live="polite">${esc(t('begleitung.denkt'))}</p>` : '',
      vorschlaege.length && !wartet
        ? `<div class="chat-vorschlaege">${vorschlaege.map((v) => `<button type="button" class="auswahl auswahl-leise" data-aktion="vorschlag">${esc(v.trim())}</button>`).join('')}</div>`
        : '',
      `<form class="formular chat-eingabe" data-form="frage">
        <label class="feld">
          <span class="nur-vorleser">${esc(t('begleitung.eingabe_label'))}</span>
          <textarea name="frage" rows="2" maxlength="2000" placeholder="${esc(t('begleitung.eingabe_platzhalter'))}" ${wartet ? 'disabled' : ''}>${esc(entwurf)}</textarea>
        </label>
        <button class="knopf knopf-haupt" type="submit" ${wartet ? 'disabled' : ''}>${esc(t('begleitung.schicken'))}</button>
      </form>`,
      frueher.length ? `<p class="leise klein">${esc(t('begleitung.frueher_hinweis'))}</p>` : '',
    ],
  }];
  if (frueher.length) {
    gruppen.push({ id: 'frueher', bloecke: [`<h2>${esc(t('begleitung.frueher_titel'))}</h2>`, ...frueher.map(nachrichtBlock)] });
  }

  zeigeSeiten(wurzel, gruppen, { schluessel: 'frag', start: 'jetzt', zurueck });

  // Ist die Begleitung auf dem Server aus oder pausiert, sagen wir es freundlich.
  begleitungStatus().then((st) => {
    const hinweis = !st.aktiv ? (st.offline ? t('begleitung.offline') : t('begleitung.nicht_aktiv')) : st.pausiert ? t('begleitung.pausiert') : '';
    if (!hinweis) return;
    const form = wurzel.querySelector('.chat-eingabe');
    if (form && !form.previousElementSibling?.classList?.contains('hinweis')) form.insertAdjacentHTML('beforebegin', `<p class="hinweis">${esc(hinweis)}</p>`);
  });

  const schicken = async (text) => {
    text = text.trim();
    if (!text || wartet) return;
    wartet = true;
    entwurf = '';
    ctx.zeichne();
    try {
      await frage(text);
    } catch (fehler) {
      entwurf = text;
      toast(fehlerText(fehler));
    }
    wartet = false;
    if (location.hash.startsWith('#frag')) ctx.zeichne();
  };

  wurzel.oninput = (e) => {
    if (e.target.matches('[name="frage"]')) entwurf = e.target.value;
  };
  wurzel.onsubmit = (e) => {
    e.preventDefault();
    schicken(wurzel.querySelector('[name="frage"]')?.value || '');
  };
  wurzel.onclick = (e) => {
    const v = e.target.closest('[data-aktion="vorschlag"]');
    if (v) schicken(v.textContent);
  };
}
