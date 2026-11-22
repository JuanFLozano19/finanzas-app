import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saldoCuenta, estadoPresupuestos, estadoRecurrente, venceEn, estadoDeseo, repartir, serieMensual, puedoPermitirme, ahorroPromedio } from '../js/domain/plata.js';

test('saldo de cuenta = inicial + ingresos − gastos de esa cuenta', () => {
  const movs = [{ cuenta_id: 'n', tipo: 'ingreso', monto: 100 }, { cuenta_id: 'n', tipo: 'gasto', monto: 30 }, { cuenta_id: 'x', tipo: 'gasto', monto: 999 }];
  assert.equal(saldoCuenta({ id: 'n', saldo_inicial: 50 }, movs), 120);
});

test('presupuestos marcan alerta al 80% y excedido al 100%', () => {
  const r = estadoPresupuestos([{ categoria: 'Comida', monto: 100 }, { categoria: 'Ropa', monto: 100 }, { categoria: 'Cine', monto: 100 }],
    [{ tipo: 'gasto', categoria: 'Comida', monto: 85 }, { tipo: 'gasto', categoria: 'Ropa', monto: 120 }, { tipo: 'ingreso', categoria: 'Cine', monto: 50 }]);
  assert.deepEqual(r.map((p) => [p.categoria, p.estado]), [['Ropa', 'excedido'], ['Comida', 'alerta'], ['Cine', 'ok']]);
});

test('pago fijo del día 31 vence el último día de meses cortos', () => {
  assert.equal(venceEn({ dia_mes: 31 }, '2027-02'), '2027-02-28');
  const e = estadoRecurrente({ dia_mes: 20, ultimo_mes: null }, '2026-11-21');
  assert.equal(e.atrasado, true);
  assert.equal(estadoRecurrente({ dia_mes: 23, ultimo_mes: null }, '2026-11-21').proximo, true);
  assert.equal(estadoRecurrente({ dia_mes: 20, ultimo_mes: '2026-11' }, '2026-11-21').pagado, true);
});

test('deseo: historial de precios y regla de 30 días', () => {
  const e = estadoDeseo({ id: 'd', created_at: '2026-11-01T00:00:00Z' },
    [{ deseo_id: 'd', precio: 300, fecha: '2026-11-01' }, { deseo_id: 'd', precio: 250, fecha: '2026-11-15' }], '2026-11-21');
  assert.equal(e.actual, 250);
  assert.equal(e.enMinimo, true);
  assert.equal(Math.round(e.cambio * 100), -17);
  assert.equal(e.puedeDecidir, false);
  assert.equal(e.fechaDecision, '2026-12-01');
});

test('repartir nunca supera el total', () => {
  const r = repartir(100001, [{ meta_id: 'a', porcentaje: 30 }, { meta_id: 'b', porcentaje: 20 }]);
  assert.deepEqual(r.items.map((x) => x.monto), [30000, 20000]);
  assert.equal(r.libre, 50001);
  assert.throws(() => repartir(10, [{ porcentaje: 70 }, { porcentaje: 40 }]));
});

test('serie mensual cruza el cambio de año', () => {
  const s = serieMensual([{ fecha: '2026-12-10', tipo: 'ingreso', monto: 10 }, { fecha: '2027-01-02', tipo: 'gasto', monto: 4 }], '2027-01', 3);
  assert.deepEqual(s.map((x) => [x.ym, x.ingresos, x.gastos]), [['2026-11', 0, 0], ['2026-12', 10, 0], ['2027-01', 0, 4]]);
  assert.equal(ahorroPromedio(s), 10);
});

test('¿me lo puedo permitir?', () => {
  assert.equal(puedoPermitirme({ precio: 500, balanceMes: 300, ahorroMensual: 1000 }).veredicto, 'no');
  assert.equal(puedoPermitirme({ precio: 200, balanceMes: 900, ahorroMensual: 100 }).veredicto, 'pensalo');
  const ok = puedoPermitirme({ precio: 100, balanceMes: 900, ahorroMensual: 400, metaPrincipal: {}, tarifaHora: 20 });
  assert.equal(ok.veredicto, 'si');
  assert.equal(ok.horasTrabajo, 5);
  assert.equal(ok.semanasRetraso, 2);
});
