<?php
/*
 * Gemeinsame Hilfsfunktionen für die EMONA-Schnittstelle:
 * Einstellungen laden, Datendatei sicher lesen und schreiben, Web-Push verschicken.
 */

declare(strict_types=1);

function emona_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $datei = __DIR__ . '/config.php';
    if (!is_file($datei)) {
        emona_fehler(500, 'Die Datei api/config.php fehlt. Bitte config.example.php kopieren und ausfüllen.');
    }
    $config = require $datei;
    $config['datenordner'] = rtrim($config['datenordner'] ?? (__DIR__ . '/daten'), '/');
    $config['zeitzone'] = $config['zeitzone'] ?? 'Europe/Berlin';
    date_default_timezone_set($config['zeitzone']);
    if (!is_dir($config['datenordner'])) {
        @mkdir($config['datenordner'], 0700, true);
    }
    return $config;
}

function emona_antwort(array $daten, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function emona_fehler(int $status, string $meldung): void
{
    emona_antwort(['ok' => false, 'fehler' => $meldung], $status);
}

function emona_pfad(string $name): string
{
    return emona_config()['datenordner'] . '/' . $name;
}

/*
 * Öffnet die Datendatei mit exklusiver Sperre, ruft $veraendern mit dem Inhalt auf
 * und schreibt das Ergebnis zurück. Gibt den Rückgabewert von $veraendern zurück.
 */
function emona_mit_daten(callable $veraendern)
{
    $pfad = emona_pfad('emona-daten.json');
    $handle = fopen($pfad, 'c+');
    if ($handle === false) {
        emona_fehler(500, 'Die Datendatei kann nicht geöffnet werden. Bitte Schreibrechte des Datenordners prüfen.');
    }
    flock($handle, LOCK_EX);
    $inhalt = stream_get_contents($handle);
    $daten = $inhalt ? json_decode($inhalt, true) : null;
    if (!is_array($daten)) {
        $daten = [];
    }
    $daten += ['format' => 1, 'docs' => [], 'system' => ['abos' => [], 'gesendet' => []]];

    $vorher = json_encode($daten);
    $ergebnis = $veraendern($daten);
    $nachher = json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    if ($vorher !== json_encode($daten)) {
        emona_sicherung($inhalt);
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, $nachher);
        fflush($handle);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
    return $ergebnis;
}

/* Legt einmal am Tag eine Sicherungskopie an und behält die letzten 30. */
function emona_sicherung(string $alterInhalt): void
{
    if ($alterInhalt === '') {
        return;
    }
    $ordner = emona_pfad('sicherungen');
    if (!is_dir($ordner)) {
        @mkdir($ordner, 0700, true);
    }
    $datei = $ordner . '/emona-daten-' . date('Y-m-d') . '.json';
    if (is_file($datei)) {
        return;
    }
    file_put_contents($datei, $alterInhalt);
    $alle = glob($ordner . '/emona-daten-*.json') ?: [];
    sort($alle);
    while (count($alle) > 30) {
        @unlink(array_shift($alle));
    }
}

/* ---------- Web-Push (ohne Nutzlast, mit VAPID) ---------- */

function emona_b64url(string $daten): string
{
    return rtrim(strtr(base64_encode($daten), '+/', '-_'), '=');
}

function emona_vapid(): array
{
    $pfad = emona_pfad('vapid.json');
    if (is_file($pfad)) {
        $vapid = json_decode((string) file_get_contents($pfad), true);
        if (is_array($vapid) && !empty($vapid['privat']) && !empty($vapid['oeffentlich'])) {
            return $vapid;
        }
    }
    $schluessel = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
    if ($schluessel === false) {
        emona_fehler(500, 'Der Server kann keinen Schlüssel für Erinnerungen erzeugen (OpenSSL fehlt).');
    }
    openssl_pkey_export($schluessel, $privatPem);
    $details = openssl_pkey_get_details($schluessel);
    $x = str_pad($details['ec']['x'], 32, "\0", STR_PAD_LEFT);
    $y = str_pad($details['ec']['y'], 32, "\0", STR_PAD_LEFT);
    $vapid = ['privat' => $privatPem, 'oeffentlich' => emona_b64url("\x04" . $x . $y)];
    file_put_contents($pfad, json_encode($vapid));
    @chmod($pfad, 0600);
    return $vapid;
}

/* Wandelt eine DER-kodierte ECDSA-Signatur in das von JWT verlangte Format (r||s, je 32 Byte). */
function emona_der_zu_roh(string $der): string
{
    $pos = 2;
    if (ord($der[1]) & 0x80) {
        $pos += ord($der[1]) & 0x7f;
    }
    $teile = [];
    for ($i = 0; $i < 2; $i++) {
        $laenge = ord($der[$pos + 1]);
        $wert = substr($der, $pos + 2, $laenge);
        $wert = ltrim($wert, "\0");
        $teile[] = str_pad($wert, 32, "\0", STR_PAD_LEFT);
        $pos += 2 + $laenge;
    }
    return $teile[0] . $teile[1];
}

function emona_vapid_jwt(string $endpunkt, array $vapid, string $kontakt): string
{
    $teile = parse_url($endpunkt);
    $publikum = $teile['scheme'] . '://' . $teile['host'] . (isset($teile['port']) ? ':' . $teile['port'] : '');
    $kopf = emona_b64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $inhalt = emona_b64url(json_encode(['aud' => $publikum, 'exp' => time() + 12 * 3600, 'sub' => $kontakt], JSON_UNESCAPED_SLASHES));
    $signatur = '';
    openssl_sign($kopf . '.' . $inhalt, $signatur, $vapid['privat'], OPENSSL_ALGO_SHA256);
    return $kopf . '.' . $inhalt . '.' . emona_b64url(emona_der_zu_roh($signatur));
}

/* Schickt eine leere Push-Nachricht. Gibt den HTTP-Status zurück (201 = angekommen). */
function emona_push_senden(string $endpunkt, string $thema): int
{
    $config = emona_config();
    $vapid = emona_vapid();
    $jwt = emona_vapid_jwt($endpunkt, $vapid, $config['kontakt'] ?? 'mailto:keine@example.de');
    $koepfe = [
        'TTL: 3600',
        'Urgency: normal',
        'Topic: ' . $thema,
        'Content-Length: 0',
        'Authorization: vapid t=' . $jwt . ', k=' . $vapid['oeffentlich'],
    ];
    if (function_exists('curl_init')) {
        $ch = curl_init($endpunkt);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => '',
            CURLOPT_HTTPHEADER => $koepfe,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $status;
    }
    $kontext = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => implode("\r\n", $koepfe),
        'content' => '',
        'ignore_errors' => true,
        'timeout' => 15,
    ]]);
    @file_get_contents($endpunkt, false, $kontext);
    $status = 0;
    foreach ($http_response_header ?? [] as $zeile) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $zeile, $treffer)) {
            $status = (int) $treffer[1];
        }
    }
    return $status;
}
