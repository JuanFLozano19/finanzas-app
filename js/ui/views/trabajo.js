// Trabajo: solo turnos (cuándo, a qué hora y de qué tipo). Sin pagos ni tarifas.
// Los recordatorios llegan por notificación: X minutos antes y la noche anterior.
import { h, fill, emptyState, formulario, toast } from '../dom.js';
import { today, addDays, fmtDayLong, fmtTime, fmtDate, DIAS_CORTOS, weekday } from '../../core/format.js';
import { duracionHoras } from '../../domain/vida.js';

const SUGERENCIAS = ['Grabación de robots', 'Turno de mañana', 'Turno de tarde', 'Turno de noche', 'Capacitación', 'Reunión'];
const AVISOS = [[15, '15 minutos antes'], [30, '30 minutos antes'], [60, '1 hora antes'], [120, '2 horas antes'], [0, 'Sin aviso antes']];

const rango = (e) => `${fmtTime(e.hora_inicio)} – ${fmtTime(e.hora_fin)}`;
const horasTxt = (n) => (Number.isInteger(n) ? `${n} h` : `${n.toFixed(1).replace('.', ',')} h`);
const cuando = (f) => (f === today() ? 'Hoy' : f === addDays(today(), 1) ? 'Mañana' : fmtDayLong(f));

function faltaTxt(p) {
  if (p.enCurso) {
    const min = Math.round((p.fin - Date.now()) / 60000);
    return `En curso · terminas ${min < 60 ? `en ${min} min` : `a las ${fmtTime(p.evento.hora_fin)}`}`;
  }
  const m = p.minutosPara;
  if (m < 60) return `Empieza en ${m} min`;
  if (m < 1440) { const hh = Math.floor(m / 60); const mm = m % 60; return `Empieza en ${hh} h${mm ? ` ${mm} min` : ''}`; }
  const d = Math.round(m / 1440);
  return `Faltan ${d} día${d === 1 ? '' : 's'}`;
}

export function formTurno(trabajo, t, tipos, recargar, preset = {}) {
  formulario({
    titulo: t ? 'Editar turno' : 'Nuevo turno',
    valores: t ? { ...t, hora_inicio: t.hora_inicio?.slice(0, 5), hora_fin: t.hora_fin?.slice(0, 5) }
      : { fecha: today(), recordatorio_min: 60, ...preset },
    campos: [
      { name: 'titulo', label: 'Tipo de turno', required: true, list: [...new Set([...tipos, ...SUGERENCIAS])], placeholder: 'Ej: Grabación de robots' },
      { name: 'notas', label: 'Descripción (qué vas a hacer)', type: 'textarea', placeholder: 'Ej: grabar pantalla y cámaras de los robots' },
      { name: 'fecha', label: t?.semanal ? 'Primer día' : 'Día', type: 'date', required: true },
      { name: 'hora_inicio', label: 'Entras a las', type: 'time', required: true },
      { name: 'hora_fin', label: 'Sales a las', type: 'time', required: true, hint: 'Si sales después de medianoche, pon la hora normal (ej. 6:00 a. m.).' },
      { name: 'semanal', label: 'Se repite cada semana este mismo día', type: 'checkbox' },
      { name: 'fecha_fin', label: 'Repetir hasta (opcional)', type: 'date' },
      { name: 'recordatorio_min', label: 'Avisarme', type: 'select', options: AVISOS, hint: 'Además te aviso la noche anterior a las 8 p. m.' },
      { name: 'lugar', label: 'Lugar (opcional)' },
    ],
    validar: (d) => {
      if (d.hora_inicio === d.hora_fin) throw new Error('La hora de entrada y la de salida no pueden ser iguales.');
      if (d.semanal && d.fecha_fin && d.fecha_fin < d.fecha) throw new Error('"Repetir hasta" debe ser después del primer día.');
    },
    onSubmit: async (d) => {
      await trabajo.guardar(t?.id, { ...d, recordatorio_min: Number(d.recordatorio_min), fecha_fin: d.semanal ? d.fecha_fin : null });
      toast(t ? 'Turno actualizado' : 'Turno agregado 💼'); recargar();
    },
    onEliminar: t ? async () => { await trabajo.eliminar(t.id); toast('Turno eliminado'); recargar(); } : null,
  });
}

function filaTurno(abrir, { fecha, evento: e }) {
  const fin = new Date(`${fecha}T${e.hora_inicio.slice(0, 5)}`).getTime() + duracionHoras(e) * 3600000;
  const aviso = AVISOS.find(([v]) => v === e.recordatorio_min)?.[1];
  return h('li', {}, h('button', { class: `shift ${fin < Date.now() ? 'past' : ''}`, onclick: () => abrir(e) },
    h('span', { class: 'shift-time' }, h('b', {}, fmtTime(e.hora_inicio)), h('small', {}, fmtTime(e.hora_fin))),
    h('span', { class: 'shift-body' },
      h('strong', {}, e.titulo),
      e.notas ? h('small', { class: 'muted' }, e.notas) : null,
      h('span', { class: 'task-meta' },
        h('span', { class: 'pill' }, horasTxt(duracionHoras(e))),
        e.semanal ? h('span', { class: 'pill' }, '🔁 Cada semana') : null,
        e.recordatorio_min ? h('span', { class: 'pill' }, `🔔 ${aviso || `${e.recordatorio_min} min antes`}`) : null,
        e.lugar ? h('span', { class: 'pill' }, `📍 ${e.lugar}`) : null))));
}

export async function renderTrabajo(cont, ctx) {
  const { vida, irA } = ctx;
  const trabajo = vida.trabajo;
  const recargar = () => renderTrabajo(cont, ctx);
  const d = await trabajo.datos();
  const abrir = (e) => formTurno(trabajo, e, d.tipos, recargar);
  const p = d.proximo;

  const porDia = new Map();
  for (const i of d.proximos) {
    if (!porDia.has(i.fecha)) porDia.set(i.fecha, []);
    porDia.get(i.fecha).push(i);
  }

  fill(cont,
    p ? h('section', { class: `shift-hero ${p.enCurso ? 'live' : ''}` },
      h('span', { class: 'shift-hero-when' }, p.enCurso ? 'Estás en turno' : `Próximo turno · ${cuando(p.fecha)}`),
      h('strong', { class: 'shift-hero-time' }, rango(p.evento)),
      h('span', { class: 'shift-hero-type' }, p.evento.titulo),
      p.evento.notas ? h('small', { class: 'shift-hero-desc' }, p.evento.notas) : null,
      h('span', { class: 'shift-hero-count' }, faltaTxt(p)))
      : h('section', { class: 'shift-hero' },
        h('span', { class: 'shift-hero-when' }, 'Sin turnos próximos'),
        h('strong', { class: 'shift-hero-type' }, 'Agrega tu horario de trabajo'),
        h('small', { class: 'shift-hero-desc' }, 'Te aviso antes de cada turno y la noche anterior.')),

    h('div', { class: 'stats three' },
      h('div', { class: 'stat' }, h('small', {}, 'Horas esta semana'), h('b', {}, horasTxt(d.horasSemana))),
      h('div', { class: 'stat' }, h('small', {}, 'Turnos esta semana'), h('b', {}, String(d.turnosSemana))),
      h('div', { class: 'stat' }, h('small', {}, 'Horas este mes'), h('b', {}, horasTxt(d.horasMes)))),

    h('div', { class: 'action-row' },
      h('button', { class: 'btn primary', onclick: () => formTurno(trabajo, null, d.tipos, recargar) }, '+ Turno'),
      h('button', { class: 'btn ghost', onclick: () => irA('agenda') }, 'Ver en la agenda')),

    porDia.size ? h('section', { class: 'shift-days' }, [...porDia.entries()].map(([fecha, items]) => h('div', { class: 'shift-day' },
      h('h4', { class: `day-title ${fecha === today() ? 'is-today' : ''}` }, cuando(fecha)),
      h('ul', { class: 'shifts' }, items.map((i) => filaTurno(abrir, i))))))
      : emptyState('💼', 'No tienes turnos en los próximos 14 días', 'Toca "+ Turno". Si trabajas los mismos días cada semana, marca "Se repite cada semana".'),

    d.fijos.length ? h('section', { class: 'card' },
      h('h3', {}, 'Turnos fijos'),
      h('ul', { class: 'shifts' }, d.fijos.map((e) => h('li', {}, h('button', { class: 'shift', onclick: () => abrir(e) },
        h('span', { class: 'shift-time' }, h('b', {}, DIAS_CORTOS[weekday(e.fecha)]), h('small', {}, fmtTime(e.hora_inicio))),
        h('span', { class: 'shift-body' }, h('strong', {}, e.titulo),
          h('small', { class: 'muted' }, `${rango(e)}, desde el ${fmtDate(e.fecha)}${e.fecha_fin ? ` hasta el ${fmtDate(e.fecha_fin)}` : ''}`))))))) : null,
  );
}
