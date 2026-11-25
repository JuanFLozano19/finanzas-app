import { h, fill, emptyState, formulario, toast, confirmar } from '../dom.js';
import { fmtDate, fmtTime, today } from '../../core/format.js';

const DIAS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado']];

export function formSemestre(horario, inicio, fin, recargar) {
  formulario({
    titulo: 'Fechas del semestre', valores: { inicio: inicio || today(), fin },
    campos: [
      { name: 'inicio', label: 'Empieza', type: 'date', required: true },
      { name: 'fin', label: 'Termina', type: 'date', required: true, hint: 'Las clases del horario se repiten hasta esta fecha.' },
    ],
    validar: (d) => { if (d.fin <= d.inicio) throw new Error('La fecha de fin debe ser después del inicio.'); },
    onSubmit: async (d) => { await horario.guardarSemestre(d.inicio, d.fin); toast('Semestre guardado 🎓'); recargar(); },
  });
}

function formClase(horario, datos, recargar, dia = 1) {
  const activas = datos.materias.filter((m) => m.activa);
  if (!activas.length) { toast('Primero agrega tus materias en Universidad → Materias', 'error'); return; }
  formulario({
    titulo: 'Agregar clase al horario', valores: { materia_id: activas[0].id, dia },
    campos: [
      { name: 'materia_id', label: 'Materia', type: 'select', options: activas.map((m) => [m.id, m.nombre]) },
      { name: 'dia', label: 'Día', type: 'select', options: DIAS },
      { name: 'hora_inicio', label: 'Hora de inicio', type: 'time', required: true },
      { name: 'hora_fin', label: 'Hora de fin', type: 'time', required: true },
      { name: 'lugar', label: 'Salón (opcional)', placeholder: 'Ej: Bloque C 204' },
    ],
    validar: (d) => { if (d.hora_fin <= d.hora_inicio) throw new Error('La hora de fin debe ser después de la de inicio.'); },
    onSubmit: async (d) => {
      await horario.agregarClase({ ...d, materia: activas.find((m) => m.id === d.materia_id), inicio: datos.inicio, fin: datos.fin });
      toast('Clase agregada: se repite cada semana 📚'); recargar();
    },
  });
}

export async function renderHorario(cont, ctx) {
  const { horario } = ctx;
  const recargar = () => renderHorario(cont, ctx);
  const datos = await horario.datos();
  const color = (id) => datos.materias.find((m) => m.id === id)?.color || 'var(--uni)';
  const hay = datos.dias.some((d) => d.clases.length);

  fill(cont,
    h('section', { class: 'card' },
      h('div', { class: 'row-between' },
        h('div', {}, h('h3', {}, 'Semestre'),
          h('small', { class: 'muted' }, datos.inicio && datos.fin ? `${fmtDate(datos.inicio)} → ${fmtDate(datos.fin)}` : 'Define las fechas para que las clases terminen solas al final del semestre.')),
        h('button', { class: 'btn ghost small', onclick: () => formSemestre(horario, datos.inicio, datos.fin, recargar) }, datos.inicio ? 'Cambiar' : 'Definir'))),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formClase(horario, datos, recargar) }, '+ Clase')),
    hay ? h('div', { class: 'timetable' }, datos.dias.map((d) => h('section', { class: 'tt-day' },
      h('div', { class: 'tt-head' }, h('strong', {}, DIAS[d.dia - 1][1]),
        h('button', { class: 'icon-btn', 'aria-label': `Agregar clase el ${DIAS[d.dia - 1][1]}`, onclick: () => formClase(horario, datos, recargar, d.dia) }, '+')),
      d.clases.length ? d.clases.map((c) => h('div', { class: 'tt-class', style: `--c:${color(c.materia_id)}` },
        h('b', {}, c.titulo),
        h('small', {}, `${fmtTime(c.hora_inicio)} – ${fmtTime(c.hora_fin)}`),
        c.lugar ? h('small', { class: 'muted' }, c.lugar) : null,
        h('button', { class: 'icon-btn tt-del', 'aria-label': 'Quitar del horario', onclick: async () => {
          if (await confirmar(`¿Quitar ${c.titulo} del ${DIAS[d.dia - 1][1].toLowerCase()} del horario?`)) { await horario.eliminarClase(c.id); toast('Clase quitada'); recargar(); }
        } }, '✕')))
        : h('small', { class: 'muted tt-free' }, 'Libre')))) : emptyState('🗓', 'Tu horario está vacío', 'Agrega cada clase una sola vez y se llena la agenda de todo el semestre.'),
  );
}
