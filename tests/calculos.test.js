import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenMovimientos, gastosPorCategoria, estadoDeuda, estadoMeta, mesesEntre } from '../js/domain/calculos.js';
import { monthRange } from '../js/core/format.js';

test('resumen de movimientos suma ingresos y gastos', () => {
  const r = resumenMovimientos([
    { tipo: 'ingreso', monto: 1000000 }, { tipo: 'gasto', monto: 250000 }, { tipo: 'gasto', monto: '50000' },
  ]);
  assert.deepEqual(r, { ingresos: 1000000, gastos: 300000, balance: 700000 });
});

test('gastos por categoría ordenados de mayor a menor', () => {
  const r = gastosPorCategoria([
    { tipo: 'gasto', categoria: 'Comida', monto: 10 }, { tipo: 'gasto', categoria: 'Transporte', monto: 30 },
    { tipo: 'gasto', categoria: 'Comida', monto: 25 }, { tipo: 'ingreso', categoria: 'Salario', monto: 99 },
  ]);
  assert.deepEqual(r, [{ categoria: 'Comida', total: 35 }, { categoria: 'Transporte', total: 30 }]);
});

test('estado de deuda calcula pendiente y cuotas restantes', () => {
  const e = estadoDeuda({ id: 'd1', monto_total: 1000, cuota: 300 }, [
    { deuda_id: 'd1', monto: 300, fecha: '2026-10-01' }, { deuda_id: 'otra', monto: 999, fecha: '2026-10-01' },
  ]);
  assert.equal(e.pendiente, 700);
  assert.equal(e.cuotasRestantes, 3);
  assert.equal(e.saldada, false);
});

test('deuda sobrepagada queda saldada sin pendiente negativo', () => {
  const e = estadoDeuda({ id: 'd1', monto_total: 100 }, [{ deuda_id: 'd1', monto: 150, fecha: '2026-10-01' }]);
  assert.equal(e.pendiente, 0);
  assert.equal(e.progreso, 1);
  assert.equal(e.saldada, true);
});

test('meta con fecha calcula ahorro mensual necesario', () => {
  const e = estadoMeta({ id: 'm1', monto_objetivo: 4000000, fecha_objetivo: '2027-05-21' },
    [{ meta_id: 'm1', monto: 1000000, fecha: '2026-11-01' }, { meta_id: 'm1', monto: -100000, fecha: '2026-11-10' }],
    '2026-11-21');
  assert.equal(e.ahorrado, 900000);
  assert.equal(e.restante, 3100000);
  assert.equal(e.mesesRestantes, 6);
  assert.equal(e.ahorroMensualNecesario, Math.ceil(3100000 / 6));
});

test('meta vencida se detecta', () => {
  const e = estadoMeta({ id: 'm1', monto_objetivo: 100, fecha_objetivo: '2026-01-01' }, [], '2026-11-21');
  assert.equal(e.vencida, true);
  assert.equal(e.ahorroMensualNecesario, null);
});

test('mesesEntre y monthRange manejan bordes', () => {
  assert.equal(mesesEntre('2026-11-21', '2026-11-22'), 1);
  assert.equal(mesesEntre('2026-11-21', '2026-11-21'), 0);
  assert.deepEqual(monthRange('2026-12'), ['2026-12-01', '2027-01-01']);
  assert.deepEqual(monthRange('2026-02'), ['2026-02-01', '2026-03-01']);
});
