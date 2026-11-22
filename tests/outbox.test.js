import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarPendientes, cumpleFiltros, esErrorDeRed } from '../js/data/outbox.js';

const filas = [{ id: 'a', monto: 10, fecha: '2026-11-01' }, { id: 'b', monto: 20, fecha: '2026-11-02' }];

test('aplica inserciones, ediciones y borrados pendientes', () => {
  const ops = [
    { table: 'movimientos', op: 'insert', values: { id: 'c', monto: 5, fecha: '2026-11-03' } },
    { table: 'movimientos', op: 'update', id: 'a', values: { monto: 99 } },
    { table: 'movimientos', op: 'delete', id: 'b' },
    { table: 'otra', op: 'delete', id: 'a' },
  ];
  const r = aplicarPendientes('movimientos', filas, [], 'fecha', false, ops);
  assert.deepEqual(r.map((x) => [x.id, x.monto]), [['c', 5], ['a', 99]]);
  assert.equal(r[0]._pendiente, true);
});

test('las inserciones respetan los filtros de la consulta', () => {
  const ops = [{ table: 't', op: 'insert', values: { id: 'z', fecha: '2026-12-05' } }];
  const r = aplicarPendientes('t', [], [['fecha', 'gte', '2026-11-01'], ['fecha', 'lt', '2026-12-01']], null, false, ops);
  assert.equal(r.length, 0);
});

test('upsert pendiente reemplaza por llave de conflicto', () => {
  const ops = [{ table: 'registros_salud', op: 'upsert', onConflict: 'user_id,fecha', values: { fecha: '2026-11-21', vasos_agua: 4 } }];
  const r = aplicarPendientes('registros_salud', [{ id: 's', fecha: '2026-11-21', vasos_agua: 2, peso_kg: 70 }], [], null, false, ops);
  assert.deepEqual([r[0].vasos_agua, r[0].peso_kg], [4, 70]);
});

test('deleteWhere y filtros', () => {
  assert.equal(cumpleFiltros({ a: 1, b: 'x' }, [['a', 'eq', '1'], ['b', 'neq', 'y']]), true);
  const ops = [{ table: 'r', op: 'deleteWhere', filters: [['habito_id', 'eq', 'h1'], ['fecha', 'eq', '2026-11-21']] }];
  const r = aplicarPendientes('r', [{ id: 1, habito_id: 'h1', fecha: '2026-11-21' }, { id: 2, habito_id: 'h1', fecha: '2026-11-20' }], [], null, false, ops);
  assert.deepEqual(r.map((x) => x.id), [2]);
});

test('detecta errores de red', () => {
  assert.equal(esErrorDeRed(new TypeError('Failed to fetch')), true);
  assert.equal(esErrorDeRed(new Error('duplicate key value')), false);
});
