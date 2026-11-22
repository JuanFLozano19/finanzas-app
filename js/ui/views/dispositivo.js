// Secciones de Ajustes: notificaciones y huella/rostro.
import { h, toast, confirmar } from '../dom.js';
import { PREFS_NOTIF } from '../../services/DispositivoService.js';
import { fmtDate } from '../../core/format.js';

export async function seccionNotificaciones({ notificaciones: svc }, aj, recargar) {
  const est = await svc.estado();
  const prefs = { eventos: true, tareas: true, evaluaciones: true, habitos: true, cumpleanos: true, pagos: true, ...(aj.notificaciones || {}) };
  const accion = (fn, ok) => async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); recargar(); }
    catch (err) { toast(err.message, 'error'); b.disabled = false; }
  };
  return h('section', { class: 'card' },
    h('h3', {}, '🔔 Notificaciones'),
    !est.soportado ? h('p', { class: 'muted' }, 'Este navegador no permite notificaciones. Usa Chrome en Android o instala la app.')
      : svc.necesitaInstalar() ? h('p', { class: 'meta-msg warn' }, 'En iPhone primero instala Rumbo: Compartir → "Agregar a pantalla de inicio", y ábrela desde el ícono.')
        : est.activo ? [
          h('p', { class: 'meta-msg' }, '✅ Activadas en este dispositivo'),
          h('div', { class: 'notif-prefs' }, PREFS_NOTIF.map(([k, label]) => h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: prefs[k] !== false, onchange: async (ev) => {
              await svc.guardarPrefs({ ...prefs, [k]: ev.target.checked }); toast('Preferencia guardada');
            } }), label))),
          h('div', { class: 'card-actions' },
            h('button', { class: 'btn ghost', onclick: accion(() => svc.probar(), (n) => (n ? '📨 Prueba enviada: debería llegarte en segundos' : 'No hay dispositivos suscritos')) }, 'Enviar prueba'),
            h('button', { class: 'btn ghost', onclick: accion(() => svc.desactivar(), 'Notificaciones desactivadas en este dispositivo') }, 'Desactivar')),
        ] : [
          h('p', { class: 'muted' }, 'Te aviso de tus clases, tareas, evaluaciones, hábitos, cumpleaños y pagos, aunque tengas la app cerrada.'),
          est.permiso === 'denied' ? h('p', { class: 'meta-msg warn' }, 'Bloqueaste las notificaciones. Actívalas en la configuración del sitio en tu navegador y vuelve aquí.') : null,
          h('button', { class: 'btn primary', disabled: est.permiso === 'denied', onclick: accion(() => svc.activar(), '🔔 ¡Listo! Te van a llegar los recordatorios') }, 'Activar notificaciones'),
        ]);
}

export async function seccionPasskeys({ passkeys: svc }, _aj, recargar) {
  if (!svc.soportado()) return h('section', { class: 'card' }, h('h3', {}, '🔐 Entrar con huella o rostro'), h('p', { class: 'muted' }, 'Este dispositivo no es compatible.'));
  let lista = [];
  let aviso = null;
  try { lista = await svc.listar(); } catch (e) { aviso = e.message; }
  return h('section', { class: 'card' },
    h('h3', {}, '🔐 Entrar con huella o rostro'),
    h('p', { class: 'muted' }, 'Registra este dispositivo y la próxima vez entras sin escribir la contraseña.'),
    aviso ? h('p', { class: 'meta-msg warn' }, aviso) : null,
    lista.length ? h('ul', { class: 'list compact' }, lista.map((p) => h('li', { class: 'list-item static' },
      h('span', {}, '🔑'), h('span', { class: 'grow' }, h('strong', {}, p.friendly_name || 'Passkey'), h('small', { class: 'muted' }, `Creada el ${fmtDate(p.created_at.slice(0, 10))}`)),
      h('button', { class: 'icon-btn', 'aria-label': 'Eliminar', onclick: async () => {
        if (await confirmar(`¿Quitar ${p.friendly_name || 'esta passkey'}?`)) { try { await svc.eliminar(p.id); recargar(); } catch (e) { toast(e.message, 'error'); } }
      } }, '🗑')))) : null,
    h('button', { class: 'btn primary', onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { await svc.registrar(); toast('🔐 Huella registrada. Ya puedes entrar con ella.'); recargar(); }
      catch (err) { toast(err.message, 'error'); b.disabled = false; }
    } }, 'Registrar este dispositivo'));
}
