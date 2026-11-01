<?php
/*
 * EMONA leicht – sanfte Erinnerungen
 *
 * Diese Datei wird regelmäßig von einem Cronjob aufgerufen (am besten alle 15 Minuten):
 *   https://deine-domain.de/emona/api/erinnerung.php?schluessel=CRON-SCHLUESSEL
 * oder auf der Kommandozeile:
 *   php erinnerung.php
 *
 * Sie verschickt höchstens eine Morgen- und eine Abenderinnerung pro Tag. Während des Experiments
 * „Eine sanfte Ess-Erinnerung am Mittag“ kommt eine Mittagserinnerung dazu. Wer in der App
 * ausdrücklich „Erinnere mich in einer Stunde noch einmal“ wählt, bekommt genau eine weitere.
 * Ist die Uhrzeit schon länger als 90 Minuten vorbei, wird nichts nachgeschickt.
 * Ist der Eintrag schon gemacht, wird gar nicht erst erinnert.
 *
 * Seit Version 1.6.0 gibt es dazu bis zu drei Schultern-Erinnerungen („Magst du kurz deine Schultern fragen?“).
 * Sie haben einen eigenen Schalter (barometerAn) und kommen nicht, wenn seit der Uhrzeit schon gefragt wurde.
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
    // Schultern-Erinnerungen: ohne eigene Einstellung in Anemones Fassung (Ordnername mit „anemone“) an, sonst aus.
    $barometerAn = array_key_exists('barometerAn', $einstellungen)
        ? !empty($einstellungen['barometerAn'])
        : stripos(basename(dirname(__DIR__)), 'anemone') !== false;
    $tagesErinnerungen = !empty($einstellungen['erinnerungenAn']);
    if ((!$tagesErinnerungen && !$barometerAn) || empty($daten['system']['abos'])) {
        return ['gesendet' => [], 'hinweis' => 'Die Erinnerungen sind ausgeschaltet, oder es ist noch kein Gerät angemeldet.'];
    }
    $gesendet = [];

    // „Später erinnern“: genau eine weitere Erinnerung, um die ausdrücklich gebeten wurde.
    $spaeter = $daten['system']['spaeter'] ?? null;
    if ($spaeter && time() >= (int) $spaeter['um']) {
        unset($daten['system']['spaeter']);
        if (time() < (int) $spaeter['um'] + EMONA_FENSTER_MINUTEN * 60) {
            foreach ($daten['system']['abos'] as $abo) {
                $gesendet[] = ['art' => 'spaeter', 'status' => emona_push_senden($abo['endpoint'], 'spaeter')];
            }
        }
    }

    $heute = date('Y-m-d');
    $jetztMinuten = (int) date('G') * 60 + (int) date('i');
    $tag = $daten['docs']['tag:' . $heute]['wert'] ?? [];
    $versuch = $daten['docs']['versuch']['wert'] ?? [];
    $mittagAktiv = ($versuch['erinnerung'] ?? '') === 'mittag'
        && ($versuch['start'] ?? '9999') <= $heute && $heute < ($versuch['ende'] ?? '0000');

    $arten = !$tagesErinnerungen ? [] : [
        'morgen' => [
            'uhrzeit' => $einstellungen['erinnerungMorgen'] ?? '08:00',
            'schon_erledigt' => isset($tag['gewicht']) || isset($tag['einschlafzeit']) || isset($tag['schlafdauer']),
        ],
        'abend' => [
            'uhrzeit' => $einstellungen['erinnerungAbend'] ?? '20:30',
            'schon_erledigt' => isset($tag['anspannung']),
        ],
    ];
    // Die dritte Erinnerung gibt es nur, solange das Experiment mit der Ess-Erinnerung am Mittag läuft.
    if ($mittagAktiv && $tagesErinnerungen) {
        $arten['mittag'] = ['uhrzeit' => $einstellungen['erinnerungMittag'] ?? '12:30', 'schon_erledigt' => false];
    }

    // Bis zu drei Schultern-Zeiten. Wer seit der Zeit schon in die Schultern gehorcht hat, wird nicht erinnert.
    if ($barometerAn) {
        $zeiten = $einstellungen['barometerZeiten'] ?? ['10:30', '15:00', '20:00'];
        $heutigeEintraege = [];
        foreach ($daten['docs'] as $schluessel => $doc) {
            if (strpos($schluessel, 'barometer:' . $heute) === 0 && is_array($doc['wert'] ?? null)) {
                $heutigeEintraege[] = (string) ($doc['wert']['zeit'] ?? '');
            }
        }
        foreach (array_values((array) $zeiten) as $i => $uhrzeit) {
            if (!is_string($uhrzeit) || $uhrzeit === '' || $i > 2) {
                continue;
            }
            $schon = false;
            foreach ($heutigeEintraege as $zeit) {
                if (strcmp(str_pad($zeit, 5, '0', STR_PAD_LEFT), str_pad($uhrzeit, 5, '0', STR_PAD_LEFT)) >= 0) {
                    $schon = true;
                }
            }
            $arten['schultern' . $i] = ['uhrzeit' => $uhrzeit, 'schon_erledigt' => $schon];
        }
    }

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
