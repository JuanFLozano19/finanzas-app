import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapaHabitos, nivelDe, mejorRacha, logros, mejorMes, diaMasOcupado } from '../js/domain/motivacion.js';

const diario = { dias: [0, 1, 2, 3, 4, 5, 6], created_at: '2026-11-15T00:00:00Z' };

test('mapa de hábitos: niveles por día', () => {
  const hs = [{ ...diario, fechas: new Set(['2026-11-20', '2026-11-21']) }, { ...diario, fechas: new Set(['2026-11-21']) }];
  const m = mapaHabitos(hs, '2026-11-21', 10);
  assert.equal(m.length, 10);
  assert.equal(m[0].nivel, null); // antes de crear los hábitos
  assert.deepEqual(m.at(-1), { fecha: '2026-11-21', tocan: 2, hechos: 2, nivel: 4 });
  assert.equal(m.at(-2).nivel, 2);
  assert.deepEqual([0, 0.2, 0.5, 0.8, 1].map(nivelDe), [0, 1, 2, 3, 4]);
});

test('mejor racha histórica', () => {
  const f = new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']);
  assert.equal(mejorRacha(diario, f), 3);
  const lunVie = { dias: [1, 2, 3, 4, 5] };
  // vie 20 y lun 23 seguidos (el fin de semana no toca)
  assert.equal(mejorRacha(lunVie, new Set(['2026-11-19', '2026-11-20', '2026-11-23'])), 3);
  assert.equal(mejorRacha(diario, new Set()), 0);
});

test('logros con progreso', () => {
  const l = logros({ mejorRacha: 8, tareas: 50, metas: 0, ahorrado: 0, revisiones: 0, libros: 1, entrenos: 0, horasEstudio: 0, turnos: 0, diario: 0, aciertos: 0, deudasPagadas: 0 });
  const por = Object.fromEntries(l.map((x) => [x.id, x]));
  assert.equal(por.racha7.logrado, true);
  assert.equal(por.racha30.logrado, false);
  assert.equal(por.tareas100.progreso, 0.5);
  assert.equal(por.libro1.logrado, true);
});

test('mejor mes y día más ocupado', () => {
  assert.equal(mejorMes([{ ym: '2026-01', balance: 10 }, { ym: '2026-02', balance: 50 }, { ym: '2026-03', balance: 0 }]).ym, '2026-02');
  assert.equal(mejorMes([]), null);
  assert.equal(diaMasOcupado([{ fecha: '2026-11-16', evento: { h: 4 } }, { fecha: '2026-11-21', evento: { h: 8 } }], (e) => e.h), 6);
});
