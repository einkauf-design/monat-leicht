// Seiten: Jede Ansicht zeigt eine Seite nach der anderen, gescrollt wird nie.
//
// Eine Ansicht übergibt Gruppen. Jede Gruppe ist eine Seite aus mehreren Blöcken (HTML).
// Passt eine Gruppe nicht auf den Bildschirm, wird sie an den Blockgrenzen auf mehrere Seiten verteilt.
// Weiter geht es mit dem Knopf „Weiter“ unten in der Mitte oder mit einem Wisch nach links.
// Alle Seiten bleiben im Dokument, damit Eingaben beim Blättern erhalten bleiben.

import { t } from './inhalte.js';
import { esc } from './util.js';

// Merkt sich pro Ansicht, auf welcher Seite man gerade ist.
const stand = new Map();

export function seitenZuruecksetzen(schluessel) {
  if (schluessel) stand.delete(schluessel);
  else stand.clear();
}

export function merkeSeite(schluessel, gruppe, teil = 0) {
  stand.set(schluessel, { gruppe, teil, gemerkt: Date.now() });
}

// Beim Öffnen einer Ansicht über die Navigation beginnt sie auf der ersten Seite,
// außer eine andere Ansicht hat gerade eben eine bestimmte Seite vorgemerkt.
export function seitenBeimOeffnen(schluessel) {
  const s = stand.get(schluessel);
  if (s?.gemerkt && Date.now() - s.gemerkt < 4000) {
    delete s.gemerkt;
    return;
  }
  stand.delete(schluessel);
}

function knoten(html, kontext) {
  const vorlage = document.createElement(kontext === 'liste' ? 'ul' : 'template');
  if (kontext === 'liste') {
    vorlage.innerHTML = html;
    return [...vorlage.childNodes];
  }
  vorlage.innerHTML = html;
  return [...vorlage.content.childNodes];
}

function neueSeite(flaeche, gruppe, teil) {
  const seite = document.createElement('section');
  seite.className = `seite ${gruppe.klasse || ''}`;
  seite.dataset.gruppe = gruppe.id;
  seite.dataset.teil = teil;
  const innen = document.createElement('div');
  innen.className = `seite-innen${gruppe.mitte ? ' mitte' : ''}${gruppe.schlicht ? ' schlicht' : ''}`;
  seite.appendChild(innen);
  let ziel = innen;
  if (gruppe.huelle) {
    const huelle = knoten(gruppe.huelle)[0];
    innen.appendChild(huelle);
    ziel = huelle;
  }
  flaeche.appendChild(seite);
  return { seite, ziel };
}

function laeuftUeber(seite) {
  return seite.scrollHeight > seite.clientHeight + 1;
}

// Verteilt die Blöcke einer Gruppe auf so viele Seiten wie nötig.
function packe(flaeche, gruppe) {
  const seiten = [];
  let teil = 0;
  let aktuell = neueSeite(flaeche, gruppe, teil);
  seiten.push(aktuell.seite);
  let anzahl = 0;
  const kontext = gruppe.huelle && /^\s*<(ul|ol)/.test(gruppe.huelle) ? 'liste' : '';
  for (const block of gruppe.bloecke.filter(Boolean)) {
    const neu = knoten(block, kontext);
    neu.forEach((n) => aktuell.ziel.appendChild(n));
    anzahl += 1;
    if (laeuftUeber(aktuell.seite) && anzahl > 1 && !gruppe.fest) {
      neu.forEach((n) => n.remove());
      teil += 1;
      aktuell = neueSeite(flaeche, gruppe, teil);
      seiten.push(aktuell.seite);
      neu.forEach((n) => aktuell.ziel.appendChild(n));
      anzahl = 1;
    }
    if (laeuftUeber(aktuell.seite)) {
      // Ein einzelner Block ist größer als der Bildschirm. Das sollte nicht vorkommen.
      console.warn('EMONA: Ein Block passt nicht auf eine Seite.', gruppe.id);
      aktuell.seite.classList.add('zu-gross');
    }
  }
  return seiten;
}

/**
 * Zeigt Gruppen als Seiten an.
 * @param {HTMLElement} wurzel
 * @param {Array} gruppen  [{ id, bloecke: [html], huelle?, klasse?, mitte?, fest?, ohneWeiter? }]
 * @param {Object} optionen { schluessel, zurueck?: {text, href|aktion}, start?: gruppenId }
 */
export function zeigeSeiten(wurzel, gruppen, optionen = {}) {
  const schluessel = optionen.schluessel || 'ansicht';
  wurzel.innerHTML = `
    <div class="blaettern">
      <div class="blaettern-kopf">
        <button type="button" class="blaettern-zurueck knopf-text" data-blaettern="zurueck"><span aria-hidden="true">←</span> <span class="zurueck-text">${esc(t('seiten.zurueck'))}</span></button>
        <ol class="seiten-punkte" aria-hidden="true"></ol>
        <span class="nur-vorleser seiten-stand" aria-live="polite"></span>
      </div>
      <div class="blaettern-flaeche"></div>
      <div class="blaettern-fuss">
        <button type="button" class="knopf knopf-haupt blaettern-weiter" data-blaettern="weiter">${esc(t('seiten.weiter'))}</button>
      </div>
    </div>`;
  const flaeche = wurzel.querySelector('.blaettern-flaeche');
  const punkte = wurzel.querySelector('.seiten-punkte');
  const standText = wurzel.querySelector('.seiten-stand');
  const zurueckKnopf = wurzel.querySelector('[data-blaettern="zurueck"]');
  const weiterKnopf = wurzel.querySelector('[data-blaettern="weiter"]');

  const seiten = [];
  for (const gruppe of gruppen.filter(Boolean)) {
    for (const seite of packe(flaeche, gruppe)) seiten.push({ seite, gruppe });
  }

  let index = 0;
  const gemerkt = optionen.start ? { gruppe: optionen.start, teil: 0 } : stand.get(schluessel);
  if (gemerkt) {
    const passend = seiten.findIndex((s) => s.gruppe.id === gemerkt.gruppe && Number(s.seite.dataset.teil) === gemerkt.teil);
    const ersteDerGruppe = seiten.findIndex((s) => s.gruppe.id === gemerkt.gruppe);
    index = passend >= 0 ? passend : Math.max(0, ersteDerGruppe);
  }

  punkte.innerHTML = seiten.length > 1 ? seiten.map(() => '<li></li>').join('') : '';

  function zeige(neu, richtung = 0) {
    index = Math.max(0, Math.min(seiten.length - 1, neu));
    seiten.forEach(({ seite }, i) => {
      seite.classList.toggle('aktiv', i === index);
      seite.classList.toggle('links', i < index);
      seite.classList.toggle('rechts', i > index);
      seite.setAttribute('aria-hidden', String(i !== index));
      if (i === index) seite.removeAttribute('inert');
      else seite.setAttribute('inert', '');
    });
    [...punkte.children].forEach((p, i) => p.classList.toggle('aktiv', i === index));
    const aktuell = seiten[index];
    if (aktuell) {
      stand.set(schluessel, { gruppe: aktuell.gruppe.id, teil: Number(aktuell.seite.dataset.teil) });
      standText.textContent = seiten.length > 1 ? t('seiten.stand', { nummer: index + 1, gesamt: seiten.length }) : '';
    }
    const hatZurueck = index > 0 || optionen.zurueck;
    zurueckKnopf.style.visibility = hatZurueck ? 'visible' : 'hidden';
    zurueckKnopf.querySelector('.zurueck-text').textContent = index === 0 && optionen.zurueck ? optionen.zurueck.text : t('seiten.zurueck');
    const letzte = index >= seiten.length - 1;
    weiterKnopf.style.visibility = letzte || aktuell?.gruppe.ohneWeiter ? 'hidden' : 'visible';
    if (richtung) wurzel.dispatchEvent(new CustomEvent('seitenwechsel', { detail: { index, gruppe: aktuell?.gruppe.id } }));
  }

  const steuerung = {
    weiter: () => zeige(index + 1, 1),
    zurueck: () => {
      if (index === 0 && optionen.zurueck) {
        if (optionen.zurueck.href) location.hash = optionen.zurueck.href;
        else optionen.zurueck.aktion?.();
        return;
      }
      zeige(index - 1, -1);
    },
    gehe: (gruppenId) => {
      const i = seiten.findIndex((s) => s.gruppe.id === gruppenId);
      if (i >= 0) zeige(i, i > index ? 1 : -1);
    },
    index: () => index,
    anzahl: () => seiten.length,
    gruppe: () => seiten[index]?.gruppe.id,
  };

  weiterKnopf.onclick = steuerung.weiter;
  zurueckKnopf.onclick = steuerung.zurueck;

  // Wischen: nach links für weiter, nach rechts für zurück. Eingabefelder und Spiele bleiben unberührt.
  let start = null;
  flaeche.onpointerdown = (e) => {
    if (e.target.closest('input, textarea, select, [data-kein-wischen]')) { start = null; return; }
    start = { x: e.clientX, y: e.clientY };
  };
  flaeche.onpointerup = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && index < seiten.length - 1 && !seiten[index].gruppe.ohneWeiter) steuerung.weiter();
    if (dx > 0) steuerung.zurueck();
  };
  flaeche.onpointercancel = () => { start = null; };

  zeige(index);
  return steuerung;
}

// Teilt einen langen Text in Absätze und sehr lange Absätze in Satzgruppen, damit nichts gescrollt werden muss.
export function textBloecke(text, klasse = '') {
  const attr = klasse ? ` class="${klasse}"` : '';
  const bloecke = [];
  for (const absatz of String(text ?? '').split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean)) {
    if (absatz.length <= 420) {
      bloecke.push(`<p${attr}>${esc(absatz)}</p>`);
      continue;
    }
    const saetze = absatz.match(/[^.!?…]+[.!?…]+["“”]?\s*|[^.!?…]+$/g) || [absatz];
    let stueck = '';
    for (const satz of saetze) {
      if ((stueck + satz).length > 380 && stueck) {
        bloecke.push(`<p${attr}>${esc(stueck.trim())}</p>`);
        stueck = '';
      }
      stueck += satz;
    }
    if (stueck.trim()) bloecke.push(`<p${attr}>${esc(stueck.trim())}</p>`);
  }
  return bloecke;
}
