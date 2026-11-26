import { abrirSemestreNuevo } from '../herramientas.js';
// Carrera (promedio acumulado y créditos), malla curricular y plan de repaso.
import { h, fill, emptyState, formulario, toast, progressBar, dialogo } from '../dom.js';
import { fmtDate, fmtDayLong, fmtTime, fmtPct } from '../../core/format.js';
import { NOTA_APROBATORIA } from '../../domain/vida.js';

export const ESTADOS = [['cursando', 'Cursando'], ['aprobada', 'Aprobada'], ['perdida', 'Perdida'], ['pendiente', 'Pendiente']];
const COLORES = [['#2f55d4', 'Cobalto'], ['#0f8f78', 'Verde'], ['#7c3aed', 'Morado'], ['#db2777', 'Rosa'], ['#ea580c', 'Naranja'], ['#ca8a04', 'Mostaza'], ['#0891b2', 'Cian'], ['#475569', 'Gris']];
const nota = (x) => (x == null ? '—' : Number(x).toFixed(2));
const claseNota = (x) => (x == null ? '' : x >= NOTA_APROBATORIA ? 'pos' : 'neg');

export function formMateriaCarrera(carrera, m, recargar, preset = {}) {
  formulario({
    titulo: m ? `Editar ${m.nombre}` : 'Agregar materia',
    valores: m ? { ...m } : { estado: 'aprobada', color: '#2f55d4', ...preset },
    campos: [
      { name: 'nombre', label: 'Materia', required: true },
      { name: 'semestre', label: 'Semestre', type: 'number', min: '1', step: '1', required: true },
      { name: 'creditos', label: 'Créditos', type: 'number', min: '0', step: '1' },
      { name: 'estado', label: 'Estado', type: 'select', options: ESTADOS },
      { name: 'nota_final', label: 'Nota final (0.0 a 5.0)', type: 'number', min: '0', step: '0.01', hint: 'Si la materia está en curso, se calcula sola con sus evaluaciones.' },
      { name: 'profesor', label: 'Docente (opcional)' },
      { name: 'color', label: 'Color', type: 'select', options: COLORES },
    ],
    validar: (d) => {
      if (d.nota_final != null && (d.nota_final < 0 || d.nota_final > 5)) throw new Error('La nota debe estar entre 0.0 y 5.0.');
      if (d.semestre < 1 || d.semestre > 14) throw new Error('El semestre debe estar entre 1 y 14.');
    },
    onSubmit: async (d) => { await carrera.guardarMateria(m?.id, d); toast('Materia guardada 🎓'); recargar(); },
    onEliminar: m ? async () => { await carrera.eliminarMateria(m.id); toast('Materia eliminada'); recargar(); } : null,
  });
}

function formCreditos(carrera, actual, recargar) {
  formulario({
    titulo: 'Créditos de la carrera', valores: { creditos: actual },
    campos: [{ name: 'creditos', label: '¿Cuántos créditos tiene tu carrera en total?', type: 'number', min: '1', step: '1', required: true, hint: 'Lo encuentras en el plan de estudios de tu programa.' }],
    onSubmit: async (d) => { await carrera.guardarCreditos(d.creditos); toast('Guardado'); recargar(); },
  });
}

// ================= Carrera =================
export async function renderCarrera(cont, ctx) {
  const { carrera } = ctx;
  const recargar = () => renderCarrera(cont, ctx);
  const { items, resumen: r, creditosCarrera } = await carrera.datos();
  fill(cont,
    h('section', { class: 'hero' },
      h('span', { class: 'hero-label' }, 'Promedio acumulado de la carrera'),
      h('strong', { class: 'hero-amount' }, r.papa != null ? r.papa.toFixed(2) : '—'),
      creditosCarrera ? [progressBar(r.avance, 'light'),
        h('small', {}, `${r.creditosAprobados} de ${creditosCarrera} créditos aprobados (${fmtPct(r.avance)}) · te faltan ${r.faltan}`)]
        : h('button', { class: 'link light', onclick: () => formCreditos(carrera, null, recargar) }, 'Define los créditos de tu carrera para ver tu avance')),
    h('div', { class: 'stats three' },
      h('div', { class: 'stat' }, h('small', {}, 'Créditos aprobados'), h('b', {}, String(r.creditosAprobados))),
      h('div', { class: 'stat' }, h('small', {}, 'Cursando'), h('b', {}, `${r.creditosCursando} cr.`)),
      h('button', { class: 'stat', onclick: () => formCreditos(carrera, creditosCarrera, recargar) }, h('small', {}, 'Total carrera'), h('b', {}, creditosCarrera ? `${creditosCarrera} cr.` : 'Definir'))),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formMateriaCarrera(carrera, null, recargar) }, '+ Materia de otro semestre'),
      items.some((m) => m.estado === 'cursando') ? h('button', { class: 'btn ghost', onclick: () => abrirSemestreNuevo(ctx.semestre, ctx.irA) }, 'Cerrar semestre') : null),
    items.length ? r.porSemestre.map((s) => h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', {}, s.semestre ? `Semestre ${s.semestre}` : 'Sin semestre asignado'),
        h('span', { class: `badge ${s.promedio == null ? '' : s.promedio >= NOTA_APROBATORIA ? 'ok' : 'late'}` }, s.promedio != null ? `Promedio ${nota(s.promedio)}` : `${s.creditos} cr.`)),
      h('ul', { class: 'list compact' }, s.materias.map((m) => h('li', {}, h('button', { class: 'list-item', onclick: () => formMateriaCarrera(carrera, m, recargar) },
        h('i', { class: 'swatch', style: `--c:${m.color}` }),
        h('span', { class: 'grow' }, h('strong', {}, m.nombre), h('small', { class: 'muted' }, `${ESTADOS.find(([v]) => v === m.estado)?.[1]}${m.creditos ? ` · ${m.creditos} créditos` : ''}`)),
        h('b', { class: claseNota(m.final) }, nota(m.final))))))))
      : emptyState('🎓', 'Aún no hay materias', 'Agrega las materias que ya viste con su nota y semestre para calcular tu promedio de carrera.'),
  );
}

// ================= Malla curricular =================
export async function renderMalla(cont, ctx) {
  const { carrera } = ctx;
  const recargar = () => renderMalla(cont, ctx);
  const { items, resumen: r } = await carrera.datos();
  const maxSem = Math.max(1, ...items.map((m) => m.semestre || 1));
  const cambiar = (m) => {
    const d = dialogo(h('div', { class: 'sheet-body' },
      h('div', { class: 'sheet-head' }, h('h2', {}, m.nombre), h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕')),
      h('p', { class: 'muted' }, `Semestre ${m.semestre || '—'}${m.creditos ? ` · ${m.creditos} créditos` : ''}${m.final != null ? ` · nota ${nota(m.final)}` : ''}`),
      h('div', { class: 'state-picker' }, ESTADOS.map(([v, l]) => h('button', {
        class: `state-opt st-${v} ${m.estado === v ? 'on' : ''}`,
        onclick: async () => { await carrera.cambiarEstado(m, v); d.close(); toast(`${m.nombre}: ${l.toLowerCase()}`); recargar(); },
      }, l))),
      h('button', { class: 'btn ghost', onclick: () => { d.close(); formMateriaCarrera(carrera, m, recargar); } }, 'Editar materia')));
  };
  fill(cont,
    h('div', { class: 'legend malla-legend' }, ESTADOS.map(([v, l]) => h('span', {}, h('i', { class: `st-dot st-${v}` }), l))),
    items.length ? h('div', { class: 'malla' }, Array.from({ length: maxSem }, (_, i) => i + 1).map((s) => {
      const ms = items.filter((m) => (m.semestre || 1) === s);
      return h('section', { class: 'malla-col' },
        h('h4', {}, `Semestre ${s}`),
        ms.map((m) => h('button', { class: `malla-item st-${m.estado}`, onclick: () => cambiar(m), title: ESTADOS.find(([v]) => v === m.estado)?.[1] },
          h('strong', {}, m.nombre), h('small', {}, [m.creditos ? `${m.creditos} cr.` : null, m.final != null ? nota(m.final) : null].filter(Boolean).join(' · ') || ' '))),
        h('button', { class: 'malla-add', 'aria-label': `Agregar materia al semestre ${s}`, onclick: () => formMateriaCarrera(carrera, null, recargar, { semestre: s, estado: 'pendiente' }) }, '+'));
    }), h('section', { class: 'malla-col add-col' }, h('button', { class: 'malla-add tall', onclick: () => formMateriaCarrera(carrera, null, recargar, { semestre: maxSem + 1, estado: 'pendiente' }) }, `+ Semestre ${maxSem + 1}`)))
      : emptyState('🗺️', 'Arma tu malla curricular', 'Agrega las materias de cada semestre de tu plan de estudios y márcalas como vistas, en curso o pendientes.'),
    items.length ? h('p', { class: 'muted center' }, `${items.filter((m) => m.estado === 'aprobada').length} aprobadas · ${items.filter((m) => m.estado === 'cursando').length} cursando · ${items.filter((m) => m.estado === 'pendiente').length} pendientes${r.perdidas ? ` · ${r.perdidas} perdidas` : ''}`) : null,
  );
}

// ================= Plan de repaso =================
export async function abrirPlanRepaso(plan, recargar, preset = null) {
  const proximas = await plan.proximas();
  if (!proximas.length && !preset) { toast('Primero agrega una evaluación con fecha en Universidad → Materias', 'error'); return; }
  formulario({
    titulo: '🧠 Planear repaso', enviar: 'Ver propuesta',
    valores: { evaluacion: preset?.id || proximas[0]?.id, sesiones: 3, minutos: 60 },
    campos: [
      { name: 'evaluacion', label: '¿Para qué evaluación?', type: 'select', options: proximas.map((e) => [e.id, `${e.nombre} · ${e.materia?.nombre || ''} (${fmtDate(e.fecha)})`]) },
      { name: 'sesiones', label: 'Sesiones de repaso', type: 'select', options: [[2, '2 sesiones'], [3, '3 sesiones'], [4, '4 sesiones'], [5, '5 sesiones']] },
      { name: 'minutos', label: 'Duración de cada sesión', type: 'select', options: [[30, '30 minutos'], [45, '45 minutos'], [60, '1 hora'], [90, '1 hora y media'], [120, '2 horas']] },
    ],
    onSubmit: async (d) => {
      const ev = proximas.find((e) => e.id === d.evaluacion);
      const propuesta = await plan.proponer({ examen: ev.fecha, sesiones: Number(d.sesiones), minutos: Number(d.minutos) });
      if (!propuesta.length) throw new Error('No encontré huecos libres antes de esa fecha. Prueba con sesiones más cortas.');
      setTimeout(() => confirmarPlan(plan, propuesta, ev, recargar), 50);
    },
  });
}

function confirmarPlan(plan, propuesta, ev, recargar) {
  const titulo = `Repaso: ${ev.materia?.nombre ? `${ev.materia.nombre} – ` : ''}${ev.nombre}`;
  const d = dialogo(h('div', { class: 'sheet-body' },
    h('div', { class: 'sheet-head' }, h('h2', {}, 'Tu plan de repaso'), h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕')),
    h('p', { class: 'muted' }, `Encontré estos huecos libres antes del ${fmtDate(ev.fecha)}, sin chocar con tus clases ni turnos:`),
    h('ul', { class: 'shifts' }, propuesta.map((p) => h('li', {}, h('div', { class: 'shift' },
      h('span', { class: 'shift-time' }, h('b', {}, fmtTime(p.inicio)), h('small', {}, fmtTime(p.fin))),
      h('span', { class: 'shift-body' }, h('strong', {}, fmtDayLong(p.fecha)), h('small', { class: 'muted' }, titulo)))))),
    propuesta.length < 2 ? h('p', { class: 'meta-msg warn' }, 'Solo encontré un hueco. Considera mover algo de tu agenda.') : null,
    h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn ghost', onclick: () => d.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async (e) => {
        e.currentTarget.disabled = true;
        await plan.agendar(propuesta, { titulo, materia_id: ev.materia_id });
        d.close(); toast(`🧠 ${propuesta.length} sesiones agregadas a tu agenda`); recargar?.();
      } }, 'Agregar a mi agenda'))));
}
