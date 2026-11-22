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

/**
 * Línea simple de una serie (por ejemplo, el peso en el tiempo) en SVG,
 * con puntos enfocables, tooltip y tabla de datos.
 */
export function lineaSimple({ puntos, formato = String, alto = 160, color = 'var(--series-1)' }) {
  const W = 600;
  const H = alto;
  const pad = { t: 14, r: 14, b: 22, l: 14 };
  const vals = puntos.map((p) => p.valor);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (i) => pad.l + (puntos.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (puntos.length - 1));
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'line-chart'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Desde ${formato(vals[0])} hasta ${formato(vals.at(-1))}`);
  const el = (t, a) => { const e = document.createElementNS(ns, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); svg.append(e); return e; };
  for (const v of [min, max]) el('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'gridline-svg' });
  el('polyline', { points: puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' });
  puntos.forEach((p, i) => {
    const c = el('circle', { cx: x(i), cy: y(p.valor), r: 5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2, tabindex: 0, class: 'line-dot' });
    conTip(c, [[p.etiqueta, formato(p.valor), color]]);
  });
  const ext = (v, i) => { const t = el('text', { x: i === 0 ? pad.l : W - pad.r, y: H - 4, class: 'line-label', 'text-anchor': i === 0 ? 'start' : 'end' }); t.textContent = v; };
  ext(puntos[0].etiqueta, 0); ext(puntos.at(-1).etiqueta, 1);
  return h('figure', { class: 'chart' }, svg,
    tablaDatos(['Fecha', 'Valor'], puntos.map((p) => [p.etiqueta, formato(p.valor)])));
}
