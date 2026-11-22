import { h, fill, emptyState, formulario, toast, confirmar } from '../dom.js';
import { fmtDate } from '../../core/format.js';

let filtro = 'todas';
let busqueda = '';

function formApunte(apuntesSvc, a, materias, recargar) {
  formulario({
    titulo: a ? 'Editar apunte' : 'Nuevo apunte',
    valores: a || { materia_id: filtro !== 'todas' ? filtro : materias[0]?.id },
    campos: [
      { name: 'titulo', label: 'Título', required: true, placeholder: 'Ej: Normalización 3FN' },
      { name: 'materia_id', label: 'Materia', type: 'select', options: [['', '— General —'], ...materias.map((m) => [m.id, m.nombre])] },
      { name: 'contenido', label: 'Apunte', type: 'textarea', rows: 6 },
      { name: 'enlace', label: 'Enlace (Drive, video, página)', type: 'url', placeholder: 'https://…' },
      { name: 'archivo', label: a?.archivo_nombre ? `Reemplazar archivo (${a.archivo_nombre})` : 'Archivo: PDF, foto del tablero, documento (máx. 20 MB)', type: 'file',
        accept: 'image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip' },
    ],
    onSubmit: async (d) => { await apuntesSvc.guardar(a?.id, d, a); toast('Apunte guardado 📎'); recargar(); },
    onEliminar: a ? async () => { await apuntesSvc.eliminar(a); toast('Apunte eliminado'); recargar(); } : null,
  });
}

export async function renderApuntes(cont, ctx) {
  const { apuntes: svc } = ctx;
  const recargar = () => renderApuntes(cont, ctx);
  const { apuntes, materias } = await svc.listado();
  const q = busqueda.toLowerCase();
  const visibles = apuntes
    .filter((a) => filtro === 'todas' || a.materia_id === filtro || (filtro === 'general' && !a.materia_id))
    .filter((a) => !q || `${a.titulo} ${a.contenido || ''} ${a.archivo_nombre || ''}`.toLowerCase().includes(q));
  const materia = (id) => materias.find((m) => m.id === id);

  const buscador = h('input', { type: 'search', class: 'search', placeholder: 'Buscar en apuntes…', value: busqueda, 'aria-label': 'Buscar' });
  buscador.addEventListener('input', () => {
    busqueda = buscador.value;
    clearTimeout(buscador._t); buscador._t = setTimeout(async () => { await recargar(); const s = cont.querySelector('.search'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }, 250);
  });

  fill(cont,
    h('div', { class: 'toolbar' }, buscador, h('button', { class: 'btn primary', onclick: () => formApunte(svc, null, materias, recargar) }, '+ Apunte')),
    h('div', { class: 'chips scroll' },
      [['todas', 'Todas'], ...materias.filter((m) => m.activa).map((m) => [m.id, m.nombre]), ['general', 'General']].map(([v, l]) =>
        h('button', { class: `chip ${filtro === v ? 'active' : ''}`, onclick: () => { filtro = v; recargar(); } }, l))),
    visibles.length ? h('div', { class: 'notes-grid' }, visibles.map((a) => h('article', { class: 'note', style: `border-top:4px solid ${materia(a.materia_id)?.color || 'var(--border)'}` },
      h('button', { class: 'plain', onclick: () => formApunte(svc, a, materias, recargar) },
        h('strong', {}, a.titulo),
        h('small', { class: 'muted' }, `${materia(a.materia_id)?.nombre || 'General'} · ${fmtDate(a.created_at.slice(0, 10))}`),
        a.contenido ? h('p', {}, a.contenido.length > 200 ? `${a.contenido.slice(0, 200)}…` : a.contenido) : null),
      h('div', { class: 'note-actions' },
        a.enlace ? h('a', { class: 'chip', href: a.enlace, target: '_blank', rel: 'noopener' }, '🔗 Abrir enlace') : null,
        a.archivo_path ? h('button', { class: 'chip', onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try { const url = await svc.urlArchivo(a); const link = h('a', { href: url, target: '_blank', rel: 'noopener' }); document.body.append(link); link.click(); link.remove(); }
          catch (err) { toast(err.message, 'error'); } finally { b.disabled = false; }
        } }, `📎 ${a.archivo_nombre}`) : null,
        a.archivo_path ? h('button', { class: 'icon-btn', 'aria-label': 'Quitar archivo', onclick: async () => {
          if (await confirmar(`¿Quitar el archivo ${a.archivo_nombre}?`)) { await svc.quitarArchivo(a); recargar(); }
        } }, '🗑') : null))))
      : emptyState('📚', q ? 'Sin resultados' : 'Sin apuntes', 'Guarda resúmenes, enlaces y fotos del tablero organizados por materia.'),
  );
}
