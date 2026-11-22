// Secciones de Ajustes: notificaciones y huella/rostro.
import { h, toast, confirmar, formulario } from '../dom.js';
import { bloqueo } from '../../core/bloqueo.js';

import { PREFS_NOTIF } from '../../services/DispositivoService.js';
import { fmtDate } from '../../core/format.js';

export async function seccionNotificaciones({ notificaciones: svc }, aj, recargar) {
  const est = await svc.estado();
  const prefs = { agua: false, turnos: true, eventos: true, tareas: true, evaluaciones: true, habitos: true, cumpleanos: true, pagos: true, ...(aj.notificaciones || {}) };
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

// ---------- Bloqueo con PIN / huella ----------

const TIEMPOS = [[0, 'Cada vez que salgo de la app'], [1, 'Después de 1 minuto'], [5, 'Después de 5 minutos'], [15, 'Después de 15 minutos']];

function formPin(titulo, onPin) {
  formulario({
    titulo, enviar: 'Guardar PIN',
    campos: [
      { name: 'pin', label: 'PIN de 4 a 6 números', type: 'password', inputmode: 'numeric', required: true, autocomplete: 'new-password', placeholder: '••••' },
      { name: 'pin2', label: 'Repite el PIN', type: 'password', inputmode: 'numeric', required: true, autocomplete: 'new-password' },
    ],
    validar: (d) => {
      if (!/^\d{4,6}$/.test(d.pin || '')) throw new Error('El PIN debe tener entre 4 y 6 números.');
      if (d.pin !== d.pin2) throw new Error('Los PIN no coinciden.');
    },
    onSubmit: async (d) => onPin(d.pin),
  });
}

export async function seccionBloqueo(_ctx, _aj, recargar) {
  const activo = bloqueo.activo();
  const conf = bloqueo.config() || {};
  const huella = activo && await bloqueo.huellaDisponible();
  return h('section', { class: 'card' },
    h('h3', {}, '🔒 Bloquear la app'),
    h('p', { class: 'muted' }, 'Pide un PIN (o tu huella) al abrir Rumbo en este dispositivo, para que nadie más vea tu plata ni tu diario.'),
    activo ? [
      h('p', { class: 'meta-msg' }, '✅ Bloqueo activado en este dispositivo'),
      h('label', { class: 'field' }, h('span', { class: 'label' }, 'Bloquear'),
        h('select', { onchange: (e) => { bloqueo.cambiarMinutos(Number(e.target.value)); toast('Guardado'); } },
          TIEMPOS.map(([v, l]) => h('option', { value: v, selected: (conf.minutos ?? 1) === v }, l)))),
      huella ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: bloqueo.tieneHuella(), onchange: async (e) => {
        try {
          if (e.target.checked) { await bloqueo.registrarHuella(); toast('👆 Huella activada para desbloquear'); } else { bloqueo.quitarHuella(); toast('Huella desactivada'); }
        } catch { e.target.checked = false; toast('No se pudo activar la huella en este dispositivo', 'error'); }
      } }), 'Desbloquear también con huella o rostro') : null,
      h('div', { class: 'card-actions' },
        h('button', { class: 'btn ghost', onclick: () => formPin('Nuevo PIN', async (pin) => { await bloqueo.definirPin(pin, conf.minutos ?? 1); toast('PIN cambiado'); recargar(); }) }, 'Cambiar PIN'),
        h('button', { class: 'btn ghost', onclick: async () => {
          if (await confirmar('¿Quitar el bloqueo de este dispositivo?', { aceptar: 'Quitar bloqueo' })) { bloqueo.desactivar(); toast('Bloqueo desactivado'); recargar(); }
        } }, 'Quitar bloqueo')),
    ] : h('button', { class: 'btn primary', onclick: () => formPin('Crea tu PIN', async (pin) => { await bloqueo.definirPin(pin, 1); toast('🔒 Bloqueo activado'); recargar(); }) }, 'Activar bloqueo'),
  );
}
