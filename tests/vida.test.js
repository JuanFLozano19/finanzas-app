import { test } from 'node:test';
import assert from 'node:assert/strict';
import { racha, cumplimiento, eventosDelDia, agruparTareas, estadoMateria, promedioSemestre, resumenHoras, resumenSemanaSalud } from '../js/domain/vida.js';
import { addDays, startOfWeek, weekday } from '../js/core/format.js';

const diario = { dias: [0, 1, 2, 3, 4, 5, 6], created_at: '2026-01-01T00:00:00Z' };

test('fechas: addDays, weekday y lunes de la semana', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekday('2026-11-21'), 6); // sábado
  assert.equal(startOfWeek('2026-11-21'), '2026-11-16');
  assert.equal(startOfWeek('2026-11-22'), '2026-11-16'); // domingo pertenece a la semana del lunes anterior
});

test('racha no se rompe si hoy aún no se marca', () => {
  const hechas = new Set(['2026-11-20', '2026-11-19', '2026-11-18']);
  assert.equal(racha(diario, hechas, '2026-11-21'), 3);
  hechas.add('2026-11-21');
  assert.equal(racha(diario, hechas, '2026-11-21'), 4);
});

test('racha salta días que no tocan', () => {
  const lunVie = { dias: [1, 2, 3, 4, 5], created_at: '2026-01-01' };
  // vie 20, jue 19 hechos; sáb 21 no toca
  assert.equal(racha(lunVie, new Set(['2026-11-20', '2026-11-19']), '2026-11-21'), 2);
});

test('cumplimiento cuenta solo días programados', () => {
  const h = { dias: [0, 1, 2, 3, 4, 5, 6], created_at: '2026-11-18' };
  assert.equal(cumplimiento(h, new Set(['2026-11-18', '2026-11-20']), '2026-11-21'), 0.5);
});

test('eventos semanales se repiten el mismo día de la semana', () => {
  const ev = [
    { id: 1, fecha: '2026-11-17', semanal: true, hora_inicio: '10:00' },
    { id: 2, fecha: '2026-11-24', semanal: false, hora_inicio: '08:00' },
    { id: 3, fecha: '2026-12-01', semanal: true, hora_inicio: '07:00' },
  ];
  assert.deepEqual(eventosDelDia(ev, '2026-11-24').map((e) => e.id), [2, 1]);
  assert.deepEqual(eventosDelDia(ev, '2026-11-10').map((e) => e.id), []);
});

test('tareas se agrupan por vencimiento', () => {
  const g = agruparTareas([
    { id: 'a', fecha_limite: '2026-11-20', prioridad: 2, hecha: false },
    { id: 'b', fecha_limite: '2026-11-21', prioridad: 1, hecha: false },
    { id: 'c', fecha_limite: null, prioridad: 3, hecha: false },
    { id: 'd', fecha_limite: '2026-11-25', prioridad: 1, hecha: false },
    { id: 'e', fecha_limite: '2026-11-01', prioridad: 1, hecha: true },
  ], '2026-11-21');
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((t) => t.id)])),
    { vencidas: ['a'], hoy: ['b'], proximas: ['d'], sinFecha: ['c'], hechas: ['e'] });
});

test('materia: acumulado, promedio y nota necesaria para 3.0', () => {
  const e = estadoMateria([
    { porcentaje: 30, nota: 3.5 }, { porcentaje: 30, nota: 2.5 }, { porcentaje: 40, nota: null },
  ]);
  assert.equal(e.acumulado, 1.8);
  assert.equal(e.promedio, 3);
  assert.equal(e.pctRestante, 40);
  assert.equal(e.notaNecesaria, 3);
  assert.equal(e.imposible, false);
});

test('materia perdida e imposible de recuperar', () => {
  const e = estadoMateria([{ porcentaje: 80, nota: 1 }, { porcentaje: 20, nota: null }]);
  assert.equal(e.imposible, true);
  const p = estadoMateria([{ porcentaje: 100, nota: 2.9 }]);
  assert.equal(p.perdida, true);
});

test('promedio del semestre ponderado por créditos', () => {
  assert.equal(promedioSemestre([
    { creditos: 4, estado: { promedio: 4 } }, { creditos: 2, estado: { promedio: 3 } }, { creditos: 3, estado: { promedio: null } },
  ]), 3.67);
});

test('horas de trabajo pendientes por cobrar', () => {
  const r = resumenHoras([
    { horas: 4, tarifa: 12000, pagado: false }, { horas: 2.5, tarifa: 12000, pagado: false }, { horas: 8, tarifa: 10000, pagado: true },
  ]);
  assert.equal(r.horasPendientes, 6.5);
  assert.equal(r.montoPendiente, 78000);
  assert.equal(r.montoTotal, 158000);
});

test('resumen semanal de salud', () => {
  const r = resumenSemanaSalud(
    [{ fecha: '2026-11-21', duracion_min: 30 }, { fecha: '2026-11-15', duracion_min: 60 }, { fecha: '2026-11-10', duracion_min: 90 }],
    [{ fecha: '2026-11-21', horas_sueno: 7, vasos_agua: 8, peso_kg: 70 }, { fecha: '2026-11-20', horas_sueno: 6, peso_kg: 70.5 }],
    '2026-11-21');
  assert.equal(r.minutosEjercicio, 90);
  assert.equal(r.sesiones, 2);
  assert.equal(r.suenoPromedio, 6.5);
  assert.equal(r.pesoActual, 70);
  assert.equal(r.pesoAnterior, 70.5);
});
