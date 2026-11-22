import { h, fill, toast, confirmar } from '../dom.js';
import { ACENTOS, aplicarTema } from '../../core/tema.js';
import { outbox } from '../../data/outbox.js';

/** Secciones extra que otros módulos registran (reparto, semestre, notificaciones…). */
export const seccionesAjustes = [];

export async function renderAjustes(cont, ctx) {
  const { vida, correo, salir } = ctx;
  const recargar = () => renderAjustes(cont, ctx);
  const aj = await vida.ajustes.obtener();
  const tema = aj.tema || 'auto';
  const acento = aj.acento || '#0f8f78';

  const guardar = async (cambios) => {
    aplicarTema({ tema, acento, ...cambios });
    await vida.ajustes.guardar(cambios);
    recargar();
  };

  const pendientes = outbox.leer().length;
  const extras = await Promise.all(seccionesAjustes.map((s) => s(ctx, aj, recargar)));

  fill(cont,
    h('section', { class: 'card' },
      h('h3', {}, '🎨 Apariencia'),
      h('span', { class: 'label' }, 'Tema'),
      h('div', { class: 'chips' }, [['auto', '📱 Automático'], ['claro', '☀️ Claro'], ['oscuro', '🌙 Oscuro']].map(([v, l]) =>
        h('button', { class: `chip ${tema === v ? 'active' : ''}`, onclick: () => guardar({ tema: v }) }, l))),
      h('span', { class: 'label' }, 'Color principal'),
      h('div', { class: 'swatches' }, ACENTOS.map(([c, nombre]) => h('button', {
        class: `color-dot ${acento === c ? 'on' : ''}`, style: `--c:${c}`, title: nombre, 'aria-label': nombre,
        onclick: () => guardar({ acento: c }),
      })))),

    extras,

    h('section', { class: 'card' },
      h('h3', {}, '📤 Tus datos'),
      h('p', { class: 'muted' }, 'Descarga una copia de todo en Excel: una hoja por cada módulo.'),
      h('button', { class: 'btn primary', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = 'Preparando…';
        try { const n = await vida.exportar.exportar(); toast(`Respaldo listo: ${n} registros`); }
        catch (err) { toast(err.message, 'error'); }
        finally { b.disabled = false; b.textContent = 'Descargar Excel'; }
      } }, 'Descargar Excel'),
      pendientes ? h('p', { class: 'meta-msg warn' }, `Tienes ${pendientes} cambio${pendientes === 1 ? '' : 's'} sin subir. Se suben solos cuando vuelva el internet.`) : null),

    h('section', { class: 'card' },
      h('h3', {}, '👤 Cuenta'),
      h('div', { class: 'row-between' },
        h('div', { class: 'grow' }, h('small', { class: 'muted' }, 'Sesión iniciada como'), h('strong', { class: 'user-mail' }, correo)),
        h('button', { class: 'btn ghost small', onclick: async () => {
          if (pendientes && !(await confirmar(`Tienes ${pendientes} cambios sin subir y se perderán si sales. ¿Salir igual?`, { aceptar: 'Salir' }))) return;
          salir();
        } }, 'Salir'))),
    h('p', { class: 'muted center' }, 'Rumbo 🧭 · hecho para Pacho'),
  );
}
