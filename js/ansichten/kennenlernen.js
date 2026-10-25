// Ansicht „Kennenlernen“: die zehn Eingangsfragen, eine pro Seite.
// Jede Frage lässt sich überspringen, „Möchte ich nicht sagen“ ist immer möglich.
// Vor Frage 10 steht eine eigene Seite mit der Einwilligung für Gesundheitsangaben.

import { t } from '../inhalte.js';
import { esc, toast } from '../util.js';
import { einstellungen, setzeEinstellungen, heuteKey } from '../daten.js';
import {
  aktiveEingangsfragen, antwort, status, speichereAntwort, STATUS, profil, markiereProfil,
  hatEinwilligung, stimmeZu, gesundheitHat, freudeVorschlaege, uebernimmFreudeVorschlaege,
} from '../profil.js';
import { zeigeSeiten, merkeSeite } from '../seiten.js';
import { auswahlKnoepfe } from './teile.js';

let steuerung = null;

function frageSeite(frage, gesamt) {
  const gewaehlt = antwort(frage.id);
  const zustand = status(frage.id);
  const bloecke = [
    `<p class="ueberzeile">${esc(t('kennenlernen.frage_von', { nummer: frage.nummer, gesamt }))}</p>`,
    `<h2>${esc(frage.text)}</h2>`,
    `<p class="leise klein">${esc(frage.mehrfach ? t('kennenlernen.mehrfach') : t('kennenlernen.einfach'))}</p>`,
    `<div class="auswahl-liste ${frage.optionen.length > 4 ? 'zweispaltig' : ''}">${auswahlKnoepfe(frage, gewaehlt)}</div>`,
  ];
  if (frage.freitext) {
    bloecke.push(`
      <label class="feld block-abstand">
        <span class="feld-name">${esc(t('kennenlernen.freitext_label'))}</span>
        <textarea name="freitext" data-frage="${esc(frage.id)}" rows="2" maxlength="400" placeholder="${esc(t('kennenlernen.freitext_platzhalter'))}">${esc(profil().freitext?.[frage.id] || '')}</textarea>
      </label>`);
  }
  bloecke.push(`
    <div class="auswahl-extra">
      ${frage.nochNicht ? `<button type="button" class="auswahl auswahl-leise" data-aktion="noch-nicht" data-frage="${esc(frage.id)}" aria-pressed="${zustand === STATUS.NOCH_NICHT}">${esc(t('kennenlernen.noch_nicht'))}</button>` : ''}
      <button type="button" class="auswahl auswahl-leise" data-aktion="nicht-sagen" data-frage="${esc(frage.id)}" aria-pressed="${zustand === STATUS.NICHT_SAGEN}">${esc(t('kennenlernen.nicht_sagen'))}</button>
    </div>`);
  bloecke.push(`<button type="button" class="knopf-text leise-knopf" data-aktion="spaeter">${esc(t('kennenlernen.spaeter'))}</button>`);
  return { id: `f-${frage.id}`, bloecke };
}

export function zeige(wurzel, ctx) {
  const fragen = aktiveEingangsfragen();
  const gesamt = fragen.length;
  const gruppen = [{
    id: 'willkommen',
    mitte: true,
    bloecke: [
      '<div class="start-zeichen" aria-hidden="true">✦</div>',
      `<h1>${esc(t('kennenlernen.titel'))}</h1>`,
      `<p>${esc(t('kennenlernen.text'))}</p>`,
      `<button type="button" class="knopf knopf-haupt" data-aktion="los">${esc(t('kennenlernen.los'))}</button>`,
      `<button type="button" class="knopf-text leise-knopf" data-aktion="spaeter">${esc(t('kennenlernen.spaeter'))}</button>`,
    ],
  }];

  for (const frage of fragen) {
    if (frage.gesundheit) {
      if (!hatEinwilligung()) {
        gruppen.push({
          id: 'einwilligung',
          mitte: true,
          bloecke: [
            `<h2>${esc(t('kennenlernen.einwilligung_titel'))}</h2>`,
            `<p>${esc(t('kennenlernen.einwilligung_text'))}</p>`,
            `<div class="knopf-spalte">
              <button type="button" class="knopf knopf-haupt" data-aktion="zustimmen">${esc(t('kennenlernen.zustimmen'))}</button>
              <button type="button" class="knopf knopf-zweit" data-aktion="ueberspringen">${esc(t('kennenlernen.ueberspringen'))}</button>
            </div>`,
          ],
        });
      } else {
        gruppen.push(frageSeite(frage, gesamt));
      }
      continue;
    }
    gruppen.push(frageSeite(frage, gesamt));
  }

  if (gesundheitHat('schicht')) {
    const e = einstellungen();
    gruppen.push({
      id: 'zeiten',
      bloecke: [
        `<h2>${esc(t('kennenlernen.zeiten_titel'))}</h2>`,
        `<p>${esc(t('kennenlernen.zeiten_text'))}</p>`,
        `<label class="feld"><span class="feld-name">${esc(t('mehr.erinnerung_morgen'))}</span><input type="time" name="erinnerungMorgen" value="${esc(e.erinnerungMorgen)}"></label>`,
        `<label class="feld"><span class="feld-name">${esc(t('mehr.erinnerung_abend'))}</span><input type="time" name="erinnerungAbend" value="${esc(e.erinnerungAbend)}"></label>`,
        `<button type="button" class="knopf knopf-zweit" data-aktion="zeiten">${esc(t('kennenlernen.zeiten_speichern'))}</button>`,
      ],
    });
  }

  const freude = freudeVorschlaege();
  if (freude.length) {
    gruppen.push({
      id: 'freude',
      bloecke: [
        `<h2>${esc(t('kennenlernen.freude_titel'))}</h2>`,
        `<p class="leise">${esc(t('kennenlernen.freude_text'))}</p>`,
        ...freude.map((f) => `<div class="freude-platz"><span class="symbol gross" aria-hidden="true">${esc(f.symbol || '💛')}</span><span class="freude-titel">${esc(f.titel)}</span></div>`),
        `<button type="button" class="knopf knopf-zweit" data-aktion="freude">${esc(t('kennenlernen.freude_uebernehmen'))}</button>`,
      ],
    });
  }

  gruppen.push({
    id: 'fertig',
    mitte: true,
    bloecke: [
      `<h2>${esc(t('kennenlernen.danke'))}</h2>`,
      `<p>${esc(t('experimentwahl.vorschlag_text'))}</p>`,
      `<a class="knopf knopf-haupt" href="#experiment" data-aktion="fertig">${esc(t('kennenlernen.zum_experiment'))}</a>`,
    ],
  });

  const bearbeiten = ctx.param ? fragen.find((f) => f.id === ctx.param) : null;
  let start;
  if (bearbeiten) start = bearbeiten.gesundheit && !hatEinwilligung() ? 'einwilligung' : `f-${bearbeiten.id}`;
  steuerung = zeigeSeiten(wurzel, gruppen, {
    schluessel: 'kennenlernen',
    start,
    zurueck: bearbeiten ? { text: t('kennenlernen.zurueck_angaben'), href: '#angaben' } : undefined,
  });

  const weiterOderZurueck = () => {
    if (bearbeiten) location.hash = '#angaben';
    else steuerung.weiter();
  };

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    const aktion = ziel.dataset.aktion;
    const frage = fragen.find((f) => f.id === ziel.dataset.frage);

    if (aktion === 'los') { steuerung.weiter(); return; }
    if (aktion === 'spaeter') {
      markiereProfil({ angeboten: profil().angeboten || heuteKey() });
      toast(t('kennenlernen.abgebrochen'));
      location.hash = '#heute';
      return;
    }
    if (aktion === 'option' && frage) {
      if (frage.mehrfach) {
        const alt = Array.isArray(antwort(frage.id)) ? antwort(frage.id) : [];
        let neu;
        if (alt.includes(ziel.dataset.option)) neu = alt.filter((o) => o !== ziel.dataset.option);
        else if ((frage.exklusiv || []).includes(ziel.dataset.option)) neu = [ziel.dataset.option];
        else neu = [...alt.filter((o) => !(frage.exklusiv || []).includes(o)), ziel.dataset.option];
        const freitext = wurzel.querySelector('[name="freitext"]')?.value.trim();
        speichereAntwort(frage.id, neu, neu.length ? STATUS.BEANTWORTET : STATUS.OHNE, frage.freitext ? freitext : undefined);
        merkeSeite('kennenlernen', `f-${frage.id}`);
        ctx.zeichne();
      } else {
        speichereAntwort(frage.id, ziel.dataset.option);
        merkeSeite('kennenlernen', `f-${frage.id}`);
        ctx.zeichne();
        weiterOderZurueck();
      }
      return;
    }
    if ((aktion === 'noch-nicht' || aktion === 'nicht-sagen') && frage) {
      speichereAntwort(frage.id, null, aktion === 'noch-nicht' ? STATUS.NOCH_NICHT : STATUS.NICHT_SAGEN);
      merkeSeite('kennenlernen', `f-${frage.id}`);
      ctx.zeichne();
      weiterOderZurueck();
      return;
    }
    if (aktion === 'zustimmen') {
      stimmeZu();
      merkeSeite('kennenlernen', 'f-gesundheit');
      ctx.zeichne();
      return;
    }
    if (aktion === 'ueberspringen') {
      markiereProfil({ gesundheitUebersprungen: heuteKey() });
      if (bearbeiten) location.hash = '#angaben';
      else steuerung.weiter();
      return;
    }
    if (aktion === 'zeiten') {
      const morgen = wurzel.querySelector('[name="erinnerungMorgen"]').value;
      const abend = wurzel.querySelector('[name="erinnerungAbend"]').value;
      setzeEinstellungen({ ...(morgen ? { erinnerungMorgen: morgen } : {}), ...(abend ? { erinnerungAbend: abend } : {}) });
      toast(t('kennenlernen.zeiten_gespeichert'));
      steuerung.weiter();
      return;
    }
    if (aktion === 'freude') {
      uebernimmFreudeVorschlaege();
      toast(t('kennenlernen.freude_uebernommen'), '💛');
      steuerung.weiter();
      return;
    }
    if (aktion === 'fertig') {
      markiereProfil({ abgeschlossen: heuteKey(), angeboten: profil().angeboten || heuteKey() });
    }
  };

  wurzel.onchange = (e) => {
    const feld = e.target.closest('[name="freitext"]');
    if (!feld) return;
    const id = feld.dataset.frage;
    const wert = Array.isArray(antwort(id)) ? antwort(id) : [];
    const text = feld.value.trim();
    speichereAntwort(id, wert, wert.length || text ? STATUS.BEANTWORTET : STATUS.OHNE, text);
  };
}
