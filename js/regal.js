// Abendregal: ein ruhiges Sortierspiel. Waren aus dem Korb kommen ins passende Fach.
// Kein Timer, kein Verlieren. Nach jedem Regal gibt es einen Stern und eine Pause.

import { t, inhalt } from './inhalte.js';
import { esc, mischen, rattern, sternchen, $, $$, wenigBewegung } from './util.js';
import { regalStand, aendereRegal } from './daten.js';

export function starteRegal(wurzel, { beenden, nachSpiel, ohneAtem }) {
  const regeln = inhalt('regal', {});
  let runde = null;
  let anzeige = { sterne: regalStand().sterne, punkte: regalStand().punkte };

  function neueRunde() {
    const stand = regalStand();
    const faecher = stand.regale >= (regeln.regaleBisVierFaecher ?? 3) ? regeln.faecherMax ?? 4 : regeln.faecherStart ?? 3;
    const kategorien = mischen(regeln.kategorien || []).slice(0, faecher);
    const korb = [];
    for (const kat of kategorien) {
      for (const symbol of mischen(kat.waren).slice(0, regeln.warenProRegal ?? 3)) {
        korb.push({ id: `${kat.id}-${symbol}`, symbol, kat: kat.id });
      }
    }
    runde = {
      nummer: stand.regale + 1,
      kategorien,
      korb: mischen(korb),
      faecher: Object.fromEntries(kategorien.map((k) => [k.id, []])),
      gewaehlt: null,
      fehlgriffe: 0,
      meldung: t('regal.anleitung'),
    };
    zeichne();
  }

  function kopf() {
    return `
      <div class="regal-kopf">
        <button class="knopf-text" data-aktion="zurueck">← ${esc(t('regal.zurueck'))}</button>
        <div class="regal-zaehler">
          <span class="zaehler"><span class="zaehler-symbol" aria-hidden="true">★</span><span data-zahl="sterne">${anzeige.sterne}</span><span class="nur-vorleser"> ${esc(t('regal.sterne'))}</span></span>
          <span class="zaehler"><span class="zaehler-symbol" aria-hidden="true">●</span><span data-zahl="punkte">${anzeige.punkte}</span><span class="nur-vorleser"> ${esc(t('regal.punkte'))}</span></span>
        </div>
      </div>`;
  }

  function zeichne() {
    const gewaehlteWare = runde.korb.find((w) => w.id === runde.gewaehlt);
    wurzel.innerHTML = `
      <div class="regal-spiel">
        ${kopf()}
        <p class="regal-meldung" aria-live="polite">${esc(gewaehlteWare ? t('regal.gewaehlt', { ware: gewaehlteWare.symbol }) : runde.meldung)}</p>
        <div class="regal" style="--faecher:${runde.kategorien.length}">
          ${runde.kategorien
            .map(
              (k) => `
            <button class="fach" data-aktion="fach" data-kat="${esc(k.id)}" aria-label="${esc(k.name)}">
              <span class="fach-schild">${esc(k.name)}</span>
              <span class="fach-waren">${runde.faecher[k.id].map((s) => `<span class="ware-im-fach">${esc(s)}</span>`).join('')}</span>
              <span class="fach-brett" aria-hidden="true"></span>
            </button>`,
            )
            .join('')}
        </div>
        <div class="korb" aria-label="${esc(t('regal.korb'))}">
          ${runde.korb
            .map(
              (w) => `<button class="ware ${w.id === runde.gewaehlt ? 'gewaehlt' : ''}" data-aktion="ware" data-id="${esc(w.id)}" aria-pressed="${w.id === runde.gewaehlt}">${esc(w.symbol)}</button>`,
            )
            .join('')}
        </div>
      </div>`;
  }

  function pause(ruhigeHand) {
    wurzel.innerHTML = `
      <div class="regal-spiel">
        ${kopf()}
        <div class="regal-pause">
          <div class="grosser-stern" aria-hidden="true">★</div>
          <h2>${esc(t('regal.fertig_titel', { nummer: runde.nummer }))}</h2>
          ${ruhigeHand ? `<p class="leise">${esc(t('regal.ruhige_hand'))}</p>` : ''}
          ${ohneAtem
            ? `<p>${esc(t('regal.pause_ohne_atem'))}</p>`
            : `<div class="atem-kreis" aria-hidden="true"><span>${esc(t('regal.atem'))}</span></div><p>${esc(t('regal.fertig_text'))}</p>`}
          <div class="knopf-reihe zentriert">
            <button class="knopf knopf-haupt" data-aktion="naechstes">${esc(t('regal.naechstes'))}</button>
            <button class="knopf knopf-zweit" data-aktion="genug">${esc(t('regal.genug'))}</button>
          </div>
        </div>
      </div>`;
    const stern = $('.grosser-stern', wurzel);
    setTimeout(() => sternchen(stern, 7), 250);
  }

  function aktualisiereZaehler() {
    const stand = regalStand();
    rattern($('[data-zahl="punkte"]', wurzel), anzeige.punkte, stand.punkte);
    rattern($('[data-zahl="sterne"]', wurzel), anzeige.sterne, stand.sterne, 600);
    anzeige = { sterne: stand.sterne, punkte: stand.punkte };
  }

  function legeAb(fach) {
    const ware = runde.korb.find((w) => w.id === runde.gewaehlt);
    if (!ware) {
      runde.meldung = t('regal.anleitung_kurz');
      zeichne();
      return;
    }
    if (ware.kat !== fach.dataset.kat) {
      runde.fehlgriffe += 1;
      runde.gewaehlt = null;
      runde.meldung = t('regal.passt_woanders');
      zeichne();
      const neuesFach = $(`.fach[data-kat="${CSS.escape(fach.dataset.kat)}"]`, wurzel);
      if (!wenigBewegung()) neuesFach?.classList.add('sanft-wackeln');
      return;
    }
    runde.korb = runde.korb.filter((w) => w.id !== ware.id);
    runde.faecher[ware.kat].push(ware.symbol);
    runde.gewaehlt = null;
    runde.meldung = t('regal.anleitung_kurz');
    const fertig = runde.korb.length === 0;
    const ruhigeHand = fertig && runde.fehlgriffe === 0;
    aendereRegal((r) => {
      r.punkte += regeln.punkteProWare ?? 10;
      if (fertig) {
        r.regale += 1;
        r.sterne += 1;
        if (ruhigeHand) r.punkte += regeln.punkteRuhigeHand ?? 20;
      }
      return r;
    });
    if (fertig) {
      pause(ruhigeHand);
    } else {
      zeichne();
      const ziel = $(`.fach[data-kat="${CSS.escape(ware.kat)}"] .ware-im-fach:last-child`, wurzel);
      ziel?.classList.add('neu-abgelegt');
    }
    aktualisiereZaehler();
  }

  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    switch (ziel.dataset.aktion) {
      case 'ware':
        runde.gewaehlt = runde.gewaehlt === ziel.dataset.id ? null : ziel.dataset.id;
        zeichne();
        break;
      case 'fach':
        legeAb(ziel);
        break;
      case 'naechstes':
        neueRunde();
        break;
      case 'genug':
        wurzel.innerHTML = `
          <div class="regal-spiel">
            <div class="regal-pause">
              <div class="grosser-stern mond" aria-hidden="true">🌙</div>
              <p>${esc(t('regal.gute_nacht'))}</p>
              <p class="leise">${esc(nachSpiel)}</p>
              <button class="knopf knopf-zweit" data-aktion="zurueck">${esc(t('regal.zurueck'))}</button>
            </div>
          </div>`;
        break;
      case 'zurueck':
        beenden();
        break;
    }
  };

  neueRunde();
}
