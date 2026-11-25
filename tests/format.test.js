import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtRelativa, fmtDate } from '../js/core/format.js';

test('fmtRelativa dice la fecha en palabras cuando está cerca', () => {
  const base = '2026-11-25';
  assert.equal(fmtRelativa('2026-11-25', base), 'hoy');
  assert.equal(fmtRelativa('2026-11-26', base), 'mañana');
  assert.equal(fmtRelativa('2026-11-24', base), 'ayer');
  assert.equal(fmtRelativa('2026-11-30', base), 'en 5 días');
  assert.equal(fmtRelativa('2026-11-23', base), 'hace 2 días');
  assert.equal(fmtRelativa('2026-12-20', base), fmtDate('2026-12-20'));
});

test('fmtDate incluye el año solo si se pide o si es de otro año', () => {
  const este = new Date().getFullYear();
  assert.ok(!fmtDate(`${este}-03-14`).includes(String(este)));
  assert.ok(fmtDate(`${este}-03-14`, { anio: true }).includes(String(este)));
  assert.ok(fmtDate(`${este + 1}-03-14`).includes(String(este + 1)));
});
