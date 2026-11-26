import { h, fill, emptyState } from '../dom.js';
import { today, addDays, startOfWeek, weekday, DIAS_CORTOS, fmtDayLong, monthLabel } from '../../core/format.js';
import { eventoItem, formEvento } from '../components.js';
import { mesCalendario } from '../../domain/herramientas.js';

let seleccion = null;
let vista = 'semana';
let vistaPintada = null; // para animar la cuadrícula solo cuando cambias de vista

const sumarMes = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export async function renderAgenda(cont, ctx) {
  const { vida } = ctx;
  const hoy = today();
  seleccion ||= hoy;
  const recargar = () => renderAgenda(cont, ctx);
  const cambiarVista = (v) => { vista = v; recargar(); };
  const selector = h('div', { class: 'seg', role: 'tablist' },
    ['semana', 'mes'].map((v) => h('button', { class: vista === v ? 'on' : '', role: 'tab', 'aria-selected': vista === v, onclick: () => cambiarVista(v) }, v === 'semana' ? 'Semana' : 'Mes')));

  let cabecera; let tira; let dias; let materias;
  if (vista === 'mes') {
    const ym = seleccion.slice(0, 7);
    const semanas = mesCalendario(ym);
    ({ dias, materias } = await vida.agenda.rango(semanas[0][0].fecha, semanas.at(-1)[6].fecha));
    const porFecha = new Map(dias.map((d) => [d.fecha, d.eventos]));
    const irMes = (n) => {
      const nuevo = sumarMes(ym, n);
      seleccion = hoy.startsWith(nuevo) ? hoy : `${nuevo}-01`;
      recargar();
    };
    cabecera = h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Mes anterior', onclick: () => irMes(-1) }, '‹'),
      h('strong', {}, monthLabel(ym)),
      h('button', { class: 'icon-btn', 'aria-label': 'Mes siguiente', onclick: () => irMes(1) }, '›'),
      !hoy.startsWith(ym) ? h('button', { class: 'chip', onclick: () => { seleccion = hoy; recargar(); } }, 'Hoy') : null, selector);
    tira = h('div', { class: `month-grid ${vistaPintada !== 'mes' ? 'entrar' : ''}` },
      ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l) => h('span', { class: 'month-wd', 'aria-hidden': 'true' }, l)),
      semanas.flat().map(({ fecha, delMes }, i) => {
        const evs = porFecha.get(fecha) || [];
        return h('button', {
          class: `month-cell ${delMes ? '' : 'fuera'} ${fecha === seleccion ? 'sel' : ''} ${fecha === hoy ? 'today' : ''} ${evs.length ? 'con' : ''}`,
          style: `--i:${i}`, 'aria-label': `${fmtDayLong(fecha)}: ${evs.length} evento${evs.length === 1 ? '' : 's'}`,
          onclick: () => { seleccion = fecha; recargar(); },
        }, h('b', {}, String(Number(fecha.slice(8)))),
          h('span', { class: 'dots' }, evs.slice(0, 3).map((e) => h('i', { class: `ev-dot ev-${e.tipo}` })),
            evs.length > 3 ? h('small', {}, `+${evs.length - 3}`) : null),
          evs.length ? h('span', { class: 'mc-evs' }, evs.slice(0, 2).map((e) => h('em', { class: `ev-${e.tipo}` }, e.titulo)),
            evs.length > 2 ? h('small', {}, `y ${evs.length - 2} más`) : null) : null);
      }));
  } else {
    const lunes = startOfWeek(seleccion);
    ({ dias, materias } = await vida.agenda.rango(lunes, addDays(lunes, 6)));
    const mover = (n) => { seleccion = addDays(seleccion, n); recargar(); };
    const f = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    cabecera = h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Semana anterior', onclick: () => mover(-7) }, '‹'),
      h('strong', {}, `${f(lunes)} – ${f(addDays(lunes, 6))}`),
      h('button', { class: 'icon-btn', 'aria-label': 'Semana siguiente', onclick: () => mover(7) }, '›'),
      seleccion !== hoy ? h('button', { class: 'chip', onclick: () => { seleccion = hoy; recargar(); } }, 'Hoy') : null, selector);
    tira = h('div', { class: `week-strip ${vistaPintada !== 'semana' ? 'entrar' : ''}` }, dias.map((d, i) => h('button', {
      class: `day-cell ${d.fecha === seleccion ? 'sel' : ''} ${d.fecha === hoy ? 'today' : ''}`, style: `--i:${i * 3}`,
      onclick: () => { seleccion = d.fecha; recargar(); },
    }, h('small', {}, DIAS_CORTOS[weekday(d.fecha)]), h('b', {}, String(Number(d.fecha.slice(8)))),
      h('span', { class: 'dots' }, d.eventos.slice(0, 3).map((e) => h('i', { class: `ev-dot ev-${e.tipo}` }))))));
  }

  vistaPintada = vista;
  const dia = dias.find((d) => d.fecha === seleccion) || { eventos: [] };
  fill(cont,
    cabecera,
    tira,
    h('div', { class: 'row-between' }, h('h3', {}, fmtDayLong(seleccion)),
      h('button', { class: 'btn primary small', onclick: () => formEvento(vida, null, materias, recargar, { fecha: seleccion }) }, '+ Evento')),
    dia.eventos.length
      ? h('ul', { class: 'events' }, dia.eventos.map((e) => eventoItem(vida, e, materias, recargar)))
      : emptyState('🗓', 'Día libre', 'Agrega clases, turnos de trabajo o citas. Las clases se pueden repetir cada semana.'),
  );
}
