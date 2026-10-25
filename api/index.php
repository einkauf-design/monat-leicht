<?php
/*
 * EMONA leicht – Schnittstelle
 *
 * Alle Anfragen kommen als POST mit JSON: { "code": "...", "aktion": "...", ... }
 *
 * Aktionen:
 *   pruefen        – prüft den Zugangscode
 *   sync           – { docs: {schluessel: {wert, zeit}}, seit } → führt zusammen, liefert neuere Dokumente
 *   vapid          – liefert den öffentlichen Schlüssel für Erinnerungen
 *   abo            – { abo: PushSubscription } speichert ein Gerät für Erinnerungen
 *   abo_loeschen   – { endpunkt } entfernt ein Gerät
 *   spaeter        – { art } bittet um genau eine weitere Erinnerung in einer Stunde
 *   export         – { format: "json"|"csv", monat?: "2026-10" } liefert die Einträge als Datei
 */

declare(strict_types=1);
require __DIR__ . '/lib.php';

$config = emona_config();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    emona_fehler(405, 'Diese Adresse antwortet nur auf POST-Anfragen.');
}

$roh = file_get_contents('php://input', false, null, 0, 4 * 1024 * 1024);
$anfrage = json_decode((string) $roh, true);
if (!is_array($anfrage)) {
    emona_fehler(400, 'Die Anfrage ist leider kein gültiges JSON.');
}

emona_code_pruefen((string) ($anfrage['code'] ?? ''));

switch ($anfrage['aktion'] ?? '') {
    case 'pruefen':
        emona_antwort(['ok' => true]);

    case 'sync':
        emona_sync($anfrage);

    case 'vapid':
        emona_antwort(['ok' => true, 'schluessel' => emona_vapid()['oeffentlich']]);

    case 'abo':
        emona_abo_speichern($anfrage);

    case 'abo_loeschen':
        $endpunkt = (string) ($anfrage['endpunkt'] ?? '');
        emona_mit_daten(function (array &$daten) use ($endpunkt) {
            $daten['system']['abos'] = array_values(array_filter(
                $daten['system']['abos'],
                fn ($abo) => ($abo['endpoint'] ?? '') !== $endpunkt
            ));
        });
        emona_antwort(['ok' => true]);

    case 'spaeter':
        // Nur auf ausdrücklichen Wunsch: genau eine weitere Erinnerung in einer Stunde.
        $art = preg_match('/^[a-z]{3,12}$/', (string) ($anfrage['art'] ?? '')) ? $anfrage['art'] : 'spaeter';
        emona_mit_daten(function (array &$daten) use ($art) {
            $daten['system']['spaeter'] = ['um' => time() + 3600, 'art' => $art];
        });
        emona_antwort(['ok' => true]);

    case 'export':
        emona_export($anfrage);

    default:
        emona_fehler(400, 'Diese Aktion kennt die Schnittstelle nicht.');
}

/* ---------- Zugangscode mit sanfter Sperre gegen Durchprobieren ---------- */

function emona_code_pruefen(string $code): void
{
    $config = emona_config();
    $erwartet = (string) ($config['zugangscode'] ?? '');
    if ($erwartet === '' || $erwartet === 'HIER-DEINEN-CODE-EINTRAGEN') {
        emona_fehler(500, 'In der Datei api/config.php steht noch kein Zugangscode. Bitte trag dort deinen Code ein.');
    }

    $sperrDatei = emona_pfad('sperre.json');
    $sperre = is_file($sperrDatei) ? (json_decode((string) file_get_contents($sperrDatei), true) ?: []) : [];
    $wer = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|emona');
    $jetzt = time();
    foreach ($sperre as $schluessel => $eintrag) {
        if ($eintrag['seit'] < $jetzt - 900) {
            unset($sperre[$schluessel]);
        }
    }
    if (($sperre[$wer]['anzahl'] ?? 0) >= 8) {
        emona_fehler(429, 'Es gab gerade zu viele Versuche. Bitte probier es in einer Viertelstunde noch einmal.');
    }

    if (!hash_equals($erwartet, $code)) {
        $sperre[$wer] = ['anzahl' => ($sperre[$wer]['anzahl'] ?? 0) + 1, 'seit' => $sperre[$wer]['seit'] ?? $jetzt];
        file_put_contents($sperrDatei, json_encode($sperre), LOCK_EX);
        sleep(1);
        emona_fehler(401, 'Dein Zugangscode passt leider nicht.');
    }
    if (isset($sperre[$wer])) {
        unset($sperre[$wer]);
        file_put_contents($sperrDatei, json_encode($sperre), LOCK_EX);
    }
}

/* ---------- Synchronisation ---------- */

function emona_sync(array $anfrage): void
{
    $eingang = is_array($anfrage['docs'] ?? null) ? $anfrage['docs'] : [];
    $seit = (int) ($anfrage['seit'] ?? 0);
    $jetzt = (int) round(microtime(true) * 1000);

    $antwort = emona_mit_daten(function (array &$daten) use ($eingang, $seit, $jetzt) {
        foreach ($eingang as $schluessel => $doc) {
            if (!is_string($schluessel) || !preg_match('/^[a-z]+(:[0-9a-z-]+)?$/', $schluessel)) {
                continue;
            }
            if (!is_array($doc) || !isset($doc['zeit']) || !array_key_exists('wert', $doc)) {
                continue;
            }
            $vorhanden = $daten['docs'][$schluessel] ?? null;
            if ($vorhanden === null || (int) $doc['zeit'] > (int) $vorhanden['zeit']) {
                $daten['docs'][$schluessel] = [
                    'wert' => $doc['wert'],
                    'zeit' => (int) $doc['zeit'],
                    'server' => $jetzt,
                ];
            }
        }
        $neu = [];
        foreach ($daten['docs'] as $schluessel => $doc) {
            if ((int) ($doc['server'] ?? 0) > $seit) {
                $neu[$schluessel] = ['wert' => $doc['wert'], 'zeit' => $doc['zeit']];
            }
        }
        return $neu;
    });

    emona_antwort(['ok' => true, 'docs' => (object) $antwort, 'jetzt' => $jetzt]);
}

/* ---------- Erinnerungen ---------- */

function emona_abo_speichern(array $anfrage): void
{
    $abo = $anfrage['abo'] ?? null;
    if (!is_array($abo) || empty($abo['endpoint']) || !preg_match('#^https://#', (string) $abo['endpoint'])) {
        emona_fehler(400, 'Ich konnte dein Gerät leider nicht für Erinnerungen anmelden.');
    }
    emona_mit_daten(function (array &$daten) use ($abo) {
        $abos = array_filter($daten['system']['abos'], fn ($a) => ($a['endpoint'] ?? '') !== $abo['endpoint']);
        $abos[] = ['endpoint' => (string) $abo['endpoint'], 'seit' => date('c')];
        $daten['system']['abos'] = array_values($abos);
    });
    emona_antwort(['ok' => true]);
}

/* ---------- Export ---------- */

function emona_export(array $anfrage): void
{
    $monat = preg_match('/^\d{4}-\d{2}$/', (string) ($anfrage['monat'] ?? '')) ? $anfrage['monat'] : '';
    $docs = emona_mit_daten(fn (array &$daten) => $daten['docs']);

    $tage = [];
    foreach ($docs as $schluessel => $doc) {
        if (strpos($schluessel, 'tag:') === 0 && is_array($doc['wert'])) {
            $datum = substr($schluessel, 4);
            if ($monat === '' || strpos($datum, $monat) === 0) {
                $tage[$datum] = $doc['wert'];
            }
        }
    }
    ksort($tage);
    $name = 'emona-' . ($monat ?: 'alle') . '-' . date('Y-m-d');

    if (($anfrage['format'] ?? 'json') === 'csv') {
        $zeilen = [['datum', 'gewicht_kg', 'taille_cm', 'einschlafzeit', 'schlafdauer_h', 'anspannung_1_bis_5', 'summen', 'summen_anzahl', 'pausen', 'freude_genutzt', 'satz', 'koerper']];
        foreach ($tage as $datum => $tag) {
            $zeilen[] = [
                $datum,
                isset($tag['gewicht']) ? str_replace('.', ',', (string) $tag['gewicht']) : '',
                isset($tag['taille']) ? str_replace('.', ',', (string) $tag['taille']) : '',
                $tag['einschlafzeit'] ?? '',
                isset($tag['schlafdauer']) ? str_replace('.', ',', (string) $tag['schlafdauer']) : '',
                $tag['anspannung'] ?? '',
                !empty($tag['summen']) ? 'ja' : 'nein',
                count($tag['summen'] ?? []),
                (int) ($tag['pausen'] ?? 0),
                count($tag['freudeGenutzt'] ?? []),
                $tag['satz'] ?? '',
                $tag['koerper'] ?? '',
            ];
        }
        $csv = "\xEF\xBB\xBF";
        foreach ($zeilen as $zeile) {
            $csv .= implode(';', array_map(function ($feld) {
                $feld = (string) $feld;
                return preg_match('/[;"\n\r]/', $feld) ? '"' . str_replace('"', '""', $feld) . '"' : $feld;
            }, $zeile)) . "\r\n";
        }
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $name . '.csv"');
        header('Cache-Control: no-store');
        echo $csv;
        exit;
    }

    $ausgabe = ['exportiert' => date('c'), 'zeitraum' => $monat ?: 'alle', 'tage' => $tage, 'weitere' => []];
    foreach ($docs as $schluessel => $doc) {
        if (strpos($schluessel, 'tag:') !== 0) {
            $ausgabe['weitere'][$schluessel] = $doc['wert'];
        }
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $name . '.json"');
    header('Cache-Control: no-store');
    echo json_encode($ausgabe, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}
