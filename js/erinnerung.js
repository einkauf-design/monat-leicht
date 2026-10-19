// Sanfte Erinnerungen über Web-Push. Der Server (api/erinnerung.php) verschickt höchstens zwei am Tag.

import { api, geraetDaten } from './speicher.js';
import { setzeEinstellungen } from './daten.js';

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
