import { h, fill, emptyState, formulario, toast, checkCircle, confirmar } from '../dom.js';
import { textoLista } from '../../services/DiaService.js';

export async function renderMercado(cont, ctx) {
  const { mercado, plata } = ctx;
  const recargar = () => renderMercado(cont, ctx);
  const { pendientes, comprados } = await mercado.lista();
  const texto = h('input', { class: 'search', placeholder: 'Agregar producto…', 'aria-label': 'Producto', autocomplete: 'off' });
  const cantidad = h('input', { class: 'search qty', placeholder: 'Cant.', 'aria-label': 'Cantidad', autocomplete: 'off' });

  const compartir = async () => {
    const t = textoLista(pendientes);
    try {
      if (navigator.share) { await navigator.share({ title: 'Lista de mercado', text: t }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener');
  };
  const terminar = async () => {
    const cuentas = await plata.listaCuentas();
    formulario({
      titulo: 'Terminar la compra', enviar: 'Registrar gasto',
      campos: [
        { name: 'total', label: '¿Cuánto pagaste en total?', type: 'money', required: true },
        { name: 'lugar', label: '¿Dónde? (opcional)', placeholder: 'Ej: D1, Éxito, plaza' },
        cuentas.length ? { name: 'cuenta_id', label: '¿De qué cuenta salió?', type: 'select', options: [['', '— Sin cuenta —'], ...cuentas.filter((c) => c.activa).map((c) => [c.id, `${c.icono} ${c.nombre}`])] } : null,
      ].filter(Boolean),
      onSubmit: async (d) => { await mercado.terminarCompra(comprados, d); toast('🛒 Compra registrada como gasto de Comida'); recargar(); },
    });
  };
  const fila = (i) => h('li', { class: `task ${i.comprado ? 'done' : ''}` },
    checkCircle(i.comprado, async () => { await mercado.alternar(i); recargar(); }, i.comprado ? 'Desmarcar' : 'Marcar como comprado'),
    h('button', { class: 'task-body', onclick: () => formulario({
      titulo: 'Editar producto', valores: i,
      campos: [{ name: 'texto', label: 'Producto', required: true }, { name: 'cantidad', label: 'Cantidad' }],
      onSubmit: async (d) => { await mercado.editar(i.id, d); recargar(); },
      onEliminar: async () => { await mercado.eliminar(i.id); recargar(); },
    }) }, h('span', { class: 'task-title' }, i.texto), i.cantidad ? h('span', { class: 'task-meta' }, h('span', { class: 'pill' }, i.cantidad)) : null));

  fill(cont,
    h('form', { class: 'toolbar add-bar', onsubmit: async (e) => {
      e.preventDefault(); const v = texto.value.trim(); if (!v) return;
      await mercado.agregar(v, cantidad.value.trim(), pendientes.length + comprados.length);
      recargar();
      setTimeout(() => cont.querySelector('.add-bar .search')?.focus(), 80);
    } }, texto, cantidad, h('button', { class: 'btn primary', type: 'submit' }, 'Agregar')),
    pendientes.length || comprados.length ? [
      pendientes.length ? h('ul', { class: 'tasks card-list' }, pendientes.map(fila)) : h('p', { class: 'meta-msg center' }, '¡Tienes todo! 🎉'),
      h('div', { class: 'action-row' },
        pendientes.length ? h('button', { class: 'btn ghost', onclick: compartir }, '📤 Compartir lista') : null,
        comprados.length ? h('button', { class: 'btn primary', onclick: terminar }, `Terminar compra (${comprados.length})`) : null),
      comprados.length ? [h('div', { class: 'row-between' }, h('h4', { class: 'section-title' }, `En el carrito · ${comprados.length}`),
        h('button', { class: 'link', onclick: async () => { if (await confirmar('¿Quitar de la lista lo que ya está en el carrito, sin registrar gasto?', { aceptar: 'Quitar' })) { await mercado.limpiarComprados(comprados); recargar(); } } }, 'Quitar sin registrar')),
      h('ul', { class: 'tasks card-list' }, comprados.map(fila))] : null,
    ] : emptyState('🛒', 'Tu lista está vacía', 'Escribe lo que necesitas comprar. Mientras compras, marca lo que ya echaste al carrito.'),
  );
}
