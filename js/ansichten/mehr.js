// Ansicht „Mehr“: Sammlung und kleine Erfolge, Einstellungen, Erinnerungen, Server und Export.

import { t } from '../inhalte.js';
import { esc, absaetze, ganz, ausKey, toast } from '../util.js';
import { einstellungen, setzeEinstellungen } from '../daten.js';
import { gesamt, erreichteErfolge, offeneErfolgeAnzahl } from '../belohnung.js';
import { geraetDaten, setzeGeraet, syncZustand, sync, api, vonVorneSynchronisieren } from '../speicher.js';
import { unterstuetzt, istIphoneImBrowser, erlaubnis, einschalten, ausschalten } from '../erinnerung.js';
import { verfuegbareMonate, exportiereCsv, exportiereJson } from '../export.js';
import { VERSION } from '../version.js';

let installAufforderung = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installAufforderung = e;
});

function datumText(key) {
  const d = ausKey(key);
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function syncText() {
  const z = syncZustand();
  const texte = {
    lokal: t('mehr.sync_lokal'),
    ok: t('mehr.sync_ok'),
    ausstehend: t('mehr.sync_ausstehend'),
    fehler: t('mehr.sync_fehler'),
    code: t('mehr.sync_code_falsch'),
  };
  let text = texte[z.art] || '';
  if (z.zuletzt && z.art !== 'lokal') {
    const wann = new Date(z.zuletzt);
    const datum = wann.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
    const uhrzeit = wann.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    text += ` ${t('mehr.zuletzt', { datum, uhrzeit })}`;
  }
  return text;
}

function erinnerungsBereich(e) {
  const code = geraetDaten().code;
  let hinweis = '';
  if (!unterstuetzt()) hinweis = istIphoneImBrowser() ? t('mehr.erinnerungen_iphone') : t('mehr.erinnerungen_nicht_moeglich');
  else if (!code) hinweis = t('mehr.erinnerungen_kein_code');
  else if (erlaubnis() === 'denied') hinweis = t('mehr.erinnerungen_abgelehnt');
  const moeglich = unterstuetzt() && code && erlaubnis() !== 'denied';
  return `
    <section class="karte" aria-labelledby="erinnerung-titel">
      <h2 id="erinnerung-titel">${esc(t('mehr.erinnerungen_titel'))}</h2>
      ${absaetze(t('mehr.erinnerungen_text'))}
      <form class="formular" data-form="zeiten">
        <div class="feld-reihe">
          <label class="feld">
            <span class="feld-name">${esc(t('mehr.erinnerung_morgen'))}</span>
            <input type="time" name="erinnerungMorgen" value="${esc(e.erinnerungMorgen)}">
          </label>
          <label class="feld">
            <span class="feld-name">${esc(t('mehr.erinnerung_abend'))}</span>
            <input type="time" name="erinnerungAbend" value="${esc(e.erinnerungAbend)}">
          </label>
        </div>
      </form>
      <p class="leise klein">${esc(e.erinnerungenAn ? t('mehr.erinnerungen_aktiv') : t('mehr.erinnerungen_inaktiv'))}</p>
      ${hinweis ? `<p class="hinweis">${esc(hinweis)}</p>` : ''}
      ${moeglich || e.erinnerungenAn
        ? `<button class="knopf ${e.erinnerungenAn ? 'knopf-zweit' : 'knopf-haupt'}" data-aktion="erinnerungen">${esc(e.erinnerungenAn ? t('mehr.erinnerungen_aus') : t('mehr.erinnerungen_an'))}</button>`
        : ''}
    </section>`;
}

export function zeige(wurzel, ctx) {
  const e = einstellungen();
  const summe = gesamt();
  const erfolge = erreichteErfolge();
  const offen = offeneErfolgeAnzahl();
  const monate = verfuegbareMonate();
  const installiert = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  wurzel.innerHTML = `
    <header class="seiten-kopf">
      <h1>${esc(t('mehr.titel'))}</h1>
    </header>

    <section class="karte karte-sammlung" aria-labelledby="sammlung-titel">
      <h2 id="sammlung-titel">${esc(t('mehr.sammlung_titel'))}</h2>
      <p>${esc(t('mehr.sammlung_satz', { sterne: ganz(summe.sterne), punkte: ganz(summe.punkte) }))}</p>
      <div class="sammlung" aria-hidden="true">
        <div class="sammlung-wert"><span class="sammlung-symbol" aria-hidden="true">★</span><span class="sammlung-zahl" data-zahl="sterne">${ganz(summe.sterne)}</span><span class="sammlung-name">${esc(t('belohnung.sterne'))}</span></div>
        <div class="sammlung-wert"><span class="sammlung-symbol" aria-hidden="true">●</span><span class="sammlung-zahl" data-zahl="punkte">${ganz(summe.punkte)}</span><span class="sammlung-name">${esc(t('belohnung.punkte'))}</span></div>
      </div>
      <h3>${esc(t('erfolge.titel'))}</h3>
      <p class="leise klein">${esc(t('erfolge.einleitung'))}</p>
      ${erfolge.length
        ? `<ul class="erfolge">${erfolge
            .map((er) => `<li class="erfolg"><span class="symbol gross" aria-hidden="true">${esc(er.symbol)}</span><span><span class="erfolg-titel">${esc(er.titel)}</span><span class="leise klein">${esc(t('erfolge.erreicht_am', { datum: datumText(er.datum) }))}</span></span></li>`)
            .join('')}</ul>`
        : `<p>${esc(t('erfolge.leer'))}</p>`}
      ${offen ? `<p class="leise klein">${esc(t('erfolge.weitere'))}</p>` : ''}
    </section>

    <section class="karte" aria-labelledby="einst-titel">
      <h2 id="einst-titel">${esc(t('mehr.einstellungen_titel'))}</h2>
      <form class="formular" data-form="einstellungen">
        <label class="feld">
          <span class="feld-name">${esc(t('mehr.name'))}</span>
          <input type="text" name="name" value="${esc(e.name)}" maxlength="40" autocomplete="given-name">
        </label>
        <label class="feld">
          <span class="feld-name">${esc(t('mehr.abendmodus_ab'))}</span>
          <input type="time" name="abendmodusAb" value="${esc(e.abendmodusAb)}">
          <span class="feld-hilfe">${esc(t('mehr.abendmodus_hilfe'))}</span>
        </label>
        <button class="knopf knopf-haupt" type="submit">${esc(t('mehr.speichern'))}</button>
      </form>
    </section>

    ${erinnerungsBereich(e)}

    <section class="karte" aria-labelledby="sync-titel">
      <h2 id="sync-titel">${esc(t('mehr.sync_titel'))}</h2>
      <p class="sync-text" aria-live="polite">${esc(syncText())}</p>
      <form class="formular" data-form="code">
        <label class="feld">
          <span class="feld-name">${esc(t('mehr.code'))}</span>
          <input type="password" name="code" value="${esc(geraetDaten().code)}" autocomplete="current-password">
        </label>
        <div class="knopf-reihe">
          <button class="knopf knopf-zweit" type="submit">${esc(t('mehr.code_speichern'))}</button>
          ${geraetDaten().code ? `<button class="knopf-text" type="button" data-aktion="sync">${esc(t('mehr.sync_jetzt'))}</button>` : ''}
        </div>
      </form>
    </section>

    <section class="karte" aria-labelledby="export-titel">
      <h2 id="export-titel">${esc(t('mehr.export_titel'))}</h2>
      ${absaetze(t('mehr.export_text'))}
      <label class="feld">
        <span class="feld-name">${esc(t('mehr.export_zeitraum'))}</span>
        <select name="monat" data-feld="export-monat">
          <option value="">${esc(t('mehr.export_alle'))}</option>
          ${monate.map((m) => `<option value="${m}">${esc(ausKey(`${m}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))}</option>`).join('')}
        </select>
      </label>
      <div class="knopf-reihe">
        <button class="knopf knopf-zweit" data-aktion="csv">${esc(t('mehr.export_csv'))}</button>
        <button class="knopf knopf-zweit" data-aktion="json">${esc(t('mehr.export_json'))}</button>
      </div>
    </section>

    ${installiert ? '' : `
    <section class="karte" aria-labelledby="install-titel">
      <h2 id="install-titel">${esc(t('mehr.installieren_titel'))}</h2>
      <p>${esc(ios ? t('mehr.installieren_iphone') : t('mehr.installieren_android'))}</p>
      ${installAufforderung ? `<button class="knopf knopf-zweit" data-aktion="installieren">${esc(t('mehr.installieren_knopf'))}</button>` : ''}
    </section>`}

    <p class="fusszeile leise klein">${esc(t('mehr.version', { version: VERSION }))}</p>`;

  wurzel.onclick = async (ev) => {
    const ziel = ev.target.closest('[data-aktion]');
    if (!ziel) return;
    const aktion = ziel.dataset.aktion;
    const monat = wurzel.querySelector('[data-feld="export-monat"]')?.value || '';
    if (aktion === 'csv') exportiereCsv(monat);
    if (aktion === 'json') exportiereJson(monat);
    if (aktion === 'sync') {
      await sync();
      ctx.zeichne();
    }
    if (aktion === 'installieren' && installAufforderung) {
      installAufforderung.prompt();
      installAufforderung = null;
    }
    if (aktion === 'erinnerungen') {
      ziel.disabled = true;
      try {
        if (einstellungen().erinnerungenAn) await ausschalten();
        else await einschalten();
      } catch (fehler) {
        const meldung = {
          'kein-code': t('mehr.erinnerungen_kein_code'),
          abgelehnt: t('mehr.erinnerungen_abgelehnt'),
        }[fehler.message] || t('mehr.erinnerungen_nicht_moeglich');
        toast(meldung);
      }
      ctx.zeichne();
    }
  };

  wurzel.onchange = (ev) => {
    const form = ev.target.closest('form');
    if (form?.dataset.form === 'zeiten' && ev.target.value) {
      setzeEinstellungen({ [ev.target.name]: ev.target.value });
      toast(t('mehr.zeit_gespeichert'));
    }
  };

  wurzel.onsubmit = async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    if (form.dataset.form === 'einstellungen') {
      setzeEinstellungen({ name: form.elements.namedItem('name').value.trim(), abendmodusAb: form.abendmodusAb.value || '21:00' });
      toast(t('mehr.gespeichert'));
      ctx.modusPruefen();
      ctx.zeichne();
    }
    if (form.dataset.form === 'code') {
      const code = form.code.value.trim();
      const vorher = geraetDaten().code;
      if (code === vorher) return;
      if (!code) {
        setzeGeraet({ code: '' });
        ctx.zeichne();
        return;
      }
      try {
        await api('pruefen', {}, { code });
        setzeGeraet({ code });
        vonVorneSynchronisieren();
        await sync();
        toast(t('mehr.code_angenommen'));
      } catch (fehler) {
        if (fehler.status === 0) {
          setzeGeraet({ code });
          vonVorneSynchronisieren();
          toast(t('start.kein_netz'));
        } else {
          toast(fehler.status === 401 ? t('start.code_falsch') : fehler.message);
        }
      }
      ctx.zeichne();
    }
  };
}
