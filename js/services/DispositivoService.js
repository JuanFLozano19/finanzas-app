// Notificaciones push e inicio con huella/rostro (passkeys).
import { VAPID_PUBLIC, SUPABASE_URL } from '../config.js';

const b64aUint8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const PREFS_NOTIF = [
  ['eventos', '🗓 Clases y eventos (30 min antes)'], ['tareas', '✅ Tareas del día (7 a. m.)'],
  ['evaluaciones', '📚 Evaluaciones y entregas de mañana (7 p. m.)'], ['habitos', '🌱 Hábitos pendientes (8 p. m.)'],
  ['cumpleanos', '🎂 Cumpleaños'], ['pagos', '🔁 Pagos fijos y préstamos'],
];

export class NotificacionesService {
  constructor(repos, client) { this.r = repos; this.client = client; }

  soportado() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  /** En iPhone las notificaciones solo funcionan con la app instalada en la pantalla de inicio. */
  necesitaInstalar() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return ios && !window.matchMedia('(display-mode: standalone)').matches;
  }

  /** Espera el service worker como máximo unos segundos para no trabar la pantalla. */
  async #registro(ms = 4000) {
    return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), ms))]);
  }

  async suscripcionActual() {
    const reg = await this.#registro();
    return reg ? reg.pushManager.getSubscription() : null;
  }

  async estado() {
    if (!this.soportado()) return { soportado: false };
    const sub = await this.suscripcionActual();
    return { soportado: true, permiso: Notification.permission, activo: Boolean(sub) && Notification.permission === 'granted' };
  }

  async activar() {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') throw new Error('No diste permiso para notificaciones. Puedes activarlo en la configuración del navegador.');
    const reg = await this.#registro(10000);
    if (!reg) throw new Error('La app aún no termina de instalarse. Recarga la página e intenta de nuevo.');
    const sub = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aUint8(VAPID_PUBLIC) });
    const j = sub.toJSON();
    const { error } = await this.client.from('push_suscripciones').upsert({
      endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, dispositivo: navigator.userAgent.slice(0, 120),
    }, { onConflict: 'endpoint' });
    if (error) throw new Error(error.message);
  }

  async desactivar() {
    const sub = await this.suscripcionActual();
    if (!sub) return;
    await this.client.from('push_suscripciones').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }

  async probar() {
    const { data } = await this.client.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ prueba: true }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'No se pudo enviar la prueba');
    return j.enviadas;
  }

  guardarPrefs(notificaciones) { return this.r.ajustes.upsert({ notificaciones }, 'user_id'); }
}

export class PasskeyService {
  constructor(client) { this.auth = client.auth; }
  soportado() { return Boolean(window.PublicKeyCredential) && typeof this.auth.registerPasskey === 'function'; }
  static #msg(error) {
    const code = error?.code || error?.error_code || '';
    if (/passkey_disabled/.test(code) || /disabled/i.test(error?.message || '')) return 'El inicio con huella aún no está activado en Supabase (Authentication → Passkeys).';
    if (/credential_exists/.test(code)) return 'Este dispositivo ya está registrado.';
    if (/not_found/.test(code)) return 'No encontramos esa huella registrada. Entra con tu correo y regístrala en Ajustes.';
    if (/abort|NotAllowed|cancel/i.test(`${code} ${error?.name} ${error?.message}`)) return 'Cancelaste la verificación.';
    return error?.message || 'No se pudo completar.';
  }
  async listar() { const { data, error } = await this.auth.passkey.list(); if (error) throw new Error(PasskeyService.#msg(error)); return data || []; }
  async registrar() { const { data, error } = await this.auth.registerPasskey(); if (error) throw new Error(PasskeyService.#msg(error)); return data; }
  async eliminar(id) { const { error } = await this.auth.passkey.delete({ passkeyId: id }); if (error) throw new Error(PasskeyService.#msg(error)); }
  async entrar() { const { error } = await this.auth.signInWithPasskey(); if (error) throw new Error(PasskeyService.#msg(error)); }
}
