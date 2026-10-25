// Notizen: Beobachtungen zum Experiment, Körper-Notizen und Antworten aus den Rückblicken.
// Jede Notiz lässt sich ändern und löschen. Gelöschte Notizen zählen nicht mehr für Rückblicke und Signale.
// Punkte und Erfolge, die schon vergeben sind, bleiben erhalten.

import { t } from './inhalte.js';
import { lies, schreibe } from './speicher.js';
import { beobachtungen, schluesselTage, aendereTag, tag } from './daten.js';
import { rueckblicke, rueckblick, speichereAntworten, ordnung, frageText } from './rueckblick.js';
import { datumLang } from './ansichten/teile.js';

export function alleNotizen() {
  const liste = [];
  for (const b of beobachtungen()) {
    liste.push({ id: `b|${b.schluessel}`, art: 'beobachtung', datum: b.datum, text: b.text, kopf: t('notizen.kopf_beobachtung', { datum: datumLang(b.datum) }) });
  }
  for (const datum of schluesselTage()) {
    const notiz = (tag(datum).koerper || '').trim();
    if (notiz) liste.push({ id: `k|${datum}`, art: 'koerper', datum, text: notiz, kopf: t('notizen.kopf_koerper', { datum: datumLang(datum) }) });
  }
  for (const rb of rueckblicke()) {
    for (const f of rb.fragen || []) {
      const text = (rb.antworten || {})[f.id];
      if (!text || f.typ === 'eingang') continue;
      liste.push({
        id: `a|${rb.nummer}|${f.id}`,
        art: 'antwort',
        datum: rb.erstellt || rb.tage?.[rb.tage.length - 1] || '',
        text,
        kopf: t('notizen.kopf_antwort', { ordnung: ordnung(rb.nummer), frage: frageText(f) }),
      });
    }
  }
  return liste.sort((a, b) => (a.datum < b.datum ? 1 : -1));
}

export function notiz(id) {
  return alleNotizen().find((n) => n.id === id) || null;
}

// Setzt den Text einer Notiz. Ein leerer Text löscht sie. Gibt eine Funktion zum Rückgängigmachen zurück.
export function setzeNotiz(id, text) {
  const [art, a, b] = id.split('|');
  if (art === 'b') {
    const alt = lies(a);
    schreibe(a, text ? { ...alt, text } : null);
    return () => schreibe(a, alt);
  }
  if (art === 'k') {
    const alt = tag(a).koerper;
    aendereTag(a, (t2) => {
      if (text) t2.koerper = text;
      else delete t2.koerper;
    });
    return () => aendereTag(a, (t2) => { t2.koerper = alt; });
  }
  if (art === 'a') {
    const nummer = Number(a);
    const alt = (rueckblick(nummer)?.antworten || {})[b] || '';
    speichereAntworten(nummer, { [b]: text });
    return () => speichereAntworten(nummer, { [b]: alt });
  }
  return () => {};
}
