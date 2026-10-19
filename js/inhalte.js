// Lädt die Inhaltsdatei. Alle Texte, Impulse und Startwerte stehen dort, nicht im Code.

let inhalte = null;

export async function ladeInhalte() {
  const antwort = await fetch('inhalte/inhalte.json', { cache: 'no-cache' });
  inhalte = await antwort.json();
  return inhalte;
}

// Liest einen Wert über einen Pfad wie „erinnerungen.abend.titel“.
export function inhalt(pfad, ersatz = undefined) {
  let wert = inhalte;
  for (const teil of pfad.split('.')) {
    if (wert === null || wert === undefined) return ersatz;
    wert = wert[teil];
  }
  return wert === undefined ? ersatz : wert;
}

// Liest einen Text aus „texte“ und setzt Platzhalter wie {name} ein.
export function t(pfad, werte = {}) {
  const text = inhalt(`texte.${pfad}`);
  if (typeof text !== 'string') return pfad;
  return fuelle(text, werte);
}

export function fuelle(text, werte = {}) {
  return text.replace(/\{(\w+)\}/g, (ganz, name) => (name in werte ? String(werte[name]) : ganz));
}
