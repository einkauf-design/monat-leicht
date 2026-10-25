// Ansicht „Rückblick“: was in sieben Einträgen sichtbar wird, und zwei bis drei freiwillige Fragen.
// Alles verteilt sich auf Seiten mit ein bis zwei Absätzen.

import { t } from '../inhalte.js';
import { esc, toast } from '../util.js';
import { infoKnopf } from '../info.js';
import { rueckblick, auswertung, markiereGelesen, speichereAntworten, ordnung, frageText } from '../rueckblick.js';
import { verlaengereExperiment, experimentJetzt } from '../daten.js';
import { eingangsfrage, antwort, status, speichereAntwort, STATUS } from '../profil.js';
import { zeigeSeiten, textBloecke, merkeSeite } from '../seiten.js';
import { datumLang, auswahlKnoepfe } from './teile.js';

let steuerung = null;

function paare(liste) {
  const ergebnis = [];
  for (let i = 0; i < liste.length; i += 2) ergebnis.push(liste.slice(i, i + 2));
  return ergebnis;
}

function eingangsAntwortText(frage) {
  const wert = antwort(frage.id);
  const liste = Array.isArray(wert) ? wert : wert ? [wert] : [];
  if (status(frage.id) === STATUS.NOCH_NICHT) return t('kennenlernen.noch_nicht');
  if (status(frage.id) === STATUS.NICHT_SAGEN) return t('kennenlernen.nicht_sagen');
  return liste.map((id) => frage.optionen.find((o) => o.id === id)?.text).filter(Boolean).join(', ');
}

function frageSeite(rb, f, i) {
  const antworten = rb.antworten || {};
  if (f.typ === 'eingang') {
    const frage = eingangsfrage(f.eingangsfrage);
    if (!frage) return null;
    const offen = status(frage.id) === STATUS.NOCH_NICHT && !antworten[f.id];
    return {
      id: `frage-${i}`,
      bloecke: [
        `<h2 class="frage">${esc(frageText(f))}</h2>`,
        `<p class="leise klein">${esc(frage.mehrfach ? t('kennenlernen.mehrfach') : t('kennenlernen.einfach'))}</p>`,
        `<div class="auswahl-liste">${auswahlKnoepfe(frage, offen ? null : antwort(frage.id), 'eingang-option')}</div>`,
        `<div class="auswahl-extra">
          <button type="button" class="auswahl auswahl-leise" data-aktion="eingang-noch-nicht" data-frage="${esc(frage.id)}">${esc(t('kennenlernen.noch_nicht'))}</button>
          <button type="button" class="auswahl auswahl-leise" data-aktion="eingang-nicht-sagen" data-frage="${esc(frage.id)}">${esc(t('kennenlernen.nicht_sagen'))}</button>
        </div>`,
      ],
    };
  }
  return {
    id: `frage-${i}`,
    bloecke: [
      `<label class="feld">
        <span class="feld-name frage">${esc(frageText(f))}</span>
        <textarea name="${esc(f.id)}" rows="4" maxlength="2000" placeholder="${esc(t('rueckblick.antwort_platzhalter'))}">${esc(antworten[f.id] || '')}</textarea>
      </label>`,
      `<button type="button" class="knopf knopf-zweit" data-aktion="antworten">${esc(t('rueckblick.speichern'))}</button>`,
    ],
  };
}

export function zeige(wurzel, ctx) {
  const nummer = Number(ctx.param);
  const rb = rueckblick(nummer);
  if (!rb) {
    zeigeSeiten(wurzel, [{ id: 'fehlt', mitte: true, bloecke: [`<p>${esc(t('rueckblick.nicht_gefunden'))}</p>`] }], {
      schluessel: 'rueckblick-fehlt',
      zurueck: { text: t('seiten.zurueck'), href: '#verlauf' },
    });
    return;
  }
  markiereGelesen(nummer);
  const a = auswertung(rb);

  const gruppen = [{
    id: 'kopf',
    mitte: true,
    bloecke: [
      `<h1>${esc(t('rueckblick.titel', { ordnung: ordnung(nummer) }))}</h1>`,
      `<p>${esc(a.zeitraum)}</p>`,
      `<p class="leise">${esc(t('rueckblick.einleitung'))} ${infoKnopf('rueckblick')}</p>`,
    ],
  }];
  const saetze = a.wenig ? [...a.saetze, t('rueckblick.wenig')] : a.saetze;
  paare(saetze).forEach((paar, i) => {
    gruppen.push({
      id: `sichtbar-${i}`,
      bloecke: [
        i === 0 ? `<h2>${esc(t('rueckblick.beobachtungen_titel'))}</h2>` : '',
        ...paar.map((satz) => `<p>${esc(satz)}</p>`),
      ],
    });
  });
  if (a.koerper.length) {
    gruppen.push({
      id: 'koerper',
      bloecke: [
        `<h2>${esc(t('rueckblick.koerper_titel'))}</h2>`,
        ...a.koerper.map((k) => `
          <div class="beobachtung">
            <p class="beobachtung-datum">${esc(t('experiment.eintrag_datum', { datum: datumLang(k.datum) }))}</p>
            ${textBloecke(k.text, 'beobachtung-text').join('')}
          </div>`),
      ],
    });
  }
  if ((rb.fragen || []).length) {
    gruppen.push({ id: 'fragen', mitte: true, bloecke: [`<h2>${esc(t('rueckblick.fragen_titel'))}</h2>`, ...textBloecke(t('rueckblick.fragen_text'))] });
    rb.fragen.forEach((f, i) => gruppen.push(frageSeite(rb, f, i)));
  }
  if (rb.experimentEnde && experimentJetzt()?.rueckblickNummer === nummer) {
    gruppen.push({
      id: 'naechstes',
      mitte: true,
      bloecke: [
        `<h2>${esc(t('experimentwahl.naechstes_titel'))}</h2>`,
        `<p>${esc(t('experimentwahl.naechstes_text'))}</p>`,
        `<div class="knopf-spalte">
          <a class="knopf knopf-haupt" href="#experiment">${esc(t('experimentwahl.naechstes_knopf'))}</a>
          <button type="button" class="knopf knopf-zweit" data-aktion="bleiben">${esc(t('experimentwahl.bleiben'))}</button>
        </div>`,
      ],
    });
  }
  gruppen.push({
    id: 'abschluss',
    mitte: true,
    bloecke: [`<p>${esc(t('rueckblick.abschluss'))}</p>`, `<a class="knopf knopf-zweit" href="#verlauf">${esc(t('rueckblick.zurueck'))}</a>`],
  });

  steuerung = zeigeSeiten(wurzel, gruppen, {
    schluessel: `rueckblick-${nummer}`,
    zurueck: { text: t('seiten.zurueck'), href: '#verlauf' },
  });

  const sichern = (meldung) => {
    const neu = {};
    for (const feld of wurzel.querySelectorAll('textarea[name]')) neu[feld.name] = feld.value.trim();
    speichereAntworten(nummer, neu);
    if (meldung) toast(t('rueckblick.gespeichert'), '🌱');
  };

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    const aktion = ziel.dataset.aktion;
    if (aktion === 'antworten') {
      sichern(true);
      steuerung.weiter();
      return;
    }
    if (aktion === 'bleiben') {
      verlaengereExperiment();
      toast(t('experimentwahl.geblieben'), '🌱');
      steuerung.weiter();
      return;
    }
    const frage = ziel.dataset.frage ? eingangsfrage(ziel.dataset.frage) : null;
    if (!frage) return;
    const fId = `e-${frage.id}`;
    const gruppe = steuerung.gruppe();
    if (aktion === 'eingang-option') {
      let neu = ziel.dataset.option;
      if (frage.mehrfach) {
        const alt = Array.isArray(antwort(frage.id)) && status(frage.id) === STATUS.BEANTWORTET ? antwort(frage.id) : [];
        if (alt.includes(neu)) neu = alt.filter((o) => o !== neu);
        else if ((frage.exklusiv || []).includes(neu)) neu = [neu];
        else neu = [...alt.filter((o) => !(frage.exklusiv || []).includes(o)), neu];
      }
      // Die neue Antwort gilt ab sofort. Das laufende Experiment bleibt, bis sie es selbst wechselt.
      speichereAntwort(frage.id, neu, Array.isArray(neu) && !neu.length ? STATUS.NOCH_NICHT : STATUS.BEANTWORTET);
    }
    if (aktion === 'eingang-noch-nicht') speichereAntwort(frage.id, null, STATUS.NOCH_NICHT);
    if (aktion === 'eingang-nicht-sagen') speichereAntwort(frage.id, null, STATUS.NICHT_SAGEN);
    speichereAntworten(nummer, { [fId]: eingangsAntwortText(frage) });
    merkeSeite(`rueckblick-${nummer}`, gruppe);
    ctx.zeichne();
    if (!frage.mehrfach || aktion !== 'eingang-option') steuerung.weiter();
  };

  // Antworten speichern sich auch beim Verlassen eines Feldes.
  wurzel.onchange = (e) => {
    if (e.target.matches('textarea[name]')) sichern(false);
  };
}
