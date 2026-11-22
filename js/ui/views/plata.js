// Pantallas de plata: cuentas, presupuestos, pagos fijos, préstamos y reparto.
import { h, fill, money, progressBar, emptyState, formulario, toast, confirmar } from '../dom.js';
import { today, fmtDate, fmtMoney, fmtPct, currentMonth, monthLabel } from '../../core/format.js';
import { CATEGORIAS } from '../../config.js';

const TIPOS_CUENTA = [['banco', '🏦 Banco'], ['billetera', '📱 Billetera digital (Nequi, Daviplata)'], ['efectivo', '💵 Efectivo'], ['ahorro', '🐷 Ahorro / bolsillo']];
const ICONO_CUENTA = { banco: '🏦', billetera: '📱', efectivo: '💵', ahorro: '🐷' };
const opcionesCuenta = (cuentas) => [['', '— Sin cuenta —'], ...cuentas.filter((c) => c.activa).map((c) => [c.id, `${c.icono} ${c.nombre}`])];

// ================= Cuentas y bolsillos =================
function formCuenta(plata, c, recargar) {
  formulario({
    titulo: c ? 'Editar cuenta' : 'Nueva cuenta',
    valores: c || { tipo: 'billetera', saldo_inicial: 0, activa: true },
    campos: [
      { name: 'nombre', label: 'Nombre', required: true, placeholder: 'Ej: Nequi, Bancolombia, Billetera' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: TIPOS_CUENTA },
      { name: 'saldo_inicial', label: c ? 'Saldo inicial' : '¿Cuánto tienes ahí hoy?', type: 'number', step: '1', min: '-999999999',
        hint: c ? 'Para corregir el saldo usa "Ajustar saldo".' : 'Desde aquí se suman y restan tus movimientos.' },
      c ? { name: 'activa', label: 'Cuenta activa', type: 'checkbox' } : null,
    ].filter(Boolean),
    onSubmit: async (d) => { await plata.guardarCuenta(c?.id, { ...d, saldo_inicial: d.saldo_inicial || 0, icono: ICONO_CUENTA[d.tipo] }); toast('Cuenta guardada'); recargar(); },
    onEliminar: c ? async () => { await plata.eliminarCuenta(c.id); toast('Cuenta eliminada'); recargar(); } : null,
  });
}

export async function renderCuentas(cont, ctx) {
  const { plata } = ctx;
  const recargar = () => renderCuentas(cont, ctx);
  const { items, total, sinCuenta } = await plata.cuentas();
  fill(cont,
    h('section', { class: 'hero' }, h('span', { class: 'hero-label' }, 'Tienes en total'), money(total, 'hero-amount'),
      h('small', {}, ((n) => `${n} cuenta${n === 1 ? '' : 's'} activa${n === 1 ? '' : 's'}`)(items.filter((c) => c.activa).length))),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formCuenta(plata, null, recargar) }, '+ Nueva cuenta')),
    items.length ? h('div', { class: 'tiles' }, items.map((c) => h('article', { class: `card account ${c.activa ? '' : 'done'}` },
      h('div', { class: 'row-between' }, h('span', { class: 'tile-icon' }, c.icono), h('button', { class: 'icon-btn', 'aria-label': 'Editar', onclick: () => formCuenta(plata, c, recargar) }, '✏️')),
      h('strong', {}, c.nombre), money(c.saldo, c.saldo < 0 ? 'neg' : ''),
      h('button', { class: 'link', onclick: () => formulario({
        titulo: `Ajustar saldo de ${c.nombre}`, valores: { saldo: Math.round(c.saldo) }, enviar: 'Ajustar',
        campos: [{ name: 'saldo', label: '¿Cuánto tienes realmente?', type: 'number', step: '1', min: '-999999999', required: true,
          hint: 'Úsalo cuando la app y tu cuenta no coincidan.' }],
        onSubmit: async ({ saldo }) => { await plata.ajustarSaldo(c, saldo); toast('Saldo ajustado'); recargar(); },
      }) }, 'Ajustar saldo'))))
      : emptyState('🏦', 'Sin cuentas', 'Agrega Nequi, tu banco o el efectivo para saber cuánto tienes en cada lado.'),
    items.length && sinCuenta ? h('p', { class: 'muted center' }, `${sinCuenta} movimientos no tienen cuenta asignada; edítalos en Movimientos para que cuadre.`) : null,
  );
}

// ================= Presupuestos =================
function formPresupuesto(plata, p, usadas, recargar) {
  formulario({
    titulo: p ? `Presupuesto de ${p.categoria}` : 'Nuevo presupuesto',
    valores: p || {},
    campos: [
      p ? null : { name: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS.gasto.filter((c) => !usadas.includes(c)) },
      { name: 'monto', label: 'Tope mensual', type: 'money', required: true },
    ].filter(Boolean),
    onSubmit: async (d) => { await plata.guardarPresupuesto(p?.id, d); toast('Presupuesto guardado'); recargar(); },
    onEliminar: p ? async () => { await plata.eliminarPresupuesto(p.id); toast('Presupuesto eliminado'); recargar(); } : null,
  });
}

export function filaPresupuesto(p, onClick) {
  const etiqueta = p.estado === 'excedido' ? `⛔ Te pasaste ${fmtMoney(-p.disponible)}` : p.estado === 'alerta' ? `⚠️ Quedan ${fmtMoney(p.disponible)}` : `Quedan ${fmtMoney(p.disponible)}`;
  return h('button', { class: `budget ${p.estado}`, onclick: onClick },
    h('div', { class: 'row-between' }, h('strong', {}, p.categoria), h('span', {}, money(p.gastado), h('small', { class: 'muted' }, ` / ${fmtMoney(p.monto)}`))),
    progressBar(Math.min(1, p.pct), p.estado === 'ok' ? '' : p.estado === 'alerta' ? 'deuda' : 'gasto'),
    h('small', { class: `budget-msg ${p.estado}` }, etiqueta));
}

export async function renderPresupuestos(cont, ctx) {
  const { plata } = ctx;
  const recargar = () => renderPresupuestos(cont, ctx);
  const { items, totalPresupuesto, totalGastado } = await plata.presupuestos();
  const usadas = items.map((p) => p.categoria);
  fill(cont,
    h('section', { class: 'hero' }, h('span', { class: 'hero-label' }, `Presupuesto de ${monthLabel(currentMonth()).toLowerCase()}`),
      money(Math.max(0, totalPresupuesto - totalGastado), 'hero-amount'),
      h('small', {}, `disponible de ${fmtMoney(totalPresupuesto)} · llevas ${fmtPct(totalPresupuesto ? totalGastado / totalPresupuesto : 0)}`)),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formPresupuesto(plata, null, usadas, recargar) }, '+ Presupuesto')),
    items.length ? h('div', { class: 'card budgets' }, items.map((p) => filaPresupuesto(p, () => formPresupuesto(plata, p, usadas, recargar))))
      : emptyState('🧮', 'Sin presupuestos', 'Ponle un tope mensual a Comida, Entretenimiento o lo que quieras controlar. Te aviso al 80%.'),
  );
}

// ================= Pagos fijos =================
function formFijo(plata, x, cuentas, recargar) {
  formulario({
    titulo: x ? 'Editar pago fijo' : 'Nuevo pago fijo',
    valores: x || { tipo: 'gasto', categoria: 'Celular e internet', dia_mes: 1, activo: true },
    campos: [
      { name: 'nombre', label: 'Nombre', required: true, placeholder: 'Ej: Plan del celular, Spotify' },
      { name: 'monto', label: 'Monto', type: 'money', required: true },
      { name: 'dia_mes', label: 'Día del mes en que se paga', type: 'number', min: '1', step: '1', required: true },
      { name: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS.gasto },
      cuentas.length ? { name: 'cuenta_id', label: 'Se paga desde', type: 'select', options: opcionesCuenta(cuentas) } : null,
      x ? { name: 'activo', label: 'Activo', type: 'checkbox' } : null,
    ].filter(Boolean),
    validar: (d) => { if (d.dia_mes < 1 || d.dia_mes > 31) throw new Error('El día debe estar entre 1 y 31.'); },
    onSubmit: async (d) => { await plata.guardarRecurrente(x?.id, { ...d, tipo: 'gasto' }); toast('Pago fijo guardado'); recargar(); },
    onEliminar: x ? async () => { await plata.eliminarRecurrente(x.id); toast('Eliminado'); recargar(); } : null,
  });
}

export function registrarFijo(plata, x, recargar) {
  formulario({
    titulo: `Pagar ${x.nombre}`, enviar: 'Registrar pago',
    valores: { monto: x.monto, fecha: today() },
    campos: [
      { name: 'monto', label: 'Monto pagado', type: 'money', required: true, hint: 'Cámbialo si este mes fue distinto.' },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
    ],
    onSubmit: async (d) => { await plata.registrarRecurrente(x, d); toast(`${x.nombre} registrado como gasto ✅`); recargar(); },
  });
}

export function etiquetaFijo(e) {
  if (e.pagado) return h('span', { class: 'badge ok' }, 'Pagado');
  if (e.atrasado) return h('span', { class: 'badge late' }, `Venció hace ${-e.dias} d`);
  if (e.dias === 0) return h('span', { class: 'badge warn' }, 'Vence hoy');
  return h('span', { class: `badge ${e.proximo ? 'warn' : ''}` }, `En ${e.dias} d`);
}

export async function renderFijos(cont, ctx) {
  const { plata } = ctx;
  const recargar = () => renderFijos(cont, ctx);
  const [{ items, pendientes, totalMensual }, cuentas] = await Promise.all([plata.recurrentes(), plata.listaCuentas()]);
  fill(cont,
    h('section', { class: 'hero' }, h('span', { class: 'hero-label' }, 'Pagos fijos al mes'), money(totalMensual, 'hero-amount'),
      h('small', {}, pendientes.length ? `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'} este mes · ${fmtMoney(pendientes.reduce((a, x) => a + Number(x.monto), 0))}` : 'Todo pagado este mes ✅')),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formFijo(plata, null, cuentas, recargar) }, '+ Pago fijo')),
    items.length ? h('ul', { class: 'list' }, items.map((x) => h('li', { class: `list-item static ${x.activo ? '' : 'faded'}` },
      h('span', { class: 'dot gasto' }, String(x.dia_mes)),
      h('button', { class: 'grow plain', onclick: () => formFijo(plata, x, cuentas, recargar) },
        h('strong', {}, x.nombre), h('small', { class: 'muted' }, `${x.categoria} · día ${x.dia_mes}${x.activo ? '' : ' · pausado'}`)),
      h('span', { class: 'right' }, money(x.monto), x.activo ? etiquetaFijo(x.estado) : null),
      x.activo && !x.estado.pagado ? h('button', { class: 'btn primary small', onclick: () => registrarFijo(plata, x, recargar) }, 'Pagar') : null)))
      : emptyState('🔁', 'Sin pagos fijos', 'Agrega el plan del celular, el internet o tus suscripciones y te recuerdo cuándo vencen.'),
  );
}

// ================= Préstamos =================
function formPrestamo(plata, p, recargar) {
  formulario({
    titulo: p ? 'Editar préstamo' : 'Le presté plata a…',
    valores: p || { fecha: today() },
    campos: [
      { name: 'persona', label: '¿A quién?', required: true },
      { name: 'monto', label: 'Monto', type: 'money', required: true },
      { name: 'fecha', label: '¿Cuándo?', type: 'date', required: true },
      { name: 'fecha_pago', label: '¿Para cuándo te paga? (opcional)', type: 'date' },
      { name: 'notas', label: 'Notas', type: 'textarea' },
    ],
    onSubmit: async (d) => { await plata.guardarPrestamo(p?.id, d); toast('Préstamo guardado'); recargar(); },
    onEliminar: p ? async () => { await plata.eliminarPrestamo(p.id); toast('Eliminado'); recargar(); } : null,
  });
}

export async function renderPrestamos(cont, ctx) {
  const { plata } = ctx;
  const recargar = () => renderPrestamos(cont, ctx);
  const { items, totalPorCobrar } = await plata.prestamos();
  const hoy = today();
  const tarjeta = (p) => {
    const e = p.estado;
    const vencido = !e.saldada && p.fecha_pago && p.fecha_pago < hoy;
    return h('article', { class: `card item-card ${e.saldada ? 'done' : ''}` },
      h('div', { class: 'row-between' }, h('div', {}, h('h3', {}, p.persona), h('small', { class: 'muted' }, `Le prestaste el ${fmtDate(p.fecha)}`)),
        e.saldada ? h('span', { class: 'badge ok' }, 'Pagado ✅') : vencido ? h('span', { class: 'badge late' }, 'Atrasado') : h('span', { class: 'badge warn' }, fmtPct(e.progreso))),
      progressBar(e.progreso),
      h('div', { class: 'kv' }, h('div', {}, h('small', {}, 'Te ha pagado'), money(e.pagado, 'pos')), h('div', {}, h('small', {}, 'Te debe'), money(e.pendiente)),
        h('div', {}, h('small', {}, 'Paga el'), h('b', {}, p.fecha_pago ? fmtDate(p.fecha_pago) : '—'))),
      p.notas ? h('p', { class: 'muted notes' }, p.notas) : null,
      e.pagos.length ? h('ul', { class: 'list compact' }, e.pagos.map((a) => h('li', { class: 'list-item static' },
        h('span', { class: 'grow' }, fmtDate(a.fecha)), money(a.monto, 'pos'),
        h('button', { class: 'icon-btn', 'aria-label': 'Eliminar abono', onclick: async () => {
          if (await confirmar('¿Eliminar este abono?')) { await plata.eliminarAbono(a.id); recargar(); }
        } }, '🗑')))) : null,
      h('div', { class: 'card-actions' },
        !e.saldada ? h('button', { class: 'btn primary', onclick: () => formulario({
          titulo: `${p.persona} te pagó`, enviar: 'Registrar', valores: { monto: e.pendiente, fecha: today(), comoIngreso: false },
          campos: [{ name: 'monto', label: 'Monto', type: 'money', required: true }, { name: 'fecha', label: 'Fecha', type: 'date', required: true },
            { name: 'comoIngreso', label: 'Registrarlo también como ingreso', type: 'checkbox' }],
          onSubmit: async (d) => { await plata.abonar(p, d); toast('Abono registrado 💰'); recargar(); },
        }) }, 'Me pagó') : null,
        h('button', { class: 'btn ghost', onclick: () => formPrestamo(plata, p, recargar) }, 'Editar')));
  };
  fill(cont,
    h('section', { class: 'hero hero-work' }, h('span', { class: 'hero-label' }, 'Te deben'), money(totalPorCobrar, 'hero-amount'),
      h('small', {}, ((n) => `${n} préstamo${n === 1 ? '' : 's'} activo${n === 1 ? '' : 's'}`)(items.filter((p) => !p.estado.saldada).length))),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formPrestamo(plata, null, recargar) }, '+ Presté plata')),
    items.length ? items.map(tarjeta) : emptyState('🤝', 'Nadie te debe', 'Cuando le prestes a alguien, anótalo aquí para no olvidarlo.'),
  );
}

// ================= Reparto de ingresos =================
/** Diálogo para repartir un ingreso entre metas según la configuración guardada. */
export async function abrirReparto(plata, monto, alTerminar) {
  const { reparto, metas } = await plata.configReparto();
  if (!reparto.length || !metas.length) return false;
  const { items, libre } = plata.calcularReparto(monto, reparto);
  const nombre = (id) => metas.find((m) => m.id === id);
  formulario({
    titulo: `Repartir ${fmtMoney(monto)}`, enviar: 'Repartir',
    valores: Object.fromEntries(items.map((it) => [`m_${it.meta_id}`, it.monto])),
    campos: [
      ...items.map((it) => ({ name: `m_${it.meta_id}`, label: `${nombre(it.meta_id).icono} ${nombre(it.meta_id).nombre} (${it.porcentaje}%)`, type: 'number', min: '0', step: '1' })),
    ],
    onSubmit: async (d) => {
      const finales = items.map((it) => ({ meta_id: it.meta_id, monto: Number(d[`m_${it.meta_id}`]) || 0 }));
      if (finales.reduce((a, x) => a + x.monto, 0) > monto) throw new Error('Estás repartiendo más de lo que recibiste.');
      await plata.aplicarReparto(finales, today());
      toast('💸 Plata repartida en tus metas'); alTerminar?.();
    },
  });
  void libre;
  return true;
}

/** Sección de Ajustes para configurar el reparto automático. */
export async function seccionReparto({ plata }, _aj, recargar) {
  const { reparto, metas } = await plata.configReparto();
  const pct = (id) => reparto.find((r) => r.meta_id === id)?.porcentaje || 0;
  const total = reparto.reduce((a, r) => a + Number(r.porcentaje), 0);
  return h('section', { class: 'card' },
    h('h3', {}, '💸 Repartir cuando te pagan'),
    h('p', { class: 'muted' }, 'Cuando registras un ingreso, Rumbo te propone separar estos porcentajes para tus metas.'),
    metas.length ? h('ul', { class: 'list compact' }, metas.map((m) => h('li', { class: 'list-item static' },
      h('span', { class: 'grow' }, `${m.icono} ${m.nombre}`), h('b', {}, `${pct(m.id)}%`)))) : h('p', { class: 'muted' }, 'Primero crea metas de ahorro en Plata → Metas.'),
    metas.length ? h('div', { class: 'row-between' }, h('small', { class: 'muted' }, `Total: ${total}% · libre ${100 - total}%`),
      h('button', { class: 'btn ghost small', onclick: () => formulario({
        titulo: 'Porcentajes por meta',
        valores: Object.fromEntries(metas.map((m) => [`p_${m.id}`, pct(m.id) || null])),
        campos: metas.map((m) => ({ name: `p_${m.id}`, label: `${m.icono} ${m.nombre} (%)`, type: 'number', min: '0', step: '1' })),
        validar: (d) => { if (Object.values(d).reduce((a, v) => a + (v || 0), 0) > 100) throw new Error('La suma no puede pasar de 100%.'); },
        onSubmit: async (d) => {
          await plata.guardarReparto(metas.map((m) => ({ meta_id: m.id, porcentaje: d[`p_${m.id}`] || 0 })).filter((x) => x.porcentaje > 0));
          toast('Reparto guardado'); recargar();
        },
      }) }, 'Configurar')) : null);
}
