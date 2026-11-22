import { h, fill, emptyState, formulario, toast, checkCircle, progressBar } from '../dom.js';
import { today, addDays, weekday, fmtPct } from '../../core/format.js';
import { tocaEnFecha } from '../../domain/vida.js';

const ICONOS = ['✅', '📚', '🏃', '💧', '🧘', '💪', '🛏️', '🍎', '✍️', '🎸', '💻', '🙏', '🚭', '🧹'];
const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DIAS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];

function formHabito(vida, hab, recargar) {
  formulario({
    titulo: hab ? 'Editar hábito' : 'Nuevo hábito',
    valores: hab || { icono: '✅', dias: [0, 1, 2, 3, 4, 5, 6], activo: true },
    campos: [
      { name: 'icono', label: 'Ícono', type: 'emoji', options: ICONOS },
      { name: 'nombre', label: 'Hábito', required: true, placeholder: 'Ej: Leer 20 minutos' },
      { name: 'dias', label: '¿Qué días?', type: 'dias', options: DIAS },
      hab ? { name: 'activo', label: 'Activo', type: 'checkbox' } : null,
    ].filter(Boolean),
    validar: (d) => { if (!d.dias.length) throw new Error('Elige al menos un día.'); },
    onSubmit: async (d) => { await vida.habitos.guardar(hab?.id, hab ? d : { ...d, activo: true }); toast('Hábito guardado 🌱'); recargar(); },
    onEliminar: hab ? async () => { await vida.habitos.eliminar(hab.id); toast('Hábito eliminado'); recargar(); } : null,
  });
}

function tarjeta(vida, x, hoy, recargar) {
  const semana = Array.from({ length: 7 }, (_, i) => addDays(hoy, i - 6));
  return h('article', { class: `card habit-card ${x.activo ? '' : 'done'}` },
    h('div', { class: 'row-between' },
      h('div', { class: 'meta-title' }, h('span', { class: 'meta-icon habit' }, x.icono),
        h('div', {}, h('h3', {}, x.nombre),
          h('small', { class: 'muted' }, x.dias.length === 7 ? 'Todos los días' : DIAS.filter(([d]) => x.dias.includes(d)).map(([, l]) => l).join(' ')))),
      x.tocaHoy && x.activo
        ? checkCircle(x.hechoHoy, async () => { await vida.habitos.alternar(x.id, hoy, x.hechoHoy); if (!x.hechoHoy) toast(`¡${x.nombre}! 🔥`); recargar(); }, 'Hecho hoy')
        : h('small', { class: 'muted' }, 'Hoy descansa')),
    h('div', { class: 'week-dots' }, semana.map((iso) => {
      const toca = tocaEnFecha(x, iso);
      const hecho = x.fechas.has(iso);
      return h('button', {
        class: `wd ${hecho ? 'on' : ''} ${toca ? '' : 'off'} ${iso === hoy ? 'today' : ''}`,
        title: iso, disabled: !toca || !x.activo,
        onclick: async () => { await vida.habitos.alternar(x.id, iso, hecho); recargar(); },
      }, h('small', {}, LETRAS[weekday(iso)]), h('span', {}, hecho ? '✓' : ''));
    })),
    h('div', { class: 'row-between' },
      h('span', { class: 'streak' }, x.racha ? `🔥 ${x.racha} día${x.racha === 1 ? '' : 's'} seguido${x.racha === 1 ? '' : 's'}` : 'Empieza tu racha hoy'),
      h('small', { class: 'muted' }, `${fmtPct(x.cumplimiento)} en 30 días`)),
    progressBar(x.cumplimiento, 'meta'),
    h('div', { class: 'card-actions' }, h('button', { class: 'btn ghost', onclick: () => formHabito(vida, x, recargar) }, 'Editar')),
  );
}

export async function renderHabitos(cont, ctx) {
  const { vida } = ctx;
  const recargar = () => renderHabitos(cont, ctx);
  const hoy = today();
  const items = await vida.habitos.listado(hoy);
  const activos = items.filter((x) => x.activo);
  const deHoy = activos.filter((x) => x.tocaHoy);
  const hechos = deHoy.filter((x) => x.hechoHoy).length;

  fill(cont,
    h('section', { class: 'hero hero-habit' },
      h('span', { class: 'hero-label' }, 'Hábitos de hoy'),
      h('strong', { class: 'hero-amount' }, `${hechos} / ${deHoy.length}`),
      progressBar(deHoy.length ? hechos / deHoy.length : 0, 'light'),
      h('small', {}, deHoy.length && hechos === deHoy.length ? '¡Día completo! 🎉' : 'Cada día cuenta.')),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formHabito(vida, null, recargar) }, '+ Nuevo hábito')),
    items.length ? null : emptyState('🌱', 'Sin hábitos todavía', 'Empieza con uno pequeño: leer 10 minutos o tomar agua.'),
    activos.map((x) => tarjeta(vida, x, hoy, recargar)),
    items.length > activos.length ? h('h4', { class: 'section-title' }, 'Pausados') : null,
    items.filter((x) => !x.activo).map((x) => tarjeta(vida, x, hoy, recargar)),
  );
}
