// Bildpaare: Karten liegen verdeckt. Zwei werden aufgedeckt, gleiche Paare bleiben offen.
// Kein Timer, kein Verlieren, keine Zugzählung. Die Motive sind eigene schlichte Zeichnungen.

import { t, inhalt } from './inhalte.js';
import { esc, mischen, sternchen } from './util.js';
import { aendere } from './speicher.js';

const P = '#6b3a5e';   // Pflaume
const N = '#1d4a52';   // Nachtpetrol
const G = '#c9962e';   // Gold
const C = '#f6efe2';   // Creme
const S = '#6f8f4e';   // Salbei
const B = '#8a6a3f';   // Braun
const R = '#d07a9a';   // Rosé
const T = '#c4664a';   // Terrakotta

// Jede Zeichnung im Raster 64 × 64.
export const MOTIVE = {
  mond: `<path d="M38 10a22 22 0 1 0 16 36A18 18 0 1 1 38 10z" fill="${G}"/>`,
  stern: `<path d="M32 8l6.5 15.5L55 25l-12.5 11 3.8 16.5L32 44l-14.3 8.5 3.8-16.5L9 25l16.5-1.5z" fill="${G}"/>`,
  sonne: `<circle cx="32" cy="32" r="11" fill="${G}"/><g stroke="${G}" stroke-width="4" stroke-linecap="round"><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M15 49l6-6M43 21l6-6"/></g>`,
  blatt: `<path d="M12 52C12 26 30 12 54 10c0 26-16 42-42 42z" fill="${S}"/><path d="M14 50L44 20" stroke="${C}" stroke-width="2.5" stroke-linecap="round"/>`,
  feder: `<path d="M50 8C30 12 16 28 14 54c6-2 10-6 14-10 10-8 20-20 22-36z" fill="${P}" opacity="0.85"/><path d="M48 10L12 56" stroke="${N}" stroke-width="2.5" stroke-linecap="round"/>`,
  blume: `<g fill="${R}"><circle cx="32" cy="18" r="9"/><circle cx="45" cy="28" r="9"/><circle cx="40" cy="43" r="9"/><circle cx="24" cy="43" r="9"/><circle cx="19" cy="28" r="9"/></g><circle cx="32" cy="31" r="7" fill="${G}"/>`,
  tanne: `<path d="M32 6L46 26H38L50 42H38L52 56H12L26 42H14L26 26H18z" fill="${N}"/><rect x="28" y="54" width="8" height="6" fill="${B}"/>`,
  pilz: `<path d="M8 32C8 18 20 10 32 10s24 8 24 22z" fill="${T}"/><circle cx="22" cy="22" r="3.5" fill="${C}"/><circle cx="38" cy="18" r="3" fill="${C}"/><circle cx="44" cy="27" r="3" fill="${C}"/><path d="M24 32h16l-2 22H26z" fill="${C}" stroke="${B}" stroke-width="2"/>`,
  pferd: `<path d="M20 56l3-18c-3-8-1-18 6-24l2-7 4 6c9 1 16 8 18 17l2 9c0 4-4 6-7 4l-6-4c-2 6-4 11-4 17z" fill="${B}"/><path d="M30 13c-4 6-5 14-3 22" stroke="${N}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="42" cy="24" r="2" fill="${C}"/>`,
  hund: `<ellipse cx="16" cy="30" rx="7" ry="13" fill="${B}"/><ellipse cx="48" cy="30" rx="7" ry="13" fill="${B}"/><circle cx="32" cy="34" r="16" fill="${G}"/><circle cx="26" cy="31" r="2.5" fill="${N}"/><circle cx="38" cy="31" r="2.5" fill="${N}"/><ellipse cx="32" cy="40" rx="4" ry="3" fill="${N}"/>`,
  katze: `<path d="M14 26L16 8l12 12M50 26L48 8 36 20" fill="${P}"/><circle cx="32" cy="36" r="18" fill="${P}"/><circle cx="25" cy="33" r="2.5" fill="${C}"/><circle cx="39" cy="33" r="2.5" fill="${C}"/><path d="M29 41l3 2 3-2" stroke="${C}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M12 40h10M42 40h10" stroke="${C}" stroke-width="1.5"/>`,
  vogel: `<ellipse cx="30" cy="38" rx="17" ry="12" fill="${N}"/><circle cx="46" cy="26" r="8" fill="${N}"/><path d="M53 25l8 3-8 3z" fill="${G}"/><path d="M20 34c6-8 16-8 20 0" stroke="${C}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M14 40L4 34l4 10z" fill="${N}"/><circle cx="48" cy="24" r="1.8" fill="${C}"/>`,
};

const RASTER = { 12: [3, 4], 16: [4, 4], 20: [4, 5] };

export function starteBildpaare(wurzel, { groesse, beenden, nachSpiel }) {
  let karten = [];
  let offen = [];
  let gefunden = new Set();
  let gesperrt = false;

  function neueRunde() {
    const paare = groesse / 2;
    const motive = mischen(Object.keys(MOTIVE)).slice(0, paare);
    karten = mischen([...motive, ...motive]).map((motiv, i) => ({ i, motiv }));
    offen = [];
    gefunden = new Set();
    gesperrt = false;
    zeichne();
  }

  function karteHtml(k) {
    const sichtbar = offen.includes(k.i) || gefunden.has(k.motiv);
    const name = inhalt(`texte.bildpaare.motive.${k.motiv}`, k.motiv);
    return `
      <button type="button" class="bildkarte ${sichtbar ? 'offen' : ''} ${gefunden.has(k.motiv) ? 'gefunden' : ''}" data-aktion="karte" data-i="${k.i}"
        aria-label="${esc(sichtbar ? name : t('bildpaare.verdeckt'))}">
        <span class="bildkarte-innen">
          <span class="bildkarte-rueckseite" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 18l3.5 9 9.5.5-7.5 6 2.5 9.5L32 38l-8 5 2.5-9.5-7.5-6 9.5-.5z" fill="currentColor"/></svg></span>
          <span class="bildkarte-vorderseite" aria-hidden="true"><svg viewBox="0 0 64 64">${MOTIVE[k.motiv]}</svg></span>
        </span>
      </button>`;
  }

  function zeichne() {
    const [spalten, zeilen] = RASTER[groesse] || RASTER[12];
    wurzel.innerHTML = `
      <div class="spiel spiel-paare">
        <div class="spiel-kopf">
          <button type="button" class="knopf-text" data-aktion="zurueck">← ${esc(t('bildpaare.zurueck'))}</button>
        </div>
        <p class="spiel-meldung" aria-live="polite">${esc(t('bildpaare.anleitung'))}</p>
        <div class="paare-flaeche" data-kein-wischen>
          <div class="paare-brett" style="--spalten:${spalten};--zeilen:${zeilen}">${karten.map(karteHtml).join('')}</div>
        </div>
      </div>`;
  }

  function geloest() {
    const punkte = inhalt(`belohnungen.punkteBildpaare.${groesse}`, 15);
    aendere('spiele', (s) => {
      s.bildpaare = s.bildpaare || { geloest: 0, sterne: 0, punkte: 0 };
      s.bildpaare.geloest += 1;
      s.bildpaare.sterne += 1;
      s.bildpaare.punkte += punkte;
    }, {});
    setTimeout(() => {
      wurzel.innerHTML = `
        <div class="spiel spiel-ende">
          <div class="grosser-stern" aria-hidden="true">★</div>
          <h2>${esc(t('bildpaare.geloest_titel'))}</h2>
          <p>${esc(t('bildpaare.geloest_text'))}</p>
          <p class="leise">${esc(nachSpiel)}</p>
          <div class="knopf-spalte">
            <button type="button" class="knopf knopf-haupt" data-aktion="nochmal">${esc(t('bildpaare.nochmal'))}</button>
            <button type="button" class="knopf knopf-zweit" data-aktion="zurueck">${esc(t('bildpaare.zurueck'))}</button>
          </div>
        </div>`;
      sternchen(wurzel.querySelector('.grosser-stern'), 7);
    }, 700);
  }

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    if (ziel.dataset.aktion === 'zurueck') { beenden(); return; }
    if (ziel.dataset.aktion === 'nochmal') { neueRunde(); return; }
    if (ziel.dataset.aktion !== 'karte' || gesperrt) return;
    const k = karten[Number(ziel.dataset.i)];
    if (gefunden.has(k.motiv) || offen.includes(k.i)) return;
    offen.push(k.i);
    ziel.classList.add('offen');
    ziel.setAttribute('aria-label', inhalt(`texte.bildpaare.motive.${k.motiv}`, k.motiv));
    if (offen.length < 2) return;
    const [a, b] = offen.map((i) => karten[i]);
    if (a.motiv === b.motiv) {
      gefunden.add(a.motiv);
      offen = [];
      wurzel.querySelectorAll(`[data-i="${a.i}"], [data-i="${b.i}"]`).forEach((el) => el.classList.add('gefunden'));
      if (gefunden.size === karten.length / 2) geloest();
      return;
    }
    // Zwei verschiedene Bilder drehen sich ruhig wieder um.
    gesperrt = true;
    setTimeout(() => {
      wurzel.querySelectorAll(`[data-i="${a.i}"], [data-i="${b.i}"]`).forEach((el) => {
        el.classList.remove('offen');
        el.setAttribute('aria-label', t('bildpaare.verdeckt'));
      });
      offen = [];
      gesperrt = false;
    }, 1000);
  };

  neueRunde();
}
