<?php
/*
 * EMONA leicht – sanfte Erinnerungen
 *
 * Diese Datei wird regelmäßig von einem Cronjob aufgerufen (am besten alle 15 Minuten):
 *   https://deine-domain.de/emona/api/erinnerung.php?schluessel=CRON-SCHLUESSEL
 * oder auf der Kommandozeile:
 *   php erinnerung.php
 *
 * Sie verschickt höchstens eine Morgen- und eine Abenderinnerung pro Tag.
 * Ist die Uhrzeit schon länger als 90 Minuten vorbei, wird nichts nachgeschickt.
 * Ist der Eintrag schon gemacht, wird gar nicht erst erinnert.
 */

declare(strict_types=1);
require __DIR__ . '/lib.php';

$config = emona_config();

if (PHP_SAPI !== 'cli') {
    $schluessel = (string) ($_GET['schluessel'] ?? '');
    $erwartet = (string) ($config['cron_schluessel'] ?? '');
    if ($erwartet === '' || strpos($erwartet, 'HIER-') === 0 || !hash_equals($erwartet, $schluessel)) {
        emona_fehler(403, 'Für diese Adresse hast du leider keinen Zugriff.');
    }
}

const EMONA_FENSTER_MINUTEN = 90;

$ergebnis = emona_mit_daten(function (array &$daten) {
    $einstellungen = $daten['docs']['einstellungen']['wert'] ?? [];
    if (empty($einstellungen['erinnerungenAn']) || empty($daten['system']['abos'])) {
        return ['gesendet' => [], 'hinweis' => 'Die Erinnerungen sind ausgeschaltet, oder es ist noch kein Gerät angemeldet.'];
    }

    $heute = date('Y-m-d');
    $jetztMinuten = (int) date('G') * 60 + (int) date('i');
    $tag = $daten['docs']['tag:' . $heute]['wert'] ?? [];
    $gesendet = [];

    $arten = [
        'morgen' => [
            'uhrzeit' => $einstellungen['erinnerungMorgen'] ?? '07:30',
            'schon_erledigt' => isset($tag['gewicht']) || isset($tag['einschlafzeit']) || isset($tag['schlafdauer']),
        ],
        'abend' => [
            'uhrzeit' => $einstellungen['erinnerungAbend'] ?? '21:00',
            'schon_erledigt' => isset($tag['anspannung']),
        ],
    ];

    foreach ($arten as $art => $info) {
        if (!preg_match('/^(\d{1,2}):(\d{2})$/', (string) $info['uhrzeit'], $teile)) {
            continue;
        }
        $zielMinuten = (int) $teile[1] * 60 + (int) $teile[2];
        $imFenster = $jetztMinuten >= $zielMinuten && $jetztMinuten < $zielMinuten + EMONA_FENSTER_MINUTEN;
        $schonGesendet = ($daten['system']['gesendet'][$art] ?? '') === $heute;
        if (!$imFenster || $schonGesendet) {
            continue;
        }
        // Auch wenn nichts verschickt wird: der Tag gilt als erledigt, damit nie nachgehakt wird.
        $daten['system']['gesendet'][$art] = $heute;
        if ($info['schon_erledigt']) {
            continue;
        }
        $behalten = [];
        foreach ($daten['system']['abos'] as $abo) {
            $status = emona_push_senden($abo['endpoint'], $art);
            $gesendet[] = ['art' => $art, 'status' => $status];
            // 404 und 410 bedeuten: Dieses Gerät gibt es nicht mehr.
            if ($status !== 404 && $status !== 410) {
                $behalten[] = $abo;
            }
        }
        $daten['system']['abos'] = $behalten;
    }
    return ['gesendet' => $gesendet];
});

emona_antwort(['ok' => true] + $ergebnis);
