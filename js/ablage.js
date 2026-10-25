// Jede Fassung der App (jeder Ordner auf dem Server) bekommt ihren eigenen Bereich im Speicher des Browsers.
// So mischen sich die Einträge nicht, auch wenn zwei Fassungen auf derselben Domain im selben Browser laufen.

export const BEREICH = location.pathname.replace(/[^/]*$/, '');
const PRAEFIX = `emona${BEREICH}`;
const ALTE_SCHLUESSEL = ['docs', 'ausstehend', 'seit', 'geraet', 'zuletzt', 'gestartet'];

export function ablageName(name) {
  return `${PRAEFIX}:${name}`;
}

// Einmalige Übernahme aus Version 1.2 und früher, als es noch keine Bereiche gab.
// Die erste Fassung, die geöffnet wird, übernimmt die alten Daten. Die alten Einträge bleiben zur Sicherheit stehen.
export function uebernimmAlteAblage() {
  try {
    if (localStorage.getItem(ablageName('docs')) !== null || localStorage.getItem(ablageName('gestartet')) !== null) return;
    if (localStorage.getItem('emona.uebernommen-von')) return;
    if (localStorage.getItem('emona.docs') === null && localStorage.getItem('emona.gestartet') === null) return;
    for (const name of ALTE_SCHLUESSEL) {
      const wert = localStorage.getItem(`emona.${name}`);
      if (wert !== null) localStorage.setItem(ablageName(name), wert);
    }
    localStorage.setItem('emona.uebernommen-von', BEREICH);
  } catch {
    /* Ohne Speicher läuft die App trotzdem. */
  }
}

export function ablageLesen(name) {
  try {
    return localStorage.getItem(ablageName(name));
  } catch {
    return null;
  }
}

export function ablageSchreiben(name, wert) {
  try {
    localStorage.setItem(ablageName(name), wert);
  } catch {
    /* Ohne Speicher läuft die App trotzdem. */
  }
}
