import { h, fill, money, emptyState, formulario, toast } from '../dom.js';
import { currentMonth, monthLabel, fmtDate, today } from '../../core/format.js';
import { CATEGORIAS } from '../../config.js';

let mesSel = currentMonth();
let filtro = 'todos';

function abrirForm(service, tipo, mov, recargar) {
  const esIngreso = tipo === 'ingreso';
  formulario({
    titulo: `${mov ? 'Editar' : 'Nuevo'} ${esIngreso ? 'ingreso' : 'gasto'}`,
    valores: mov || { fecha: today(), categoria: CATEGORIAS[tipo][0] },
    campos: [
      { name: 'monto', label: 'Monto (COP)', type: 'money', required: true, placeholder: 'Ej: 50000' },
      { name: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS[tipo], required: true },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
      { name: 'descripcion', label: 'Descripción (opcional)', placeholder: esIngreso ? 'Ej: horas de la semana' : 'Ej: almuerzo' },
    ],
    onSubmit: async (datos) => {
      await service.guardarMovimiento(mov?.id, { ...datos, tipo });
      toast(mov ? 'Cambios guardados' : `${esIngreso ? 'Ingreso' : 'Gasto'} registrado`);
      recargar();
    },
    onEliminar: mov ? async () => { await service.eliminarMovimiento(mov.id); toast('Eliminado'); recargar(); } : null,
  });
}

export async function renderMovimientos(cont, { service }) {
  const recargar = () => renderMovimientos(cont, { service });
  const { movimientos, resumen } = await service.movimientosDelMes(mesSel);
  const visibles = filtro === 'todos' ? movimientos : movimientos.filter((m) => m.tipo === filtro);

  const porFecha = new Map();
  for (const m of visibles) {
    if (!porFecha.has(m.fecha)) porFecha.set(m.fecha, []);
    porFecha.get(m.fecha).push(m);
  }

  const chip = (valor, texto) => h('button', {
    class: `chip ${filtro === valor ? 'active' : ''}`, onclick: () => { filtro = valor; recargar(); },
  }, texto);

  fill(cont, 
    h('div', { class: 'toolbar' },
      h('input', { type: 'month', value: mesSel, class: 'month-input', 'aria-label': 'Mes',
        onchange: (e) => { if (e.target.value) { mesSel = e.target.value; recargar(); } } }),
      h('div', { class: 'chips' }, chip('todos', 'Todos'), chip('ingreso', 'Ingresos'), chip('gasto', 'Gastos')),
    ),
    h('div', { class: 'stats three' },
      h('div', { class: 'stat' }, h('small', {}, 'Ingresos'), money(resumen.ingresos, 'pos')),
      h('div', { class: 'stat' }, h('small', {}, 'Gastos'), money(resumen.gastos, 'neg')),
      h('div', { class: 'stat' }, h('small', {}, 'Balance'), money(resumen.balance, resumen.balance < 0 ? 'neg' : '')),
    ),
    h('div', { class: 'action-row' },
      h('button', { class: 'btn income', onclick: () => abrirForm(service, 'ingreso', null, recargar) }, '+ Ingreso'),
      h('button', { class: 'btn expense', onclick: () => abrirForm(service, 'gasto', null, recargar) }, '+ Gasto'),
    ),
    visibles.length
      ? [...porFecha.entries()].map(([fecha, items]) => h('section', { class: 'day' },
        h('h4', { class: 'day-title' }, fmtDate(fecha)),
        h('ul', { class: 'list' }, items.map((m) => h('li', {},
          h('button', { class: 'list-item', onclick: () => abrirForm(service, m.tipo, m, recargar) },
            h('span', { class: `dot ${m.tipo}` }, m.tipo === 'ingreso' ? '↑' : '↓'),
            h('span', { class: 'grow' }, h('strong', {}, m.categoria),
              m.descripcion ? h('small', { class: 'muted' }, m.descripcion) : null),
            money(m.tipo === 'ingreso' ? m.monto : -m.monto, m.tipo === 'ingreso' ? 'pos' : 'neg'))))),
      ))
      : emptyState('📭', `Nada en ${monthLabel(mesSel).toLowerCase()}`, 'Usa los botones de arriba para registrar ingresos o gastos.'),
  );
}
