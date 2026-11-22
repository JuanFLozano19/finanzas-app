// Lista de deseos con historial de precios, regla de 30 días y "¿me lo puedo permitir?".
import { h, fill, money, emptyState, formulario, toast, confirmar } from '../dom.js';
import { today, fmtDate, fmtMoney } from '../../core/format.js';

const PRIORIDADES = [[1, 'Alta'], [2, 'Media'], [3, 'Baja']];

function formDeseo(plata, d, recargar) {
  formulario({
    titulo: d ? 'Editar deseo' : '¿Qué quieres comprar?',
    valores: d || { prioridad: 2 },
    campos: [
      { name: 'nombre', label: 'Producto', required: true, placeholder: 'Ej: Audífonos Sony' },
      d ? null : { name: 'precio', label: 'Precio que viste', type: 'money' },
      d ? null : { name: 'tienda', label: 'Tienda (opcional)', placeholder: 'Ej: Mercado Libre' },
      { name: 'enlace', label: 'Enlace (opcional)', type: 'url', placeholder: 'https://…' },
      { name: 'prioridad', label: 'Qué tanto lo quieres', type: 'select', options: PRIORIDADES },
      { name: 'notas', label: 'Notas', type: 'textarea' },
    ].filter(Boolean),
    onSubmit: async (x) => { await plata.guardarDeseo(d?.id, { ...x, prioridad: Number(x.prioridad) }); toast(d ? 'Guardado' : 'Agregado a tu lista ✨'); recargar(); },
    onEliminar: d ? async () => { await plata.eliminarDeseo(d.id); toast('Eliminado'); recargar(); } : null,
  });
}

/** Muestra el análisis de "¿me lo puedo permitir?" para un precio. */
export async function evaluarCompra(plata, precio, nombre = 'esto') {
  const r = await plata.evaluarCompra(precio);
  const titulo = { si: '✅ Sí, te lo puedes permitir', pensalo: '🤔 Piénsalo un poco', no: '⛔ Hoy no te alcanza' }[r.veredicto];
  const lineas = [
    `Si lo compras, tu balance del mes queda en ${fmtMoney(r.quedaMes)}.`,
    r.ahorroMensual > 0 ? `En promedio ahorras ${fmtMoney(r.ahorroMensual)} al mes: ${nombre} equivale a ${r.mesesDeAhorro.toFixed(1)} meses de ahorro.`
      : 'En los últimos meses no te ha quedado ahorro; cualquier compra grande sale de lo que ya tienes.',
    r.metaPrincipal && r.semanasRetraso ? `Retrasa tu meta "${r.metaPrincipal.nombre}" unas ${r.semanasRetraso} semanas.` : null,
    r.horasTrabajo ? `Son ${r.horasTrabajo} horas de tu trabajo.` : null,
  ].filter(Boolean);
  formulario({
    titulo, enviar: 'Entendido', campos: [],
    valores: {},
    onSubmit: async () => {},
  }).querySelector('.sheet-head').after(h('div', { class: `verdict ${r.veredicto}` }, h('strong', {}, `${fmtMoney(precio)} · ${nombre}`), lineas.map((l) => h('p', {}, l))));
}

function tarjeta(plata, d, recargar) {
  const e = d.estado;
  const hist = h('div', { class: 'history', hidden: true },
    h('ul', { class: 'list compact' }, [...e.historial].reverse().map((p) => h('li', { class: 'list-item static' },
      h('span', { class: 'grow' }, fmtDate(p.fecha), p.tienda ? h('small', { class: 'muted' }, ` · ${p.tienda}`) : null), money(p.precio),
      h('button', { class: 'icon-btn', 'aria-label': 'Eliminar precio', onclick: async () => {
        if (await confirmar('¿Eliminar este precio?')) { await plata.eliminarPrecio(p.id); recargar(); }
      } }, '🗑')))));
  const cambio = e.cambio != null && e.historial.length > 1
    ? h('span', { class: `badge ${e.cambio < 0 ? 'ok' : e.cambio > 0 ? 'late' : ''}` }, `${e.cambio < 0 ? '▼' : e.cambio > 0 ? '▲' : '='} ${Math.abs(Math.round(e.cambio * 100))}%`) : null;
  return h('article', { class: `card item-card ${d.comprado ? 'done' : ''}` },
    h('div', { class: 'row-between' },
      h('div', {}, h('h3', {}, d.nombre), h('small', { class: 'muted' }, `En tu lista hace ${e.dias} día${e.dias === 1 ? '' : 's'}`)),
      h('div', { class: 'right' }, e.actual != null ? money(e.actual) : h('small', { class: 'muted' }, 'Sin precio'), cambio)),
    e.minimo != null && e.historial.length > 1 ? h('small', { class: 'muted' }, `Precio más bajo visto: ${fmtMoney(e.minimo)}${e.enMinimo ? ' · ¡está en su mínimo! 🔥' : ''}`) : null,
    d.comprado ? h('p', { class: 'meta-msg' }, '¡Comprado! 🛍️')
      : h('p', { class: `meta-msg ${e.puedeDecidir ? '' : 'warn'}` }, e.puedeDecidir
        ? '✅ Ya pasaron 30 días. Si aún lo quieres, adelante.'
        : `⏳ Regla de 30 días: decide desde el ${fmtDate(e.fechaDecision)}. Si para entonces lo sigues queriendo, va.`),
    d.enlace ? h('a', { class: 'link', href: d.enlace, target: '_blank', rel: 'noopener' }, 'Ver producto ↗') : null,
    !d.comprado ? h('div', { class: 'card-actions' },
      h('button', { class: 'btn primary', onclick: () => formulario({
        titulo: `Nuevo precio de ${d.nombre}`, valores: { fecha: today() },
        campos: [{ name: 'precio', label: 'Precio', type: 'money', required: true }, { name: 'tienda', label: 'Tienda (opcional)' }, { name: 'fecha', label: 'Fecha', type: 'date', required: true }],
        onSubmit: async (x) => { await plata.agregarPrecio(d.id, x); toast('Precio anotado'); recargar(); },
      }) }, '+ Precio'),
      e.actual ? h('button', { class: 'btn ghost', onclick: () => evaluarCompra(plata, e.actual, d.nombre) }, '¿Me alcanza?') : null,
      e.actual ? h('button', { class: 'btn ghost', onclick: async () => { await plata.convertirEnMeta(d); toast('Creada como meta de ahorro 🎯'); } }, 'Ahorrar para esto') : null,
      h('button', { class: 'btn ghost', onclick: () => formulario({
        titulo: `¿Compraste ${d.nombre}?`, enviar: '¡Lo compré!', valores: { monto: e.actual, fecha: today(), registrarGasto: true },
        campos: [{ name: 'monto', label: 'Precio final', type: 'money', required: true }, { name: 'fecha', label: 'Fecha', type: 'date', required: true },
          { name: 'registrarGasto', label: 'Registrarlo como gasto', type: 'checkbox' }],
        onSubmit: async (x) => { await plata.marcarComprado(d, x); toast('¡Disfrútalo! 🛍️'); recargar(); },
      }) }, 'Lo compré'),
      e.historial.length ? h('button', { class: 'btn ghost', onclick: () => { hist.hidden = !hist.hidden; } }, `Precios (${e.historial.length})`) : null,
      h('button', { class: 'btn ghost', onclick: () => formDeseo(plata, d, recargar) }, 'Editar')) : null,
    hist);
}

export async function renderDeseos(cont, ctx) {
  const { plata } = ctx;
  const recargar = () => renderDeseos(cont, ctx);
  const items = await plata.deseos();
  const pendientes = items.filter((d) => !d.comprado).sort((a, b) => a.prioridad - b.prioridad);
  const comprados = items.filter((d) => d.comprado);
  const precio = h('input', { type: 'number', inputmode: 'numeric', min: '1', placeholder: 'Precio de algo que quieres comprar', class: 'search' });
  fill(cont,
    h('section', { class: 'card' }, h('h3', {}, '🤔 ¿Me lo puedo permitir?'),
      h('form', { class: 'toolbar', onsubmit: (ev) => { ev.preventDefault(); const v = Number(precio.value); if (v > 0) evaluarCompra(plata, v).catch((er) => toast(er.message, 'error')); } },
        precio, h('button', { class: 'btn primary', type: 'submit' }, 'Calcular'))),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formDeseo(plata, null, recargar) }, '+ Agregar a la lista')),
    items.length ? null : emptyState('✨', 'Tu lista está vacía', 'Anota lo que quieres comprar y su precio. Esperar 30 días evita compras por impulso.'),
    pendientes.map((d) => tarjeta(plata, d, recargar)),
    comprados.length ? h('h4', { class: 'section-title' }, 'Comprados') : null,
    comprados.map((d) => tarjeta(plata, d, recargar)),
  );
}
