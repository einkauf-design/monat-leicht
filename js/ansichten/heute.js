// Ansicht „Heute“: eine Seite nach der anderen.
// Morgens beginnt es mit dem Morgeneintrag, abends mit dem Abendeintrag.

import { t, inhalt, fuelle } from '../inhalte.js';
import { esc, zahl, leseZahl, zufall, toast, sternchen, ausKey, $, $$ } from '../util.js';
import {
  einstellungen, heuteKey, tag, aendereTag, morgenErledigt, letzterWert,
  summenFesthalten, pauseGenommen, freudeListe, freudeNach, freudeGenossen,
  beobachtungen, speichereBeobachtung, experimentJetzt, experimentVorbei,
} from '../daten.js';
import { infoKnopf, infoFuerExperiment } from '../info.js';
import { rueckblicke, ungelesenerRueckblick, datumKurz } from '../rueckblick.js';
import { gewichtModus, sprunghaft, gesundheitHat } from '../profil.js';
import { api } from '../speicher.js';
import { zeigeSeiten, textBloecke } from '../seiten.js';
import { feldKopf, stundenText, bestaetige } from './teile.js';

let morgenBearbeiten = false;
let abendBearbeiten = false;
let mehrEintragen = false;
let vorschlag = null;
let steuerung = null;

function tageszeit(ctx) {
  if (ctx.abendmodus()) return 'abend';
  const stunde = new Date().getHours();
  if (stunde < 4) return 'nacht';
  if (stunde < 11) return 'morgen';
  if (stunde < 17) return 'tag';
  return 'abend';
}

function haltungsSatz(datum) {
  const saetze = inhalt('texte.haltung.saetze', []);
  if (!saetze.length) return '';
  return saetze[Math.floor(ausKey(datum).getTime() / 86400000) % saetze.length];
}

// Soll heute nach dem Gewicht gefragt werden?
function gewichtHeute(datum) {
  const modus = gewichtModus();
  if (modus === 'aus') return false;
  if (modus === 'woche') return ausKey(datum).getDay() === Number(einstellungen().wiegetag ?? 1);
  return true;
}

/* ---------- Seiten ---------- */

function startSeite(datum, zeit) {
  const name = einstellungen().name || '';
  const gruss = t(`begruessung.${zeit === 'nacht' ? 'nacht' : zeit}`, { name }).replace(/,\s*\./, '.');
  const d = ausKey(datum);
  const neu = ungelesenerRueckblick();
  const bloecke = [
    `<p class="ueberzeile">${esc(t('heute.datum', {
      wochentag: inhalt('texte.allgemein.wochentage')[d.getDay()],
      tag: d.getDate(),
      monat: inhalt('texte.allgemein.monate')[d.getMonth()],
    }))}</p>`,
    `<h1>${esc(gruss)}</h1>`,
    `<p class="haltung">${esc(haltungsSatz(datum))}</p>`,
  ];
  const art = sessionStorage.getItem('emona-erinnerung');
  if (art && sprunghaft()) {
    bloecke.push(`
      <div class="hinweis-kasten">
        <p>${esc(t('erinnerung_spaeter.frage'))}</p>
        <button class="knopf knopf-zweit" data-aktion="spaeter-erinnern" data-art="${esc(art)}">${esc(t('erinnerung_spaeter.knopf'))}</button>
      </div>`);
  }
  if (neu) {
    bloecke.push(`
      <div class="hinweis-kasten karte-rueckblick">
        <h2><span class="symbol" aria-hidden="true">✨</span> ${esc(t('rueckblick.neu_titel'))}</h2>
        <p>${esc(t('rueckblick.neu_text'))}</p>
        <a class="knopf knopf-haupt" href="#rueckblick/${neu.nummer}">${esc(t('rueckblick.oeffnen'))}</a>
      </div>`);
  } else if (!rueckblicke().length) {
    bloecke.push(`<p class="leise klein block-abstand">${esc(t('rueckblick.hinweis_sieben'))} ${infoKnopf('rueckblick')}</p>`);
  }
  return { id: 'start', bloecke, mitte: true };
}

function morgenSeiten(heute, datum) {
  if (morgenErledigt(heute) && !morgenBearbeiten) {
    return [{
      id: 'morgen',
      mitte: true,
      bloecke: [
        `<h2>${esc(t('morgen.fertig_titel'))}</h2>`,
        ...textBloecke(t('morgen.fertig_text')),
        `<button class="knopf-text" data-aktion="morgen-aendern">${esc(t('morgen.aendern'))}</button>`,
      ],
    }];
  }
  const kurz = sprunghaft() && !mehrEintragen && !morgenBearbeiten;
  const mitGewicht = gewichtHeute(datum) || (heute.gewicht !== undefined && gewichtModus() !== 'aus');
  const gewicht = heute.gewicht !== undefined ? zahl(heute.gewicht, 1) : '';
  const einschlaf = heute.einschlafzeit ?? letzterWert('einschlafzeit') ?? '23:00';
  const dauer = heute.schlafdauer ?? letzterWert('schlafdauer') ?? 7;
  const taille = heute.taille !== undefined ? zahl(heute.taille, 1).replace(/,0$/, '') : '';
  const speichern = `<button class="knopf knopf-haupt" data-aktion="morgen-speichern">${esc(t('morgen.speichern'))}</button>`;
  const kopf = [`<h2>${esc(t('morgen.titel'))}</h2>`, `<p class="leise">${esc(t('morgen.einleitung'))}</p>`];

  const seiten = [];
  if (mitGewicht && !kurz) {
    seiten.push({
      id: 'morgen-gewicht',
      bloecke: [
        ...kopf,
        `<label class="feld">
          ${feldKopf(t('morgen.gewicht'), 'gewicht')}
          <span class="eingabe-mit-einheit">
            <input name="gewicht" type="text" inputmode="decimal" autocomplete="off" value="${esc(gewicht)}" aria-describedby="gewicht-hilfe">
            <span class="einheit">${esc(t('morgen.gewicht_einheit'))}</span>
          </span>
          <span class="feld-hilfe" id="gewicht-hilfe">${esc(t('morgen.gewicht_hilfe'))}</span>
        </label>`,
        gesundheitHat('schilddruese') || gesundheitHat('medikamente') ? `<p class="hinweis klein">${esc(t('gesundheit.gewicht_hinweis'))}</p>` : '',
      ],
    });
  }
  seiten.push({
    id: 'morgen-schlaf',
    bloecke: [
      ...(seiten.length ? [] : kopf),
      `<label class="feld">
        ${feldKopf(t('morgen.einschlafzeit'), 'einschlafzeit')}
        <input name="einschlafzeit" type="time" value="${esc(einschlaf)}">
      </label>`,
      `<div class="feld">
        ${feldKopf(t('morgen.schlafdauer'), 'schlafdauer', 'dauer-name')}
        <div class="stepper" role="group" aria-labelledby="dauer-name">
          <button type="button" class="stepper-knopf" data-aktion="dauer" data-schritt="-0.25" aria-label="${esc(t('morgen.weniger'))}">−</button>
          <output class="stepper-wert" data-dauer="${dauer}">${esc(stundenText(dauer))}</output>
          <button type="button" class="stepper-knopf" data-aktion="dauer" data-schritt="0.25" aria-label="${esc(t('morgen.mehr'))}">+</button>
        </div>
      </div>`,
      kurz ? speichern : '',
      kurz ? `<button class="knopf-text" data-aktion="mehr-eintragen">${esc(t('morgen.koerper_zusammenfassung'))}</button>` : '',
    ],
  });
  if (!kurz) {
    seiten.push({
      id: 'morgen-koerper',
      bloecke: [
        `<p class="feld-name">${esc(t('morgen.koerper_zusammenfassung'))}</p>`,
        `<label class="feld">
          ${feldKopf(t('morgen.taille'), 'taille')}
          <span class="eingabe-mit-einheit">
            <input name="taille" type="text" inputmode="decimal" autocomplete="off" value="${esc(taille)}" aria-describedby="taille-hilfe">
            <span class="einheit">${esc(t('morgen.taille_einheit'))}</span>
          </span>
          <span class="feld-hilfe" id="taille-hilfe">${esc(t('morgen.taille_hilfe'))}</span>
        </label>`,
        `<label class="feld">
          ${feldKopf(t('morgen.koerper'), 'koerper')}
          <textarea name="koerper" rows="2" maxlength="600" placeholder="${esc(t('morgen.koerper_platzhalter'))}">${esc(heute.koerper || '')}</textarea>
        </label>`,
        speichern,
      ],
    });
  }
  return seiten;
}

function experimentSeite() {
  const v = experimentJetzt();
  if (!v) {
    return {
      id: 'experiment',
      mitte: true,
      bloecke: [
        `<h2>${esc(t('experimentwahl.keins_titel'))} ${infoKnopf('experiment')}</h2>`,
        ...textBloecke(t('experimentwahl.keins_text')),
        `<a class="knopf knopf-haupt" href="#experiment">${esc(t('experimentwahl.keins_knopf'))}</a>`,
      ],
    };
  }
  const vorbei = experimentVorbei(v);
  const bloecke = [
    `<p class="ueberzeile">${esc(vorbei ? t('experiment.titel') : t('experimentwahl.laeuft', { ende: datumKurz(v.ende) }))}</p>`,
    `<h2 class="experiment-name">${esc(v.titel)} ${infoKnopf(v.info || infoFuerExperiment(v.titel))}</h2>`,
  ];
  if (v.beschreibung) bloecke.push(...textBloecke(v.beschreibung));
  if (v.wann) bloecke.push(`<p>${esc(t('experimentwahl.eigen_wann_anzeige', { text: v.wann }))}</p>`);
  if (v.woran) bloecke.push(`<p>${esc(t('experimentwahl.eigen_woran_anzeige', { text: v.woran }))}</p>`);
  bloecke.push(`<p class="leise klein">${esc(vorbei ? t('experimentwahl.vorbei') : t('experiment.hinweis'))}</p>`);
  bloecke.push(`<a class="knopf-text" href="#experiment">${esc(t('experimentwahl.wechseln'))}</a>`);
  return { id: 'experiment', klasse: 'seite-experiment', bloecke };
}

function beobachtungsSeiten(datum) {
  const alle = beobachtungen();
  const heutige = alle.filter((b) => b.datum === datum);
  const seiten = [{
    id: 'beobachtung',
    bloecke: [
      `<label class="feld">
        ${feldKopf(t('experiment.notiz_label'), 'beobachtungen')}
        <textarea name="beobachtung" rows="3" maxlength="1500" placeholder="${esc(t('experiment.notiz_platzhalter'))}" aria-describedby="beobachtung-hilfe"></textarea>
        <span class="feld-hilfe" id="beobachtung-hilfe">${esc(t('experiment.notiz_hilfe'))}</span>
      </label>`,
      `<button class="knopf knopf-zweit" data-aktion="beobachtung-speichern">${esc(t('experiment.notiz_speichern'))}</button>`,
      alle.some((b) => b.datum !== datum) ? `<a class="knopf-text" href="#notizen">${esc(t('experiment.fruehere_zeigen'))}</a>` : '',
    ],
  }];
  if (heutige.length) {
    seiten.push({
      id: 'beobachtung-heute',
      bloecke: [
        `<p class="feld-name">${esc(t('experiment.heute_notiert'))}</p>`,
        ...heutige.map((b) => `<div class="beobachtung">${textBloecke(b.text, 'beobachtung-text').join('')}</div>`),
      ],
    });
  }
  return seiten;
}

function freudeSeite(heute) {
  const plaetze = (heute.freudePlaetze || []).map(freudeNach).filter(Boolean);
  const genutzt = new Set(heute.freudeGenutzt || []);
  const titel = `<h2><span class="symbol" aria-hidden="true">💛</span> ${esc(t('freudeplaetze.titel'))} ${infoKnopf('freude')}</h2>`;
  if (!plaetze.length) {
    return {
      id: 'freude',
      mitte: true,
      bloecke: [titel, `<p>${esc(t('freudeplaetze.leer'))}</p>`, `<a class="knopf knopf-zweit" href="#freude">${esc(t('freudeplaetze.zur_liste'))}</a>`],
    };
  }
  return {
    id: 'freude',
    bloecke: [
      titel,
      ...plaetze.map((f) => {
        const ist = genutzt.has(f.id);
        return `
          <div class="freude-platz ${ist ? 'genutzt' : ''}">
            <span class="symbol gross" aria-hidden="true">${esc(f.symbol || '💛')}</span>
            <span class="freude-titel">${esc(f.titel)}</span>
            ${ist
              ? `<span class="abzeichen"><span aria-hidden="true">★</span> ${esc(t('freudeplaetze.genutzt'))}</span>`
              : `<button class="knopf knopf-haupt knopf-klein" data-aktion="freude-genossen" data-id="${esc(f.id)}">${esc(t('freudeplaetze.nutzen'))}</button>`}
          </div>`;
      }),
      `<a class="knopf-text" href="#freude">${esc(t('freudeplaetze.zur_liste'))}</a>`,
    ],
  };
}

function summenSeite(heute) {
  if (vorschlag) {
    return {
      id: 'summen',
      mitte: true,
      bloecke: [
        `<h2>${esc(t('summen.vorschlag_titel'))}</h2>`,
        `<p class="vorschlag-text"><span class="symbol gross" aria-hidden="true">${esc(vorschlag.symbol || '💛')}</span> ${esc(vorschlag.text)}</p>`,
        `<div class="knopf-spalte">
          <button class="knopf knopf-haupt" data-aktion="pause-annehmen">${esc(t('summen.annehmen'))}</button>
          <button class="knopf knopf-zweit" data-aktion="pause-anderer">${esc(t('summen.anderer'))}</button>
          <button class="knopf-text" data-aktion="pause-spaeter">${esc(t('summen.spaeter'))}</button>
        </div>`,
      ],
    };
  }
  const anzahl = (heute.summen || []).length;
  const zusatz = anzahl === 0 ? t('summen.knopf_hilfe') : t('summen.heute_schon', { anzahl });
  return {
    id: 'summen',
    mitte: true,
    klasse: 'seite-summen',
    bloecke: [
      `<button class="summen-knopf" data-aktion="summen">
        <span class="summen-wellen" aria-hidden="true"></span>
        <span class="summen-text">${esc(t('summen.knopf'))}</span>
      </button>`,
      `<p class="summen-zusatz">${esc(zusatz)} ${infoKnopf('summen')}</p>`,
    ],
  };
}

function abendSeite(heute) {
  if (heute.anspannung && !abendBearbeiten) {
    return {
      id: 'abend',
      mitte: true,
      bloecke: [
        `<h2>${esc(t('abendeintrag.fertig_titel'))}</h2>`,
        ...textBloecke(t('abendeintrag.fertig_text')),
        `<a class="knopf knopf-haupt" href="#abend">${esc(t('abendeintrag.zum_abend'))}</a>`,
        `<button class="knopf-text" data-aktion="abend-aendern">${esc(t('abendeintrag.aendern'))}</button>`,
      ],
    };
  }
  const stufen = inhalt('texte.abendeintrag.stufen', []);
  return {
    id: 'abend',
    bloecke: [
      `<h2 id="abend-titel">${esc(t('abendeintrag.titel'))} ${infoKnopf('anspannung')}</h2>`,
      `<p class="leise">${esc(t('abendeintrag.frage'))}</p>`,
      `<div class="skala" role="radiogroup" aria-labelledby="abend-titel">
        ${stufen.map((wort, i) => `
          <button class="skala-stufe" role="radio" aria-checked="${heute.anspannung === i + 1}" data-aktion="anspannung" data-wert="${i + 1}" style="--stufe:${i + 1}">
            <span class="skala-punkt" aria-hidden="true"></span>
            <span class="skala-wort">${esc(wort)}</span>
          </button>`).join('')}
      </div>`,
      `<label class="feld">
        <span class="feld-name">${esc(t('abendeintrag.satz_label'))}</span>
        <textarea name="satz" rows="2" maxlength="400" placeholder="${esc(t('abendeintrag.satz_platzhalter'))}">${esc(heute.satz || '')}</textarea>
      </label>`,
      `<button class="knopf knopf-haupt" data-aktion="abend-speichern" ${heute.anspannung ? '' : 'disabled'}>${esc(t('abendeintrag.speichern'))}</button>`,
    ],
  };
}

/* ---------- Aufbau ---------- */

export function zeige(wurzel, ctx) {
  const datum = heuteKey();
  const heute = tag(datum);
  const zeit = tageszeit(ctx);

  const gruppen = [startSeite(datum, zeit)];
  if (zeit === 'abend' || zeit === 'nacht') {
    gruppen.push(abendSeite(heute), freudeSeite(heute), summenSeite(heute), experimentSeite(), ...beobachtungsSeiten(datum));
    if (!morgenErledigt(heute) || morgenBearbeiten) gruppen.push(...morgenSeiten(heute, datum));
  } else {
    gruppen.push(...morgenSeiten(heute, datum), experimentSeite(), ...beobachtungsSeiten(datum), freudeSeite(heute), summenSeite(heute));
    if (new Date().getHours() >= 17) gruppen.push(abendSeite(heute));
  }

  steuerung = zeigeSeiten(wurzel, gruppen, { schluessel: 'heute' });
  binde(wurzel, ctx, datum);
}

function binde(wurzel, ctx, datum) {
  wurzel.onclick = async (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    const aktion = ziel.dataset.aktion;

    if (aktion === 'dauer') {
      const ausgabe = $('.stepper-wert', wurzel);
      const neu = Math.min(14, Math.max(0, Number(ausgabe.dataset.dauer) + Number(ziel.dataset.schritt)));
      ausgabe.dataset.dauer = neu;
      ausgabe.textContent = stundenText(neu);
      return;
    }
    if (aktion === 'morgen-aendern') {
      morgenBearbeiten = true;
      ctx.zeichne();
      steuerung.gehe(wurzel.querySelector('.seite[data-gruppe^="morgen-"]')?.dataset.gruppe);
      return;
    }
    if (aktion === 'abend-aendern') { abendBearbeiten = true; ctx.zeichne(); return; }
    if (aktion === 'mehr-eintragen') {
      mehrEintragen = true;
      ctx.zeichne();
      steuerung.gehe(wurzel.querySelector('.seite[data-gruppe^="morgen-"]')?.dataset.gruppe);
      return;
    }

    if (aktion === 'morgen-speichern') {
      const feld = (name) => wurzel.querySelector(`[name="${name}"]`);
      const gewicht = feld('gewicht') ? leseZahl(feld('gewicht').value) : undefined;
      const einschlafzeit = feld('einschlafzeit')?.value || null;
      const dauer = Number($('.stepper-wert', wurzel).dataset.dauer);
      const taille = feld('taille') ? leseZahl(feld('taille').value) : undefined;
      const koerper = feld('koerper') ? feld('koerper').value.trim() : undefined;
      aendereTag(datum, (tg) => {
        if (gewicht !== undefined) {
          if (gewicht !== null && gewicht > 20 && gewicht < 400) tg.gewicht = Math.round(gewicht * 10) / 10;
          else delete tg.gewicht;
        }
        if (einschlafzeit) tg.einschlafzeit = einschlafzeit;
        else delete tg.einschlafzeit;
        tg.schlafdauer = dauer;
        if (taille !== undefined) {
          if (taille !== null && taille > 30 && taille < 250) tg.taille = Math.round(taille * 10) / 10;
          else delete tg.taille;
        }
        if (koerper !== undefined) {
          if (koerper) tg.koerper = koerper;
          else delete tg.koerper;
        }
      });
      morgenBearbeiten = false;
      mehrEintragen = false;
      ctx.zeichne();
      steuerung.gehe('experiment');
      bestaetige(t('morgen.fertig_titel'), '☀️');
      return;
    }

    if (aktion === 'summen') {
      summenFesthalten();
      neuerVorschlag();
      ctx.zeichne();
      toast(t('summen.danke'));
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
    if (aktion === 'beobachtung-speichern') {
      const text = wurzel.querySelector('[name="beobachtung"]').value.trim();
      if (!text) return;
      speichereBeobachtung(text);
      ctx.zeichne();
      steuerung.gehe('beobachtung-heute');
      bestaetige(t('experiment.gespeichert'), '🔍');
      return;
    }
    if (aktion === 'anspannung') {
      const wert = Number(ziel.dataset.wert);
      aendereTag(datum, (tg) => { tg.anspannung = wert; });
      $$('.skala-stufe', wurzel).forEach((s) => s.setAttribute('aria-checked', String(Number(s.dataset.wert) === wert)));
      const knopf = $('[data-aktion="abend-speichern"]', wurzel);
      if (knopf) knopf.disabled = false;
      return;
    }
    if (aktion === 'abend-speichern') {
      const satz = wurzel.querySelector('[name="satz"]').value.trim();
      aendereTag(datum, (tg) => {
        if (satz) tg.satz = satz;
        else delete tg.satz;
      });
      sternchen(ziel, 5);
      abendBearbeiten = false;
      ctx.zeichne();
      bestaetige(t('belohnung.abend_gelandet'));
      return;
    }
    if (aktion === 'spaeter-erinnern') {
      ziel.disabled = true;
      try {
        await api('spaeter', { art: ziel.dataset.art });
        toast(t('erinnerung_spaeter.ok'), '🔔');
      } catch {
        toast(t('erinnerung_spaeter.fehler'));
      }
      sessionStorage.removeItem('emona-erinnerung');
      ctx.zeichne();
    }
  };
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
