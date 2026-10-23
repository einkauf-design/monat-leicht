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
// Gibt es eine Variante mit der Endung „_eins“, wird sie bei genau einem Stück verwendet.
export function t(pfad, werte = {}) {
  let text = inhalt(`texte.${pfad}`);
  if (werte.anzahl === 1) {
    const eins = inhalt(`texte.${pfad}_eins`);
    if (typeof eins === 'string') text = eins;
  }
  if (typeof text !== 'string') return pfad;
  return fuelle(text, werte);
}

// Platzhalter: {name} setzt den Wert ein, {name:wort} schreibt kleine Zahlen als Wort („zwei“),
// {name:mal} ergibt „einmal“, „dreimal“ oder bei großen Zahlen „15-mal“.
export function fuelle(text, werte = {}) {
  return text.replace(/\{(\w+)(?::(wort|mal))?\}/g, (ganz, name, form) => {
    if (!(name in werte)) return ganz;
    const wert = werte[name];
    if (!form || typeof wert !== 'number') return String(wert);
    const woerter = inhalt('texte.allgemein.zahlwoerter', []);
    const wort = Number.isInteger(wert) && woerter[wert] ? woerter[wert] : null;
    if (form === 'wort') return wort ?? String(wert);
    if (wert === 1) return 'einmal';
    return wort ? `${wort}mal` : `${wert}-mal`;
  });
}
