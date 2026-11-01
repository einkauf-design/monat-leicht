// Ansicht „Experiment“: genau ein Vorschlag, auf Wunsch ein anderer, die ganze Liste oder ein eigenes Experiment.

import { t } from '../inhalte.js';
import { esc, toast } from '../util.js';
import { experimentJetzt, verlaengereExperiment, experimentVorbei, speichereErkenntnis } from '../daten.js';
import { erkenntnisSeite } from './rueckblick.js';
import { infoKnopf } from '../info.js';
import { rangfolge, katalog, katalogEintrag, starteAusKatalog, starteEigenes, klingtNachVerbot } from '../experimente.js';
import { zeigeSeiten, merkeSeite, seitenZuruecksetzen, textBloecke } from '../seiten.js';
import { hat } from '../profil.js';
import { neuerZustand, schulternGruppen, schulternAktion, vergleichGruppe } from '../schultern.js';
import { speichereBarometer, experimentSchluessel } from '../barometer.js';

// Zustand dieser Ansicht, solange sie offen ist.
let modus = 'vorschlag';
let wieOft = 0;
let gewaehlt = null;
let entwurf = { was: '', wann: '', woran: '' };
// Vor dem Start eines Experiments: wenn ein anderes läuft, erst „Was hast du herausgefunden?“,
// dann immer „Schultern runter“ und das Barometer. Dieser Wert ist der Ausgangspunkt des neuen Experiments.
let wartetAufStart = null;
let phase = null;
let startZustand = null;

export function verlassen() {
  modus = 'vorschlag';
  wieOft = 0;
  gewaehlt = null;
  wartetAufStart = null;
  phase = null;
  startZustand = null;
}

function losGruppe() {
  return {
    id: 'start-los',
    mitte: true,
    bloecke: [
      `<h2>${esc(t('barometer.start_titel'))}</h2>`,
      `<p>${esc(startZustand?.stufe ? t('barometer.start_text') : t('barometer.start_text_ohne'))}</p>`,
      `<button type="button" class="knopf knopf-haupt" data-aktion="experiment-los">${esc(t('barometer.start_knopf'))}</button>`,
    ],
  };
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
  const gruppen = phase === 'erkenntnis'
    ? [vergleichGruppe(experimentJetzt()), erkenntnisSeite(experimentJetzt())].filter(Boolean)
    : phase === 'schultern'
      ? [...schulternGruppen('start', startZustand), losGruppe()]
      : modus === 'liste' ? [listenSeite()] : modus === 'eigen' ? eigeneSeiten() : [vorschlagSeite()];
  zeigeSeiten(wurzel, gruppen, {
    schluessel: phase ? `experiment-${phase}` : 'experiment',
    zurueck: modus === 'vorschlag' && !phase
      ? { text: t('seiten.zurueck'), href: '#heute' }
      : { text: t('seiten.zurueck'), aktion: () => { wartetAufStart = null; phase = null; modus = 'vorschlag'; ctx.zeichne(); } },
  });

  // Vor jedem Start: wenn nötig die Erkenntnis zum jetzigen Experiment, dann immer die Schultern.
  const starte = (fn) => {
    const jetzt = experimentJetzt();
    wartetAufStart = fn;
    startZustand = neuerZustand({ anlass: 'start', sofort: false });
    phase = jetzt && !jetzt.erkenntnis?.text ? 'erkenntnis' : 'schultern';
    seitenZuruecksetzen(`experiment-${phase}`);
    ctx.zeichne();
  };

  const fertig = (text) => {
    verlassen();
    toast(text, '🌱');
    seitenZuruecksetzen('experiment');
    merkeSeite('heute', 'experiment');
    location.hash = '#heute';
  };

  const zuDenSchultern = () => {
    phase = 'schultern';
    seitenZuruecksetzen('experiment-schultern');
    ctx.zeichne();
  };

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    if (phase === 'schultern') {
      const was = schulternAktion(ziel, startZustand, wurzel);
      if (was === 'stufe' || was === 'fertig') {
        // Die letzte Seite weiß dann, ob ein Ausgangspunkt festgehalten wurde.
        merkeSeite('experiment-schultern', was === 'stufe' ? 'start-wo' : 'start-los');
        ctx.zeichne();
        return;
      }
      if (was) return;
    }
    switch (ziel.dataset.aktion) {
      case 'ja': {
        const id = ziel.dataset.id;
        starte(() => starteAusKatalog(id));
        break;
      }
      case 'erkenntnis-speichern': {
        const text = wurzel.querySelector('[data-erkenntnis]')?.value.trim();
        if (text) speichereErkenntnis(text);
        zuDenSchultern();
        break;
      }
      case 'erkenntnis-ohne':
        zuDenSchultern();
        break;
      case 'experiment-los': {
        const zustand = startZustand;
        wartetAufStart?.();
        if (zustand?.stufe) speichereBarometer({ ...zustand, experiment: experimentSchluessel(experimentJetzt()) });
        fertig(t('experimentwahl.gestartet'));
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
