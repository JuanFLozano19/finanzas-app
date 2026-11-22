import { h, fill } from '../dom.js';

export function crearVistaMas(rutas) {
  return async function renderMas(cont, { irA, correo }) {
    const modulos = Object.entries(rutas).filter(([, r]) => r.enMas);
    fill(cont,
      h('div', { class: 'tiles' }, modulos.map(([id, r]) => h('button', { class: 'tile', onclick: () => irA(id) },
        h('span', { class: 'tile-icon' }, r.icono), h('strong', {}, r.titulo), h('small', { class: 'muted' }, r.desc)))),
      h('p', { class: 'muted center' }, h('span', { class: 'user-mail' }, correo)),
    );
  };
}
