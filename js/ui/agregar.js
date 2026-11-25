// Hoja "Agregar": un solo botón para registrar cualquier cosa desde cualquier pantalla.
import { h, dialogo, toast } from './dom.js';
import { icono } from './iconos.js';

/**
 * @param {Array<{id:string, titulo:string, detalle:string, ico:string, tono:string, abrir:Function}>} acciones
 */
export function abrirAgregar(acciones) {
  const d = dialogo(h('div', { class: 'sheet-body add-sheet' },
    h('div', { class: 'sheet-head' }, h('h2', {}, '¿Qué quieres agregar?'),
      h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕')),
    h('div', { class: 'add-grid' }, acciones.map((a) => h('button', {
      class: `add-item tono-${a.tono}`,
      onclick: async () => { d.close(); try { await a.abrir(); } catch (e) { toast(e.message, 'error'); } },
    }, h('span', { class: 'add-ico' }, icono(a.ico, { size: 22 })), h('strong', {}, a.titulo), h('small', {}, a.detalle)))),
  ));
}
