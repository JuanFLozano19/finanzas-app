// Reglas de negocio de los módulos de plata. Funciones puras (ver tests/plata.test.js).
import { addDays, monthRange } from '../core/format.js';
import { sum } from './calculos.js';

export function saldoCuenta(cuenta, movimientos) {
  const propios = movimientos.filter((m) => m.cuenta_id === cuenta.id);
  const ing = sum(propios.filter((m) => m.tipo === 'ingreso'));
  const gas = sum(propios.filter((m) => m.tipo === 'gasto'));
  return Number(cuenta.saldo_inicial) + ing - gas;
}

export function estadoPresupuestos(presupuestos, movimientosMes) {
  return presupuestos.map((p) => {
    const gastado = sum(movimientosMes.filter((m) => m.tipo === 'gasto' && m.categoria === p.categoria));
    const pct = Number(p.monto) > 0 ? gastado / Number(p.monto) : 0;
    return { ...p, gastado, disponible: Number(p.monto) - gastado, pct, estado: pct >= 1 ? 'excedido' : pct >= 0.8 ? 'alerta' : 'ok' };
  }).sort((a, b) => b.pct - a.pct);
}

const diasDelMes = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

/** Fecha de vencimiento de un pago fijo en un mes (si el mes es corto, el último día). */
export function venceEn(r, ym) {
  return `${ym}-${String(Math.min(r.dia_mes, diasDelMes(ym))).padStart(2, '0')}`;
}

export function estadoRecurrente(r, hoyIso) {
  const ym = hoyIso.slice(0, 7);
  const vence = venceEn(r, ym);
  const pagado = r.ultimo_mes === ym;
  const dias = Math.round((new Date(`${vence}T00:00:00`) - new Date(`${hoyIso}T00:00:00`)) / 86400000);
  return { vence, pagado, dias, atrasado: !pagado && dias < 0, proximo: !pagado && dias >= 0 && dias <= 3 };
}

export function estadoDeseo(deseo, precios, hoyIso, diasReflexion = 30) {
  const hist = precios.filter((p) => p.deseo_id === deseo.id).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.created_at || '').localeCompare(b.created_at || ''));
  const actual = hist.length ? Number(hist[hist.length - 1].precio) : null;
  const inicial = hist.length ? Number(hist[0].precio) : null;
  const minimo = hist.length ? Math.min(...hist.map((p) => Number(p.precio))) : null;
  const desde = deseo.created_at.slice(0, 10);
  const dias = Math.max(0, Math.round((new Date(`${hoyIso}T00:00:00`) - new Date(`${desde}T00:00:00`)) / 86400000));
  return {
    historial: hist, actual, inicial, minimo,
    cambio: actual != null && inicial ? (actual - inicial) / inicial : null,
    enMinimo: actual != null && actual === minimo && hist.length > 1,
    dias, puedeDecidir: dias >= diasReflexion, fechaDecision: addDays(desde, diasReflexion),
  };
}

/** Reparte un monto según porcentajes [{meta_id, porcentaje}]. Redondea a pesos y nunca supera el total. */
export function repartir(monto, reparto) {
  const total = reparto.reduce((a, r) => a + Number(r.porcentaje), 0);
  if (total > 100) throw new Error('Los porcentajes suman más de 100%.');
  const items = reparto.map((r) => ({ ...r, monto: Math.floor(monto * Number(r.porcentaje) / 100) }));
  return { items, libre: monto - items.reduce((a, r) => a + r.monto, 0) };
}

/** Ingresos y gastos por mes de los últimos `n` meses que terminan en `ymFinal`. */
export function serieMensual(movimientos, ymFinal, n = 6) {
  const meses = [];
  let [y, m] = ymFinal.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    meses.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1; if (m === 0) { m = 12; y -= 1; }
  }
  return meses.map((ym) => {
    const [desde, hasta] = monthRange(ym);
    const del = movimientos.filter((x) => x.fecha >= desde && x.fecha < hasta);
    const ingresos = sum(del.filter((x) => x.tipo === 'ingreso'));
    const gastos = sum(del.filter((x) => x.tipo === 'gasto'));
    return { ym, ingresos, gastos, balance: ingresos - gastos };
  });
}

/**
 * ¿Me lo puedo permitir? Compara el precio con lo que queda del mes,
 * cuánto ahorras normalmente y la meta principal.
 */
export function puedoPermitirme({ precio, balanceMes, ahorroMensual, metaPrincipal, tarifaHora }) {
  const quedaMes = balanceMes - precio;
  const mesesDeAhorro = ahorroMensual > 0 ? precio / ahorroMensual : null;
  const semanasRetraso = metaPrincipal && ahorroMensual > 0 ? Math.ceil((precio / ahorroMensual) * 4.345) : null;
  const horasTrabajo = tarifaHora ? Math.round((precio / tarifaHora) * 10) / 10 : null;
  let veredicto;
  if (quedaMes < 0) veredicto = 'no';
  else if (ahorroMensual <= 0 || precio > ahorroMensual) veredicto = 'pensalo';
  else veredicto = 'si';
  return { quedaMes, mesesDeAhorro, semanasRetraso, horasTrabajo, veredicto };
}

/** Promedio de ahorro mensual (ingresos − gastos) de los meses completos de la serie. */
export function ahorroPromedio(serie) {
  const completos = serie.slice(0, -1).filter((s) => s.ingresos || s.gastos);
  return completos.length ? Math.round(completos.reduce((a, s) => a + s.balance, 0) / completos.length) : 0;
}
