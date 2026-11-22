import { h, fill } from '../dom.js';

export function crearVistaMas(rutas, auth) {
  return async function renderMas(cont, { irA, correo }) {
    const modulos = Object.entries(rutas).filter(([, r]) => r.enMas);
    fill(cont,
      h('div', { class: 'tiles' }, modulos.map(([id, r]) => h('button', { class: 'tile', onclick: () => irA(id) },
        h('span', { class: 'tile-icon' }, r.icono), h('strong', {}, r.titulo), h('small', { class: 'muted' }, r.desc)))),
      h('section', { class: 'card' },
        h('div', { class: 'row-between' }, h('div', { class: 'grow' }, h('small', { class: 'muted' }, 'Sesión iniciada como'), h('strong', { class: 'user-mail' }, correo)),
          h('button', { class: 'btn ghost small', onclick: () => auth.salir() }, 'Salir'))),
    );
  };
}
