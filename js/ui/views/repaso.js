// Tarjetas de repaso (flashcards) con repetición espaciada.
import { h, fill, emptyState, formulario, toast, tabs } from '../dom.js';
import { fmtDate } from '../../core/format.js';

let pestana = 'repasar';
let filtro = 'todas';
let sesion = null; // { cola: [], hechas: 0, aciertos: 0, volteada: false }

function formTarjeta(fc, t, materias, recargar) {
  formulario({
    titulo: t ? 'Editar tarjeta' : 'Nueva tarjeta',
    valores: t || { materia_id: filtro !== 'todas' ? filtro : materias.find((m) => m.activa)?.id },
    campos: [
      { name: 'materia_id', label: 'Materia', type: 'select', options: [['', '— General —'], ...materias.filter((m) => m.activa || m.id === t?.materia_id).map((m) => [m.id, m.nombre])] },
      { name: 'frente', label: 'Pregunta (frente)', type: 'textarea', rows: 3, required: true, placeholder: 'Ej: ¿Qué es la tercera forma normal?' },
      { name: 'reverso', label: 'Respuesta (reverso)', type: 'textarea', rows: 4, required: true },
    ],
    onSubmit: async (d) => { await fc.guardar(t?.id, d); toast(t ? 'Tarjeta guardada' : 'Tarjeta agregada 🃏'); recargar(); },
    onEliminar: t ? async () => { await fc.eliminar(t.id); recargar(); } : null,
  });
}

function vistaSesion(cont, ctx, materias, recargar) {
  const { flashcards: fc } = ctx;
  const t = sesion.cola[0];
  const materia = materias.find((m) => m.id === t?.materia_id);
  if (!t) {
    const pct = sesion.hechas ? Math.round((sesion.aciertos / sesion.hechas) * 100) : 0;
    fill(cont, h('section', { class: 'focus' },
      h('div', { class: 'empty-icon' }, pct >= 80 ? '🏆' : '💪'),
      h('h2', {}, '¡Repaso terminado!'),
      h('p', { class: 'muted' }, `${sesion.hechas} tarjetas · ${pct}% las sabías. Las que fallaste vuelven mañana.`),
      h('button', { class: 'btn primary', onclick: () => { sesion = null; recargar(); } }, 'Listo')));
    return;
  }
  const responder = async (acierto) => {
    await fc.responder(t, acierto);
    sesion.hechas++; if (acierto) sesion.aciertos++;
    sesion.cola.shift(); sesion.volteada = false;
    vistaSesion(cont, ctx, materias, recargar);
  };
  fill(cont,
    h('div', { class: 'row-between' },
      h('small', { class: 'muted' }, `${sesion.hechas + 1} de ${sesion.hechas + sesion.cola.length}`),
      h('button', { class: 'link', onclick: () => { sesion = null; recargar(); } }, 'Terminar')),
    h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: `width:${(sesion.hechas / (sesion.hechas + sesion.cola.length)) * 100}%` })),
    h('button', { class: `flashcard ${sesion.volteada ? 'flipped' : ''}`, style: materia ? `--c:${materia.color}` : null,
      'aria-label': sesion.volteada ? 'Respuesta' : 'Pregunta. Toca para ver la respuesta',
      onclick: () => { sesion.volteada = true; vistaSesion(cont, ctx, materias, recargar); } },
      h('small', {}, materia?.nombre || 'General'),
      h('p', { class: 'fc-front' }, t.frente),
      sesion.volteada ? h('p', { class: 'fc-back' }, t.reverso) : h('span', { class: 'muted' }, 'Toca para ver la respuesta')),
    sesion.volteada ? h('div', { class: 'action-row' },
      h('button', { class: 'btn expense', onclick: () => responder(false) }, '✗ No la sabía'),
      h('button', { class: 'btn income', onclick: () => responder(true) }, '✓ La sabía')) : null,
  );
}

export async function renderRepaso(cont, ctx) {
  const { flashcards: fc } = ctx;
  const recargar = () => renderRepaso(cont, ctx);
  const { tarjetas, materias, pendientes } = await fc.datos();
  if (sesion) { vistaSesion(cont, ctx, materias, recargar); return; }
  const nombre = (id) => materias.find((m) => m.id === id)?.nombre || 'General';
  const porMateria = new Map();
  for (const t of pendientes) porMateria.set(t.materia_id || '', (porMateria.get(t.materia_id || '') || 0) + 1);
  const empezar = (lista) => { sesion = { cola: [...lista].sort(() => Math.random() - 0.5), hechas: 0, aciertos: 0, volteada: false }; recargar(); };
  const visibles = filtro === 'todas' ? tarjetas : tarjetas.filter((t) => (t.materia_id || '') === filtro);

  fill(cont,
    tabs([['repasar', `Repasar (${pendientes.length})`], ['tarjetas', `Mis tarjetas (${tarjetas.length})`]], pestana, (p) => { pestana = p; recargar(); }),
    pestana === 'repasar' ? [
      h('section', { class: 'hero' },
        h('span', { class: 'hero-label' }, 'Para repasar hoy'),
        h('strong', { class: 'hero-amount' }, `${pendientes.length} tarjeta${pendientes.length === 1 ? '' : 's'}`),
        h('small', {}, 'Las que aciertas vuelven en 1, 2, 4, 8 y 16 días. Las que fallas, mañana.')),
      pendientes.length ? [
        h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => empezar(pendientes) }, `Repasar todas (${pendientes.length})`)),
        h('ul', { class: 'list' }, [...porMateria.entries()].map(([id, n]) => h('li', {}, h('button', { class: 'list-item', onclick: () => empezar(pendientes.filter((t) => (t.materia_id || '') === id)) },
          h('span', { class: 'grow' }, h('strong', {}, nombre(id || null)), h('small', { class: 'muted' }, `${n} pendiente${n === 1 ? '' : 's'}`)), h('span', { class: 'muted' }, 'Repasar ›'))))),
      ] : emptyState('✅', tarjetas.length ? 'Nada pendiente por hoy' : 'Aún no tienes tarjetas', tarjetas.length ? 'Vuelve mañana: tus tarjetas aparecen cuando toca repasarlas.' : 'Crea tarjetas con preguntas de tus materias y repásalas unos minutos al día.'),
    ] : [
      h('div', { class: 'toolbar' },
        h('div', { class: 'chips scroll' }, [['todas', 'Todas'], ...materias.filter((m) => m.activa).map((m) => [m.id, m.nombre])].map(([v, l]) =>
          h('button', { class: `chip ${filtro === v ? 'active' : ''}`, onclick: () => { filtro = v; recargar(); } }, l))),
        h('button', { class: 'btn primary', onclick: () => formTarjeta(fc, null, materias, recargar) }, '+ Tarjeta')),
      visibles.length ? h('ul', { class: 'list' }, visibles.map((t) => h('li', {}, h('button', { class: 'list-item', onclick: () => formTarjeta(fc, t, materias, recargar) },
        h('span', { class: 'fc-box', title: `Caja ${t.caja} de 5` }, String(t.caja)),
        h('span', { class: 'grow' }, h('strong', {}, t.frente), h('small', { class: 'muted' }, `${nombre(t.materia_id)} · próxima ${fmtDate(t.proxima)}`))))))
        : emptyState('🃏', 'Sin tarjetas', 'Crea tu primera tarjeta: una pregunta de un lado y la respuesta del otro.'),
    ],
  );
}
