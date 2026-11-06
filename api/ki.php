<?php
/*
 * KI-Begleitung für EMONA leicht (seit 1.8.0): Gespräch („Frag mich“) und Vorschlag für die nächste Woche im Rückblick.
 *
 * Die App baut den Kontext (Kennenlernen, Experiment, letzte Einträge) selbst zusammen und schickt ihn nur,
 * wenn die Frau in der App ausdrücklich zugestimmt hat. Der Server hängt die feste Haltung an, prüft die
 * Monatsgrenze und fragt Claude über die Anthropic-API. Der API-Schlüssel steht nur in config.php.
 *
 * Einstellungen in config.php:
 *   'ki_schluessel'        => 'sk-ant-…'          (ohne Schlüssel ist die KI aus)
 *   'ki_modell'            => 'claude-sonnet-5-5'
 *   'ki_monatsgrenze_euro' => 10                   (für alle Frauen zusammen; danach pausiert die KI bis zum Monatsersten)
 *   'ki_tagesgrenze'       => 30                   (Nachrichten pro Frau und Tag)
 *   'ki_preis_eingabe'     => 4.0, 'ki_preis_ausgabe' => 20.0   (US-Dollar je Million Token, vorsichtig gerechnet)
 */

declare(strict_types=1);

function emona_ki_einstellungen(): array
{
    $c = emona_config();
    return [
        'schluessel' => trim((string) ($c['ki_schluessel'] ?? '')),
        'modell' => (string) ($c['ki_modell'] ?? 'claude-sonnet-5-5'),
        'grenze_cent' => (int) round(((float) ($c['ki_monatsgrenze_euro'] ?? 10)) * 100),
        'tagesgrenze' => (int) ($c['ki_tagesgrenze'] ?? 30),
        'preis_ein' => (float) ($c['ki_preis_eingabe'] ?? 4.0),
        'preis_aus' => (float) ($c['ki_preis_ausgabe'] ?? 20.0),
    ];
}

function emona_ki_aktiv(): bool
{
    $s = emona_ki_einstellungen()['schluessel'];
    return $s !== '' && strpos($s, 'HIER-') !== 0;
}

/* Verbrauch für alle Frauen zusammen in einer eigenen Datei, damit die Monatsgrenze sicher greift. */
function emona_ki_verbrauch(?callable $veraendern = null): array
{
    $pfad = emona_pfad('ki-verbrauch.json');
    $handle = fopen($pfad, 'c+');
    if ($handle === false) {
        emona_fehler(500, 'Ich kann die Verbrauchsdatei der KI gerade nicht öffnen.');
    }
    flock($handle, LOCK_EX);
    $daten = json_decode((string) stream_get_contents($handle), true);
    if (!is_array($daten) || ($daten['monat'] ?? '') !== date('Y-m')) {
        $daten = ['monat' => date('Y-m'), 'kosten_cent' => 0.0, 'anfragen' => 0, 'tage' => []];
    }
    if ($veraendern) {
        $veraendern($daten);
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($daten, JSON_PRETTY_PRINT));
        fflush($handle);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
    return $daten;
}

function emona_ki_status(): void
{
    $s = emona_ki_einstellungen();
    $v = emona_ki_verbrauch();
    $wer = emona_nutzerin() ?: 'haupt';
    $heute = $v['tage'][$wer][date('Y-m-d')] ?? 0;
    emona_antwort([
        'ok' => true,
        'aktiv' => emona_ki_aktiv(),
        'pausiert' => emona_ki_aktiv() && $v['kosten_cent'] >= $s['grenze_cent'],
        'heute_uebrig' => max(0, $s['tagesgrenze'] - $heute),
    ]);
}

function emona_ki_haltung(string $art): string
{
    $grund = <<<TXT
Du bist die Begleitung in der App „EMONA leicht“ von Katjuscha Essinger. Die App begleitet Frauen dabei, den Zusammenhang zwischen Anspannung, Schlaf und Gewicht zu verstehen, Freude fest in den Alltag zu holen und abends runterzukommen. Es ist keine Diät-App. Viele Frauen haben ADHS (oft spät erkannt), sind hochsensibel oder haben Tiere.

Deine Haltung:
- Du sprichst die Frau mit Du und ihrem Vornamen an, warm, ruhig und klar. Du klingst wie eine kluge Freundin, nicht wie eine Ratgeberseite.
- Kein Druck, keine Bewertung, keine künstliche Dringlichkeit. Lücken in den Einträgen sind kein Thema. Du lobst nicht übertrieben und du belehrst nicht.
- Du erfindest nichts über ihr Leben. Du nutzt nur, was im Kontext steht oder was sie dir schreibt. Weißt du etwas nicht, fragst du nach.
- Keine Diätregeln, keine Kalorien, keine Zielgewichte. Gewicht erwähnst du nur, wenn sie selbst davon spricht oder es im Kontext ausdrücklich freigegeben ist.
- Du stellst keine Diagnosen und gibst keine Medikamentenratschläge. Bei körperlichen Beschwerden, die neu, stark oder anhaltend sind, empfiehlst du freundlich, das ärztlich abklären zu lassen.
- Wenn sie von Gedanken an Suizid, Selbstverletzung oder einer akuten Krise schreibt, nimmst du das ernst, bleibst bei ihr und nennst die Telefonseelsorge (0800 111 0 111 oder 0800 111 0 222, kostenlos, rund um die Uhr) und im Notfall die 112.
- Ein Schritt nach dem anderen. Höchstens zwei Vorschläge auf einmal, jeder klein und sofort machbar. Du verweist gern auf ihr laufendes Experiment und auf das, was sie selbst schon herausgefunden hat.

Schreibregeln (immer):
- Deutsch, ganze Sätze, keine Satzfragmente und keine Sätze, die mit „Nicht“ beginnen.
- Nie gendern (also nicht „Ärzt*in“, sondern „Ärztin oder Arzt“ oder „ärztlich“).
- Apostroph bei weggelassenem Buchstaben, auch in der Befehlsform: „Probier’ es“, „Hab’ Geduld“.
- Zwei mit „und“ verbundene Hauptsätze ohne Komma.
- Keine Aufzählungszeichen, keine Überschriften, kein Fettdruck. Kurze Absätze, dazwischen eine Leerzeile.
- Emojis höchstens eins, und nie bei Scham, Angst oder Körperstress.
TXT;
    if ($art === 'woche') {
        return $grund . "\n\nDeine Aufgabe jetzt: Schreib ihr einen kurzen Rückblick auf die letzten sieben Einträge und Vorschläge für die nächste Woche. Aufbau: ein Absatz, was du in ihrer Woche siehst (konkret, aus den Zahlen und ihren eigenen Worten, ohne Bewertung). Danach zwei oder drei kleine Vorschläge für die nächste Woche, jeder in einem eigenen kurzen Absatz und jeder passend zu ihrem Experiment und dem, was sie im Kennenlernen erzählt hat. Zum Schluss ein Satz, der sie stärkt. Insgesamt höchstens 170 Wörter.";
    }
    return $grund . "\n\nDu führst jetzt ein Gespräch mit ihr. Antworte kurz, meist in zwei bis vier Sätzen, höchstens 120 Wörter, damit die Antwort auf einen Handybildschirm passt. Stell lieber eine gute Rückfrage, als eine lange Liste zu schreiben.";
}

function emona_ki_anfrage(array $anfrage, string $art): void
{
    if (!emona_ki_aktiv()) {
        emona_fehler(503, 'Die Begleitung ist auf diesem Server noch nicht eingeschaltet.');
    }
    if (empty($anfrage['einwilligung'])) {
        emona_fehler(403, 'Für die Begleitung brauche ich zuerst deine Zustimmung.');
    }
    $s = emona_ki_einstellungen();
    $wer = emona_nutzerin() ?: 'haupt';
    $heute = date('Y-m-d');
    $v = emona_ki_verbrauch();
    if ($v['kosten_cent'] >= $s['grenze_cent']) {
        emona_fehler(429, 'Die Begleitung macht diesen Monat eine Pause. Ab dem Ersten bin ich wieder für dich da.');
    }
    if ($art === 'chat' && ($v['tage'][$wer][$heute] ?? 0) >= $s['tagesgrenze']) {
        emona_fehler(429, 'Für heute haben wir schon viel miteinander gesprochen. Morgen bin ich wieder für dich da.');
    }

    if (!function_exists('curl_init')) {
        emona_fehler(500, 'Auf dem Server fehlt cURL. Ohne cURL kann die Begleitung nicht antworten.');
    }
    $kontext = mb_substr(trim((string) ($anfrage['kontext'] ?? '')), 0, 12000);
    $nachrichten = [];
    if ($art === 'chat') {
        $verlauf = is_array($anfrage['verlauf'] ?? null) ? array_slice($anfrage['verlauf'], -12) : [];
        foreach ($verlauf as $n) {
            $rolle = ($n['rolle'] ?? '') === 'ki' ? 'assistant' : 'user';
            $text = mb_substr(trim((string) ($n['text'] ?? '')), 0, 2000);
            if ($text === '') {
                continue;
            }
            if ($nachrichten && end($nachrichten)['role'] === $rolle) {
                $nachrichten[count($nachrichten) - 1]['content'] .= "\n\n" . $text;
            } else {
                $nachrichten[] = ['role' => $rolle, 'content' => $text];
            }
        }
        $neu = mb_substr(trim((string) ($anfrage['nachricht'] ?? '')), 0, 2000);
        if ($neu === '') {
            emona_fehler(400, 'Die Nachricht ist leer.');
        }
        if ($nachrichten && end($nachrichten)['role'] === 'user') {
            $nachrichten[count($nachrichten) - 1]['content'] .= "\n\n" . $neu;
        } else {
            $nachrichten[] = ['role' => 'user', 'content' => $neu];
        }
        if ($nachrichten[0]['role'] !== 'user') {
            array_shift($nachrichten);
        }
    } else {
        $nachrichten[] = ['role' => 'user', 'content' => 'Bitte schreib mir meinen Wochenrückblick mit Vorschlägen für die nächste Woche.'];
    }

    $system = emona_ki_haltung($art) . "\n\nWas die App über sie weiß (von ihr selbst eingetragen):\n" . ($kontext !== '' ? $kontext : '(noch nichts)');
    $koerper = [
        'model' => $s['modell'],
        'max_tokens' => $art === 'woche' ? 700 : 500,
        'system' => $system,
        'messages' => $nachrichten,
    ];

    $ch = curl_init((string) (emona_config()['ki_adresse'] ?? 'https://api.anthropic.com/v1/messages'));
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($koerper, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => [
            'content-type: application/json',
            'anthropic-version: 2023-06-01',
            'x-api-key: ' . $s['schluessel'],
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $roh = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $antwort = is_string($roh) ? json_decode($roh, true) : null;
    if ($status !== 200 || !is_array($antwort)) {
        error_log('EMONA KI: Status ' . $status . ' ' . substr((string) $roh, 0, 300));
        emona_fehler(502, 'Die Begleitung ist gerade nicht erreichbar. Probier’ es bitte gleich noch einmal.');
    }
    $text = '';
    foreach ($antwort['content'] ?? [] as $teil) {
        if (($teil['type'] ?? '') === 'text') {
            $text .= $teil['text'];
        }
    }
    $ein = (int) ($antwort['usage']['input_tokens'] ?? 0);
    $aus = (int) ($antwort['usage']['output_tokens'] ?? 0);
    // Dollar grob als Euro gerechnet, das ist vorsichtig genug.
    $cent = ($ein * $s['preis_ein'] + $aus * $s['preis_aus']) / 1000000 * 100;
    emona_ki_verbrauch(function (array &$d) use ($cent, $wer, $heute, $art) {
        $d['kosten_cent'] = round(($d['kosten_cent'] ?? 0) + $cent, 4);
        $d['anfragen'] = ($d['anfragen'] ?? 0) + 1;
        if ($art === 'chat') {
            $d['tage'][$wer][$heute] = ($d['tage'][$wer][$heute] ?? 0) + 1;
            // Nur die letzten Tage behalten.
            foreach ($d['tage'][$wer] as $tag => $_) {
                if ($tag < date('Y-m-d', strtotime('-7 days'))) {
                    unset($d['tage'][$wer][$tag]);
                }
            }
        }
    });
    emona_antwort(['ok' => true, 'text' => trim($text)]);
}
