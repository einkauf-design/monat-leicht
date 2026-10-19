// Ansicht „Heute“: Morgeneintrag, Summen im Kopf, Experiment, Freude-Plätze und Abendeintrag.
// Die Reihenfolge der Karten richtet sich nach der Tageszeit.

import { t, inhalt, fuelle } from '../inhalte.js';
import { esc, zahl, leseZahl, zufall, toast, sternchen, ausKey, $, $$ } from '../util.js';
import {
  einstellungen, heuteKey, tag, aendereTag, morgenErledigt, letzterWert,
  summenFesthalten, pauseGenommen, freudeListe, freudeNach, freudeGenossen,
  experiment, speichereExperiment,
} from '../daten.js';

let morgenBearbeiten = false;
let abendBearbeiten = false;
let experimentBearbeiten = false;
let vorschlag = null;

function tageszeit(ctx) {
  if (ctx.abendmodus()) return 'abend';
  const stunde = new Date().getHours();
  if (stunde < 4) return 'nacht';
  if (stunde < 11) return 'morgen';
  if (stunde < 17) return 'tag';
  return 'abend';
}

function datumZeile(datum) {
  const d = ausKey(datum);
  const wochentage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return `${wochentage[d.getDay()]}, ${d.getDate()}. ${inhalt('texte.allgemein.monate')[d.getMonth()]}`;
}

function stunden(wert) {
  return `${zahl(wert, 2).replace(/,?0+$/, '')} ${t('morgen.stunden')}`;
}

/* ---------- Karten ---------- */

function morgenKarte(heute) {
  if (morgenErledigt(heute) && !morgenBearbeiten) {
    return `
      <section class="karte karte-ruhig" aria-labelledby="morgen-titel">
        <div class="karte-kopf">
          <h2 id="morgen-titel"><span class="symbol" aria-hidden="true">☀️</span> ${esc(t('morgen.fertig_titel'))}</h2>
          <button class="knopf-text" data-aktion="morgen-aendern">${esc(t('morgen.aendern'))}</button>
        </div>
        <p>${esc(t('morgen.fertig_text'))}</p>
      </section>`;
  }
  const gewicht = heute.gewicht !== undefined ? zahl(heute.gewicht, 1) : '';
  const einschlaf = heute.einschlafzeit ?? letzterWert('einschlafzeit') ?? '23:00';
  const dauer = heute.schlafdauer ?? letzterWert('schlafdauer') ?? 7;
  return `
    <section class="karte" aria-labelledby="morgen-titel">
      <h2 id="morgen-titel"><span class="symbol" aria-hidden="true">☀️</span> ${esc(t('morgen.titel'))}</h2>
      <p class="leise">${esc(t('morgen.einleitung'))}</p>
      <form class="formular" data-form="morgen" novalidate>
        <label class="feld">
          <span class="feld-name">${esc(t('morgen.gewicht'))}</span>
          <span class="eingabe-mit-einheit">
            <input name="gewicht" type="text" inputmode="decimal" autocomplete="off" value="${esc(gewicht)}" aria-describedby="gewicht-hilfe">
            <span class="einheit">${esc(t('morgen.gewicht_einheit'))}</span>
          </span>
          <span class="feld-hilfe" id="gewicht-hilfe">${esc(t('morgen.gewicht_hilfe'))}</span>
        </label>
        <label class="feld">
          <span class="feld-name">${esc(t('morgen.einschlafzeit'))}</span>
          <input name="einschlafzeit" type="time" value="${esc(einschlaf)}">
        </label>
        <div class="feld">
          <span class="feld-name" id="dauer-name">${esc(t('morgen.schlafdauer'))}</span>
          <div class="stepper" role="group" aria-labelledby="dauer-name">
            <button type="button" class="stepper-knopf" data-aktion="dauer" data-schritt="-0.25" aria-label="weniger">−</button>
            <output class="stepper-wert" data-dauer="${dauer}">${esc(stunden(dauer))}</output>
            <button type="button" class="stepper-knopf" data-aktion="dauer" data-schritt="0.25" aria-label="mehr">+</button>
          </div>
        </div>
        <button class="knopf knopf-haupt" type="submit">${esc(t('morgen.speichern'))}</button>
      </form>
    </section>`;
}

function summenKarte(heute) {
  const anzahl = (heute.summen || []).length;
  const zusatz = anzahl === 0 ? t('summen.knopf_hilfe') : anzahl === 1 ? t('summen.heute_schon_eins') : t('summen.heute_schon', { anzahl });
  let vorschlagHtml = '';
  if (vorschlag) {
    vorschlagHtml = `
      <div class="vorschlag" role="status">
        <h3>${esc(t('summen.vorschlag_titel'))}</h3>
        <p class="vorschlag-text"><span class="symbol gross" aria-hidden="true">${esc(vorschlag.symbol || '💛')}</span> ${esc(vorschlag.text)}</p>
        <div class="knopf-reihe">
          <button class="knopf knopf-haupt" data-aktion="pause-annehmen">${esc(t('summen.annehmen'))}</button>
          <button class="knopf knopf-zweit" data-aktion="pause-anderer">${esc(t('summen.anderer'))}</button>
          <button class="knopf-text" data-aktion="pause-spaeter">${esc(t('summen.spaeter'))}</button>
        </div>
      </div>`;
  }
  return `
    <section class="karte karte-summen" aria-label="${esc(t('summen.knopf'))}">
      <button class="summen-knopf" data-aktion="summen">
        <span class="summen-wellen" aria-hidden="true"></span>
        <span class="summen-text">${esc(t('summen.knopf'))}</span>
      </button>
      <p class="summen-zusatz">${esc(zusatz)}</p>
      ${vorschlagHtml}
    </section>`;
}

function experimentKarte() {
  const ex = experiment();
  const monatName = inhalt('texte.allgemein.monate')[Number(ex.monat.slice(5)) - 1];
  if (experimentBearbeiten) {
    return `
      <section class="karte karte-experiment" aria-labelledby="ex-titel">
        <h2 id="ex-titel"><span class="symbol" aria-hidden="true">🔍</span> ${esc(t('experiment.titel'))}</h2>
        <form class="formular" data-form="experiment">
          <label class="feld">
            <span class="feld-name">${esc(t('experiment.titel_label'))}</span>
            <input name="titel" type="text" value="${esc(ex.titel)}" maxlength="120">
          </label>
          <div class="knopf-reihe">
            <button class="knopf knopf-haupt" type="submit">${esc(t('experiment.speichern'))}</button>
            <button class="knopf-text" type="button" data-aktion="experiment-abbrechen">${esc(t('experiment.abbrechen'))}</button>
          </div>
        </form>
      </section>`;
  }
  return `
    <section class="karte karte-experiment" aria-labelledby="ex-titel">
      <div class="karte-kopf">
        <p class="ueberzeile" id="ex-titel">${esc(t('experiment.titel'))} · ${esc(t('experiment.monat', { monat: monatName }))}</p>
        <button class="knopf-text" data-aktion="experiment-bearbeiten">${esc(t('experiment.bearbeiten'))}</button>
      </div>
      <h2 class="experiment-name">${esc(ex.titel)}</h2>
      ${ex.beschreibung ? `<p>${esc(ex.beschreibung)}</p>` : ''}
      <p class="leise klein">${esc(t('experiment.hinweis'))}</p>
      <label class="feld">
        <span class="feld-name">${esc(t('experiment.notiz_label'))}</span>
        <textarea name="notiz" rows="3" data-feld="experiment-notiz" placeholder="${esc(t('experiment.notiz_platzhalter'))}">${esc(ex.notiz)}</textarea>
      </label>
    </section>`;
}

function freudeKarte(heute) {
  const plaetze = (heute.freudePlaetze || []).map(freudeNach).filter(Boolean);
  const genutzt = new Set(heute.freudeGenutzt || []);
  const inhaltHtml = plaetze.length
    ? `<ul class="freude-plaetze">${plaetze
        .map((f) => {
          const ist = genutzt.has(f.id);
          return `
            <li class="freude-platz ${ist ? 'genutzt' : ''}">
              <span class="symbol gross" aria-hidden="true">${esc(f.symbol || '💛')}</span>
              <span class="freude-titel">${esc(f.titel)}</span>
              ${ist
                ? `<span class="abzeichen"><span aria-hidden="true">★</span> ${esc(t('freudeplaetze.genutzt'))}</span>`
                : `<button class="knopf knopf-haupt knopf-klein" data-aktion="freude-genossen" data-id="${esc(f.id)}">${esc(t('freudeplaetze.nutzen'))}</button>`}
            </li>`;
        })
        .join('')}</ul>
       <a class="knopf-text" href="#freude">${esc(t('freudeplaetze.zur_liste'))}</a>`
    : `<p>${esc(t('freudeplaetze.leer'))}</p><a class="knopf knopf-zweit" href="#freude">${esc(t('freudeplaetze.zur_liste'))}</a>`;
  return `
    <section class="karte" aria-labelledby="freude-titel">
      <h2 id="freude-titel"><span class="symbol" aria-hidden="true">💛</span> ${esc(t('freudeplaetze.titel'))}</h2>
      ${inhaltHtml}
    </section>`;
}

function abendKarte(heute) {
  const stufen = inhalt('texte.abendeintrag.stufen', []);
  if (heute.anspannung && !abendBearbeiten) {
    return `
      <section class="karte karte-abend" aria-labelledby="abend-titel">
        <div class="karte-kopf">
          <h2 id="abend-titel"><span class="symbol" aria-hidden="true">🌙</span> ${esc(t('abendeintrag.fertig_titel'))}</h2>
          <button class="knopf-text" data-aktion="abend-aendern">${esc(t('abendeintrag.aendern'))}</button>
        </div>
        <p>${esc(t('abendeintrag.fertig_text'))}</p>
        <a class="knopf knopf-haupt" href="#abend">${esc(t('abendeintrag.zum_abend'))}</a>
      </section>`;
  }
  return `
    <section class="karte karte-abend" aria-labelledby="abend-titel">
      <h2 id="abend-titel"><span class="symbol" aria-hidden="true">🌙</span> ${esc(t('abendeintrag.titel'))}</h2>
      <p class="leise">${esc(t('abendeintrag.frage'))}</p>
      <div class="skala" role="radiogroup" aria-labelledby="abend-titel">
        ${stufen
          .map((wort, i) => {
            const wert = i + 1;
            const an = heute.anspannung === wert;
            return `
              <button class="skala-stufe" role="radio" aria-checked="${an}" data-aktion="anspannung" data-wert="${wert}" style="--stufe:${wert}">
                <span class="skala-punkt" aria-hidden="true"></span>
                <span class="skala-wort">${esc(wort)}</span>
              </button>`;
          })
          .join('')}
      </div>
      <form class="formular" data-form="abend">
        <label class="feld">
          <span class="feld-name">${esc(t('abendeintrag.satz_label'))}</span>
          <textarea name="satz" rows="2" maxlength="400" placeholder="${esc(t('abendeintrag.satz_platzhalter'))}">${esc(heute.satz || '')}</textarea>
        </label>
        <button class="knopf knopf-haupt" type="submit" ${heute.anspannung ? '' : 'disabled'}>${esc(t('abendeintrag.speichern'))}</button>
      </form>
    </section>`;
}

/* ---------- Aufbau ---------- */

export function zeige(wurzel, ctx) {
  const datum = heuteKey();
  const heute = tag(datum);
  const zeit = tageszeit(ctx);
  const name = einstellungen().name || '';
  const gruss = t(`begruessung.${zeit === 'nacht' ? 'nacht' : zeit}`, { name }).replace(/,\s*\./, '.');

  const morgenFertig = morgenErledigt(heute) || zeit !== 'morgen';
  const karten = [];
  if (zeit === 'abend' || zeit === 'nacht') {
    karten.push(abendKarte(heute), freudeKarte(heute), summenKarte(heute), experimentKarte());
    if (!morgenErledigt(heute) || morgenBearbeiten) karten.push(morgenKarte(heute));
  } else {
    karten.push(morgenKarte(heute));
    if (morgenFertig) karten.push(experimentKarte(), freudeKarte(heute));
    karten.push(summenKarte(heute));
  }

  wurzel.innerHTML = `
    <header class="seiten-kopf">
      <p class="ueberzeile">${esc(datumZeile(datum))}</p>
      <h1>${esc(gruss)}</h1>
    </header>
    ${karten.join('')}`;

  binde(wurzel, ctx, datum);
}

function binde(wurzel, ctx, datum) {
  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    const aktion = ziel.dataset.aktion;

    if (aktion === 'dauer') {
      const ausgabe = $('.stepper-wert', wurzel);
      const neu = Math.min(14, Math.max(0, Number(ausgabe.dataset.dauer) + Number(ziel.dataset.schritt)));
      ausgabe.dataset.dauer = neu;
      ausgabe.textContent = stunden(neu);
      return;
    }
    if (aktion === 'morgen-aendern') { morgenBearbeiten = true; ctx.zeichne(); return; }
    if (aktion === 'abend-aendern') { abendBearbeiten = true; ctx.zeichne(); return; }
    if (aktion === 'experiment-bearbeiten') { experimentBearbeiten = true; ctx.zeichne(); return; }
    if (aktion === 'experiment-abbrechen') { experimentBearbeiten = false; ctx.zeichne(); return; }

    if (aktion === 'summen') {
      summenFesthalten();
      neuerVorschlag();
      ctx.zeichne();
      toast(t('summen.danke'), '🫧');
      return;
    }
    if (aktion === 'pause-anderer') { neuerVorschlag(vorschlag?.id); ctx.zeichne(); return; }
    if (aktion === 'pause-spaeter') { vorschlag = null; ctx.zeichne(); return; }
    if (aktion === 'pause-annehmen') {
      pauseGenommen();
      vorschlag = null;
      sternchen(ziel, 4);
      ctx.zeichne();
      toast(t('summen.angenommen'), '🍃');
      return;
    }
    if (aktion === 'freude-genossen') {
      sternchen(ziel, 6);
      freudeGenossen(ziel.dataset.id);
      ctx.zeichne();
      toast(t('freudeplaetze.belohnung'), '★');
      return;
    }
    if (aktion === 'anspannung') {
      const wert = Number(ziel.dataset.wert);
      aendereTag(datum, (tg) => { tg.anspannung = wert; });
      $$('.skala-stufe', wurzel).forEach((s) => s.setAttribute('aria-checked', String(Number(s.dataset.wert) === wert)));
      const knopf = $('[data-form="abend"] button[type="submit"]', wurzel);
      if (knopf) knopf.disabled = false;
      return;
    }
  };

  wurzel.onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.dataset.form === 'morgen') {
      const gewicht = leseZahl(form.gewicht.value);
      const einschlafzeit = form.einschlafzeit.value || null;
      const dauer = Number($('.stepper-wert', form).dataset.dauer);
      aendereTag(datum, (tg) => {
        if (gewicht !== null && gewicht > 20 && gewicht < 400) tg.gewicht = Math.round(gewicht * 10) / 10;
        else delete tg.gewicht;
        if (einschlafzeit) tg.einschlafzeit = einschlafzeit;
        else delete tg.einschlafzeit;
        tg.schlafdauer = dauer;
      });
      morgenBearbeiten = false;
      ctx.zeichne();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (form.dataset.form === 'abend') {
      const satz = form.satz.value.trim();
      const knopf = form.querySelector('button[type="submit"]');
      aendereTag(datum, (tg) => {
        if (satz) tg.satz = satz;
        else delete tg.satz;
      });
      sternchen(knopf, 5);
      abendBearbeiten = false;
      ctx.zeichne();
      toast(t('belohnung.abend_gelandet'), '🌙');
    }
    if (form.dataset.form === 'experiment') {
      const titel = form.titel.value.trim();
      if (titel) speichereExperiment(experiment().monat, { titel, beschreibung: titel === experiment().titel ? experiment().beschreibung : '' });
      experimentBearbeiten = false;
      ctx.zeichne();
    }
  };

  // Die Notiz zum Experiment speichert sich beim Verlassen des Feldes von selbst.
  const notiz = $('[data-feld="experiment-notiz"]', wurzel);
  if (notiz) {
    notiz.onchange = () => {
      speichereExperiment(experiment().monat, { notiz: notiz.value.trim() });
      toast(t('experiment.gespeichert'), '🔍');
    };
  }
}

function neuerVorschlag(ausserId) {
  const liste = freudeListe();
  let auswahl = liste.filter((f) => f.pause && f.id !== ausserId);
  if (!auswahl.length) auswahl = liste.filter((f) => f.id !== ausserId);
  if (!auswahl.length) auswahl = liste;
  const freude = zufall(auswahl);
  if (!freude) { vorschlag = null; return; }
  vorschlag = {
    id: freude.id,
    symbol: freude.symbol,
    text: fuelle(zufall(inhalt('pausenImpulse', ['{freude}'])), { freude: freude.titel }),
  };
}
