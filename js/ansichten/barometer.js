// Ansicht „Schultern“ (#barometer): erreichbar über die Erinnerung, die Tagesübersicht und die Experiment-Seite.
// Kein eigener Bereich: Jeder Eintrag gehört zum laufenden Experiment, ohne Experiment steht er unter „ohne Experiment“.

import { t } from '../inhalte.js';
import { zeigeSeiten, seitenZuruecksetzen, merkeSeite } from '../seiten.js';
import { neuerZustand, schulternGruppen, dankeGruppe, schulternAktion } from '../schultern.js';

let zustand = null;

export function verlassen() {
  zustand = null;
  seitenZuruecksetzen('barometer');
}

export function zeige(wurzel, ctx) {
  zustand ||= neuerZustand({ anlass: ctx.param === 'erinnerung' ? 'erinnerung' : 'frei' });
  zeigeSeiten(wurzel, [...schulternGruppen('b', zustand), dankeGruppe('b', zustand)], {
    schluessel: 'barometer',
    zurueck: { text: t('seiten.zurueck'), href: '#heute' },
  });
  wurzel.onclick = (e) => {
    const ziel = e.target.closest('[data-aktion]');
    if (!ziel) return;
    const was = schulternAktion(ziel, zustand, wurzel);
    // Nach der Stufe geht es zu „Wo spürst du es noch?“, danach zum Dank. Neu gezeichnet wird,
    // damit der Dank weiß, was gespürt wurde.
    if (was === 'stufe') merkeSeite('barometer', 'b-wo');
    if (was === 'fertig') merkeSeite('barometer', 'b-danke');
    if (was === 'stufe' || was === 'fertig') ctx.zeichne();
  };
}
