import { h, fill, emptyState } from '../dom.js';
import { fmtMoney, monthLabel, fmtDate } from '../../core/format.js';
import { barrasAgrupadas, barrasHorizontales } from '../charts.js';

const mesCorto = (ym) => monthLabel(ym).slice(0, 3);
const compacto = (n) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)} M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)} mil` : fmtMoney(n));

export async function renderEstadisticas(cont, ctx) {
  const { plata } = ctx;
  const s = await plata.estadisticas();
  const hayPlata = s.serie.some((m) => m.ingresos || m.gastos);
  const ultimo = s.serie[s.serie.length - 1];
  fill(cont,
    h('div', { class: 'stats three' },
      h('div', { class: 'stat' }, h('small', {}, 'Ahorro promedio/mes'), h('b', { class: s.ahorroPromedio < 0 ? 'neg' : '' }, fmtMoney(s.ahorroPromedio))),
      h('div', { class: 'stat' }, h('small', {}, 'Ingresos este mes'), h('b', {}, fmtMoney(ultimo.ingresos))),
      h('div', { class: 'stat' }, h('small', {}, 'Gastos este mes'), h('b', {}, fmtMoney(ultimo.gastos)))),

    h('section', { class: 'card' }, h('h3', {}, 'Ingresos y gastos por mes'),
      hayPlata ? barrasAgrupadas({
        etiquetas: s.serie.map((m) => mesCorto(m.ym)), formato: compacto,
        series: [
          { nombre: 'Ingresos', color: 'var(--series-1)', valores: s.serie.map((m) => m.ingresos) },
          { nombre: 'Gastos', color: 'var(--series-2)', valores: s.serie.map((m) => m.gastos) },
        ],
      }) : emptyState('📊', 'Aún no hay datos', 'Registra ingresos y gastos para ver tu historia mes a mes.')),

    h('section', { class: 'card' }, h('h3', {}, `Gastos de ${monthLabel(ultimo.ym).toLowerCase()} por categoría`),
      s.categorias.length ? barrasHorizontales({ items: s.categorias.map((c) => ({ etiqueta: c.categoria, valor: c.total })), formato: compacto })
        : h('p', { class: 'muted' }, 'Sin gastos este mes.')),

    h('section', { class: 'card' }, h('h3', {}, 'Horas trabajadas por semana'),
      s.semanas.some((x) => x.horas) ? barrasAgrupadas({
        etiquetas: s.semanas.map((x) => fmtDate(x.ini).split(' de ').slice(0, 2).join(' ')), formato: (v) => `${v} h`, alto: 140,
        series: [{ nombre: 'Horas', color: 'var(--series-1)', valores: s.semanas.map((x) => x.horas) }],
      }) : h('p', { class: 'muted' }, 'Registra horas en Trabajo para ver esta gráfica.')),

    h('section', { class: 'card' }, h('h3', {}, 'Tu ánimo según lo que duermes'),
      s.animo.dias >= 3 ? h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('small', {}, 'Durmiendo 7 h o más'), h('b', {}, s.animo.conSueno != null ? `${s.animo.conSueno} / 5` : '—')),
        h('div', { class: 'stat' }, h('small', {}, 'Durmiendo menos de 7 h'), h('b', {}, s.animo.sinSueno != null ? `${s.animo.sinSueno} / 5` : '—')))
        : h('p', { class: 'muted' }, 'Escribe en el diario (con tu ánimo) y registra tus horas de sueño en Salud. Con unos días de datos te muestro la relación.'),
      s.animo.dias >= 3 ? h('small', { class: 'muted' }, `Basado en ${s.animo.dias} días con diario y sueño registrados.`) : null),
  );
}
