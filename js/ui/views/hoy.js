import { h, fill, money, emptyState, checkCircle, tablero } from '../dom.js';
import { today, addDays, currentMonth, fmtDayLong, fmtDate, fmtTime, fmtRelativa } from '../../core/format.js';
import { tareaItem, eventoItem, formTarea, formEvento } from '../components.js';

function saludo() {
  const hr = new Date().getHours();
  if (hr < 12) return 'Buenos días';
  if (hr < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Agenda del día con una marca de "ahora" y lo ya pasado atenuado. */
function lineaDeTiempo(eventos, item) {
  const ahora = new Date().toTimeString().slice(0, 5);
  const fin = (e) => e.hora_fin?.slice(0, 5) || e.hora_inicio?.slice(0, 5) || '23:59';
  const out = [];
  let marcado = false;
  for (const e of eventos) {
    if (!marcado && e.hora_inicio && e.hora_inicio.slice(0, 5) > ahora) {
      out.push(h('li', { class: 'now-line', 'aria-label': `Ahora, ${ahora}` }, h('span', {}, 'Ahora')));
      marcado = true;
    }
    const li = item(e);
    if (e.hora_inicio && fin(e) < ahora && fin(e) > e.hora_inicio.slice(0, 5)) li.classList.add('is-past');
    out.push(li);
  }
  if (!marcado) out.push(h('li', { class: 'now-line' }, h('span', {}, 'Ahora')));
  return out;
}

export async function renderHoy(cont, ctx) {
  const { service, vida, plata, bienestar, irA } = ctx;
  const recargar = () => renderHoy(cont, ctx);
  const hoy = today();
  const [agenda, tareas, habitos, mes, trabajo, uni] = await Promise.all([
    vida.agenda.rango(hoy, hoy), vida.tareas.listado(), vida.habitos.listado(hoy),
    service.movimientosDelMes(currentMonth()), vida.trabajo.datos(), vida.universidad.listado(),
  ]);
  const [fijos, personas, prestamos, rutinas] = await Promise.all([plata.recurrentes(), bienestar.contactos(), plata.prestamos(), bienestar.rutinas()]);
  const avisos = [
    ...fijos.pendientes.filter((x) => x.activo && (x.estado.atrasado || x.estado.dias <= 2)).map((x) => ['🔁',
      x.estado.atrasado ? `${x.nombre} venció hace ${-x.estado.dias} día${x.estado.dias === -1 ? '' : 's'}` : x.estado.dias === 0 ? `Hoy se paga ${x.nombre}` : `${x.nombre} se paga en ${x.estado.dias} día${x.estado.dias === 1 ? '' : 's'}`, 'fijos']),
    ...personas.cumples.filter((c) => c.estado.cumple.dias <= 2).map((c) => ['🎂',
      c.estado.cumple.dias === 0 ? `¡Hoy cumple años ${c.nombre}!` : `${c.nombre} cumple ${c.estado.cumple.dias === 1 ? 'mañana' : 'en 2 días'}`, 'contactos']),
    ...prestamos.items.filter((p) => !p.estado.saldada && p.fecha_pago && p.fecha_pago <= hoy).map((p) => ['🤝', `${p.persona} te debía pagar el ${fmtDate(p.fecha_pago)}`, 'prestamos']),
    ...([0, 1].includes(new Date().getDay()) ? [['🧭', new Date().getDay() === 0 ? 'Es domingo: buen momento para tu revisión semanal' : 'Revisa cómo te fue la semana pasada', 'revision']] : []),
  ];
  const rutina = new Date().getHours() < 15 ? rutinas.manana : rutinas.noche;
  const rutinaPend = rutina.filter((i) => !i.hecho).length;
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

    trabajo.proximo && (trabajo.proximo.enCurso || trabajo.proximo.fecha === hoy) ? h('button', { class: 'card banner shift-banner', onclick: () => irA('trabajo') },
      h('span', {}, '💼'), h('span', { class: 'grow' },
        h('strong', {}, trabajo.proximo.enCurso ? `Estás en turno hasta las ${fmtTime(trabajo.proximo.evento.hora_fin)}` : `Hoy tienes turno de ${fmtTime(trabajo.proximo.evento.hora_inicio)} a ${fmtTime(trabajo.proximo.evento.hora_fin)}`),
        h('small', { class: 'muted' }, trabajo.proximo.evento.titulo)), h('span', {}, '›')) : null,

    new Date().getMonth() === 11 ? h('button', { class: 'card banner', onclick: () => irA('anio') },
      h('span', {}, '🎆'), h('span', { class: 'grow' }, h('strong', {}, `Tu ${new Date().getFullYear()} en Rumbo está listo`),
        h('small', { class: 'muted' }, 'Horas trabajadas, tareas, plata, hábitos y más')), h('span', {}, '›')) : null,

    h('button', { class: 'assistant-bar', onclick: ctx.abrirAsistente }, h('span', {}, '✨'), h('span', { class: 'muted' }, 'Cuéntale a Rumbo: "gasté 15 mil en almuerzo"…')),

    tablero(
    avisos.length ? h('section', { class: 'card' }, h('h3', {}, 'Para tener en cuenta'),
      h('ul', { class: 'list compact' }, avisos.map(([ic, txt, ruta]) => h('li', {}, h('button', { class: 'list-item', onclick: () => irA(ruta) },
        h('span', {}, ic), h('span', { class: 'grow' }, txt), h('span', { class: 'muted' }, '›')))))) : null,

    [rutina.length && rutinaPend ? h('button', { class: 'card banner', onclick: () => irA('rutinas') },
      h('span', {}, new Date().getHours() < 15 ? '☀️' : '🌙'),
      h('span', { class: 'grow' }, h('strong', {}, `Rutina de la ${new Date().getHours() < 15 ? 'mañana' : 'noche'}: te faltan ${rutinaPend}`),
        h('small', { class: 'muted' }, rutina.filter((i) => !i.hecho).map((i) => i.texto).slice(0, 3).join(' · '))), h('span', {}, '›')) : null, 'lado'],

    [h('div', { class: 'stats three' },
      h('button', { class: 'stat', onclick: () => irA('finanzas') }, h('small', {}, 'Balance del mes'),
        money(mes.resumen.balance, mes.resumen.balance < 0 ? 'neg' : 'pos')),
      h('button', { class: 'stat', onclick: () => irA('trabajo') }, h('small', {}, trabajo.proximo?.enCurso ? 'Turno' : 'Próximo turno'),
        h('b', {}, trabajo.proximo ? (trabajo.proximo.enCurso ? 'Ahora' : `${trabajo.proximo.fecha === hoy ? 'Hoy' : trabajo.proximo.fecha === addDays(hoy, 1) ? 'Mañana' : fmtDate(trabajo.proximo.fecha).split(' de ').slice(0, 2).join(' ')} ${fmtTime(trabajo.proximo.evento.hora_inicio)}`) : '—')),
      h('button', { class: 'stat', onclick: () => irA('universidad') }, h('small', {}, 'Tu promedio'),
        h('span', { class: 'money' }, uni.promedio != null ? uni.promedio.toFixed(2) : '—')),
    ), 'lado'],

    [h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Hábitos de hoy'), h('button', { class: 'link', onclick: () => irA('habitos') }, 'Ver')),
      habHoy.length
        ? h('div', { class: 'habit-chips' }, habHoy.map((x) => h('div', { class: `habit-chip ${x.hechoHoy ? 'on' : ''}` },
          checkCircle(x.hechoHoy, async () => { await vida.habitos.alternar(x.id, hoy, x.hechoHoy); recargar(); }, x.nombre),
          h('span', {}, `${x.icono} ${x.nombre}`), x.racha > 1 ? h('small', {}, `🔥${x.racha}`) : null)))
        : emptyState('🌱', 'Sin hábitos para hoy', 'Crea hábitos como leer, estudiar o tomar agua.')), 'lado'],

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Agenda de hoy'),
        h('button', { class: 'link', onclick: () => formEvento(vida, null, materias, recargar, { fecha: hoy }) }, '+ Agregar')),
      eventos.length ? h('ul', { class: 'events timeline' }, lineaDeTiempo(eventos, (e) => eventoItem(vida, e, materias, recargar)))
        : h('p', { class: 'muted' }, 'Nada agendado para hoy.')),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Tareas para hoy'),
        h('button', { class: 'link', onclick: () => formTarea(vida, null, materias, recargar, { fecha_limite: hoy }) }, '+ Agregar')),
      tareasHoy.length ? h('ul', { class: 'tasks' }, tareasHoy.map((t) => tareaItem(vida, t, materias, recargar)))
        : h('p', { class: 'muted' }, tareas.grupos.proximas.length
          ? `Nada para hoy. Tu próxima tarea es "${tareas.grupos.proximas[0].titulo}" (${fmtDate(tareas.grupos.proximas[0].fecha_limite)}).`
          : 'No tienes tareas pendientes para hoy 🙌')),

    [proxEval.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Evaluaciones próximas'), h('button', { class: 'link', onclick: () => irA('universidad') }, 'Ver')),
      h('ul', { class: 'list compact' }, proxEval.map((e) => h('li', { class: 'list-item static' },
        h('i', { class: 'swatch', style: `--c:${e.materia?.color || '#888'}` }),
        h('span', { class: 'grow' }, h('strong', {}, e.nombre), h('small', { class: 'muted' }, `${e.materia?.nombre || ''} · ${e.porcentaje}%`)),
        h('span', { class: 'pill' }, fmtRelativa(e.fecha)))))) : null, 'lado'],
    ),
  );
}

