import { h, fill, emptyState, tabs } from '../dom.js';
import { tareaItem, formTarea } from '../components.js';

let vista = 'pendientes';

export async function renderTareas(cont, ctx) {
  const { vida } = ctx;
  const recargar = () => renderTareas(cont, ctx);
  const { grupos, materias } = await vida.tareas.listado();
  const pendientes = grupos.vencidas.length + grupos.hoy.length + grupos.proximas.length + grupos.sinFecha.length;

  const seccion = (titulo, items, clase = '') => items.length ? h('section', { class: 'group' },
    h('h4', { class: `group-title ${clase}` }, `${titulo} · ${items.length}`),
    h('ul', { class: 'tasks card-list' }, items.map((t) => tareaItem(vida, t, materias, recargar)))) : null;

  fill(cont,
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formTarea(vida, null, materias, recargar) }, '+ Nueva tarea')),
    tabs([['pendientes', `Pendientes (${pendientes})`], ['hechas', `Hechas (${grupos.hechas.length})`]], vista, (v) => { vista = v; recargar(); }),
    vista === 'pendientes'
      ? (pendientes ? [
        seccion('Vencidas', grupos.vencidas, 'late'),
        seccion('Hoy', grupos.hoy),
        seccion('Próximas', grupos.proximas),
        seccion('Sin fecha', grupos.sinFecha),
      ] : emptyState('🎉', 'Todo al día', 'No tienes tareas pendientes. Agrega una cuando la necesites.'))
      : (grupos.hechas.length ? seccion('Completadas', grupos.hechas.slice(0, 50)) : emptyState('📋', 'Aún no completas tareas', 'Aquí verás lo que ya terminaste.')),
  );
}
