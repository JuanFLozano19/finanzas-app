import { h, fill, emptyState, formulario, toast } from '../dom.js';
import { today, fmtDate } from '../../core/format.js';

const TIPOS = ['Gimnasio', 'Correr', 'Caminar', 'Fútbol', 'Bicicleta', 'Natación', 'Yoga', 'Ejercicio en casa', 'Baloncesto'];
const INTENSIDAD = [[1, 'Suave'], [2, 'Moderada'], [3, 'Intensa']];

function formEntreno(vida, en, recargar) {
  formulario({
    titulo: en ? 'Editar entrenamiento' : 'Nuevo entrenamiento',
    valores: en || { fecha: today(), intensidad: 2 },
    campos: [
      { name: 'tipo', label: 'Actividad', required: true, list: TIPOS, placeholder: 'Ej: Gimnasio' },
      { name: 'duracion_min', label: 'Duración (minutos)', type: 'number', min: '1', step: '1', required: true },
      { name: 'intensidad', label: 'Intensidad', type: 'select', options: INTENSIDAD },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      { name: 'notas', label: 'Notas (opcional)', type: 'textarea', placeholder: 'Ej: pecho y tríceps' },
    ],
    onSubmit: async (d) => { await vida.salud.guardarEntrenamiento(en?.id, { ...d, intensidad: Number(d.intensidad) }); toast('Entrenamiento guardado 💪'); recargar(); },
    onEliminar: en ? async () => { await vida.salud.eliminarEntrenamiento(en.id); toast('Eliminado'); recargar(); } : null,
  });
}

function formHoy(vida, reg, recargar) {
  formulario({
    titulo: 'Registro de hoy',
    valores: reg,
    campos: [
      { name: 'horas_sueno', label: '¿Cuántas horas dormiste?', type: 'number', min: '0', step: '0.5' },
      { name: 'peso_kg', label: 'Peso (kg, opcional)', type: 'number', min: '1', step: '0.1' },
      { name: 'vasos_agua', label: 'Vasos de agua', type: 'number', min: '0', step: '1' },
    ],
    onSubmit: async (d) => { await vida.salud.guardarRegistro({ fecha: reg.fecha, ...d }); toast('Registro guardado'); recargar(); },
  });
}

export async function renderSalud(cont, ctx) {
  const { vida } = ctx;
  const recargar = () => renderSalud(cont, ctx);
  const { entrenamientos, hoy, semana, metaAgua: META_AGUA, registros } = await vida.salud.listado();
  const agua = hoy.vasos_agua ?? 0;
  const cambiarAgua = async (n) => {
    const v = Math.max(0, agua + n);
    await vida.salud.guardarRegistro({ fecha: hoy.fecha, vasos_agua: v });
    if (v === META_AGUA && n > 0) toast('¡Meta de agua cumplida! 💧');
    recargar();
  };
  const deltaPeso = semana.pesoActual != null && semana.pesoAnterior != null ? semana.pesoActual - semana.pesoAnterior : null;

  fill(cont,
    h('section', { class: 'hero hero-health' },
      h('span', { class: 'hero-label' }, 'Agua de hoy'),
      h('div', { class: 'water' },
        h('button', { class: 'round-btn', 'aria-label': 'Quitar un vaso', onclick: () => cambiarAgua(-1), disabled: agua === 0 }, '−'),
        h('div', { class: 'glasses' }, Array.from({ length: Math.max(META_AGUA, agua) }, (_, i) => h('span', { class: i < agua ? 'on' : '' }, '💧'))),
        h('button', { class: 'round-btn', 'aria-label': 'Agregar un vaso', onclick: () => cambiarAgua(1) }, '+')),
      h('button', { class: 'link light', onclick: () => formulario({
        titulo: 'Meta de agua', valores: { meta: META_AGUA },
        campos: [{ name: 'meta', label: 'Vasos al día', type: 'number', min: '1', step: '1', required: true, hint: 'Activa el recordatorio de agua en Ajustes → Notificaciones.' }],
        validar: (d) => { if (d.meta < 1 || d.meta > 30) throw new Error('Pon una meta entre 1 y 30 vasos.'); },
        onSubmit: async (d) => { await vida.salud.guardarMetaAgua(d.meta); toast('Meta guardada 💧'); recargar(); },
      }) }, `${agua} de ${META_AGUA} vasos · cambiar meta`)),

    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('small', {}, 'Ejercicio (7 días)'), h('b', {}, `${semana.minutosEjercicio} min`), h('small', { class: 'muted' }, `${semana.sesiones} sesiones`)),
      h('div', { class: 'stat' }, h('small', {}, 'Sueño promedio'), h('b', {}, semana.suenoPromedio != null ? `${semana.suenoPromedio} h` : '—'),
        h('small', { class: 'muted' }, hoy.horas_sueno != null ? `Anoche: ${hoy.horas_sueno} h` : 'Sin registro hoy')),
      h('div', { class: 'stat' }, h('small', {}, 'Peso'), h('b', {}, semana.pesoActual != null ? `${semana.pesoActual} kg` : '—'),
        deltaPeso != null ? h('small', { class: 'muted' }, `${deltaPeso > 0 ? '+' : ''}${deltaPeso.toFixed(1)} kg vs. anterior`) : null),
      h('button', { class: 'stat stat-action', onclick: () => formHoy(vida, hoy, recargar) }, h('small', {}, 'Registro diario'), h('b', {}, '✏️ Sueño y peso')),
    ),

    h('div', { class: 'row-between' }, h('h3', {}, 'Entrenamientos'),
      h('button', { class: 'btn primary small', onclick: () => formEntreno(vida, null, recargar) }, '+ Entrenamiento')),
    entrenamientos.length ? h('ul', { class: 'list' }, entrenamientos.slice(0, 30).map((e) => h('li', {},
      h('button', { class: 'list-item', onclick: () => formEntreno(vida, e, recargar) },
        h('span', { class: 'dot health' }, '💪'),
        h('span', { class: 'grow' }, h('strong', {}, e.tipo), h('small', { class: 'muted' }, [fmtDate(e.fecha), e.notas].filter(Boolean).join(' · '))),
        h('span', { class: 'right' }, h('b', {}, `${e.duracion_min} min`),
          e.intensidad ? h('small', { class: 'muted' }, INTENSIDAD.find(([v]) => v === e.intensidad)?.[1]) : null)))))
      : emptyState('🏃', 'Sin entrenamientos', 'Registra lo que entrenas y mira cuántos minutos sumas a la semana.'),
  );
}
