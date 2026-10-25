// Wollfäden: Gleichfarbige Knöpfe werden mit einem Faden verbunden. Die Fäden kreuzen sich nicht,
// und am Ende ist jedes Feld gefüllt. Kein Timer, kein Verlieren, keine Zugzählung.
//
// Jedes Brett ist lösbar, weil es aus einer Lösung entsteht: Ein zufälliger Weg führt einmal durch
// alle Felder und wird in mehrere Stücke geschnitten. Die Enden jedes Stücks werden zu Knöpfen.

import { t, inhalt } from './inhalte.js';
import { esc, sternchen } from './util.js';
import { lies, aendere } from './speicher.js';

export const STUFEN = { ruhig: { n: 5, farben: 5 }, knifflig: { n: 7, farben: 7 }, wach: { n: 9, farben: 9 } };
const FARBEN = ['#6b3a5e', '#1d6b74', '#c9962e', '#c4664a', '#6f8f4e', '#4a6fa5', '#d07a9a', '#8a6a3f', '#7b6bb0', '#3f8f7a'];

/* ---------- Rätsel erzeugen ---------- */

function zufallszahl(saat) {
  let s = saat >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Ein Weg, der jedes Feld genau einmal besucht. Start als Schlange, dann durch „Backbite“-Züge gemischt.
function hamiltonWeg(n, zufall) {
  let weg = [];
  for (let y = 0; y < n; y++) {
    for (let i = 0; i < n; i++) weg.push(y * n + (y % 2 ? n - 1 - i : i));
  }
  const nachbarn = (z) => {
    const x = z % n;
    const y = Math.floor(z / n);
    const liste = [];
    if (x > 0) liste.push(z - 1);
    if (x < n - 1) liste.push(z + 1);
    if (y > 0) liste.push(z - n);
    if (y < n - 1) liste.push(z + n);
    return liste;
  };
  const zuege = n * n * 40;
  for (let k = 0; k < zuege; k++) {
    if (zufall() < 0.5) weg.reverse();
    const ende = weg[weg.length - 1];
    const auswahl = nachbarn(ende).filter((z) => z !== weg[weg.length - 2]);
    const v = auswahl[Math.floor(zufall() * auswahl.length)];
    const i = weg.indexOf(v);
    // Der Teil nach v wird umgedreht, so bleibt es ein durchgehender Weg.
    weg = [...weg.slice(0, i + 1), ...weg.slice(i + 1).reverse()];
  }
  return weg;
}

// Schneidet den Weg in Stücke mit mindestens drei Feldern.
function zerschneide(weg, anzahl, zufall) {
  const laengen = new Array(anzahl).fill(3);
  let rest = weg.length - anzahl * 3;
  while (rest > 0) {
    laengen[Math.floor(zufall() * anzahl)] += 1;
    rest -= 1;
  }
  const stuecke = [];
  let pos = 0;
  for (const l of laengen) {
    stuecke.push(weg.slice(pos, pos + l));
    pos += l;
  }
  return stuecke;
}

export function erzeugeRaetsel(stufe, saat = Date.now()) {
  const { n, farben } = STUFEN[stufe] || STUFEN.ruhig;
  const zufall = zufallszahl(saat);
  const anzahl = Math.min(farben, Math.floor((n * n) / 3));
  const loesung = zerschneide(hamiltonWeg(n, zufall), anzahl, zufall);
  return {
    n,
    stufe,
    loesung,
    enden: loesung.map((stueck) => [stueck[0], stueck[stueck.length - 1]]),
  };
}

// Prüft eine Lösung: Jeder Faden verbindet seine Knöpfe über Nachbarfelder, kein Feld ist doppelt, alle sind gefüllt.
export function istGeloest(raetsel, faeden) {
  const { n, enden } = raetsel;
  const belegt = new Set();
  for (let f = 0; f < enden.length; f++) {
    const weg = faeden[f] || [];
    if (weg.length < 2) return false;
    const [a, b] = enden[f];
    if (!((weg[0] === a && weg[weg.length - 1] === b) || (weg[0] === b && weg[weg.length - 1] === a))) return false;
    for (let i = 0; i < weg.length; i++) {
      if (belegt.has(weg[i])) return false;
      belegt.add(weg[i]);
      if (i > 0) {
        const d = Math.abs(weg[i] - weg[i - 1]);
        const gleicheZeile = Math.floor(weg[i] / n) === Math.floor(weg[i - 1] / n);
        if (!((d === 1 && gleicheZeile) || d === n)) return false;
      }
    }
  }
  return belegt.size === n * n;
}

/* ---------- Spiel ---------- */

export function starteWollfaeden(wurzel, { stufe, beenden, nachSpiel }) {
  let raetsel = erzeugeRaetsel(stufe);
  let faeden = [];
  let zug = null;
  let fertig = false;

  const endeVon = new Map();
  const ordneEnden = () => {
    endeVon.clear();
    raetsel.enden.forEach(([a, b], f) => { endeVon.set(a, f); endeVon.set(b, f); });
  };
  ordneEnden();

  const besitzer = (z) => faeden.findIndex((w) => w && w.includes(z));
  const komplett = (f) => {
    const w = faeden[f];
    if (!w || w.length < 2) return false;
    const [a, b] = raetsel.enden[f];
    return (w[0] === a && w[w.length - 1] === b) || (w[0] === b && w[w.length - 1] === a);
  };

  function zeichneBrett() {
    const { n } = raetsel;
    const felder = [];
    for (let z = 0; z < n * n; z++) {
      felder.push(`<rect class="wolle-feld" x="${(z % n) + 0.04}" y="${Math.floor(z / n) + 0.04}" width="0.92" height="0.92" rx="0.18"/>`);
    }
    const linien = faeden
      .map((w, f) => (w && w.length > 1
        ? `<polyline class="wolle-faden" stroke="${FARBEN[f % FARBEN.length]}" points="${w.map((z) => `${(z % n) + 0.5},${Math.floor(z / n) + 0.5}`).join(' ')}"/>`
        : ''))
      .join('');
    const knoepfe = raetsel.enden
      .map(([a, b], f) => [a, b].map((z) => `<circle class="wolle-knopf" cx="${(z % n) + 0.5}" cy="${Math.floor(z / n) + 0.5}" r="0.32" fill="${FARBEN[f % FARBEN.length]}"><title>${esc(t('wollfaeden.faden', { nummer: f + 1 }))}</title></circle>`).join(''))
      .join('');
    return `<svg class="wolle-brett" viewBox="0 0 ${n} ${n}" data-kein-wischen role="img" aria-label="${esc(t('wollfaeden.name'))}">${felder}${linien}${knoepfe}</svg>`;
  }

  function aktualisiere() {
    const brett = wurzel.querySelector('.wolle-brett');
    if (brett) brett.outerHTML = zeichneBrett();
    pruefe();
  }

  function zeichne() {
    wurzel.innerHTML = `
      <div class="spiel spiel-wolle">
        <div class="spiel-kopf">
          <button type="button" class="knopf-text" data-aktion="zurueck">← ${esc(t('wollfaeden.zurueck'))}</button>
          <button type="button" class="knopf-text" data-aktion="tipp">${esc(t('wollfaeden.tipp'))}</button>
        </div>
        <p class="spiel-meldung" aria-live="polite">${esc(t('wollfaeden.anleitung'))}</p>
        <div class="wolle-flaeche">${zeichneBrett()}</div>
      </div>`;
    binde();
  }

  function pruefe() {
    const meldung = wurzel.querySelector('.spiel-meldung');
    if (istGeloest(raetsel, faeden)) {
      fertig = true;
      geloest();
      return;
    }
    const alleVerbunden = raetsel.enden.every((_, f) => komplett(f));
    if (meldung) meldung.textContent = alleVerbunden ? t('wollfaeden.frei') : t('wollfaeden.anleitung');
  }

  function geloest() {
    const punkte = inhalt(`belohnungen.punkteWollfaeden.${raetsel.stufe}`, 20);
    aendere('spiele', (s) => {
      s.wollfaeden = s.wollfaeden || { geloest: 0, sterne: 0, punkte: 0 };
      s.wollfaeden.geloest += 1;
      s.wollfaeden.sterne += 1;
      s.wollfaeden.punkte += punkte;
    }, {});
    setTimeout(() => {
      wurzel.innerHTML = `
        <div class="spiel spiel-ende">
          <div class="grosser-stern" aria-hidden="true">★</div>
          <h2>${esc(t('wollfaeden.geloest_titel'))}</h2>
          <p>${esc(t('wollfaeden.geloest_text'))}</p>
          <p class="leise">${esc(nachSpiel)}</p>
          <div class="knopf-spalte">
            <button type="button" class="knopf knopf-haupt" data-aktion="nochmal">${esc(t('wollfaeden.nochmal'))}</button>
            <button type="button" class="knopf knopf-zweit" data-aktion="zurueck">${esc(t('wollfaeden.zurueck'))}</button>
          </div>
        </div>`;
      sternchen(wurzel.querySelector('.grosser-stern'), 7);
      binde();
    }, 500);
  }

  // Ein Schritt des Fadens in das Feld z.
  function schritt(z) {
    const f = zug.faden;
    const weg = faeden[f];
    const letzte = weg[weg.length - 1];
    if (z === letzte) return;
    if (weg.length > 1 && z === weg[weg.length - 2]) { weg.pop(); return; }
    const eigen = weg.indexOf(z);
    if (eigen >= 0) { faeden[f] = weg.slice(0, eigen + 1); return; }
    if (komplett(f)) return;
    const knopfFarbe = endeVon.get(z);
    if (knopfFarbe !== undefined && knopfFarbe !== f) return;
    const anderer = besitzer(z);
    if (anderer >= 0 && anderer !== f) {
      const w2 = faeden[anderer];
      faeden[anderer] = w2.slice(0, w2.indexOf(z));
    }
    weg.push(z);
  }

  function feldAus(e) {
    const brett = wurzel.querySelector('.wolle-brett');
    const r = brett.getBoundingClientRect();
    const { n } = raetsel;
    const x = Math.floor(((e.clientX - r.left) / r.width) * n);
    const y = Math.floor(((e.clientY - r.top) / r.height) * n);
    if (x < 0 || y < 0 || x >= n || y >= n) return null;
    return y * n + x;
  }

  function binde() {
    wurzel.onclick = (e) => {
      const ziel = e.target.closest('[data-aktion]');
      if (!ziel) return;
      if (ziel.dataset.aktion === 'zurueck') beenden();
      if (ziel.dataset.aktion === 'nochmal') {
        raetsel = erzeugeRaetsel(stufe);
        faeden = [];
        fertig = false;
        ordneEnden();
        zeichne();
      }
      if (ziel.dataset.aktion === 'tipp') {
        // Zeigt einen Faden aus der Lösung, der noch nicht richtig liegt.
        const f = raetsel.loesung.findIndex((l, i) => JSON.stringify(faeden[i] || []) !== JSON.stringify(l) && JSON.stringify([...(faeden[i] || [])].reverse()) !== JSON.stringify(l));
        if (f < 0) return;
        const loesung = raetsel.loesung[f];
        faeden.forEach((w, i) => {
          if (i === f || !w) return;
          const k = w.findIndex((z) => loesung.includes(z));
          if (k >= 0) faeden[i] = w.slice(0, k);
        });
        faeden[f] = [...loesung];
        aktualisiere();
      }
    };
    const flaeche = wurzel.querySelector('.wolle-flaeche');
    if (!flaeche) return;
    flaeche.onpointerdown = (e) => {
      if (fertig) return;
      const z = feldAus(e);
      if (z === null) return;
      const knopf = endeVon.get(z);
      const besitz = besitzer(z);
      if (knopf !== undefined) {
        faeden[knopf] = [z];
        zug = { faden: knopf, start: z, bewegt: false, war: besitz };
      } else if (besitz >= 0) {
        const w = faeden[besitz];
        faeden[besitz] = w.slice(0, w.indexOf(z) + 1);
        zug = { faden: besitz, start: z, bewegt: false, war: besitz, angetippt: true, vorher: w };
      } else {
        return;
      }
      flaeche.setPointerCapture?.(e.pointerId);
      aktualisiere();
    };
    flaeche.onpointermove = (e) => {
      if (!zug) return;
      const z = feldAus(e);
      if (z === null) return;
      const { n } = raetsel;
      let letzte = faeden[zug.faden][faeden[zug.faden].length - 1];
      if (z === letzte) return;
      zug.bewegt = true;
      // Bei schnellen Bewegungen werden die Felder dazwischen nacheinander betreten.
      let sicherung = 0;
      while (z !== letzte && sicherung++ < 2 * n) {
        const lx = letzte % n;
        const ly = Math.floor(letzte / n);
        const zx = z % n;
        const zy = Math.floor(z / n);
        const naechste = lx !== zx ? letzte + Math.sign(zx - lx) : letzte + Math.sign(zy - ly) * n;
        schritt(naechste);
        const neu = faeden[zug.faden][faeden[zug.faden].length - 1];
        if (neu === letzte) break;
        letzte = neu;
      }
      aktualisiere();
    };
    const loslassen = () => {
      if (!zug) return;
      // Ein kurzer Tipp auf einen Faden löst ihn wieder auf.
      if (!zug.bewegt && (zug.angetippt || (zug.war === zug.faden && endeVon.has(zug.start)))) faeden[zug.faden] = [];
      zug = null;
      aktualisiere();
    };
    flaeche.onpointerup = loslassen;
    flaeche.onpointercancel = loslassen;
  }

  zeichne();
}

export function spieleStand() {
  return lies('spiele', {});
}
