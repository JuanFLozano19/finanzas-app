// Interfaz del asistente: escribes una frase, ves lo que entendió y confirmas.
import { h, dialogo, toast } from './dom.js';
import { interpretar } from '../domain/asistente.js';
import { today, fmtDate, fmtMoney } from '../core/format.js';

const EJEMPLOS = ['gasté 15 mil en almuerzo', 'me pagaron 350 mil', 'trabajé 4 horas', 'parcial de bases el jueves a las 2',
  'tengo que entregar el taller mañana', 'tomé 2 vasos de agua', 'dormí 7 horas', 'entrené 45 min de gimnasio', 'leí 20 páginas',
  'le presté 50 mil a Carlos', 'nota: idea para el proyecto'];

export function describir(a) {
  const f = (x) => (x === today() ? 'hoy' : fmtDate(x));
  switch (a.tipo) {
    case 'gasto': return ['💸 Gasto', `${fmtMoney(a.monto)} · ${a.categoria}${a.descripcion ? ` · ${a.descripcion}` : ''} · ${f(a.fecha)}`];
    case 'ingreso': return ['💰 Ingreso', `${fmtMoney(a.monto)}${a.descripcion ? ` · ${a.descripcion}` : ''} · ${f(a.fecha)}`];
    case 'horas': return ['💼 Horas de trabajo', `${a.horas} h · ${f(a.fecha)}`];
    case 'sueno': return ['😴 Sueño', `${a.horas} h dormidas · ${f(a.fecha)}`];
    case 'agua': return ['💧 Agua', `+${a.vasos} vaso${a.vasos === 1 ? '' : 's'} hoy`];
    case 'entreno': return ['💪 Entrenamiento', `${a.actividad} · ${a.minutos} min · ${f(a.fecha)}`];
    case 'lectura': return ['📖 Lectura', `+${a.cantidad} en lo que estás leyendo`];
    case 'prestamo': return ['🤝 Préstamo', `${fmtMoney(a.monto)} a ${a.persona}`];
    case 'evento': return ['🗓 Agenda', `${a.titulo} · ${f(a.fecha)}${a.hora ? ` · ${a.hora}` : ''}`];
    case 'nota': return ['📝 Nota', a.contenido];
    case 'tarea': return ['✅ Tarea', `${a.titulo}${a.fecha ? ` · para ${f(a.fecha)}` : ''}`];
    default: return ['🤔', 'No entendí. Prueba con uno de los ejemplos.'];
  }
}

export function abrirAsistente(asistente, alGuardar) {
  const input = h('input', { class: 'search assistant-input', placeholder: 'Ej: gasté 15 mil en almuerzo', autocomplete: 'off', enterkeyhint: 'send' });
  const vista = h('div', { class: 'assistant-preview', hidden: true });
  let actual = null;
  const guardarBtn = h('button', { class: 'btn primary', type: 'submit', disabled: true }, 'Guardar');
  const pintar = () => {
    const txt = input.value.trim();
    actual = txt ? interpretar(txt, today()) : null;
    vista.hidden = !actual;
    guardarBtn.disabled = !actual || actual.tipo === 'desconocido';
    if (actual) {
      const [titulo, detalle] = describir(actual);
      vista.replaceChildren(h('small', { class: 'muted' }, 'Entendí:'), h('strong', {}, titulo), h('span', {}, detalle));
    }
  };
  input.addEventListener('input', pintar);
  const form = h('form', { class: 'sheet-body' },
    h('div', { class: 'sheet-head' }, h('h2', {}, '✨ Cuéntale a Rumbo'), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕')),
    input, vista,
    h('div', { class: 'chips wrap' }, EJEMPLOS.map((e) => h('button', { class: 'chip', type: 'button', onclick: () => { input.value = e; pintar(); input.focus(); } }, e))),
    h('div', { class: 'sheet-actions' }, h('span'), guardarBtn));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!actual || actual.tipo === 'desconocido') return;
    guardarBtn.disabled = true;
    try {
      const msg = await asistente.ejecutar(actual);
      toast(`✨ ${msg}`);
      input.value = ''; pintar(); input.focus();
      alGuardar?.();
    } catch (err) { toast(err.message, 'error'); guardarBtn.disabled = false; }
  });
  const d = dialogo(form);
  setTimeout(() => input.focus(), 50);
}
