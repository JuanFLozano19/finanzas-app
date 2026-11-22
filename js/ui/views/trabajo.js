import { h, fill, money, emptyState, formulario, toast, confirmar } from '../dom.js';
import { today, fmtDate, fmtMoney } from '../../core/format.js';

function formTarifa(vida, tarifa, recargar, despues) {
  formulario({
    titulo: 'Tu tarifa por hora',
    valores: { tarifa_hora: tarifa },
    campos: [{ name: 'tarifa_hora', label: '¿Cuánto te pagan por hora? (COP)', type: 'money', required: true,
      hint: 'Se usa por defecto al registrar horas. Si cambia, los registros viejos conservan su tarifa.' }],
    onSubmit: async (d) => { await vida.trabajo.guardarTarifa(d.tarifa_hora); toast('Tarifa guardada'); await recargar(); despues?.(d.tarifa_hora); },
  });
}

function formHoras(vida, reg, tarifa, recargar) {
  formulario({
    titulo: reg ? 'Editar horas' : 'Registrar horas',
    valores: reg || { fecha: today(), tarifa },
    campos: [
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      { name: 'horas', label: 'Horas trabajadas', type: 'number', min: '0.25', step: '0.25', required: true, placeholder: 'Ej: 4.5' },
      { name: 'tarifa', label: 'Tarifa por hora', type: 'money', required: true },
      { name: 'descripcion', label: 'Descripción (opcional)', placeholder: 'Ej: grabación de robots, turno mañana' },
    ],
    validar: (d) => { if (d.horas > 24) throw new Error('Un día tiene máximo 24 horas.'); },
    onSubmit: async (d) => { await vida.trabajo.guardar(reg?.id, d); toast(`${d.horas} h registradas · ${fmtMoney(d.horas * d.tarifa)}`); recargar(); },
    onEliminar: reg ? async () => { await vida.trabajo.eliminar(reg.id); toast('Registro eliminado'); recargar(); } : null,
  });
}

export async function renderTrabajo(cont, ctx) {
  const { vida } = ctx;
  const recargar = () => renderTrabajo(cont, ctx);
  const { registros, tarifa, resumen } = await vida.trabajo.listado();

  const registrar = () => (tarifa ? formHoras(vida, null, tarifa, recargar)
    : formTarifa(vida, null, recargar, (t) => formHoras(vida, null, t, recargar)));

  const cobrar = async () => {
    const ok = await confirmar(`¿Ya te pagaron ${fmtMoney(resumen.montoPendiente)} por ${resumen.horasPendientes} h? Se registra como ingreso en Finanzas y las horas quedan como pagadas.`,
      { aceptar: 'Sí, ya me pagaron', peligro: false });
    if (!ok) return;
    const total = await vida.trabajo.cobrar(resumen.pendientes, today());
    toast(`💰 ${fmtMoney(total)} agregados a tus ingresos`); recargar();
  };

  fill(cont,
    h('section', { class: 'hero hero-work' },
      h('span', { class: 'hero-label' }, 'Por cobrar'),
      money(resumen.montoPendiente, 'hero-amount'),
      h('small', {}, `${resumen.horasPendientes} h pendientes · tarifa ${tarifa ? fmtMoney(tarifa) : 'sin definir'}/h`)),
    h('div', { class: 'action-row' },
      h('button', { class: 'btn primary', onclick: registrar }, '+ Registrar horas'),
      resumen.pendientes.length ? h('button', { class: 'btn income', onclick: cobrar }, '💰 Ya me pagaron') : null),
    h('button', { class: 'link', onclick: () => formTarifa(vida, tarifa, recargar) }, tarifa ? `Cambiar tarifa (${fmtMoney(tarifa)}/h)` : 'Definir tarifa por hora'),
    registros.length ? h('ul', { class: 'list' }, registros.map((r) => h('li', {},
      h('button', { class: 'list-item', onclick: () => formHoras(vida, r, tarifa, recargar) },
        h('span', { class: 'dot work' }, `${Number(r.horas)}h`),
        h('span', { class: 'grow' }, h('strong', {}, fmtDate(r.fecha)), h('small', { class: 'muted' }, r.descripcion || `${fmtMoney(r.tarifa)}/h`)),
        h('span', { class: 'right' }, money(Number(r.horas) * Number(r.tarifa)),
          h('span', { class: `badge ${r.pagado ? 'ok' : 'warn'}` }, r.pagado ? 'Pagado' : 'Pendiente'))))))
      : emptyState('💼', 'Sin horas registradas', 'Registra tus horas cada día y sabrás exactamente cuánto te deben.'),
    registros.length ? h('p', { class: 'muted center' }, `Total histórico: ${resumen.horasTotales} h · ${fmtMoney(resumen.montoTotal)}`) : null,
  );
}
