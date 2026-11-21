import { h, fill, money, progressBar, emptyState, formulario, toast, confirmar } from '../dom.js';
import { fmtDate, fmtMoney, fmtPct, today } from '../../core/format.js';

function formDeuda(service, deuda, recargar) {
  formulario({
    titulo: deuda ? 'Editar deuda' : 'Nueva deuda',
    valores: deuda || {},
    campos: [
      { name: 'nombre', label: '¿Qué debes?', required: true, placeholder: 'Ej: Tarjeta de crédito, préstamo de mi tía' },
      { name: 'acreedor', label: '¿A quién? (opcional)', placeholder: 'Ej: Bancolombia' },
      { name: 'monto_total', label: 'Monto total de la deuda', type: 'money', required: true },
      { name: 'cuota', label: 'Cuota mensual (opcional)', type: 'money' },
      { name: 'tasa_interes', label: 'Interés mensual % (opcional)', type: 'number', step: '0.01', min: '0' },
      { name: 'fecha_limite', label: 'Fecha límite (opcional)', type: 'date' },
      { name: 'notas', label: 'Notas', type: 'textarea' },
    ],
    onSubmit: async (d) => { await service.guardarDeuda(deuda?.id, d); toast('Deuda guardada'); recargar(); },
    onEliminar: deuda ? async () => { await service.eliminarDeuda(deuda.id); toast('Deuda eliminada'); recargar(); } : null,
  });
}

function formPago(service, deuda, recargar) {
  formulario({
    titulo: `Pago a ${deuda.nombre}`,
    enviar: 'Registrar pago',
    valores: { monto: deuda.cuota ? Math.min(deuda.cuota, deuda.estado.pendiente) : null, fecha: today(), comoGasto: true },
    campos: [
      { name: 'monto', label: 'Monto pagado', type: 'money', required: true, hint: `Pendiente: ${fmtMoney(deuda.estado.pendiente)}` },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      { name: 'comoGasto', label: 'Registrarlo también como gasto del mes', type: 'checkbox' },
    ],
    onSubmit: async (d) => { await service.registrarPago(deuda, d); toast('Pago registrado 💪'); recargar(); },
  });
}

function tarjeta(service, d, recargar) {
  const e = d.estado;
  const historial = h('div', { class: 'history', hidden: true },
    e.pagos.length ? h('ul', { class: 'list compact' }, e.pagos.map((p) => h('li', { class: 'list-item static' },
      h('span', { class: 'grow' }, fmtDate(p.fecha)), money(p.monto),
      h('button', { class: 'icon-btn', 'aria-label': 'Eliminar pago', onclick: async () => {
        if (await confirmar('¿Eliminar este pago?')) { await service.eliminarPago(p.id); toast('Pago eliminado'); recargar(); }
      } }, '🗑')))) : h('p', { class: 'muted' }, 'Aún no hay pagos.'));

  return h('article', { class: `card item-card ${e.saldada ? 'done' : ''}` },
    h('div', { class: 'row-between' },
      h('div', {}, h('h3', {}, d.nombre), d.acreedor ? h('small', { class: 'muted' }, d.acreedor) : null),
      e.saldada ? h('span', { class: 'badge ok' }, '¡Pagada! ✅') : h('span', { class: 'badge warn' }, fmtPct(e.progreso))),
    progressBar(e.progreso, 'deuda'),
    h('div', { class: 'kv' },
      h('div', {}, h('small', {}, 'Pagado'), money(e.pagado, 'pos')),
      h('div', {}, h('small', {}, 'Pendiente'), money(e.pendiente)),
      h('div', {}, h('small', {}, 'Total'), money(d.monto_total)),
    ),
    h('div', { class: 'tags' },
      d.cuota ? h('span', { class: 'tag' }, `Cuota ${fmtMoney(d.cuota)}`) : null,
      e.cuotasRestantes ? h('span', { class: 'tag' }, `${e.cuotasRestantes} cuota${e.cuotasRestantes === 1 ? '' : 's'} restante${e.cuotasRestantes === 1 ? '' : 's'}`) : null,
      d.tasa_interes ? h('span', { class: 'tag' }, `${d.tasa_interes}% mensual`) : null,
      d.fecha_limite ? h('span', { class: 'tag' }, `Límite ${fmtDate(d.fecha_limite)}`) : null,
    ),
    d.notas ? h('p', { class: 'muted notes' }, d.notas) : null,
    h('div', { class: 'card-actions' },
      !e.saldada ? h('button', { class: 'btn primary', onclick: () => formPago(service, d, recargar) }, 'Registrar pago') : null,
      h('button', { class: 'btn ghost', onclick: () => { historial.hidden = !historial.hidden; } }, `Pagos (${e.pagos.length})`),
      h('button', { class: 'btn ghost', onclick: () => formDeuda(service, d, recargar) }, 'Editar'),
    ),
    historial,
  );
}

export async function renderDeudas(cont, { service }) {
  const recargar = () => renderDeudas(cont, { service });
  const { items, totalPendiente } = await service.deudas();
  const activas = items.filter((d) => !d.estado.saldada);
  const pagadas = items.filter((d) => d.estado.saldada);

  fill(cont, 
    h('section', { class: 'hero hero-deuda' },
      h('span', { class: 'hero-label' }, 'Total que debes'),
      money(totalPendiente, 'hero-amount'),
      h('small', {}, activas.length ? `${activas.length} deuda${activas.length === 1 ? '' : 's'} activa${activas.length === 1 ? '' : 's'}` : 'Sin deudas activas 🙌'),
    ),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formDeuda(service, null, recargar) }, '+ Nueva deuda')),
    items.length ? null : emptyState('💳', 'No tienes deudas registradas', 'Si debes algo, agrégalo para llevar la cuenta de cuánto te falta.'),
    activas.map((d) => tarjeta(service, d, recargar)),
    pagadas.length ? h('h4', { class: 'section-title' }, 'Pagadas') : null,
    pagadas.map((d) => tarjeta(service, d, recargar)),
  );
}
