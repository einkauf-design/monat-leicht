<?php
/*
 * Vorlage für die Einstellungen der Schnittstelle.
 * Kopiere diese Datei als „config.php“ in denselben Ordner und trage deine Werte ein.
 * Die Datei config.php wird nie im Browser angezeigt, weil der Server sie als PHP ausführt.
 */
return [
    // Dein persönlicher Zugangscode. Wähle etwas, das nur du kennst (mindestens 8 Zeichen).
    'zugangscode' => 'HIER-DEINEN-CODE-EINTRAGEN',

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
];
