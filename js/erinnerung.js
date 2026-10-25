// Sanfte Erinnerungen über Web-Push. Der Server (api/erinnerung.php) verschickt höchstens zwei am Tag.

import { api, geraetDaten } from './speicher.js';
import { setzeEinstellungen, einstellungen } from './daten.js';
import { mittagsErinnerungAktiv } from './experimente.js';

export function unterstuetzt() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function istIphoneImBrowser() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installiert = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return ios && !installiert;
}

export function erlaubnis() {
  return 'Notification' in window ? Notification.permission : 'denied';
}

function schluesselZuBytes(text) {
  const auffuellen = '='.repeat((4 - (text.length % 4)) % 4);
  const roh = atob((text + auffuellen).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(roh, (z) => z.charCodeAt(0));
}

export async function einschalten() {
  if (!geraetDaten().code) throw new Error('kein-code');
  const antwort = await Notification.requestPermission();
  if (antwort !== 'granted') throw new Error('abgelehnt');
  const registrierung = await navigator.serviceWorker.ready;
  const { schluessel } = await api('vapid');
  let abo = await registrierung.pushManager.getSubscription();
  if (!abo) {
    abo = await registrierung.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: schluesselZuBytes(schluessel),
    });
  }
  await api('abo', { abo: abo.toJSON() });
  setzeEinstellungen({ erinnerungenAn: true });
}

export async function ausschalten() {
  setzeEinstellungen({ erinnerungenAn: false });
  try {
    const registrierung = await navigator.serviceWorker.ready;
    const abo = await registrierung.pushManager.getSubscription();
    if (abo) {
      await api('abo_loeschen', { endpunkt: abo.endpoint }).catch(() => {});
      await abo.unsubscribe();
    }
  } catch {
    /* Ohne Abo ist nichts zu tun. */
  }
}

// Legt die Erinnerungszeiten für den Service Worker ab. Er erkennt daran, welche Erinnerung gerade kommt.
export async function merkeErinnerungszeiten() {
  if (!('caches' in window)) return;
  const e = einstellungen();
  const zeiten = {
    morgen: e.erinnerungMorgen,
    abend: e.erinnerungAbend,
    mittag: mittagsErinnerungAktiv() ? e.erinnerungMittag : null,
  };
  try {
    const ablage = await caches.open('emona-zeiten');
    await ablage.put(new URL('erinnerungszeiten.json', location.href).href, new Response(JSON.stringify(zeiten), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    /* Ohne Zwischenspeicher wählt der Service Worker nach der Uhrzeit. */
  }
}
