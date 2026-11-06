<?php
/*
 * Vorlage für die Einstellungen der Schnittstelle.
 * Kopiere diese Datei als „config.php“ in denselben Ordner und trage deine Werte ein.
 * Die Datei config.php wird nie im Browser angezeigt, weil der Server sie als PHP ausführt.
 */
return [
    // Dein persönlicher Zugangscode. Wähle etwas, das nur du kennst (mindestens 8 Zeichen).
    'zugangscode' => 'HIER-DEINEN-CODE-EINTRAGEN',

    // Für mehrere Testerinnen (seit 1.7.0): pro Frau ein eigener Code und ein Kurzname
    // (kleine Buchstaben, Ziffern, Bindestrich). Jede Frau bekommt eine eigene Datendatei.
    // Wer nur diese Liste nutzt, setzt „zugangscode“ auf ''.
    // 'zugangscodes' => [
    //     'LANGER-CODE-FUER-FRAU-1' => 'frau-1',
    //     'LANGER-CODE-FUER-FRAU-2' => 'frau-2',
    // ],

    // Ordner, in dem die Einträge als JSON-Datei liegen.
    // Am sichersten ist ein Ordner außerhalb des Web-Verzeichnisses, zum Beispiel '/www/htdocs/w0123456/emona-daten'.
    // Standard ist der geschützte Ordner „daten“ direkt neben dieser Datei.
    'datenordner' => __DIR__ . '/daten',

    // Zeitzone für die Erinnerungen.
    'zeitzone' => 'Europe/Berlin',

    // Kontaktadresse für den Erinnerungsdienst (wird nur an Apple/Google/Mozilla übermittelt).
    'kontakt' => 'mailto:deine-adresse@example.de',

    // Geheimer Schlüssel für den Cronjob, der die Erinnerungen verschickt.
    // Der Cronjob ruft dann auf: https://deine-domain.de/emona/api/erinnerung.php?schluessel=DIESER-WERT
    'cron_schluessel' => 'HIER-EINEN-LANGEN-ZUFALLSWERT-EINTRAGEN',

    // KI-Begleitung (seit 1.8.0): Gespräch „Frag mich“ und Vorschlag für die nächste Woche im Rückblick.
    // Ohne Schlüssel bleibt die Begleitung aus. Den Schlüssel gibt es unter console.anthropic.com → API Keys.
    'ki_schluessel' => 'HIER-DEN-API-SCHLUESSEL-EINTRAGEN',
    'ki_modell' => 'claude-sonnet-5-5',
    // Für alle Frauen zusammen. Ist die Grenze erreicht, pausiert die Begleitung bis zum Monatsersten.
    'ki_monatsgrenze_euro' => 10,
    // Nachrichten pro Frau und Tag.
    'ki_tagesgrenze' => 30,
];
