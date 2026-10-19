// Ansicht „Verlauf“: Wochendurchschnitt Gewicht, Anspannung und der Zusammenhang mit dem Einschlafen.
// Neutrale Farben, keine Pfeile, keine Bewertung. Gewicht erscheint nur als Wochendurchschnitt.

import { t, inhalt } from '../inhalte.js';
import {
  esc, zahl, mittelwert, isoWoche, wochenMontag, plusTage, logischerTag, ausKey,
  einschlafMinuten, minutenZuZeit, $,
} from '../util.js';
import { alleTage } from '../daten.js';

const WOCHEN = 8;
let tabelleOffen = false;

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
    });
  }
  return wochen;
}

// Anspannung eines Tages und die Einschlafzeit der folgenden Nacht (eingetragen am nächsten Morgen).
function zusammenhang(tage) {
  const nachDatum = Object.fromEntries(tage.map((tg) => [tg.datum, tg]));
  const gruppen = {
    leicht: { werte: [], name: t('verlauf.gruppe_leicht') },
    mittel: { werte: [], name: t('verlauf.gruppe_mittel') },
    angespannt: { werte: [], name: t('verlauf.gruppe_angespannt') },
  };
  for (const tg of tage) {
    if (!tg.anspannung) continue;
    const naechster = nachDatum[plusTage(tg.datum, 1)];
    const minuten = einschlafMinuten(naechster?.einschlafzeit);
    if (minuten === null) continue;
    const gruppe = tg.anspannung <= 2 ? 'leicht' : tg.anspannung === 3 ? 'mittel' : 'angespannt';
    gruppen[gruppe].werte.push(minuten);
  }
  return Object.entries(gruppen).map(([id, g]) => ({ id, name: g.name, anzahl: g.werte.length, mittel: mittelwert(g.werte) }));
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

function gewichtDiagramm(wochen) {
  const mitWert = wochen.map((w, i) => ({ ...w, i })).filter((w) => w.gewicht !== null);
  if (!mitWert.length) return `<p class="leise">${esc(t('verlauf.keine_daten'))}</p>`;
  const H = 170;
  const werte = mitWert.map((w) => w.gewicht);
  // Großzügiger Spielraum, damit kleine Schwankungen ruhig aussehen.
  const min = Math.floor(Math.min(...werte) - 2);
  const max = Math.ceil(Math.max(...werte) + 2);
  const y = (v) => RAND.oben + (1 - (v - min) / (max - min)) * (H - RAND.oben - RAND.unten);
  const linien = [min, (min + max) / 2, max]
    .map((v) => `<line class="gitter" x1="${RAND.links}" x2="${B - RAND.rechts}" y1="${y(v)}" y2="${y(v)}"/><text class="achse-text" x="${RAND.links - 6}" y="${y(v) + 4}" text-anchor="end">${zahl(v, 0)}</text>`)
    .join('');
  const pfad = mitWert.map((w, j) => `${j ? 'L' : 'M'}${xPos(w.i)},${y(w.gewicht)}`).join(' ');
  const letzter = mitWert[mitWert.length - 1];
  const punkte = mitWert
    .map((w) => {
      const tipp = `${t('verlauf.woche', { kw: w.kw })}: ${zahl(w.gewicht, 1)} kg, ${t('verlauf.aus_tagen', { anzahl: w.gewichtTage })}`;
      return `<g class="punkt-gruppe" tabindex="0" data-tipp="${esc(tipp)}">
          <circle class="trefferflaeche" cx="${xPos(w.i)}" cy="${y(w.gewicht)}" r="16"/>
          <circle class="punkt punkt-petrol" cx="${xPos(w.i)}" cy="${y(w.gewicht)}" r="4.5"/>
        </g>`;
    })
    .join('');
  return `
    <svg class="diagramm" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(t('verlauf.gewicht_titel'))}">
      ${linien}
      <path class="linie linie-petrol" d="${pfad}"/>
      ${punkte}
      <text class="wert-text" x="${xPos(letzter.i)}" y="${y(letzter.gewicht) - 11}" text-anchor="middle">${zahl(letzter.gewicht, 1)}</text>
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
      const tipp = `${t('verlauf.woche', { kw: w.kw })}: ${zahl(w.anspannung, 1)}, ${t('verlauf.aus_tagen', { anzahl: w.anspannungTage })}`;
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

function zusammenhangDiagramm(gruppen) {
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
      const tipp = `${g.name}: ${minutenZuZeit(g.mittel)} ${t('allgemein.uhr')}, ${t('verlauf.nach_tagen', { anzahl: g.anzahl })}`;
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
    <svg class="diagramm" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(t('verlauf.zusammenhang_titel'))}">
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
    const teile = [`${kurz[d.getDay()]} ${d.getDate()}.`];
    if (stufe) teile.push(`${t('verlauf.spalte_anspannung').replace(' Ø', '')} ${stufe}`);
    if ((tg.summen || []).length) teile.push(`${t('verlauf.summen_kurz')} ${tg.summen.length}×`);
    if ((tg.freudeGenutzt || []).length) teile.push(`${t('verlauf.freude_kurz')} ${tg.freudeGenutzt.length}×`);
    zellen.push(`
      <li class="tag-zelle" tabindex="0" data-tipp="${esc(teile.join(' · '))}">
        <span class="tag-punkt ${stufe ? '' : 'leer'}" style="--stufe:${stufe}" aria-hidden="true"></span>
        <span class="tag-name">${kurz[d.getDay()]}</span>
        ${(tg.freudeGenutzt || []).length ? '<span class="tag-freude" aria-hidden="true">★</span>' : '<span class="tag-freude" aria-hidden="true"></span>'}
        <span class="nur-vorleser">${esc(teile.join(', '))}</span>
      </li>`);
  }
  return `<ol class="tage-streifen">${zellen.join('')}</ol>`;
}

function tabelle(wochen) {
  const zeilen = [...wochen]
    .reverse()
    .map(
      (w) => `<tr>
        <th scope="row">${esc(t('verlauf.woche', { kw: w.kw }))}</th>
        <td>${w.gewicht !== null ? `${zahl(w.gewicht, 1)} kg` : '–'}</td>
        <td>${w.anspannung !== null ? zahl(w.anspannung, 1) : '–'}</td>
        <td>${w.einschlaf !== null ? minutenZuZeit(w.einschlaf) : '–'}</td>
        <td>${w.schlaf !== null ? `${zahl(w.schlaf, 1)} h` : '–'}</td>
      </tr>`,
    )
    .join('');
  return `
    <div class="tabelle-rahmen">
      <table class="tabelle">
        <thead><tr>
          <th scope="col">${esc(t('verlauf.spalte_woche'))}</th>
          <th scope="col">${esc(t('verlauf.spalte_gewicht'))}</th>
          <th scope="col">${esc(t('verlauf.spalte_anspannung'))}</th>
          <th scope="col">${esc(t('verlauf.spalte_einschlafen'))}</th>
          <th scope="col">${esc(t('verlauf.spalte_schlaf'))}</th>
        </tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
    </div>`;
}

export function zeige(wurzel) {
  const tage = alleTage();
  const wochen = wochenDaten(tage);
  const gruppen = zusammenhang(tage);
  const leicht = gruppen.find((g) => g.id === 'leicht');
  const angespannt = gruppen.find((g) => g.id === 'angespannt');
  const satz =
    leicht.mittel !== null && angespannt.mittel !== null && leicht.anzahl >= 2 && angespannt.anzahl >= 2
      ? `<p>${esc(t('verlauf.zusammenhang_satz', { leicht: minutenZuZeit(leicht.mittel), angespannt: minutenZuZeit(angespannt.mittel) }))}</p>`
      : '';

  wurzel.innerHTML = `
    <header class="seiten-kopf">
      <h1>${esc(t('verlauf.titel'))}</h1>
      <p class="leise">${esc(t('verlauf.einleitung'))}</p>
    </header>

    <section class="karte" aria-labelledby="v-gewicht">
      <h2 id="v-gewicht" class="diagramm-titel"><span class="farbmarke farbe-petrol" aria-hidden="true"></span>${esc(t('verlauf.gewicht_titel'))}</h2>
      ${gewichtDiagramm(wochen)}
    </section>

    <section class="karte" aria-labelledby="v-anspannung">
      <h2 id="v-anspannung" class="diagramm-titel"><span class="farbmarke farbe-pflaume" aria-hidden="true"></span>${esc(t('verlauf.anspannung_titel'))}</h2>
      <p class="leise klein">${esc(t('verlauf.anspannung_skala'))}</p>
      ${anspannungDiagramm(wochen)}
    </section>

    <section class="karte" aria-labelledby="v-zusammenhang">
      <h2 id="v-zusammenhang">${esc(t('verlauf.zusammenhang_titel'))}</h2>
      <p class="leise klein">${esc(t('verlauf.zusammenhang_text'))}</p>
      ${zusammenhangDiagramm(gruppen)}
      ${satz}
    </section>

    <section class="karte" aria-labelledby="v-tage">
      <h2 id="v-tage">${esc(t('verlauf.letzte_tage_titel'))}</h2>
      <p class="leise klein">${esc(t('verlauf.letzte_tage_text'))}</p>
      ${letzteTage(tage)}
    </section>

    <section class="karte">
      <button class="knopf knopf-zweit" data-aktion="tabelle" aria-expanded="${tabelleOffen}">
        ${esc(tabelleOffen ? t('verlauf.tabelle_verbergen') : t('verlauf.tabelle_zeigen'))}
      </button>
      ${tabelleOffen ? tabelle(wochen) : ''}
    </section>
    <div class="tipp" role="tooltip" hidden></div>`;

  binde(wurzel);
}

function binde(wurzel) {
  const tipp = $('.tipp', wurzel);
  const zeigeTipp = (ziel) => {
    const r = ziel.getBoundingClientRect();
    const basis = wurzel.getBoundingClientRect();
    tipp.textContent = ziel.dataset.tipp;
    tipp.hidden = false;
    const breite = tipp.offsetWidth;
    const links = Math.max(8, Math.min(basis.width - breite - 8, r.left - basis.left + r.width / 2 - breite / 2));
    tipp.style.left = `${links}px`;
    tipp.style.top = `${r.top - basis.top - tipp.offsetHeight - 8}px`;
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
    if (e.target.closest('[data-aktion="tabelle"]')) {
      tabelleOffen = !tabelleOffen;
      zeige(wurzel);
      return;
    }
    tipp.hidden = true;
  };
}
