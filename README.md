# EMONA leicht

EMONA leicht ist eine persönliche Begleit-App fürs Handy. Sie zeigt den Zusammenhang zwischen Anspannung, Schlaf und Gewicht, holt Freude fest in den Alltag und hilft abends beim Runterkommen. Es ist keine Diät-App.

Die App ist eine installierbare Web-App (PWA). Sie braucht nur normales Webhosting mit PHP 7.4 oder neuer, keinen Node-Server und keine Datenbank.

## So kommt die App auf den Server

### 1. Diese Dateien und Ordner hochladen

Lade alles in einen eigenen Ordner, zum Beispiel `seemoorhof.de/emona/`:

```
emona/
├── index.html
├── manifest.webmanifest
├── sw.js
├── .htaccess
├── css/            (ganzer Ordner)
├── js/             (ganzer Ordner, mit Unterordner „ansichten“)
├── inhalte/        (ganzer Ordner)
├── icons/          (ganzer Ordner)
└── api/
    ├── index.php
    ├── lib.php
    ├── erinnerung.php
    ├── config.php      (selbst anlegen, siehe Schritt 2)
    ├── .htaccess
    └── daten/
        ├── .htaccess
        └── index.php
```

Nicht hochladen musst du `README.md`, `.gitignore` und `api/config.example.php`.

Achte darauf, dass dein FTP-Programm auch die versteckten Dateien `.htaccess` hochlädt.

### 2. Den Zugangscode festlegen

1. Kopiere `api/config.example.php` und nenne die Kopie `config.php`.
2. Trage bei `zugangscode` deinen persönlichen Code ein. Diesen Code gibst du beim ersten Öffnen der App ein.
3. Trage bei `kontakt` deine E-Mail-Adresse ein, mit `mailto:` davor. Sie wird nur an Apple oder Google übermittelt, die die Erinnerungen zustellen.
4. Trage bei `cron_schluessel` einen langen Zufallswert ein, zum Beispiel aus einem Passwort-Generator.
5. Lade `config.php` in den Ordner `api/` hoch.

### 3. Schreibrechte prüfen

Der Ordner `api/daten/` muss für PHP beschreibbar sein. Bei den meisten Anbietern ist das schon so. Falls beim ersten Eintragen ein Fehler kommt, setze die Rechte des Ordners auf `755` oder `775`.

In diesem Ordner entstehen von selbst:

- `emona-daten.json` mit allen Einträgen,
- `vapid.json` mit dem Schlüssel für die Erinnerungen,
- `sicherungen/` mit einer Sicherungskopie pro Tag (die letzten 30 bleiben erhalten).

Der Ordner ist durch die `.htaccess` für den Browser gesperrt. Wenn dein Anbieter kein Apache nutzt (zum Beispiel nginx), trage in `config.php` bei `datenordner` einen Ordner außerhalb des Web-Verzeichnisses ein.

### 4. Die Erinnerungen einrichten (Cronjob)

Damit morgens und abends eine sanfte Erinnerung kommt, braucht der Server einen Cronjob. Lege im Kundenmenü deines Anbieters einen Cronjob an, der alle 15 Minuten diese Adresse aufruft:

```
https://seemoorhof.de/emona/api/erinnerung.php?schluessel=DEIN-CRON-SCHLUESSEL
```

Wenn dein Anbieter keine Cronjobs hat, geht das kostenlos über einen Dienst wie cron-job.org.

So verhalten sich die Erinnerungen:

- Es kommen höchstens zwei am Tag, eine morgens und eine abends.
- Ist der Eintrag schon gemacht, kommt keine Erinnerung.
- Ist die eingestellte Uhrzeit länger als 90 Minuten vorbei, wird nichts nachgeschickt. Es gibt also nie eine Nachfrage.

Danach in der App unter „Mehr“ auf „Erinnerungen einschalten“ tippen. Auf dem iPhone geht das nur, wenn die App vorher auf den Home-Bildschirm gelegt und von dort geöffnet wurde (ab iOS 16.4).

### 5. Auf den Startbildschirm legen

- **iPhone:** Die Adresse in Safari öffnen, auf „Teilen“ und dann auf „Zum Home-Bildschirm“ tippen.
- **Android:** Die Adresse in Chrome öffnen und im Menü „App installieren“ wählen.

Die Seite muss über `https://` erreichbar sein, sonst lässt sie sich nicht installieren.

## Updates

Die App holt sich neue Fassungen von selbst. Lade geänderte Dateien einfach hoch. Wenn du an `sw.js` oder an der Liste der Dateien etwas änderst, erhöhe die Nummer in `CACHE_NAME` in `sw.js` und `VERSION` in `js/version.js`. Die neue Fassung wird dann still geladen, sobald die App das nächste Mal im Hintergrund war.

## Texte und Inhalte ändern

Alle Texte, Impulse, Freude-Quellen, Experimente, Ideen zum Runterkommen, die Waren im Abendregal und die kleinen Erfolge stehen in **`inhalte/inhalte.json`**. Für einen Kurs kannst du diese Datei austauschen, ohne den Code anzufassen. Persönliche Daten stehen nicht im Code. Der Name wird in der App eingegeben, der Zugangscode steht nur in `api/config.php`.

Die wichtigsten Bereiche der Inhaltsdatei:

| Bereich | Inhalt |
|---|---|
| `texte` | alle Beschriftungen und Sätze der App |
| `freudeStartwerte` | die Freude-Liste beim ersten Start |
| `pausenImpulse` | Sätze für den Pausenvorschlag nach „Summen im Kopf“, `{freude}` wird ersetzt |
| `experimentStartwert` | das erste Experiment des Monats |
| `runterkommen` | Ideen im Abendmodus mit Schritt-für-Schritt-Hinweisen |
| `regal` | Fächer und Waren des Abendregals |
| `belohnungen` | Punkte für Freude-Plätze, Pausen und gelandete Abende |
| `erfolge` | kleine Erfolge mit Art, Anzahl und Text |
| `erinnerungen` | Titel und Text der beiden Erinnerungen |

## Export für die Monatsauswertung

In der App unter „Mehr“ lässt sich ein Monat oder alles als CSV (für Excel oder Numbers) oder als JSON herunterladen.

Die Schnittstelle liefert den Export auch direkt, zum Beispiel für eine automatische Auswertung:

```
curl -X POST https://seemoorhof.de/emona/api/index.php \
  -d '{"code":"DEIN-CODE","aktion":"export","format":"csv","monat":"2026-10"}'
```

Wichtig für die Auswertung: Ein Tag beginnt um 4 Uhr morgens. Die Einschlafzeit wird am Morgen eingetragen und gehört deshalb zur Nacht nach dem Vortag. Der Verlauf in der App vergleicht die Anspannung eines Tages mit der Einschlafzeit der folgenden Nacht.

## Aufbau für später

Der Aufbau ist offen für Erweiterungen:

- **Daten:** Alles liegt als einzelne Dokumente mit Schlüsseln wie `tag:2026-10-19`, `freude`, `experiment:2026-10`, `regal`, `erfolge`, `einstellungen`. Neue Bereiche (etwa `stressquellen` oder `rueckblick:2026-10`) lassen sich einfach als weitere Dokumente ergänzen. Der Abgleich funktioniert für jeden Schlüssel von selbst.
- **Ansichten:** Jede Ansicht ist eine eigene Datei in `js/ansichten/`. Eine neue Ansicht wird in `js/app.js` bei `ANSICHTEN` eingetragen.
- **Abendspiele:** Das Abendregal steckt in `js/regal.js`. Weitere ruhige Spiele können nach demselben Muster daneben entstehen.
- **Kursfassung:** Texte stecken in der Inhaltsdatei. Für mehrere Frauen müsste die Schnittstelle pro Zugangscode eine eigene Datendatei anlegen.

## Dateien im Überblick

| Datei | Aufgabe |
|---|---|
| `index.html` | Gerüst der App |
| `css/app.css` | Gestaltung mit Tag- und Abendmodus |
| `js/app.js` | Start, Navigation, Abendmodus, Updates |
| `js/speicher.js` | lokaler Speicher und Abgleich mit dem Server |
| `js/daten.js` | Tage, Freude-Liste, Experimente, Einstellungen |
| `js/belohnung.js` | Sterne, Punkte und kleine Erfolge |
| `js/regal.js` | das Abendregal |
| `js/erinnerung.js` | Anmeldung für Erinnerungen |
| `js/export.js` | Export als CSV und JSON |
| `js/ansichten/*.js` | die Ansichten Heute, Verlauf, Freude, Abend, Mehr und die Begrüßung |
| `sw.js` | Offline-Betrieb, Updates und Anzeige der Erinnerungen |
| `api/index.php` | Schnittstelle: Code prüfen, Abgleich, Export, Erinnerungs-Anmeldung |
| `api/erinnerung.php` | verschickt die Erinnerungen (Cronjob) |
| `api/lib.php` | gemeinsame Hilfsfunktionen, sicheres Schreiben, Web-Push |
