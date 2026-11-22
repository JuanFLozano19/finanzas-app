import { h, fill, emptyState, formulario, toast, tabs } from '../dom.js';
import { today, fmtDate, fmtDayLong } from '../../core/format.js';

const ANIMOS = [[5, '😄 Excelente'], [4, '🙂 Bien'], [3, '😐 Normal'], [2, '😕 Regular'], [1, '😞 Mal']];
const EMOJI = { 5: '😄', 4: '🙂', 3: '😐', 2: '😕', 1: '😞' };
let pestana = 'nota';
let busqueda = '';

function formNota(vida, n, recargar) {
  formulario({
    titulo: n ? 'Editar nota' : 'Nueva nota',
    valores: n || {},
    campos: [
      { name: 'titulo', label: 'Título', placeholder: 'Ej: Ideas para el proyecto' },
      { name: 'contenido', label: 'Contenido', type: 'textarea', rows: 8, required: true },
      { name: 'fijada', label: '📌 Fijar arriba', type: 'checkbox' },
    ],
    onSubmit: async (d) => { await vida.notas.guardar(n?.id, { ...d, tipo: 'nota', contenido: d.contenido || '' }); toast('Nota guardada'); recargar(); },
    onEliminar: n ? async () => { await vida.notas.eliminar(n.id); toast('Nota eliminada'); recargar(); } : null,
  });
}

function formDiario(vida, n, recargar) {
  formulario({
    titulo: n ? 'Editar entrada' : '¿Cómo te fue hoy?',
    valores: n ? { ...n, animo: n.animo ?? 3 } : { fecha: today(), animo: 4 },
    campos: [
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      { name: 'animo', label: '¿Cómo te sentiste?', type: 'select', options: ANIMOS },
      { name: 'contenido', label: 'Escribe sobre tu día', type: 'textarea', rows: 8, required: true,
        placeholder: '¿Qué pasó hoy? ¿Qué aprendiste? ¿De qué estás agradecido?' },
    ],
    onSubmit: async (d) => {
      await vida.notas.guardar(n?.id, { ...d, tipo: 'diario', animo: Number(d.animo) });
      toast('Entrada guardada ✍️'); recargar();
    },
    onEliminar: n ? async () => { await vida.notas.eliminar(n.id); toast('Entrada eliminada'); recargar(); } : null,
  });
}

export async function renderNotas(cont, ctx) {
  const { vida } = ctx;
  const recargar = () => renderNotas(cont, ctx);
  const items = await vida.notas.listado(pestana);
  const q = busqueda.toLowerCase();
  const visibles = q ? items.filter((n) => `${n.titulo || ''} ${n.contenido}`.toLowerCase().includes(q)) : items;
  const yaHoy = pestana === 'diario' && items.some((n) => n.fecha === today());

  const buscador = h('input', { type: 'search', class: 'search', placeholder: 'Buscar…', value: busqueda, 'aria-label': 'Buscar' });
  buscador.addEventListener('input', () => {
    busqueda = buscador.value;
    clearTimeout(buscador._t); buscador._t = setTimeout(async () => { await recargar(); const s = cont.querySelector('.search'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }, 250);
  });

  fill(cont,
    tabs([['nota', '📝 Notas'], ['diario', '📔 Diario']], pestana, (p) => { pestana = p; busqueda = ''; recargar(); }),
    h('div', { class: 'toolbar' }, buscador,
      h('button', { class: 'btn primary', onclick: () => (pestana === 'nota' ? formNota : formDiario)(vida, null, recargar) },
        pestana === 'nota' ? '+ Nota' : (yaHoy ? '+ Entrada' : '+ Escribir hoy'))),
    !visibles.length ? (pestana === 'nota'
      ? emptyState('📝', q ? 'Sin resultados' : 'Sin notas', 'Guarda ideas, listas y apuntes rápidos.')
      : emptyState('📔', q ? 'Sin resultados' : 'Tu diario está vacío', 'Escribe unas líneas sobre tu día. En unas semanas vas a agradecer haberlo hecho.'))
      : pestana === 'nota'
        ? h('div', { class: 'notes-grid' }, visibles.map((n) => h('button', { class: `note ${n.fijada ? 'pinned' : ''}`, onclick: () => formNota(vida, n, recargar) },
          n.fijada ? h('span', { class: 'pin' }, '📌') : null,
          n.titulo ? h('strong', {}, n.titulo) : null,
          h('p', {}, n.contenido.length > 220 ? `${n.contenido.slice(0, 220)}…` : n.contenido),
          h('small', { class: 'muted' }, fmtDate(n.updated_at.slice(0, 10))))))
        : h('div', { class: 'journal' }, visibles.map((n) => h('button', { class: 'card journal-entry', onclick: () => formDiario(vida, n, recargar) },
          h('div', { class: 'row-between' }, h('strong', {}, fmtDayLong(n.fecha)), h('span', { class: 'mood' }, EMOJI[n.animo] || '')),
          h('p', {}, n.contenido.length > 300 ? `${n.contenido.slice(0, 300)}…` : n.contenido)))),
  );
}
