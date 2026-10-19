// Kleine Hilfsfunktionen: Datum, Zahlen, HTML, Animationen.

export const $ = (auswahl, wurzel = document) => wurzel.querySelector(auswahl);
export const $$ = (auswahl, wurzel = document) => [...wurzel.querySelectorAll(auswahl)];

export function esc(wert) {
  return String(wert ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function neueId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Datum ---------- */

const zwei = (n) => String(n).padStart(2, '0');

export function datumKey(d = new Date()) {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

export function ausKey(key) {
  const [j, m, t] = key.split('-').map(Number);
  return new Date(j, m - 1, t, 12);
}

export function plusTage(key, n) {
  const d = ausKey(key);
  d.setDate(d.getDate() + n);
  return datumKey(d);
}

// Der Tag beginnt erst um vier Uhr morgens. Ein Eintrag um halb eins gehört noch zum Vortag.
export function logischerTag(d = new Date()) {
  const kopie = new Date(d);
  if (kopie.getHours() < 4) kopie.setDate(kopie.getDate() - 1);
  return datumKey(kopie);
}

export function monatKey(d = new Date()) {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}`;
}

export function isoWoche(key) {
  const d = ausKey(key);
  const tag = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - tag + 3);
  const jahr = d.getFullYear();
  const ersterDonnerstag = new Date(jahr, 0, 4, 12);
  const kw = 1 + Math.round(((d - ersterDonnerstag) / 86400000 - 3 + ((ersterDonnerstag.getDay() + 6) % 7)) / 7);
  return { jahr, kw, key: `${jahr}-W${zwei(kw)}` };
}

export function wochenMontag(key) {
  const d = ausKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return datumKey(d);
}

export function jetztZeit(d = new Date()) {
  return `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

export function zeitZuMinuten(zeit) {
  const treffer = /^(\d{1,2}):(\d{2})$/.exec(zeit || '');
  if (!treffer) return null;
  return Number(treffer[1]) * 60 + Number(treffer[2]);
}

// Für Einschlafzeiten: alles vor zwölf Uhr mittags zählt als „nach Mitternacht“ (also 24:30 statt 00:30).
export function einschlafMinuten(zeit) {
  const m = zeitZuMinuten(zeit);
  if (m === null) return null;
  return m < 12 * 60 ? m + 24 * 60 : m;
}

export function minutenZuZeit(minuten) {
  const m = ((Math.round(minuten) % 1440) + 1440) % 1440;
  return `${zwei(Math.floor(m / 60))}:${zwei(m % 60)}`;
}

/* ---------- Zahlen ---------- */

export function zahl(wert, stellen = 1) {
  if (wert === null || wert === undefined || Number.isNaN(wert)) return '–';
  return Number(wert).toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
}

export function ganz(wert) {
  return Math.round(wert).toLocaleString('de-DE');
}

export function leseZahl(text) {
  if (text === null || text === undefined) return null;
  const sauber = String(text).trim().replace(',', '.');
  if (sauber === '') return null;
  const n = Number(sauber);
  return Number.isFinite(n) ? n : null;
}

export function mittelwert(werte) {
  const gueltig = werte.filter((w) => typeof w === 'number' && Number.isFinite(w));
  if (!gueltig.length) return null;
  return gueltig.reduce((a, b) => a + b, 0) / gueltig.length;
}

export function zufall(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

export function mischen(liste) {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

/* ---------- Animationen ---------- */

export const wenigBewegung = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lässt eine Zahl ruhig von „von“ nach „bis“ hochrattern.
export function rattern(element, von, bis, dauer = 900) {
  if (!element) return;
  if (wenigBewegung() || von === bis) {
    element.textContent = ganz(bis);
    return;
  }
  const start = performance.now();
  element.classList.add('rattert');
  const schritt = (jetzt) => {
    const anteil = Math.min(1, (jetzt - start) / dauer);
    const sanft = 1 - Math.pow(1 - anteil, 3);
    element.textContent = ganz(von + (bis - von) * sanft);
    if (anteil < 1) requestAnimationFrame(schritt);
    else element.classList.remove('rattert');
  };
  requestAnimationFrame(schritt);
}

let toastTimer = null;
export function toast(text, symbol = '') {
  let box = $('#toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  box.innerHTML = `${symbol ? `<span class="toast-symbol" aria-hidden="true">${esc(symbol)}</span>` : ''}<span>${esc(text)}</span>`;
  box.classList.add('sichtbar');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('sichtbar'), 3800);
}

// Kleine Sterne, die an einer Stelle aufsteigen und verblassen.
export function sternchen(ausgangsElement, anzahl = 5) {
  if (wenigBewegung() || !ausgangsElement) return;
  const r = ausgangsElement.getBoundingClientRect();
  for (let i = 0; i < anzahl; i++) {
    const s = document.createElement('span');
    s.className = 'funkeln';
    s.textContent = '✦';
    s.style.left = `${r.left + r.width / 2 + (Math.random() - 0.5) * r.width * 0.6}px`;
    s.style.top = `${r.top + r.height / 2}px`;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 80}px`);
    s.style.setProperty('--verzoegerung', `${i * 70}ms`);
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1600 + i * 70);
  }
}

export function herunterladen(dateiname, inhalt, typ) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
