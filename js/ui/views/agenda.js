import { h, fill, emptyState } from '../dom.js';
import { today, addDays, startOfWeek, weekday, DIAS_CORTOS, fmtDayLong } from '../../core/format.js';
import { eventoItem, formEvento } from '../components.js';

let seleccion = null;

export async function renderAgenda(cont, ctx) {
  const { vida } = ctx;
  const hoy = today();
  seleccion ||= hoy;
  const recargar = () => renderAgenda(cont, ctx);
  const lunes = startOfWeek(seleccion);
  const { dias, materias } = await vida.agenda.rango(lunes, addDays(lunes, 6));
  const dia = dias.find((d) => d.fecha === seleccion);
  const mover = (n) => { seleccion = addDays(seleccion, n); recargar(); };
  const rangoTxt = `${new Date(`${lunes}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} – ${new Date(`${addDays(lunes, 6)}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

  fill(cont,
    h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Semana anterior', onclick: () => mover(-7) }, '‹'),
      h('strong', {}, rangoTxt),
      h('button', { class: 'icon-btn', 'aria-label': 'Semana siguiente', onclick: () => mover(7) }, '›'),
      seleccion !== hoy ? h('button', { class: 'chip', onclick: () => { seleccion = hoy; recargar(); } }, 'Hoy') : null),
    h('div', { class: 'week-strip' }, dias.map((d) => h('button', {
      class: `day-cell ${d.fecha === seleccion ? 'sel' : ''} ${d.fecha === hoy ? 'today' : ''}`,
      onclick: () => { seleccion = d.fecha; recargar(); },
    }, h('small', {}, DIAS_CORTOS[weekday(d.fecha)]), h('b', {}, String(Number(d.fecha.slice(8)))),
      h('span', { class: 'dots' }, d.eventos.slice(0, 3).map((e) => h('i', { class: `ev-dot ev-${e.tipo}` })))))),
    h('div', { class: 'row-between' }, h('h3', {}, fmtDayLong(seleccion)),
      h('button', { class: 'btn primary small', onclick: () => formEvento(vida, null, materias, recargar, { fecha: seleccion }) }, '+ Evento')),
    dia.eventos.length
      ? h('ul', { class: 'events' }, dia.eventos.map((e) => eventoItem(vida, e, materias, recargar)))
      : emptyState('🗓', 'Día libre', 'Agrega clases, turnos de trabajo o citas. Las clases se pueden repetir cada semana.'),
  );
}
