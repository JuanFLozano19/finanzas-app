import { h, fill, emptyState, formulario, toast, progressBar, checkCircle } from '../dom.js';
import { fmtDate, fmtPct, today } from '../../core/format.js';
import { parseIntegrantes } from '../../domain/vida.js';

function formProyecto(grupos, p, materias, recargar) {
  formulario({
    titulo: p ? 'Editar trabajo en grupo' : 'Nuevo trabajo en grupo',
    valores: p ? { ...p, integrantes: (p.integrantes || []).map((i) => (i.contacto ? `${i.nombre} - ${i.contacto}` : i.nombre)).join('\n') } : {},
    campos: [
      { name: 'nombre', label: 'Trabajo', required: true, placeholder: 'Ej: Proyecto integrador AppoinTech' },
      { name: 'materia_id', label: 'Materia', type: 'select', options: [['', '— Ninguna —'], ...materias.filter((m) => m.activa).map((m) => [m.id, m.nombre])] },
      { name: 'fecha_entrega', label: 'Fecha de entrega', type: 'date' },
      { name: 'integrantes', label: 'Integrantes (uno por línea, "Nombre - contacto")', type: 'textarea', rows: 4, placeholder: 'Ana - 3001234567\nLuis - luis@correo.com' },
      { name: 'notas', label: 'Notas', type: 'textarea' },
      p ? { name: 'terminado', label: 'Trabajo entregado', type: 'checkbox' } : null,
    ].filter(Boolean),
    onSubmit: async (d) => { await grupos.guardar(p?.id, { ...d, integrantes: parseIntegrantes(d.integrantes) }); toast('Trabajo guardado 👥'); recargar(); },
    onEliminar: p ? async () => { await grupos.eliminar(p.id); toast('Trabajo eliminado'); recargar(); } : null,
  });
}

function formParte(grupos, p, parte, recargar) {
  const quienes = [['Yo', 'Yo'], ...(p.integrantes || []).map((i) => [i.nombre, i.nombre])];
  formulario({
    titulo: parte ? 'Editar parte' : `Nueva parte · ${p.nombre}`,
    valores: parte || { responsable: 'Yo', fecha_limite: p.fecha_entrega },
    campos: [
      { name: 'titulo', label: '¿Qué hay que hacer?', required: true, placeholder: 'Ej: Diagrama entidad-relación' },
      { name: 'responsable', label: '¿Quién?', type: 'select', options: quienes },
      { name: 'fecha_limite', label: 'Para cuándo', type: 'date' },
    ],
    onSubmit: async (d) => { await grupos.guardarParte(parte?.id, { ...d, proyecto_id: p.id, materia_id: p.materia_id }); toast('Parte guardada'); recargar(); },
    onEliminar: parte ? async () => { await grupos.eliminarParte(parte.id); recargar(); } : null,
  });
}

export async function renderGrupos(cont, ctx) {
  const { grupos } = ctx;
  const recargar = () => renderGrupos(cont, ctx);
  const { items, materias } = await grupos.listado();
  const hoy = today();
  const materia = (id) => materias.find((m) => m.id === id);
  const tarjeta = (p) => h('article', { class: `card item-card ${p.terminado ? 'done' : ''}`, style: materia(p.materia_id) ? `border-top:4px solid ${materia(p.materia_id).color}` : null },
    h('div', { class: 'row-between' },
      h('div', {}, h('h3', {}, p.nombre), h('small', { class: 'muted' }, [materia(p.materia_id)?.nombre, p.fecha_entrega ? `Entrega ${fmtDate(p.fecha_entrega)}` : null].filter(Boolean).join(' · '))),
      p.terminado ? h('span', { class: 'badge ok' }, 'Entregado') : p.fecha_entrega && p.fecha_entrega < hoy ? h('span', { class: 'badge late' }, 'Vencido') : h('span', { class: 'badge meta' }, fmtPct(p.avance))),
    progressBar(p.avance, 'subject'),
    (p.integrantes || []).length ? h('div', { class: 'tags' }, p.integrantes.map((i) => h('span', { class: 'tag', title: i.contacto || '' }, `👤 ${i.nombre}${i.contacto ? ` · ${i.contacto}` : ''}`))) : null,
    p.partes.length ? h('ul', { class: 'tasks' }, p.partes.map((t) => h('li', { class: `task ${t.hecha ? 'done' : ''}` },
      checkCircle(t.hecha, async () => { await grupos.marcarParte(t); recargar(); }, t.hecha ? 'Marcar pendiente' : 'Marcar hecha'),
      h('button', { class: 'task-body', onclick: () => formParte(grupos, p, t, recargar) },
        h('span', { class: 'task-title' }, t.titulo),
        h('span', { class: 'task-meta' }, h('span', { class: `pill ${/^yo$/i.test(t.responsable || '') ? 'high' : ''}` }, `👤 ${t.responsable || 'Sin asignar'}`),
          t.fecha_limite ? h('span', { class: `pill ${!t.hecha && t.fecha_limite < hoy ? 'late' : ''}` }, fmtDate(t.fecha_limite)) : null))))) : h('p', { class: 'muted' }, 'Divide el trabajo en partes y asigna quién hace cada una.'),
    p.notas ? h('p', { class: 'muted notes' }, p.notas) : null,
    h('div', { class: 'card-actions' },
      !p.terminado ? h('button', { class: 'btn primary', onclick: () => formParte(grupos, p, null, recargar) }, '+ Parte') : null,
      h('button', { class: 'btn ghost', onclick: () => formProyecto(grupos, p, materias, recargar) }, 'Editar')));

  fill(cont,
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formProyecto(grupos, null, materias, recargar) }, '+ Trabajo en grupo')),
    items.length ? [items.filter((p) => !p.terminado).map(tarjeta),
      items.some((p) => p.terminado) ? h('h4', { class: 'section-title' }, 'Entregados') : null,
      items.filter((p) => p.terminado).map(tarjeta)]
      : emptyState('👥', 'Sin trabajos en grupo', 'Anota quién hace qué y para cuándo. Las partes que te tocan aparecen en tus Tareas.'),
  );
}
