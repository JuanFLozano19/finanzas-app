// Pantallas de bienestar: rutinas, metas de vida, lectura, contactos, enfoque y revisión semanal.
import { h, fill, emptyState, formulario, toast, progressBar, checkCircle, confirmar, money } from '../dom.js';
import { today, fmtDate, fmtDayLong, fmtPct, fmtTime, startOfWeek, addDays } from '../../core/format.js';
import { enlaceWhatsApp } from '../../domain/bienestar.js';

// ================= Rutinas =================
export async function renderRutinas(cont, ctx) {
  const { bienestar } = ctx;
  const recargar = () => renderRutinas(cont, ctx);
  const r = await bienestar.rutinas();
  const hora = new Date().getHours();
  const bloque = (momento, titulo, items, ejemplo) => {
    const hechos = items.filter((i) => i.hecho).length;
    const input = h('input', { class: 'search', placeholder: ejemplo, 'aria-label': `Agregar a ${titulo}` });
    return h('section', { class: `card routine ${(momento === 'manana') === (hora < 15) ? 'now' : ''}` },
      h('div', { class: 'row-between' }, h('h3', {}, titulo), h('span', { class: `badge ${items.length && hechos === items.length ? 'ok' : 'meta'}` }, `${hechos}/${items.length}`)),
      items.length ? progressBar(hechos / items.length) : null,
      h('ul', { class: 'tasks' }, items.map((i) => h('li', { class: `task ${i.hecho ? 'done' : ''}` },
        checkCircle(i.hecho, async () => { await bienestar.alternarRutina(i); recargar(); }, i.texto),
        h('button', { class: 'task-body', onclick: () => formulario({
          titulo: 'Editar paso de la rutina', valores: { texto: i.texto },
          campos: [{ name: 'texto', label: 'Paso', required: true }],
          onSubmit: async ({ texto }) => { await bienestar.editarRutina(i.id, texto); recargar(); },
          onEliminar: async () => { await bienestar.eliminarRutina(i.id); recargar(); },
        }) }, h('span', { class: 'task-title' }, i.texto))))),
      h('form', { class: 'toolbar', onsubmit: async (e) => {
        e.preventDefault(); const v = input.value.trim(); if (!v) return;
        await bienestar.agregarRutina(momento, v, items.length); recargar();
      } }, input, h('button', { class: 'btn primary small', type: 'submit' }, '+')),
      items.length && hechos === items.length ? h('p', { class: 'meta-msg' }, momento === 'manana' ? '¡Arrancaste el día con todo! ☀️' : '¡Día cerrado! A descansar 🌙') : null);
  };
  fill(cont,
    h('p', { class: 'muted' }, 'Listas cortas que se reinician cada día. Márcalas al levantarte y antes de dormir.'),
    bloque('manana', '☀️ Rutina de la mañana', r.manana, 'Ej: Tomar agua, tender la cama…'),
    bloque('noche', '🌙 Rutina de la noche', r.noche, 'Ej: Preparar maleta, leer 10 min…'),
  );
}

// ================= Metas de vida =================
const ICONOS_VIDA = ['⭐', '🎓', '🗣️', '🏍️', '🚗', '🏠', '✈️', '💼', '💪', '🎸', '📚', '💰', '❤️', '🧠'];

function formMetaVida(bienestar, m, recargar) {
  formulario({
    titulo: m ? 'Editar meta de vida' : 'Nueva meta de vida',
    valores: m || { icono: '⭐' },
    campos: [
      { name: 'icono', label: 'Ícono', type: 'emoji', options: ICONOS_VIDA },
      { name: 'titulo', label: 'Meta', required: true, placeholder: 'Ej: Graduarme, aprender inglés, sacar la moto' },
      { name: 'descripcion', label: '¿Por qué es importante para ti?', type: 'textarea' },
      { name: 'fecha_objetivo', label: '¿Para cuándo? (opcional)', type: 'date' },
      m ? { name: 'completada', label: '¡La logré!', type: 'checkbox' } : null,
    ].filter(Boolean),
    onSubmit: async (d) => { await bienestar.guardarMetaVida(m?.id, d); toast(d.completada && !m?.completada ? '¡Felicitaciones! 🏆' : 'Meta guardada'); recargar(); },
    onEliminar: m ? async () => { await bienestar.eliminarMetaVida(m.id); toast('Meta eliminada'); recargar(); } : null,
  });
}

export async function renderMetasVida(cont, ctx) {
  const { bienestar } = ctx;
  const recargar = () => renderMetasVida(cont, ctx);
  const metas = await bienestar.metasVida();
  const tarjeta = (m) => {
    const input = h('input', { class: 'search', placeholder: 'Siguiente paso…', 'aria-label': 'Nuevo paso' });
    return h('article', { class: `card item-card ${m.completada ? 'done' : ''}` },
      h('div', { class: 'row-between' },
        h('div', { class: 'meta-title' }, h('span', { class: 'meta-icon' }, m.icono),
          h('div', {}, h('h3', {}, m.titulo), m.fecha_objetivo ? h('small', { class: 'muted' }, `Para ${fmtDate(m.fecha_objetivo)}`) : null)),
        h('span', { class: `badge ${m.completada ? 'ok' : 'meta'}` }, m.completada ? '🏆 Lograda' : fmtPct(m.progreso))),
      m.descripcion ? h('p', { class: 'muted notes' }, m.descripcion) : null,
      progressBar(m.completada ? 1 : m.progreso, 'meta'),
      h('ul', { class: 'tasks' }, m.pasos.map((p) => h('li', { class: `task ${p.hecho ? 'done' : ''}` },
        checkCircle(p.hecho, async () => { await bienestar.alternarPaso(p); recargar(); }, p.texto),
        h('span', { class: 'task-body' }, h('span', { class: 'task-title' }, p.texto)),
        h('button', { class: 'icon-btn', 'aria-label': 'Eliminar paso', onclick: async () => { await bienestar.eliminarPaso(p.id); recargar(); } }, '✕')))),
      !m.completada ? h('form', { class: 'toolbar', onsubmit: async (e) => {
        e.preventDefault(); const v = input.value.trim(); if (!v) return;
        await bienestar.agregarPaso(m.id, v, m.pasos.length); recargar();
      } }, input, h('button', { class: 'btn primary small', type: 'submit' }, '+ Paso')) : null,
      h('div', { class: 'card-actions' }, h('button', { class: 'btn ghost', onclick: () => formMetaVida(bienestar, m, recargar) }, 'Editar')));
  };
  fill(cont,
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formMetaVida(bienestar, null, recargar) }, '+ Meta de vida')),
    metas.length ? [metas.filter((m) => !m.completada).map(tarjeta), metas.some((m) => m.completada) ? h('h4', { class: 'section-title' }, 'Logradas 🏆') : null, metas.filter((m) => m.completada).map(tarjeta)]
      : emptyState('⭐', 'Sueña en grande, avanza en pasos', 'Escribe una meta grande y divídela en pasos pequeños que puedas marcar.'),
  );
}

// ================= Lectura y cursos =================
function formLectura(bienestar, l, recargar) {
  formulario({
    titulo: l ? 'Editar' : 'Nuevo libro o curso',
    valores: l || { tipo: 'libro', estado: 'leyendo', actual: 0 },
    campos: [
      { name: 'tipo', label: 'Tipo', type: 'select', options: [['libro', '📖 Libro'], ['curso', '🎧 Curso']] },
      { name: 'titulo', label: 'Título', required: true },
      { name: 'autor', label: 'Autor o plataforma (opcional)' },
      { name: 'total', label: 'Total (páginas o lecciones)', type: 'number', min: '1', step: '1', required: true },
      { name: 'actual', label: 'Vas en', type: 'number', min: '0', step: '1' },
      { name: 'estado', label: 'Estado', type: 'select', options: [['pendiente', 'Por empezar'], ['leyendo', 'En progreso'], ['terminado', 'Terminado']] },
    ],
    validar: (d) => { if ((d.actual || 0) > d.total) throw new Error('No puedes ir más allá del total.'); },
    onSubmit: async (d) => { await bienestar.guardarLectura(l?.id, { ...d, actual: d.actual || 0 }); toast('Guardado 📖'); recargar(); },
    onEliminar: l ? async () => { await bienestar.eliminarLectura(l.id); recargar(); } : null,
  });
}

export async function renderLectura(cont, ctx) {
  const { bienestar } = ctx;
  const recargar = () => renderLectura(cont, ctx);
  const items = await bienestar.lecturas();
  const grupo = (estado, titulo) => {
    const xs = items.filter((l) => l.estado === estado);
    return xs.length ? [h('h4', { class: 'section-title' }, titulo), xs.map((l) => {
      const unidad = l.tipo === 'libro' ? 'páginas' : 'lecciones';
      return h('article', { class: 'card item-card' },
        h('div', { class: 'row-between' },
          h('div', {}, h('h3', {}, `${l.tipo === 'libro' ? '📖' : '🎧'} ${l.titulo}`), l.autor ? h('small', { class: 'muted' }, l.autor) : null),
          h('span', { class: `badge ${l.estado === 'terminado' ? 'ok' : 'meta'}` }, fmtPct(l.progreso))),
        progressBar(l.progreso, 'meta'),
        h('small', { class: 'muted' }, `${l.actual} de ${l.total} ${unidad}`),
        h('div', { class: 'card-actions' },
          l.estado !== 'terminado' ? [5, 10, 20].map((n) => h('button', { class: 'btn ghost', onclick: async () => {
            await bienestar.avanzar(l, l.tipo === 'curso' ? Math.ceil(n / 10) : n);
            if (Number(l.actual) + n >= Number(l.total)) toast('¡Terminado! 🎉'); recargar();
          } }, `+${l.tipo === 'curso' ? Math.ceil(n / 10) : n}`)) : null,
          h('button', { class: 'btn ghost', onclick: () => formLectura(bienestar, l, recargar) }, 'Editar')));
    })] : null;
  };
  fill(cont,
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formLectura(bienestar, null, recargar) }, '+ Libro o curso')),
    items.length ? [grupo('leyendo', 'En progreso'), grupo('pendiente', 'Por empezar'), grupo('terminado', 'Terminados ✅')]
      : emptyState('📚', 'Nada en tu lista', 'Agrega lo que estás leyendo o el curso que haces. Dile al asistente "leí 20 páginas" y se actualiza.'),
  );
}

// ================= Contactos =================
const MESES = [[1, 'Enero'], [2, 'Febrero'], [3, 'Marzo'], [4, 'Abril'], [5, 'Mayo'], [6, 'Junio'], [7, 'Julio'], [8, 'Agosto'], [9, 'Septiembre'], [10, 'Octubre'], [11, 'Noviembre'], [12, 'Diciembre']];
function formContacto(bienestar, c, recargar) {
  formulario({
    titulo: c ? `Editar ${c.nombre}` : 'Nuevo contacto',
    valores: c || {},
    campos: [
      { name: 'nombre', label: 'Nombre', required: true },
      { name: 'relacion', label: 'Relación', list: ['Familia', 'Amigo', 'Pareja', 'Compañero', 'Trabajo', 'Profesor'], placeholder: 'Ej: Familia' },
      { name: 'telefono', label: 'Celular (opcional)', type: 'tel' },
      { name: 'cumple_dia', label: 'Día de cumpleaños', type: 'number', min: '1', step: '1' },
      { name: 'cumple_mes', label: 'Mes de cumpleaños', type: 'select', options: [['', '—'], ...MESES] },
      { name: 'frecuencia_dias', label: 'Recordarme hablarle cada (días)', type: 'number', min: '1', step: '1', placeholder: 'Ej: 14' },
    ],
    validar: (d) => {
      if ((d.cumple_dia && !d.cumple_mes) || (!d.cumple_dia && d.cumple_mes)) throw new Error('Pon el día y el mes del cumpleaños, o ninguno.');
      if (d.cumple_dia > 31) throw new Error('El día debe estar entre 1 y 31.');
    },
    onSubmit: async (d) => { await bienestar.guardarContacto(c?.id, { ...d, cumple_mes: d.cumple_mes ? Number(d.cumple_mes) : null }); toast('Contacto guardado'); recargar(); },
    onEliminar: c ? async () => { await bienestar.eliminarContacto(c.id); recargar(); } : null,
  });
}

export async function renderContactos(cont, ctx) {
  const { bienestar } = ctx;
  const recargar = () => renderContactos(cont, ctx);
  const { items, cumples, pendientes } = await bienestar.contactos();
  const fila = (c, extra) => h('li', { class: 'list-item static' },
    h('span', { class: 'dot health' }, c.nombre.charAt(0).toUpperCase()),
    h('button', { class: 'grow plain', onclick: () => formContacto(bienestar, c, recargar) },
      h('strong', {}, c.nombre), h('small', { class: 'muted' }, extra || [c.relacion, c.estado.desde != null ? `hablaron hace ${c.estado.desde} d` : null].filter(Boolean).join(' · ') || ' ')),
    c.telefono ? h('a', { class: 'chip', href: enlaceWhatsApp(c.telefono), target: '_blank', rel: 'noopener' }, '💬') : null,
    h('button', { class: 'chip', title: 'Hablé hoy', onclick: async () => { await bienestar.hableHoy(c); toast(`Anotado: hablaste con ${c.nombre}`); recargar(); } }, '✓ Hablé'));
  fill(cont,
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formContacto(bienestar, null, recargar) }, '+ Contacto')),
    cumples.length ? h('section', { class: 'card' }, h('h3', {}, 'Cumpleaños próximos'),
      h('ul', { class: 'list compact' }, cumples.map((c) => fila(c, c.estado.cumple.dias === 0 ? '¡Hoy es su cumpleaños! 🎉' : `${fmtDate(c.estado.cumple.fecha)} · en ${c.estado.cumple.dias} día${c.estado.cumple.dias === 1 ? '' : 's'}`)))) : null,
    pendientes.length ? h('section', { class: 'card' }, h('h3', {}, 'Hace rato no hablas con…'),
      h('ul', { class: 'list compact' }, pendientes.map((c) => fila(c, c.estado.desde != null ? `Hace ${c.estado.desde} días` : 'Aún no registras contacto')))) : null,
    items.length ? h('section', {}, h('h4', { class: 'section-title' }, `Todos (${items.length})`), h('ul', { class: 'list' }, items.map((c) => fila(c))))
      : emptyState('👥', 'Sin contactos', 'Agrega a tu familia y amigos con su cumpleaños para que nunca se te pase.'),
  );
}

// ================= Modo enfoque =================
export async function renderEnfoque(cont, ctx) {
  const { bienestar, irA } = ctx;
  const recargar = () => renderEnfoque(cont, ctx);
  const { foco, candidatas, proximo } = await bienestar.enfoque();
  const elegir = () => formulario({
    titulo: 'Elige tus 3 cosas de hoy', enviar: 'Listo',
    valores: Object.fromEntries(foco.map((t) => [`t_${t.id}`, true])),
    campos: [...foco, ...candidatas].slice(0, 25).map((t) => ({ name: `t_${t.id}`, label: `${t.titulo}${t.fecha_limite ? ` · ${fmtDate(t.fecha_limite)}` : ''}`, type: 'checkbox' })),
    validar: (d) => { if (Object.values(d).filter(Boolean).length > 3) throw new Error('Máximo 3. Lo importante es enfocarse 😉'); },
    onSubmit: async (d) => {
      for (const t of [...foco, ...candidatas]) {
        const quiere = Boolean(d[`t_${t.id}`]);
        const tiene = foco.some((f) => f.id === t.id);
        if (quiere !== tiene) await bienestar.marcarFoco(t, quiere);
      }
      recargar();
    },
  });
  fill(cont,
    h('section', { class: 'focus' },
      h('small', { class: 'muted' }, fmtDayLong(today())),
      h('h2', {}, foco.length ? 'Hoy solo importa esto:' : '¿Qué es lo más importante hoy?'),
      foco.length ? h('ol', { class: 'focus-list' }, foco.map((t) => h('li', {},
        checkCircle(false, async () => { await bienestar.completar(t); toast('¡Una menos! 🎯'); recargar(); }, `Completar ${t.titulo}`),
        h('span', {}, t.titulo))))
        : h('p', { class: 'muted' }, candidatas.length ? 'Escoge hasta 3 tareas. Todo lo demás puede esperar.' : 'No tienes tareas pendientes. ¡Disfruta el día!'),
      candidatas.length || foco.length ? h('button', { class: 'btn ghost', onclick: elegir }, foco.length ? 'Cambiar' : 'Elegir mis 3') : null,
      proximo ? h('div', { class: 'focus-next' }, h('small', { class: 'muted' }, 'Lo siguiente en tu agenda'),
        h('strong', {}, `${proximo.hora_inicio ? `${fmtTime(proximo.hora_inicio)} · ` : ''}${proximo.titulo}`)) : null,
      h('button', { class: 'btn primary', onclick: () => irA('estudio') }, '⏱ Arrancar un Pomodoro')),
  );
}

// ================= Revisión semanal =================
let semanaSel = null;
export async function renderRevision(cont, ctx) {
  const { bienestar } = ctx;
  const recargar = () => renderRevision(cont, ctx);
  const esteLunes = startOfWeek(today());
  semanaSel ||= new Date().getDay() === 1 ? addDays(esteLunes, -7) : esteLunes; // el lunes revisas la semana que pasó
  const r = await bienestar.revision(semanaSel);
  const a = r.actual || {};
  const caritas = [[5, '🤩'], [4, '🙂'], [3, '😐'], [2, '😕'], [1, '😞']];
  fill(cont,
    h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Semana anterior', onclick: () => { semanaSel = addDays(semanaSel, -7); recargar(); } }, '‹'),
      h('strong', {}, `${fmtDate(r.lunes)} – ${fmtDate(r.domingo)}`),
      h('button', { class: 'icon-btn', 'aria-label': 'Semana siguiente', disabled: semanaSel >= esteLunes, onclick: () => { semanaSel = addDays(semanaSel, 7); recargar(); } }, '›')),
    h('div', { class: 'stats three' },
      h('div', { class: 'stat' }, h('small', {}, 'Tareas hechas'), h('b', {}, String(r.tareasHechas))),
      h('div', { class: 'stat' }, h('small', {}, 'Hábitos'), h('b', {}, r.habitos == null ? '—' : fmtPct(r.habitos))),
      h('div', { class: 'stat' }, h('small', {}, 'Estudio'), h('b', {}, `${Math.round(r.minutosEstudio / 6) / 10} h`)),
      h('div', { class: 'stat' }, h('small', {}, 'Trabajo'), h('b', {}, `${r.horasTrabajo} h`)),
      h('div', { class: 'stat' }, h('small', {}, 'Ejercicio'), h('b', {}, `${r.minutosEjercicio} min`)),
      h('div', { class: 'stat' }, h('small', {}, 'Balance'), money(r.ingresos - r.gastos, r.ingresos - r.gastos < 0 ? 'neg' : 'pos'))),
    h('section', { class: 'card' }, h('h3', {}, a.semana ? '✍️ Tu revisión' : '✍️ ¿Cómo te fue esta semana?'),
      a.calificacion ? h('p', { class: 'mood' }, caritas.find(([v]) => v === a.calificacion)?.[1]) : null,
      a.logros ? [h('span', { class: 'label' }, '🏆 Lo que salió bien'), h('p', { class: 'notes' }, a.logros)] : null,
      a.mejorar ? [h('span', { class: 'label' }, '🔧 Qué mejorar'), h('p', { class: 'notes' }, a.mejorar)] : null,
      a.prioridades ? [h('span', { class: 'label' }, '🎯 Prioridades de la próxima semana'), h('p', { class: 'notes' }, a.prioridades)] : null,
      h('button', { class: `btn ${a.semana ? 'ghost' : 'primary'}`, onclick: () => formulario({
        titulo: 'Revisión de la semana', valores: { calificacion: 4, ...a },
        campos: [
          { name: 'calificacion', label: '¿Cómo calificas tu semana?', type: 'select', options: caritas.map(([v, e]) => [v, `${e} ${v}/5`]) },
          { name: 'logros', label: '🏆 ¿Qué salió bien?', type: 'textarea', rows: 3 },
          { name: 'mejorar', label: '🔧 ¿Qué puedes mejorar?', type: 'textarea', rows: 3 },
          { name: 'prioridades', label: '🎯 Tus 3 prioridades para la próxima semana', type: 'textarea', rows: 3 },
        ],
        onSubmit: async (d) => { await bienestar.guardarRevision(r.lunes, { ...d, calificacion: Number(d.calificacion) }); toast('Revisión guardada 🧭'); recargar(); },
      }) }, a.semana ? 'Editar' : 'Hacer mi revisión')),
    r.historial.length ? h('section', {}, h('h4', { class: 'section-title' }, 'Semanas anteriores'),
      h('ul', { class: 'list' }, r.historial.map((x) => h('li', {}, h('button', { class: 'list-item', onclick: () => { semanaSel = x.semana; recargar(); } },
        h('span', { class: 'mood' }, caritas.find(([v]) => v === x.calificacion)?.[1] || '📝'),
        h('span', { class: 'grow' }, h('strong', {}, `Semana del ${fmtDate(x.semana)}`), h('small', { class: 'muted' }, (x.prioridades || x.logros || '').slice(0, 80))))))))
      : null,
  );
}
