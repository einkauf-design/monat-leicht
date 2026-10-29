// Ansicht „Mein Weg“ (Adresse #verlauf): zuerst, wo du gerade stehst, dann was bisher passiert ist,
// danach die Diagramme. Neutrale Farben, keine Pfeile, keine Bewertung. Gewicht erscheint nur als Durchschnitt.

import { t, inhalt } from '../inhalte.js';
import {
  esc, toast, zahl, mittelwert, isoWoche, wochenMontag, plusTage, logischerTag, ausKey,
  einschlafMinuten, minutenZuZeit, $,
} from '../util.js';
import { alleTage } from '../daten.js';
import { infoKnopf } from '../info.js';
import { stand, ereignisse } from '../weg.js';
import { datumLang, stundenText } from './teile.js';
import { gewichtSichtbar, gesundheitHat } from '../profil.js';
import { zeigeSeiten, textBloecke, merkeSeite } from '../seiten.js';
import { alleNotizen, notiz, setzeNotiz } from '../notizen.js';

const WOCHEN = 8;
let bearbeite = null;
let loeschfrage = false;

function wochenDaten(tage) {
  const nachDatum = Object.fromEntries(tage.map((tg) => [tg.datum, tg]));
  const heute = logischerTag();
  const ersteWoche = plusTage(wochenMontag(heute), -7 * (WOCHEN - 1));
  const wochen = [];
  for (let w = 0; w < WOCHEN; w++) {
    const montag = plusTage(ersteWoche, w * 7);
    const tageDerWoche = [];
    for (let i = 0; i < 7; i++) {
      const tg = nachDatum[plusTage(montag, i)];
      if (tg) tageDerWoche.push(tg);
    }
    const gewichte = tageDerWoche.map((tg) => tg.gewicht);
    const einschlaf = tageDerWoche.map((tg) => einschlafMinuten(tg.einschlafzeit));
    wochen.push({
      montag,
      kw: isoWoche(montag).kw,
      gewicht: mittelwert(gewichte),
      gewichtTage: gewichte.filter((g) => typeof g === 'number').length,
      anspannung: mittelwert(tageDerWoche.map((tg) => tg.anspannung)),
      anspannungTage: tageDerWoche.filter((tg) => tg.anspannung).length,
      einschlaf: mittelwert(einschlaf),
      schlaf: mittelwert(tageDerWoche.map((tg) => tg.schlafdauer)),
      taille: mittelwert(tageDerWoche.map((tg) => tg.taille)),
    });
  }
  return wochen;
}

// Ein Abendwert (1 bis 5) und die folgende Nacht (eingetragen am nächsten Morgen): Einschlafzeit und Schlafdauer.
// Für die Anspannung heißen die Gruppen leicht, mittel, angespannt, für Offenes im Kopf wenig, einiges, viel.
function zusammenhang(tage, feld = 'anspannung', ids = ['leicht', 'mittel', 'angespannt']) {
  const nachDatum = Object.fromEntries(tage.map((tg) => [tg.datum, tg]));
  const gruppen = Object.fromEntries(ids.map((id) => [id, { werte: [], schlaf: [], name: t(`verlauf.gruppe_${id}`) }]));
  for (const tg of tage) {
    if (!tg[feld]) continue;
    const naechster = nachDatum[plusTage(tg.datum, 1)];
    const minuten = einschlafMinuten(naechster?.einschlafzeit);
    const gruppe = gruppen[ids[tg[feld] <= 2 ? 0 : tg[feld] === 3 ? 1 : 2]];
    if (minuten !== null) gruppe.werte.push(minuten);
    if (typeof naechster?.schlafdauer === 'number') gruppe.schlaf.push(naechster.schlafdauer);
  }
  return Object.entries(gruppen).map(([id, g]) => ({
    id, name: g.name, anzahl: g.werte.length, mittel: mittelwert(g.werte), schlaf: mittelwert(g.schlaf), schlafAnzahl: g.schlaf.length,
  }));
}

// Durchschnitt der letzten sieben Tage, nur wo Werte da sind.
function letzteSiebenTage(tage) {
  const ab = plusTage(logischerTag(), -6);
  const woche = tage.filter((tg) => tg.datum >= ab);
  const wert = (feld) => mittelwert(woche.map((tg) => tg[feld]));
  return {
    gewicht: wert('gewicht'),
    taille: wert('taille'),
    schlaf: wert('schlafdauer'),
    einschlaf: mittelwert(woche.map((tg) => einschlafMinuten(tg.einschlafzeit))),
    anspannung: wert('anspannung'),
    offen: wert('offen'),
  };
}

/* ---------- Diagramme als SVG ---------- */

const B = 340; // Breite des Zeichenbereichs (skaliert mit)
const RAND = { links: 34, rechts: 14, oben: 18, unten: 26 };

function xPos(i) {
  return RAND.links + (i + 0.5) * ((B - RAND.links - RAND.rechts) / WOCHEN);
}

function wochenAchse(wochen, hoehe) {
  return wochen
    .map((w, i) => `<text class="achse-text" x="${xPos(i)}" y="${hoehe - 6}" text-anchor="middle">${w.kw}</text>`)
    .join('');
}

// Ein ruhiges Liniendiagramm für Wochendurchschnitte (Gewicht oder Taillenumfang).
function linienDiagramm(wochen, { feld, spielraum, tipp, titel, leer, hoehe = 170 }) {
  const mitWert = wochen.map((w, i) => ({ ...w, i, wert: w[feld] })).filter((w) => w.wert !== null);
  if (!mitWert.length) return `<p class="leise">${esc(leer)}</p>`;
  const H = hoehe;
  const werte = mitWert.map((w) => w.wert);
  // Großzügiger Spielraum, damit kleine Schwankungen ruhig aussehen.
  const min = Math.floor(Math.min(...werte) - spielraum);
  const max = Math.ceil(Math.max(...werte) + spielraum);
  const y = (v) => RAND.oben + (1 - (v - min) / (max - min)) * (H - RAND.oben - RAND.unten);
  const linien = [min, (min + max) / 2, max]
    .map((v) => `<line class="gitter" x1="${RAND.links}" x2="${B - RAND.rechts}" y1="${y(v)}" y2="${y(v)}"/><text class="achse-text" x="${RAND.links - 6}" y="${y(v) + 4}" text-anchor="end">${zahl(v, 0)}</text>`)
    .join('');
  const pfad = mitWert.map((w, j) => `${j ? 'L' : 'M'}${xPos(w.i)},${y(w.wert)}`).join(' ');
  const letzter = mitWert[mitWert.length - 1];
  const punkte = mitWert
    .map((w) => {
      return `<g class="punkt-gruppe" tabindex="0" data-tipp="${esc(tipp(w))}">
          <circle class="trefferflaeche" cx="${xPos(w.i)}" cy="${y(w.wert)}" r="16"/>
          <circle class="punkt punkt-petrol" cx="${xPos(w.i)}" cy="${y(w.wert)}" r="4.5"/>
        </g>`;
    })
    .join('');
  return `
    <svg class="diagramm" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(titel)}">
      ${linien}
      <path class="linie linie-petrol" d="${pfad}"/>
      ${punkte}
      <text class="wert-text" x="${xPos(letzter.i)}" y="${y(letzter.wert) - 11}" text-anchor="middle">${zahl(letzter.wert, 1)}</text>
      ${wochenAchse(wochen, H)}
    </svg>`;
}

function anspannungDiagramm(wochen) {
  if (!wochen.some((w) => w.anspannung !== null)) return `<p class="leise">${esc(t('verlauf.keine_daten'))}</p>`;
  const H = 150;
  const y = (v) => RAND.oben + (1 - (v - 0) / 5) * (H - RAND.oben - RAND.unten);
  const breite = ((B - RAND.links - RAND.rechts) / WOCHEN) * 0.46;
  const linien = [1, 3, 5]
    .map((v) => `<line class="gitter" x1="${RAND.links}" x2="${B - RAND.rechts}" y1="${y(v)}" y2="${y(v)}"/><text class="achse-text" x="${RAND.links - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`)
    .join('');
  const saeulen = wochen
    .map((w, i) => {
      if (w.anspannung === null) return '';
      const oben = y(w.anspannung);
      const unten = y(0);
      const r = Math.min(4, (unten - oben) / 2);
      const x = xPos(i) - breite / 2;
      const tipp = t('verlauf.tipp_anspannung', { kw: w.kw, wert: zahl(w.anspannung, 1), anzahl: w.anspannungTage });
      return `<g class="punkt-gruppe" tabindex="0" data-tipp="${esc(tipp)}">
          <rect class="trefferflaeche" x="${x - 6}" y="${RAND.oben}" width="${breite + 12}" height="${unten - RAND.oben}"/>
          <path class="saeule" d="M${x},${unten} V${oben + r} Q${x},${oben} ${x + r},${oben} H${x + breite - r} Q${x + breite},${oben} ${x + breite},${oben + r} V${unten} Z"/>
        </g>`;
    })
    .join('');
  return `
    <svg class="diagramm" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(t('verlauf.anspannung_titel'))}">
      ${linien}
      <line class="grundlinie" x1="${RAND.links}" x2="${B - RAND.rechts}" y1="${y(0)}" y2="${y(0)}"/>
      ${saeulen}
      ${wochenAchse(wochen, H)}
    </svg>`;
}

function zusammenhangDiagramm(gruppen, titel = t('verlauf.zusammenhang_titel')) {
  const mit = gruppen.filter((g) => g.mittel !== null);
  const genug = mit.length >= 2 && mit.reduce((s, g) => s + g.anzahl, 0) >= 4;
  if (!genug) return `<p class="leise">${esc(t('verlauf.zu_wenig'))}</p>`;
  const H = 40 + gruppen.length * 46;
  const links = 112;
  const rechts = B - 18;
  const werte = mit.map((g) => g.mittel);
  const min = Math.floor((Math.min(...werte) - 30) / 60) * 60;
  const max = Math.ceil((Math.max(...werte) + 30) / 60) * 60;
  const x = (m) => links + ((m - min) / (max - min)) * (rechts - links);
  const stunden = [];
  for (let m = min; m <= max; m += 60) stunden.push(m);
  const gitter = stunden
    .map((m) => `<line class="gitter" x1="${x(m)}" x2="${x(m)}" y1="14" y2="${H - 24}"/><text class="achse-text" x="${x(m)}" y="${H - 8}" text-anchor="middle">${minutenZuZeit(m)}</text>`)
    .join('');
  const zeilen = gruppen
    .map((g, i) => {
      const yy = 34 + i * 46;
      const name = `<text class="beschriftung" x="0" y="${yy + 4}">${esc(g.name)}</text><text class="achse-text" x="0" y="${yy + 19}">${esc(t('verlauf.nach_tagen', { anzahl: g.anzahl }))}</text>`;
      if (g.mittel === null) return name;
      const tipp = t('verlauf.tipp_zusammenhang', { gruppe: t(`verlauf.tipp_gruppe_${g.id}`), zeit: minutenZuZeit(g.mittel), anzahl: g.anzahl });
      return `${name}
        <line class="spur" x1="${links}" x2="${rechts}" y1="${yy}" y2="${yy}"/>
        <g class="punkt-gruppe" tabindex="0" data-tipp="${esc(tipp)}">
          <circle class="trefferflaeche" cx="${x(g.mittel)}" cy="${yy}" r="16"/>
          <circle class="punkt punkt-pflaume" cx="${x(g.mittel)}" cy="${yy}" r="6"/>
        </g>
        <text class="wert-text" x="${x(g.mittel)}" y="${yy - 11}" text-anchor="middle">${minutenZuZeit(g.mittel)}</text>`;
    })
    .join('');
  return `
    <svg class="diagramm" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(titel)}">
      ${gitter}${zeilen}
    </svg>`;
}

function letzteTage(tage) {
  const nachDatum = Object.fromEntries(tage.map((tg) => [tg.datum, tg]));
  const heute = logischerTag();
  const kurz = inhalt('texte.allgemein.wochentage_kurz');
  const zellen = [];
  for (let i = 13; i >= 0; i--) {
    const datum = plusTage(heute, -i);
    const tg = nachDatum[datum] || {};
    const d = ausKey(datum);
    const stufe = tg.anspannung || 0;
    const datumText = `${inhalt('texte.allgemein.wochentage')[d.getDay()]}, ${d.getDate()}. ${inhalt('texte.allgemein.monate')[d.getMonth()]}`;
    const etwas = stufe || (tg.summen || []).length || (tg.freudeGenutzt || []).length;
    const teile = [];
    if (stufe) teile.push(t('verlauf.tipp_tag', { datum: datumText, wort: inhalt('texte.abendeintrag.stufen')[stufe - 1] }));
    else teile.push(t(etwas ? 'verlauf.tipp_tag_offen' : 'verlauf.tipp_tag_leer', { datum: datumText }));
    const summen = (tg.summen || []).length;
    const freude = (tg.freudeGenutzt || []).length;
    if (summen) teile.push(t(summen === 1 ? 'verlauf.tipp_summen_eins' : 'verlauf.tipp_summen', { anzahl: summen }));
    if (freude) teile.push(t(freude === 1 ? 'verlauf.tipp_freude_eins' : 'verlauf.tipp_freude', { anzahl: freude }));
    zellen.push(`
      <li class="tag-zelle" tabindex="0" data-tipp="${esc(teile.join(' '))}">
        <span class="tag-punkt ${stufe ? '' : 'leer'}" style="--stufe:${stufe}" aria-hidden="true"></span>
        <span class="tag-name">${kurz[d.getDay()]}</span>
        ${(tg.freudeGenutzt || []).length ? '<span class="tag-freude" aria-hidden="true">★</span>' : '<span class="tag-freude" aria-hidden="true"></span>'}
        <span class="nur-vorleser">${esc(teile.join(' '))}</span>
      </li>`);
  }
  return `<ol class="tage-streifen">${zellen.join('')}</ol>`;
}

function tabelle(wochen, mitGewicht) {
  const zelle = (wert) => `<td>${wert}</td>`;
  const zeilen = [...wochen]
    .reverse()
    .map((w) => `<tr>
        <th scope="row">${esc(String(w.kw))}</th>
        ${mitGewicht ? zelle(w.gewicht !== null ? zahl(w.gewicht, 1) : '–') : ''}
        ${zelle(w.taille !== null ? zahl(w.taille, 1) : '–')}
        ${zelle(w.anspannung !== null ? zahl(w.anspannung, 1) : '–')}
        ${zelle(w.einschlaf !== null ? minutenZuZeit(w.einschlaf) : '–')}
        ${zelle(w.schlaf !== null ? zahl(w.schlaf, 1) : '–')}
      </tr>`)
    .join('');
  const kopf = (text, einheit = '') => `<th scope="col">${esc(text)}${einheit ? `<br><small>${einheit}</small>` : ''}</th>`;
  return `
    <table class="tabelle">
      <thead><tr>
        ${kopf(t('verlauf.spalte_woche'), 'KW')}
        ${mitGewicht ? kopf(t('verlauf.spalte_gewicht'), 'kg') : ''}
        ${kopf(t('verlauf.spalte_taille'), 'cm')}
        ${kopf(t('verlauf.spalte_anspannung'), '1 bis 5')}
        ${kopf(t('verlauf.spalte_einschlafen'), 'Uhr')}
        ${kopf(t('verlauf.spalte_schlaf'), 'h')}
      </tr></thead>
      <tbody>${zeilen}</tbody>
    </table>`;
}

function statusSeite(tage) {
  const st = stand();
  const w = letzteSiebenTage(tage);
  const zeile = (name, wert) => (wert ? `<div class="weg-wert"><dt>${esc(name)}</dt><dd>${esc(wert)}</dd></div>` : '');
  const wort = (liste, x) => (x === null ? '' : inhalt(liste, [])[Math.round(x) - 1] || '');
  const werte = [
    gewichtSichtbar() && w.gewicht !== null ? zeile(t('weg.wert_gewicht'), `${zahl(w.gewicht, 1)} kg`) : '',
    w.taille !== null ? zeile(t('weg.wert_taille'), `${zahl(w.taille, 1).replace(/,0$/, '')} cm`) : '',
    w.schlaf !== null ? zeile(t('weg.wert_schlaf'), stundenText(Math.round(w.schlaf * 4) / 4)) : '',
    w.einschlaf !== null ? zeile(t('weg.wert_einschlaf'), t('weg.uhr', { zeit: minutenZuZeit(w.einschlaf) })) : '',
    zeile(t('weg.wert_anspannung'), wort('texte.abendeintrag.stufen', w.anspannung)),
    zeile(t('weg.wert_offen'), wort('texte.abendeintrag.offen_stufen', w.offen)),
  ].join('');
  const experimentText = st.experiment
    ? `<p class="weg-experiment"><span class="symbol" aria-hidden="true">🧪</span> ${esc(t('weg.experiment', { titel: st.experiment.titel }))}${st.tag ? ` ${esc(t('weg.experiment_tag', st.tag))}` : ''}</p>`
    : `<p class="weg-experiment">${esc(t('weg.kein_experiment'))} <a href="#experiment">${esc(t('weg.experiment_waehlen'))}</a></p>`;
  return {
    id: 'status',
    bloecke: [
      `<h1>${esc(t('weg.titel'))}</h1>`,
      experimentText,
      `<p class="leise klein">${esc(st.eintraege === 1 ? t('weg.eintraege_eins') : t('weg.eintraege', { anzahl: st.eintraege }))} ${esc(st.bisRueckblick === 1 ? t('weg.bis_rueckblick_eins') : t('weg.bis_rueckblick', { anzahl: st.bisRueckblick }))}</p>`,
      werte ? `<p class="feld-name weg-unterzeile">${esc(t('weg.sieben_tage'))}</p><dl class="weg-werte">${werte}</dl>` : `<p class="leise">${esc(t('weg.sieben_tage_leer'))}</p>`,
    ],
  };
}

function zeitleisteSeite() {
  const liste = ereignisse();
  return {
    id: 'zeitleiste',
    bloecke: [
      `<h2>${esc(t('weg.zeitleiste_titel'))} ${infoKnopf('rueckblick')}</h2>`,
      ...(liste.length
        ? liste.map((e) => `
          <div class="weg-ereignis weg-${e.art}">
            <span class="weg-symbol" aria-hidden="true">${esc(e.symbol)}</span>
            <div class="weg-inhalt">
              <p class="weg-datum">${esc(datumLang(e.datum))}</p>
              <p class="weg-titel">${esc(e.titel)}</p>
              ${e.text ? `<p class="weg-text${e.kurz ? ' weg-kurz' : ''}">${esc(e.text)}</p>` : ''}
              ${e.link ? `<a class="weg-link" href="${esc(e.link)}">${esc(t('weg.ansehen'))}</a>` : ''}
            </div>
          </div>`)
        : [`<p class="leise">${esc(t('weg.zeitleiste_leer'))}</p>`]),
    ],
  };
}

const STIFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>';

function notizenSeiten() {
  if (bearbeite) {
    const n = notiz(bearbeite);
    if (!n) {
      bearbeite = null;
    } else if (loeschfrage) {
      return [{
        id: 'notiz-loeschen',
        mitte: true,
        bloecke: [
          `<p>${esc(t(`notizen.frage_${n.art}`))}</p>`,
          `<div class="knopf-spalte">
            <button type="button" class="knopf knopf-haupt" data-aktion="notiz-weg">${esc(t('notizen.ja_loeschen'))}</button>
            <button type="button" class="knopf knopf-zweit" data-aktion="notiz-nein">${esc(t('notizen.nein'))}</button>
          </div>`,
        ],
      }];
    } else {
      return [{
        id: 'notiz-bearbeiten',
        bloecke: [
          `<h2>${esc(t('notizen.bearbeiten_titel'))}</h2>`,
          `<p class="beobachtung-datum">${esc(n.kopf)}</p>`,
          `<textarea name="notiz" rows="6" maxlength="2000" aria-label="${esc(n.kopf)}">${esc(n.text)}</textarea>`,
          `<div class="knopf-reihe">
            <button type="button" class="knopf knopf-haupt" data-aktion="notiz-speichern">${esc(t('notizen.speichern'))}</button>
            <button type="button" class="knopf knopf-zweit" data-aktion="notiz-abbrechen">${esc(t('notizen.abbrechen'))}</button>
          </div>`,
          `<button type="button" class="knopf-text leise-knopf" data-aktion="notiz-loeschen">${esc(t('notizen.loeschen'))}</button>`,
        ],
      }];
    }
  }
  const liste = alleNotizen();
  return [{
    id: 'notizen',
    bloecke: [
      `<h2>${esc(t('notizen.titel'))}</h2>`,
      `<p class="leise klein">${esc(liste.length ? t('notizen.text') : t('notizen.leer'))}</p>`,
      ...liste.map((n) => `
        <div class="notiz">
          <div class="notiz-kopf">
            <p class="beobachtung-datum">${esc(n.kopf)}</p>
            <button type="button" class="stift-knopf" data-aktion="notiz-bearbeiten" data-id="${esc(n.id)}" aria-label="${esc(t('notizen.stift'))}">${STIFT}</button>
          </div>
          <p class="beobachtung-text">${esc(n.text.length > 280 ? `${n.text.slice(0, 277).trim()} …` : n.text)}</p>
        </div>`),
    ],
  }];
}

export function verlassen() {
  bearbeite = null;
  loeschfrage = false;
}

export function zeige(wurzel, ctx) {
  const tage = alleTage();
  const wochen = wochenDaten(tage);
  const gruppen = zusammenhang(tage);
  const offenGruppen = zusammenhang(tage, 'offen', ['wenig', 'einiges', 'viel']);
  const offenWenig = offenGruppen[0];
  const offenViel = offenGruppen[2];
  const offenSatz = [
    offenWenig.anzahl >= 2 && offenViel.anzahl >= 2
      ? `<p>${esc(t('verlauf.offen_satz', { wenig: minutenZuZeit(offenWenig.mittel), viel: minutenZuZeit(offenViel.mittel) }))}</p>` : '',
    offenWenig.schlafAnzahl >= 2 && offenViel.schlafAnzahl >= 2
      ? `<p>${esc(t('verlauf.offen_schlaf_satz', { wenig: stundenText(Math.round(offenWenig.schlaf * 4) / 4), viel: stundenText(Math.round(offenViel.schlaf * 4) / 4) }))}</p>` : '',
  ];
  const leicht = gruppen.find((g) => g.id === 'leicht');
  const angespannt = gruppen.find((g) => g.id === 'angespannt');
  const satz =
    leicht.mittel !== null && angespannt.mittel !== null && leicht.anzahl >= 2 && angespannt.anzahl >= 2
      ? `<p>${esc(t('verlauf.zusammenhang_satz', { leicht: minutenZuZeit(leicht.mittel), angespannt: minutenZuZeit(angespannt.mittel) }))}</p>`
      : '';
  const mitGewicht = gewichtSichtbar();

  const seiten = bearbeite ? notizenSeiten() : [
    statusSeite(tage),
    zeitleisteSeite(),
    { id: 'diagramme', mitte: true, bloecke: [`<h2>${esc(t('verlauf.titel'))}</h2>`, ...textBloecke(t('verlauf.einleitung'), 'leise')] },
    mitGewicht ? {
      id: 'gewicht',
      bloecke: [
        `<h2 class="diagramm-titel"><span class="farbmarke farbe-petrol" aria-hidden="true"></span><span>${esc(t('verlauf.gewicht_titel'))} ${infoKnopf('gewicht')}</span></h2>`,
        linienDiagramm(wochen, {
          feld: 'gewicht',
          spielraum: 2,
          titel: t('verlauf.gewicht_titel'),
          leer: t('verlauf.keine_daten'),
          tipp: (w) => t('verlauf.tipp_gewicht', { kw: w.kw, wert: zahl(w.gewicht, 1), anzahl: w.gewichtTage }),
        }),
        gesundheitHat('schilddruese') || gesundheitHat('medikamente') ? `<p class="hinweis klein">${esc(t('gesundheit.gewicht_hinweis'))}</p>` : '',
      ],
    } : null,
    {
      id: 'taille',
      bloecke: [
        `<h2 class="diagramm-titel"><span class="farbmarke farbe-petrol" aria-hidden="true"></span><span>${esc(t('verlauf.taille_titel'))} ${infoKnopf('taille')}</span></h2>`,
        `<p class="leise klein">${esc(t('verlauf.taille_text'))}</p>`,
        linienDiagramm(wochen, {
          feld: 'taille',
          spielraum: 3,
          hoehe: 150,
          titel: t('verlauf.taille_titel'),
          leer: t('verlauf.taille_leer'),
          tipp: (w) => t('verlauf.tipp_taille', { kw: w.kw, wert: zahl(w.taille, 1) }),
        }),
      ],
    },
    {
      id: 'anspannung',
      bloecke: [
        `<h2 class="diagramm-titel"><span class="farbmarke farbe-pflaume" aria-hidden="true"></span><span>${esc(t('verlauf.anspannung_titel'))} ${infoKnopf('anspannung')}</span></h2>`,
        `<p class="leise klein">${esc(t('verlauf.anspannung_skala'))}</p>`,
        anspannungDiagramm(wochen),
      ],
    },
    {
      id: 'zusammenhang',
      bloecke: [
        `<h2>${esc(t('verlauf.zusammenhang_titel'))} ${infoKnopf('einschlafzeit')}</h2>`,
        `<p class="leise klein">${esc(t('verlauf.zusammenhang_text'))}</p>`,
        zusammenhangDiagramm(gruppen),
        satz,
      ],
    },
    {
      id: 'offen',
      bloecke: [
        `<h2>${esc(t('verlauf.offen_titel'))} ${infoKnopf('erledigt')}</h2>`,
        `<p class="leise klein">${esc(t('verlauf.offen_text'))}</p>`,
        zusammenhangDiagramm(offenGruppen, t('verlauf.offen_titel')),
        ...offenSatz,
      ],
    },
    {
      id: 'tage',
      bloecke: [`<h2>${esc(t('verlauf.letzte_tage_titel'))}</h2>`, ...textBloecke(t('verlauf.letzte_tage_text'), 'leise klein'), letzteTage(tage)],
    },
    {
      id: 'tabelle',
      bloecke: [`<h2>${esc(t('verlauf.tabelle_text'))}</h2>`, tabelle(wochen, mitGewicht)],
    },
    ...notizenSeiten(),
  ];

  // Abschnitte für die Zeile oben: Wo du stehst, Was passiert ist, Bilder, Notizen.
  if (!bearbeite) {
    for (const g of seiten.filter(Boolean)) {
      g.schritt = g.id === 'status' ? 'stand' : g.id === 'zeitleiste' ? 'zeitleiste' : g.id.startsWith('notiz') ? 'notizen' : 'bilder';
    }
  }
  zeigeSeiten(wurzel, seiten, {
    schluessel: bearbeite ? 'verlauf-notiz' : 'verlauf',
    start: ctx.start,
    zurueck: bearbeite ? { text: t('notizen.abbrechen'), aktion: () => { verlassen(); ctx.zeichne(); } } : undefined,
  });
  wurzel.insertAdjacentHTML('beforeend', '<div class="tipp" role="tooltip" hidden></div>');
  binde(wurzel, ctx);
}

function binde(wurzel, ctx) {
  const tipp = $('.tipp', wurzel);
  const zeigeTipp = (ziel) => {
    const r = ziel.getBoundingClientRect();
    const basis = wurzel.getBoundingClientRect();
    tipp.textContent = ziel.dataset.tipp;
    tipp.hidden = false;
    const breite = tipp.offsetWidth;
    const links = Math.max(8, Math.min(basis.width - breite - 8, r.left - basis.left + r.width / 2 - breite / 2));
    tipp.style.left = `${links}px`;
    tipp.style.top = `${Math.max(4, r.top - basis.top - tipp.offsetHeight - 8)}px`;
  };
  wurzel.onpointerover = (e) => {
    const ziel = e.target.closest('[data-tipp]');
    if (ziel) zeigeTipp(ziel);
  };
  wurzel.onpointerout = (e) => {
    if (e.target.closest('[data-tipp]') && !e.relatedTarget?.closest?.('[data-tipp]')) tipp.hidden = true;
  };
  wurzel.onfocusin = (e) => {
    const ziel = e.target.closest('[data-tipp]');
    if (ziel) zeigeTipp(ziel);
  };
  wurzel.onfocusout = () => { tipp.hidden = true; };
  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-tipp]');
    if (ziel) { zeigeTipp(ziel); return; }
    tipp.hidden = true;
    const knopf = e.target.closest('[data-aktion]');
    if (!knopf) return;
    switch (knopf.dataset.aktion) {
      case 'notiz-bearbeiten':
        bearbeite = knopf.dataset.id;
        loeschfrage = false;
        ctx.zeichne();
        break;
      case 'notiz-abbrechen':
        verlassen();
        ctx.zeichne();
        break;
      case 'notiz-speichern': {
        const text = wurzel.querySelector('[name="notiz"]').value.trim();
        if (!text) {
          loeschfrage = true;
          ctx.zeichne();
          return;
        }
        setzeNotiz(bearbeite, text);
        verlassen();
        merkeSeite('verlauf', 'notizen');
        ctx.zeichne();
        toast(t('notizen.gespeichert'));
        break;
      }
      case 'notiz-loeschen':
        loeschfrage = true;
        ctx.zeichne();
        break;
      case 'notiz-nein':
        loeschfrage = false;
        ctx.zeichne();
        break;
      case 'notiz-weg': {
        const rueckgaengig = setzeNotiz(bearbeite, '');
        verlassen();
        merkeSeite('verlauf', 'notizen');
        ctx.zeichne();
        toast(t('notizen.geloescht'), '', {
          text: t('notizen.rueckgaengig'),
          dauer: 5000,
          fn: () => {
            rueckgaengig();
            ctx.zeichne();
            toast(t('notizen.wieder_da'));
          },
        });
        break;
      }
    }
  };
}
