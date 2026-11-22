// Gráficas livianas en HTML/CSS (sin librerías), con leyenda, tooltip al pasar
// el cursor o enfocar, y tabla de datos para accesibilidad.
// Colores de serie: paleta categórica validada (slot 1 azul, slot 2 naranja), con
// variantes para modo oscuro definidas en styles.css (--series-1, --series-2).
import { h } from './dom.js';

let tip;
function tooltip() {
  if (!tip) { tip = h('div', { class: 'chart-tip', role: 'tooltip', hidden: true }); document.body.append(tip); }
  return tip;
}
function mostrarTip(el, lineas) {
  const t = tooltip();
  t.replaceChildren(...lineas.map(([k, v, color]) => h('div', { class: 'tip-row' },
    color ? h('i', { class: 'tip-key', style: `background:${color}` }) : null, h('span', {}, k), h('b', {}, v))));
  t.hidden = false;
  const r = el.getBoundingClientRect();
  const w = t.offsetWidth;
  t.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  t.style.top = `${Math.max(8, r.top - t.offsetHeight - 8)}px`;
}
const ocultarTip = () => { if (tip) tip.hidden = true; };
window.addEventListener('scroll', ocultarTip, { passive: true });

function conTip(el, lineas) {
  el.tabIndex = 0;
  el.addEventListener('mouseenter', () => mostrarTip(el, lineas));
  el.addEventListener('focus', () => mostrarTip(el, lineas));
  el.addEventListener('mouseleave', ocultarTip);
  el.addEventListener('blur', ocultarTip);
  el.addEventListener('click', () => mostrarTip(el, lineas));
  return el;
}

function tablaDatos(columnas, filas) {
  return h('details', { class: 'chart-table' }, h('summary', {}, 'Ver tabla'),
    h('table', {}, h('thead', {}, h('tr', {}, columnas.map((c) => h('th', {}, c)))),
      h('tbody', {}, filas.map((f) => h('tr', {}, f.map((c) => h('td', {}, c)))))));
}

/**
 * Barras verticales agrupadas.
 * series: [{ nombre, color: 'var(--series-1)', valores: [n…] }], etiquetas: [string…]
 */
export function barrasAgrupadas({ etiquetas, series, formato = String, alto = 180 }) {
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const grupos = etiquetas.map((et, i) => h('div', { class: 'bar-group' },
    h('div', { class: 'bars', style: `height:${alto}px` }, series.map((s) => {
      const v = s.valores[i];
      return conTip(h('div', { class: 'bar-hit', 'aria-label': `${s.nombre} ${et}: ${formato(v)}` },
        h('div', { class: 'bar', style: `height:${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%;background:${s.color}` })),
      [[et, ''], ...series.map((x) => [x.nombre, formato(x.valores[i]), x.color])]);
    })),
    h('small', { class: 'bar-label' }, et)));
  return h('figure', { class: 'chart' },
    series.length > 1 ? h('div', { class: 'legend' }, series.map((s) => h('span', {}, h('i', { style: `background:${s.color}` }), s.nombre))) : null,
    h('div', { class: 'chart-plot' }, grupos),
    tablaDatos(['', ...series.map((s) => s.nombre)], etiquetas.map((et, i) => [et, ...series.map((s) => formato(s.valores[i]))])));
}

/** Barras horizontales de una sola serie (ranking por categoría). */
export function barrasHorizontales({ items, formato = String, color = 'var(--series-1)' }) {
  const max = Math.max(1, ...items.map((x) => x.valor));
  return h('figure', { class: 'chart' },
    h('div', { class: 'hbars' }, items.map((x) => conTip(h('div', { class: 'hbar-row', 'aria-label': `${x.etiqueta}: ${formato(x.valor)}` },
      h('span', { class: 'hbar-label' }, x.etiqueta),
      h('div', { class: 'hbar-track' }, h('div', { class: 'hbar', style: `width:${(x.valor / max) * 100}%;background:${color}` })),
      h('b', { class: 'hbar-val' }, formato(x.valor))), [[x.etiqueta, formato(x.valor)]]))),
  );
}
