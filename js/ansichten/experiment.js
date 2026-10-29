// Ansicht „Experiment“: genau ein Vorschlag, auf Wunsch ein anderer, die ganze Liste oder ein eigenes Experiment.

import { t } from '../inhalte.js';
import { esc, toast } from '../util.js';
import { experimentJetzt, verlaengereExperiment, experimentVorbei, speichereErkenntnis } from '../daten.js';
import { erkenntnisSeite } from './rueckblick.js';
import { infoKnopf } from '../info.js';
import { rangfolge, katalog, katalogEintrag, starteAusKatalog, starteEigenes, klingtNachVerbot } from '../experimente.js';
import { zeigeSeiten, merkeSeite, seitenZuruecksetzen, textBloecke } from '../seiten.js';
import { hat } from '../profil.js';

// Zustand dieser Ansicht, solange sie offen ist.
let modus = 'vorschlag';
let wieOft = 0;
let gewaehlt = null;
let entwurf = { was: '', wann: '', woran: '' };
// Wer ein neues Experiment startet, wird vorher einmal gefragt, was sie beim jetzigen herausgefunden hat.
let wartetAufStart = null;

export function verlassen() {
  modus = 'vorschlag';
  wieOft = 0;
  gewaehlt = null;
  wartetAufStart = null;
}

function infoFuer(e) {
  if (e.id === 'kaffee' && hat('kaffeewirkung', 'ruhig')) return 'kaffeeRuhig';
  return e.info || 'experiment';
}

function vorschlagSeite() {
  const liste = rangfolge();
  const e = (gewaehlt && katalogEintrag(gewaehlt)) || liste[wieOft % Math.max(1, liste.length)];
  if (!e) return { id: 'vorschlag', bloecke: [`<p>${esc(t('experimentwahl.liste_text'))}</p>`] };
  const jetzt = experimentJetzt();
  return {
    id: 'vorschlag',
    klasse: 'seite-vorschlag',
    bloecke: [
      `<p class="ueberzeile">${esc(t('experimentwahl.vorschlag_titel'))} ${esc(t('experimentwahl.vorschlag_text'))}</p>`,
      `<h2 class="experiment-name">${esc(e.titel)} ${infoKnopf(infoFuer(e))}</h2>`,
      ...textBloecke(e.beschreibung),
      `<div class="knopf-spalte eng">
        <button type="button" class="knopf knopf-haupt" data-aktion="ja" data-id="${esc(e.id)}">${esc(t('experimentwahl.ja'))}</button>
        <button type="button" class="knopf knopf-zweit" data-aktion="anderes">${esc(t('experimentwahl.anderes'))}</button>
        <button type="button" class="knopf-text" data-aktion="eigenes">${esc(t('experimentwahl.eigenes'))}</button>
        ${jetzt ? `<button type="button" class="knopf-text leise-knopf" data-aktion="bleiben">${esc(t('experimentwahl.bleiben'))}</button>` : ''}
      </div>`,
    ],
  };
}

function listenSeite() {
  const moegliche = new Set(rangfolge().map((e) => e.id));
  return {
    id: 'liste',
    bloecke: [
      `<h2>${esc(t('experimentwahl.liste_titel'))}</h2>`,
      `<p class="leise">${esc(t('experimentwahl.liste_text'))}</p>`,
      ...katalog().filter((e) => moegliche.has(e.id)).map((e) => `
        <button type="button" class="experiment-wahl" data-aktion="waehle" data-id="${esc(e.id)}">
          <span class="experiment-wahl-titel">${esc(e.titel)}</span>
          <span class="experiment-wahl-text">${esc(e.beschreibung)}</span>
        </button>`),
      `<button type="button" class="knopf-text" data-aktion="eigenes">${esc(t('experimentwahl.eigenes'))}</button>`,
    ],
  };
}

function eigeneSeiten() {
  const feld = (name, beispiel, label) => `
    <label class="feld">
      <span class="feld-name">${esc(label)}</span>
      <textarea name="${name}" rows="2" maxlength="300" placeholder="${esc(beispiel)}">${esc(entwurf[name])}</textarea>
    </label>`;
  return [
    {
      id: 'eigen',
      bloecke: [
        `<h2>${esc(t('experimentwahl.eigen_titel'))}</h2>`,
        `<p class="leise klein">${esc(t('experimentwahl.eigen_text'))}</p>`,
        feld('was', t('experimentwahl.eigen_was_beispiel'), t('experimentwahl.eigen_was')),
        feld('wann', t('experimentwahl.eigen_wann_beispiel'), t('experimentwahl.eigen_wann')),
      ],
    },
    {
      id: 'eigen-2',
      bloecke: [
        feld('woran', t('experimentwahl.eigen_woran_beispiel'), t('experimentwahl.eigen_woran')),
        `<button type="button" class="knopf knopf-haupt" data-aktion="eigen-speichern">${esc(t('experimentwahl.eigen_speichern'))}</button>`,
      ],
    },
  ];
}

export function zeige(wurzel, ctx) {
  const gruppen = wartetAufStart
    ? [erkenntnisSeite(experimentJetzt())]
    : modus === 'liste' ? [listenSeite()] : modus === 'eigen' ? eigeneSeiten() : [vorschlagSeite()];
  zeigeSeiten(wurzel, gruppen, {
    schluessel: wartetAufStart ? 'experiment-erkenntnis' : 'experiment',
    zurueck: modus === 'vorschlag' && !wartetAufStart
      ? { text: t('seiten.zurueck'), href: '#heute' }
      : { text: t('seiten.zurueck'), aktion: () => { wartetAufStart = null; modus = 'vorschlag'; ctx.zeichne(); } },
  });

  // Startet sofort, oder fragt zuerst nach der Erkenntnis, wenn ein anderes Experiment läuft und noch keine notiert ist.
  const starte = (fn) => {
    const jetzt = experimentJetzt();
    if (jetzt && !jetzt.erkenntnis?.text && !wartetAufStart) {
      wartetAufStart = fn;
      ctx.zeichne();
      return;
    }
    fn();
  };

  const fertig = (text) => {
    verlassen();
    toast(text, '🌱');
    seitenZuruecksetzen('experiment');
    merkeSeite('heute', 'experiment');
    location.hash = '#heute';
  };

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    switch (ziel.dataset.aktion) {
      case 'ja': {
        const id = ziel.dataset.id;
        starte(() => { starteAusKatalog(id); fertig(t('experimentwahl.gestartet')); });
        break;
      }
      case 'erkenntnis-speichern': {
        const text = wurzel.querySelector('[data-erkenntnis]')?.value.trim();
        if (text) speichereErkenntnis(text);
        const weiter = wartetAufStart;
        wartetAufStart = null;
        weiter?.();
        break;
      }
      case 'erkenntnis-ohne': {
        const weiter = wartetAufStart;
        wartetAufStart = null;
        weiter?.();
        break;
      }
      case 'anderes':
        gewaehlt = null;
        wieOft += 1;
        if (wieOft >= 3) modus = 'liste';
        ctx.zeichne();
        break;
      case 'waehle':
        gewaehlt = ziel.dataset.id;
        modus = 'vorschlag';
        ctx.zeichne();
        break;
      case 'eigenes':
        modus = 'eigen';
        ctx.zeichne();
        break;
      case 'bleiben':
        // Verlängert wird nur, wenn der Monat schon um ist. Sonst läuft es einfach weiter.
        if (experimentVorbei()) verlaengereExperiment();
        fertig(t('experimentwahl.geblieben'));
        break;
      case 'eigen-speichern': {
        if (!entwurf.was.trim()) {
          toast(t('experimentwahl.eigen_leer'));
          wurzel.querySelector('[name="was"]')?.focus();
          return;
        }
        const daten = { was: entwurf.was.trim(), wann: entwurf.wann.trim(), woran: entwurf.woran.trim() };
        starte(() => {
          starteEigenes(daten);
          entwurf = { was: '', wann: '', woran: '' };
          fertig(t('experimentwahl.gestartet'));
        });
        break;
      }
    }
  };

  // Der sanfte Hinweis erscheint als Meldung, sobald eine Formulierung nach Verbot klingt. Speichern geht trotzdem.
  let klangVorher = klingtNachVerbot(`${entwurf.was} ${entwurf.wann} ${entwurf.woran}`);
  wurzel.oninput = (e) => {
    const feld = e.target.closest('textarea[name]');
    if (!feld || modus !== 'eigen') return;
    entwurf[feld.name] = feld.value;
    const klang = klingtNachVerbot(`${entwurf.was} ${entwurf.wann} ${entwurf.woran}`);
    if (klang && !klangVorher) toast(t('experimentwahl.eigen_verbot'), '🌱', null, 7000);
    klangVorher = klang;
  };
}
