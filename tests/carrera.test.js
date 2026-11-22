import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notaFinal, resumenCarrera, estadoPorNota, huecoLibre, planearRepaso, siguienteRepaso, tarjetasPendientes } from '../js/domain/carrera.js';

test('nota final: manual o acumulada al 100%', () => {
  assert.equal(notaFinal({ nota_final: 4.2 }), 4.2);
  assert.equal(notaFinal({}, [{ porcentaje: 50, nota: 4 }, { porcentaje: 50, nota: 3 }]), 3.5);
  assert.equal(notaFinal({}, [{ porcentaje: 50, nota: 4 }, { porcentaje: 50, nota: null }]), null);
});

test('PAPA ponderado por créditos y avance de carrera', () => {
  const r = resumenCarrera([
    { semestre: 1, creditos: 4, estado: 'aprobada', final: 4 },
    { semestre: 1, creditos: 2, estado: 'perdida', final: 2.5 },
    { semestre: 2, creditos: 3, estado: 'cursando', final: null },
    { semestre: 3, creditos: 3, estado: 'pendiente', final: null },
  ], 20);
  assert.equal(r.papa, 3.5);
  assert.equal(r.creditosAprobados, 4);
  assert.equal(r.creditosCursando, 3);
  assert.equal(r.avance, 0.2);
  assert.equal(r.faltan, 16);
  assert.equal(r.porSemestre[0].promedio, 3.5);
  assert.equal(estadoPorNota(2.99), 'perdida');
});

test('hueco libre evita clases y turnos con margen', () => {
  assert.deepEqual(huecoLibre([{ inicio: '07:00', fin: '10:00' }, { inicio: '11:30', fin: '18:00' }], 60), { inicio: '10:15', fin: '11:15' });
  assert.deepEqual(huecoLibre([{ inicio: '07:00', fin: '10:00' }, { inicio: '11:00', fin: '18:00' }], 60), { inicio: '18:15', fin: '19:15' });
  assert.deepEqual(huecoLibre([{ inicio: '08:00', fin: '10:00' }], 45), { inicio: '07:00', fin: '07:45' });
  assert.deepEqual(huecoLibre([{ inicio: '07:30', fin: '10:00' }], 45), { inicio: '10:15', fin: '11:00' });
  assert.equal(huecoLibre([{ inicio: '07:00', fin: '21:30' }], 60), null);
  assert.deepEqual(huecoLibre([{ inicio: '22:00', fin: '06:00' }], 60), { inicio: '07:00', fin: '08:00' });
});

test('plan de repaso reparte sesiones en días distintos antes del examen', () => {
  const ev = [{ id: 1, fecha: '2026-11-23', semanal: true, hora_inicio: '07:00:00', hora_fin: '20:00:00' }];
  const plan = planearRepaso(ev, { desde: '2026-11-23', examen: '2026-11-30', sesiones: 3, minutos: 60 });
  assert.equal(plan.length, 3);
  assert.ok(plan.every((p) => p.fecha < '2026-11-30' && p.fecha !== '2026-11-23'));
  assert.equal(plan[plan.length - 1].fecha, '2026-11-29');
  assert.equal(new Set(plan.map((p) => p.fecha)).size, 3);
});

test('Leitner: subir de caja al acertar, volver a 1 al fallar', () => {
  assert.deepEqual(siguienteRepaso({ caja: 2, aciertos: 1, fallos: 0 }, true, '2026-11-22'), { caja: 3, proxima: '2026-11-26', aciertos: 2, fallos: 0 });
  assert.deepEqual(siguienteRepaso({ caja: 4 }, false, '2026-11-22'), { caja: 1, proxima: '2026-11-23', aciertos: 0, fallos: 1 });
  assert.equal(siguienteRepaso({ caja: 5 }, true, '2026-11-22').caja, 5);
  assert.equal(tarjetasPendientes([{ proxima: '2026-11-22' }, { proxima: '2026-11-25' }], '2026-11-22').length, 1);
});
