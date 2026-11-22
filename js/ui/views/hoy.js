import { h, fill, money, emptyState, checkCircle } from '../dom.js';
import { today, addDays, currentMonth, fmtDayLong, fmtDate, fmtMoney } from '../../core/format.js';
import { tareaItem, eventoItem, formTarea, formEvento } from '../components.js';

function saludo() {
  const hr = new Date().getHours();
  if (hr < 12) return 'Buenos días';
  if (hr < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export async function renderHoy(cont, ctx) {
  const { service, vida, irA } = ctx;
  const recargar = () => renderHoy(cont, ctx);
  const hoy = today();
  const [agenda, tareas, habitos, mes, trabajo, uni] = await Promise.all([
    vida.agenda.rango(hoy, hoy), vida.tareas.listado(), vida.habitos.listado(hoy),
    service.movimientosDelMes(currentMonth()), vida.trabajo.listado(), vida.universidad.listado(),
  ]);
  const materias = tareas.materias;
  const habHoy = habitos.filter((x) => x.activo && x.tocaHoy);
  const hechos = habHoy.filter((x) => x.hechoHoy).length;
  const tareasHoy = [...tareas.grupos.vencidas, ...tareas.grupos.hoy];
  const proxEval = uni.proximas.filter((e) => e.fecha <= addDays(hoy, 14)).slice(0, 4);
  const eventos = agenda.dias[0].eventos;

  fill(cont,
    h('section', { class: 'hero hero-hoy' },
      h('span', { class: 'hero-label' }, fmtDayLong(hoy)),
      h('strong', { class: 'hero-title' }, `${saludo()} 👋`),
      h('div', { class: 'hero-row' },
        h('div', {}, h('small', {}, 'Eventos'), h('b', {}, String(eventos.length))),
        h('div', {}, h('small', {}, 'Tareas para hoy'), h('b', {}, String(tareasHoy.length))),
        h('div', {}, h('small', {}, 'Hábitos'), h('b', {}, `${hechos}/${habHoy.length}`)),
      )),

    h('div', { class: 'stats three' },
      h('button', { class: 'stat', onclick: () => irA('finanzas') }, h('small', {}, 'Balance del mes'),
        money(mes.resumen.balance, mes.resumen.balance < 0 ? 'neg' : 'pos')),
      h('button', { class: 'stat', onclick: () => irA('trabajo') }, h('small', {}, 'Por cobrar'), money(trabajo.resumen.montoPendiente)),
      h('button', { class: 'stat', onclick: () => irA('universidad') }, h('small', {}, 'Promedio'),
        h('span', { class: 'money' }, uni.promedio != null ? uni.promedio.toFixed(2) : '—')),
    ),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Hábitos de hoy'), h('button', { class: 'link', onclick: () => irA('habitos') }, 'Ver')),
      habHoy.length
        ? h('div', { class: 'habit-chips' }, habHoy.map((x) => h('div', { class: `habit-chip ${x.hechoHoy ? 'on' : ''}` },
          checkCircle(x.hechoHoy, async () => { await vida.habitos.alternar(x.id, hoy, x.hechoHoy); recargar(); }, x.nombre),
          h('span', {}, `${x.icono} ${x.nombre}`), x.racha > 1 ? h('small', {}, `🔥${x.racha}`) : null)))
        : emptyState('🌱', 'Sin hábitos para hoy', 'Crea hábitos como leer, estudiar o tomar agua.')),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Agenda de hoy'),
        h('button', { class: 'link', onclick: () => formEvento(vida, null, materias, recargar, { fecha: hoy }) }, '+ Agregar')),
      eventos.length ? h('ul', { class: 'events' }, eventos.map((e) => eventoItem(vida, e, materias, recargar)))
        : h('p', { class: 'muted' }, 'Nada agendado para hoy.')),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Tareas para hoy'),
        h('button', { class: 'link', onclick: () => formTarea(vida, null, materias, recargar, { fecha_limite: hoy }) }, '+ Agregar')),
      tareasHoy.length ? h('ul', { class: 'tasks' }, tareasHoy.map((t) => tareaItem(vida, t, materias, recargar)))
        : h('p', { class: 'muted' }, tareas.grupos.proximas.length
          ? `Nada para hoy. Tu próxima tarea es "${tareas.grupos.proximas[0].titulo}" (${fmtDate(tareas.grupos.proximas[0].fecha_limite)}).`
          : 'No tienes tareas pendientes para hoy 🙌')),

    proxEval.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Evaluaciones próximas'), h('button', { class: 'link', onclick: () => irA('universidad') }, 'Ver')),
      h('ul', { class: 'list compact' }, proxEval.map((e) => h('li', { class: 'list-item static' },
        h('i', { class: 'swatch', style: `--c:${e.materia?.color || '#888'}` }),
        h('span', { class: 'grow' }, h('strong', {}, e.nombre), h('small', { class: 'muted' }, `${e.materia?.nombre || ''} · ${e.porcentaje}%`)),
        h('span', { class: 'pill' }, fmtDate(e.fecha)))))) : null,

    trabajo.resumen.montoPendiente > 0 ? h('button', { class: 'card banner', onclick: () => irA('trabajo') },
      h('span', {}, '💼'), h('span', { class: 'grow' }, h('strong', {}, `Tienes ${trabajo.resumen.horasPendientes} h sin cobrar`),
        h('small', { class: 'muted' }, `Equivalen a ${fmtMoney(trabajo.resumen.montoPendiente)}`)), h('span', {}, '›')) : null,
  );
}

