import { h, fill, emptyState, formulario, toast, progressBar, dialogo } from '../dom.js';
import { fmtDate } from '../../core/format.js';
import { formTarea, tareaItem } from '../components.js';
import { NOTA_APROBATORIA, simularMateria } from '../../domain/vida.js';

const COLORES = [['#0b7a5a', 'Verde'], ['#2563eb', 'Azul'], ['#7c3aed', 'Morado'], ['#db2777', 'Rosa'], ['#ea580c', 'Naranja'], ['#ca8a04', 'Mostaza'], ['#0891b2', 'Cian'], ['#475569', 'Gris']];
const nota = (x) => (x == null ? '—' : Number(x).toFixed(2));
const claseNota = (x) => (x == null ? '' : x >= NOTA_APROBATORIA ? 'pos' : 'neg');

function formMateria(vida, m, recargar) {
  formulario({
    titulo: m ? 'Editar materia' : 'Nueva materia',
    valores: m || { color: '#0b7a5a', activa: true },
    campos: [
      { name: 'nombre', label: 'Materia', required: true, placeholder: 'Ej: Bases de Datos' },
      { name: 'profesor', label: 'Docente (opcional)' },
      { name: 'creditos', label: 'Créditos', type: 'number', min: '0', step: '1' },
      { name: 'color', label: 'Color', type: 'select', options: COLORES },
      { name: 'activa', label: 'La estoy viendo este semestre', type: 'checkbox' },
    ],
    onSubmit: async (d) => { await vida.universidad.guardarMateria(m?.id, d); toast('Materia guardada 📚'); recargar(); },
    onEliminar: m ? async () => { await vida.universidad.eliminarMateria(m.id); toast('Materia eliminada'); recargar(); } : null,
  });
}

function formEvaluacion(vida, materia, ev, recargar) {
  const usado = materia.evaluaciones.filter((e) => e.id !== ev?.id).reduce((a, e) => a + Number(e.porcentaje), 0);
  formulario({
    titulo: ev ? 'Editar evaluación' : `Nueva evaluación · ${materia.nombre}`,
    valores: ev || {},
    campos: [
      { name: 'nombre', label: 'Evaluación', required: true, placeholder: 'Ej: Primer parcial' },
      { name: 'porcentaje', label: 'Porcentaje (%)', type: 'number', min: '0.5', step: '0.5', required: true, hint: `Disponible: ${100 - usado}%` },
      { name: 'fecha', label: 'Fecha (opcional)', type: 'date' },
      { name: 'nota', label: 'Nota de 0.0 a 5.0 (déjala vacía si aún no la tienes)', type: 'number', min: '0', step: '0.01' },
    ],
    validar: (d) => {
      if (d.porcentaje + usado > 100) throw new Error(`Los porcentajes de la materia superarían el 100% (quedan ${100 - usado}%).`);
      if (d.nota != null && (d.nota < 0 || d.nota > 5)) throw new Error('La nota debe estar entre 0.0 y 5.0.');
    },
    onSubmit: async (d) => { await vida.universidad.guardarEvaluacion(ev?.id, { ...d, materia_id: materia.id }); toast('Evaluación guardada'); recargar(); },
    onEliminar: ev ? async () => { await vida.universidad.eliminarEvaluacion(ev.id); toast('Evaluación eliminada'); recargar(); } : null,
  });
}

function simulador(m) {
  const pendientes = m.evaluaciones.filter((e) => e.nota == null);
  const valores = Object.fromEntries(pendientes.map((e) => [e.id, 3.5]));
  const res = h('div', { class: 'sim-result' });
  const pintar = () => {
    const r = simularMateria(m.evaluaciones, valores);
    const falta = Math.max(0, 100 - r.pctTotal);
    res.replaceChildren(
      h('small', {}, 'Nota final simulada'),
      h('b', { class: r.acumulado >= NOTA_APROBATORIA ? 'pos' : 'neg' }, nota(r.acumulado)),
      h('small', { class: 'muted' }, r.acumulado >= NOTA_APROBATORIA ? '¡Así pasarías! 🎉' : `Te faltarían ${nota(NOTA_APROBATORIA - r.acumulado)} para el 3.0`),
      falta > 0 ? h('small', { class: 'muted' }, `Ojo: faltan evaluaciones por registrar (${falta}% del total).`) : null);
  };
  const d = dialogo(h('div', { class: 'sheet-body' },
    h('div', { class: 'sheet-head' }, h('h2', {}, `Simular · ${m.nombre}`), h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕')),
    h('p', { class: 'muted' }, 'Mueve las barras para ver qué pasaría con distintas notas. Nada se guarda.'),
    pendientes.map((e) => {
      const lbl = h('b', {}, nota(valores[e.id]));
      return h('label', { class: 'field' }, h('span', { class: 'label row-between' }, `${e.nombre} (${Number(e.porcentaje)}%)`, lbl),
        h('input', { type: 'range', min: '0', max: '5', step: '0.1', value: String(valores[e.id]), oninput: (ev) => {
          valores[e.id] = Number(ev.target.value); lbl.textContent = nota(valores[e.id]); pintar();
        } }));
    }),
    res,
    h('div', { class: 'sheet-actions' }, h('span'), h('button', { class: 'btn primary', onclick: () => d.close() }, 'Listo'))));
  pintar();
}

function mensaje(e) {
  if (e.pctTotal === 0) return 'Agrega las evaluaciones del semestre con sus porcentajes.';
  if (e.perdida) return 'Se completó el 100% y no alcanzó el 3.0 😔';
  if (e.pctRestante === 0) return '¡Materia aprobada! 🎉';
  if (e.aprobada) return `¡Ya la pasaste! Llevas ${nota(e.acumulado)} acumulado.`;
  if (e.imposible) return `Necesitarías ${nota(e.notaNecesaria)} en el ${e.pctRestante}% restante: no alcanza el 3.0.`;
  return `Necesitas ${nota(e.notaNecesaria)} en promedio en el ${e.pctRestante}% que falta para pasar con 3.0.`;
}

function tarjeta(vida, m, materias, recargar) {
  const e = m.estado;
  return h('article', { class: `card subject ${m.activa ? '' : 'done'}`, style: `--c:${m.color}` },
    h('div', { class: 'row-between' },
      h('div', {}, h('h3', {}, m.nombre),
        h('small', { class: 'muted' }, [m.profesor, m.creditos ? `${m.creditos} créditos` : null].filter(Boolean).join(' · ') || ' ')),
      h('div', { class: 'grade' }, h('small', {}, 'Acumulado'), h('b', { class: e.pctRestante === 0 || e.aprobada ? claseNota(e.acumulado) : '' }, nota(e.pctEvaluado ? e.acumulado : null)))),
    progressBar(e.pctEvaluado / 100, 'subject'),
    h('div', { class: 'kv' },
      h('div', {}, h('small', {}, 'Evaluado'), h('b', {}, `${e.pctEvaluado}%`)),
      h('div', {}, h('small', {}, 'Promedio'), h('b', { class: claseNota(e.promedio) }, nota(e.promedio))),
      h('div', {}, h('small', {}, 'Falta'), h('b', {}, `${e.pctRestante}%`))),
    h('p', { class: `meta-msg ${e.imposible || e.perdida ? 'warn' : ''}`, style: 'color:var(--c)' }, mensaje(e)),
    m.evaluaciones.length ? h('ul', { class: 'list compact' }, m.evaluaciones.map((ev) => h('li', {},
      h('button', { class: 'list-item', onclick: () => formEvaluacion(vida, m, ev, recargar) },
        h('span', { class: 'grow' }, h('strong', {}, ev.nombre), h('small', { class: 'muted' }, [`${Number(ev.porcentaje)}%`, ev.fecha ? fmtDate(ev.fecha) : null].filter(Boolean).join(' · '))),
        h('b', { class: claseNota(ev.nota) }, nota(ev.nota)))))) : null,
    m.pendientes.length ? h('ul', { class: 'tasks' }, m.pendientes.map((t) => tareaItem(vida, t, materias, recargar))) : null,
    h('div', { class: 'card-actions' },
      h('button', { class: 'btn primary', onclick: () => formEvaluacion(vida, m, null, recargar) }, '+ Evaluación'),
      m.evaluaciones.some((ev) => ev.nota == null) ? h('button', { class: 'btn ghost', onclick: () => simulador(m) }, '🔮 Simular') : null,
      h('button', { class: 'btn ghost', onclick: () => formTarea(vida, null, materias, recargar, { materia_id: m.id }) }, '+ Tarea'),
      h('button', { class: 'btn ghost', onclick: () => formMateria(vida, m, recargar) }, 'Editar')),
  );
}

export async function renderUniversidad(cont, ctx) {
  const { vida } = ctx;
  const recargar = () => renderUniversidad(cont, ctx);
  const { items, promedio, proximas } = await vida.universidad.listado();
  const activas = items.filter((m) => m.activa);
  const anteriores = items.filter((m) => !m.activa);

  fill(cont,
    h('section', { class: 'hero hero-uni' },
      h('span', { class: 'hero-label' }, 'Promedio del semestre'),
      h('strong', { class: 'hero-amount' }, promedio != null ? promedio.toFixed(2) : '—'),
      h('small', {}, activas.length ? `${activas.length} materia${activas.length === 1 ? '' : 's'} en curso · ponderado por créditos` : 'Agrega tus materias del semestre')),
    proximas.length ? h('section', { class: 'card' }, h('h3', {}, 'Próximas evaluaciones'),
      h('ul', { class: 'list compact' }, proximas.slice(0, 5).map((e) => h('li', { class: 'list-item static' },
        h('i', { class: 'swatch', style: `--c:${e.materia?.color}` }),
        h('span', { class: 'grow' }, h('strong', {}, e.nombre), h('small', { class: 'muted' }, `${e.materia?.nombre} · ${Number(e.porcentaje)}%`)),
        h('span', { class: 'pill' }, fmtDate(e.fecha)))))) : null,
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formMateria(vida, null, recargar) }, '+ Nueva materia')),
    items.length ? null : emptyState('🎓', 'Sin materias', 'Agrega tus materias con sus porcentajes y te digo cuánto necesitas para pasar.'),
    activas.map((m) => tarjeta(vida, m, items, recargar)),
    anteriores.length ? h('h4', { class: 'section-title' }, 'Semestres anteriores') : null,
    anteriores.map((m) => tarjeta(vida, m, items, recargar)),
  );
}
