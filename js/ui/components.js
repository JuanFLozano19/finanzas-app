// Componentes compartidos entre varias vistas (Hoy, Tareas, Agenda, Universidad).
import { h, checkCircle, formulario, toast } from './dom.js';
import { fmtDate, fmtTime, today } from '../core/format.js';

export const PRIORIDADES = [[1, 'Alta'], [2, 'Media'], [3, 'Baja']];
export const TIPOS_EVENTO = [['clase', '📚 Clase'], ['trabajo', '💼 Trabajo'], ['cita', '📍 Cita'], ['entrega', '📝 Entrega'], ['otro', '🗓 Otro']];
export const ICONO_EVENTO = { clase: '📚', trabajo: '💼', cita: '📍', entrega: '📝', otro: '🗓' };

const opcionesMateria = (materias) => [['', '— Ninguna —'], ...materias.filter((m) => m.activa !== false).map((m) => [m.id, m.nombre])];

export function formTarea(vida, tarea, materias, recargar, preset = {}) {
  formulario({
    titulo: tarea ? 'Editar tarea' : 'Nueva tarea',
    valores: tarea || { prioridad: 2, ...preset },
    campos: [
      { name: 'titulo', label: '¿Qué tienes que hacer?', required: true, placeholder: 'Ej: Taller de ecuaciones' },
      { name: 'fecha_limite', label: 'Fecha límite (opcional)', type: 'date' },
      { name: 'prioridad', label: 'Prioridad', type: 'select', options: PRIORIDADES },
      materias.length ? { name: 'materia_id', label: 'Materia (opcional)', type: 'select', options: opcionesMateria(materias) } : null,
      { name: 'descripcion', label: 'Detalles (opcional)', type: 'textarea' },
    ].filter(Boolean),
    onSubmit: async (d) => {
      await vida.tareas.guardar(tarea?.id, { ...d, prioridad: Number(d.prioridad) });
      toast(tarea ? 'Tarea actualizada' : 'Tarea agregada ✍️'); recargar();
    },
    onEliminar: tarea ? async () => { await vida.tareas.eliminar(tarea.id); toast('Tarea eliminada'); recargar(); } : null,
  });
}

export function tareaItem(vida, t, materias, recargar) {
  const materia = materias.find((m) => m.id === t.materia_id);
  const hoy = today();
  const vencida = !t.hecha && t.fecha_limite && t.fecha_limite < hoy;
  return h('li', { class: `task ${t.hecha ? 'done' : ''}` },
    checkCircle(t.hecha, async () => { await vida.tareas.marcar(t.id, !t.hecha); if (!t.hecha) toast('¡Bien hecho! ✅'); recargar(); },
      t.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'),
    h('button', { class: 'task-body', onclick: () => formTarea(vida, t, materias, recargar) },
      h('span', { class: 'task-title' }, t.titulo),
      h('span', { class: 'task-meta' },
        t.prioridad === 1 && !t.hecha ? h('span', { class: 'pill high' }, 'Alta') : null,
        t.fecha_limite ? h('span', { class: `pill ${vencida ? 'late' : ''}` }, `${vencida ? 'Venció ' : ''}${t.fecha_limite === hoy ? 'Hoy' : fmtDate(t.fecha_limite)}`) : null,
        materia ? h('span', { class: 'pill', style: `--c:${materia.color}` }, h('i', { class: 'swatch' }), materia.nombre) : null,
      )),
  );
}

export function formEvento(vida, ev, materias, recargar, preset = {}) {
  formulario({
    titulo: ev ? 'Editar evento' : 'Nuevo evento',
    valores: ev ? { ...ev, hora_inicio: ev.hora_inicio?.slice(0, 5), hora_fin: ev.hora_fin?.slice(0, 5) } : { tipo: 'otro', fecha: today(), ...preset },
    campos: [
      { name: 'titulo', label: 'Título', required: true, placeholder: 'Ej: Clase de Bases de Datos' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: TIPOS_EVENTO },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      { name: 'hora_inicio', label: 'Hora inicio (opcional)', type: 'time' },
      { name: 'hora_fin', label: 'Hora fin (opcional)', type: 'time' },
      { name: 'semanal', label: 'Se repite cada semana (ideal para clases y turnos)', type: 'checkbox' },
      { name: 'lugar', label: 'Lugar (opcional)', placeholder: 'Ej: Bloque C, salón 204' },
      materias.length ? { name: 'materia_id', label: 'Materia (opcional)', type: 'select', options: opcionesMateria(materias) } : null,
      { name: 'notas', label: 'Notas', type: 'textarea' },
    ].filter(Boolean),
    validar: (d) => {
      if (d.hora_inicio && d.hora_fin && d.hora_fin <= d.hora_inicio) throw new Error('La hora de fin debe ser después de la de inicio.');
    },
    onSubmit: async (d) => { await vida.agenda.guardar(ev?.id, d); toast('Evento guardado 🗓'); recargar(); },
    onEliminar: ev ? async () => { await vida.agenda.eliminar(ev.id); toast('Evento eliminado'); recargar(); } : null,
  });
}

export function eventoItem(vida, e, materias, recargar) {
  const materia = materias.find((m) => m.id === e.materia_id);
  return h('li', {},
    h('button', { class: `event ev-${e.tipo}`, style: materia ? `--c:${materia.color}` : null, onclick: () => formEvento(vida, e, materias, recargar) },
      h('span', { class: 'event-time' }, e.hora_inicio ? fmtTime(e.hora_inicio) : 'Todo el día',
        e.hora_fin ? h('small', {}, fmtTime(e.hora_fin)) : null),
      h('span', { class: 'event-body' },
        h('strong', {}, `${ICONO_EVENTO[e.tipo] || ''} ${e.titulo}`),
        h('small', { class: 'muted' }, [e.lugar, e.semanal ? 'Cada semana' : null].filter(Boolean).join(' · '))),
    ));
}
