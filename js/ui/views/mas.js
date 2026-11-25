import { h, fill } from '../dom.js';
import { icono } from '../iconos.js';

const ORDEN = ['Mi día', 'Universidad', 'Áreas', 'Crecimiento', 'Rumbo'];
// Cada sección tiene su color, el mismo que usa en el resto de la app.
const TONO = { 'Mi día': 'task', Universidad: 'uni', 'Áreas': 'work', Crecimiento: 'meta', Rumbo: 'neutral' };

export function crearVistaMas(rutas) {
  return async function renderMas(cont, { irA, correo }) {
    const grupos = new Map(ORDEN.map((g) => [g, []]));
    for (const [id, r] of Object.entries(rutas)) if (r.enMas) (grupos.get(r.grupo) || grupos.set(r.grupo, []).get(r.grupo)).push([id, r]);
    fill(cont,
      [...grupos.entries()].filter(([, items]) => items.length).map(([g, items]) => h('section', { class: `more-group tono-${TONO[g] || 'neutral'}` },
        h('h4', { class: 'section-title' }, g),
        h('ul', { class: 'list more-list' }, items.map(([id, r]) => h('li', {}, h('button', { class: 'list-item', onclick: () => irA(id) },
          h('span', { class: 'more-icon', 'aria-hidden': 'true' }, icono(id)),
          h('span', { class: 'grow' }, h('strong', {}, r.titulo), h('small', { class: 'muted' }, r.desc)),
          h('span', { class: 'muted', 'aria-hidden': 'true' }, '›'))))))),
      h('p', { class: 'muted center' }, h('span', { class: 'user-mail' }, correo)),
    );
  };
}
