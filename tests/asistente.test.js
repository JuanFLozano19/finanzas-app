import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, parseMonto, parseFecha, categoriaDe } from '../js/domain/asistente.js';
import { proximoCumple, estadoContacto, enlaceWhatsApp, progresoMetaVida } from '../js/domain/bienestar.js';

const HOY = '2026-11-21'; // sábado

test('montos en formatos colombianos', () => {
  assert.equal(parseMonto('gasté 15 mil').valor, 15000);
  assert.equal(parseMonto('15k').valor, 15000);
  assert.equal(parseMonto('$15.000').valor, 15000);
  assert.equal(parseMonto('1,5 millones').valor, 1500000);
  assert.equal(parseMonto('20 lucas').valor, 20000);
  assert.equal(parseMonto('2 palos').valor, 2000000);
  assert.equal(parseMonto('tomé 2 vasos'), null);
});

test('fechas relativas', () => {
  assert.equal(parseFecha('mañana', HOY).fecha, '2026-11-22');
  assert.equal(parseFecha('pasado mañana', HOY).fecha, '2026-11-23');
  assert.equal(parseFecha('el jueves', HOY).fecha, '2026-11-26');
  assert.equal(parseFecha('el sábado', HOY).fecha, '2026-11-28');
  assert.equal(parseFecha('para el 5 de diciembre', HOY).fecha, '2026-12-05');
  assert.equal(parseFecha('el 3/1', HOY).fecha, '2027-01-03');
});

test('gastos con categoría y descripción', () => {
  assert.deepEqual(interpretar('gasté 15 mil en almuerzo', HOY), { tipo: 'gasto', monto: 15000, categoria: 'Comida', descripcion: 'almuerzo', fecha: HOY });
  const b = interpretar('pagué 2.500 de bus ayer', HOY);
  assert.equal(b.categoria, 'Transporte');
  assert.equal(b.fecha, '2026-11-20');
  assert.equal(interpretar('almuerzo 12 mil', HOY).tipo, 'gasto');
  assert.equal(categoriaDe('recarga de datos'), 'Celular e internet');
});

test('ingresos', () => {
  const r = interpretar('me pagaron 350 mil del trabajo', HOY);
  assert.equal(r.tipo, 'ingreso');
  assert.equal(r.monto, 350000);
  assert.equal(r.descripcion, 'trabajo');
});

test('horas, sueño, agua, entreno y lectura', () => {
  assert.deepEqual(interpretar('dormí 7 horas', HOY), { tipo: 'sueno', horas: 7, fecha: HOY });
  assert.deepEqual(interpretar('tomé 2 vasos de agua', HOY), { tipo: 'agua', vasos: 2 });
  assert.deepEqual(interpretar('entrené 45 min de gimnasio', HOY), { tipo: 'entreno', minutos: 45, actividad: 'Gimnasio', fecha: HOY });
  assert.equal(interpretar('corrí 1 hora', HOY).minutos, 60);
  assert.deepEqual(interpretar('leí 20 páginas', HOY), { tipo: 'lectura', cantidad: 20 });
});

test('turnos de trabajo', () => {
  assert.deepEqual(interpretar('turno mañana de 8 a 2', HOY), { tipo: 'turno', titulo: 'Turno', fecha: '2026-11-22', hora_inicio: '08:00', hora_fin: '14:00' });
  const r = interpretar('tengo turno de grabación el jueves de 2 a 6 pm', HOY);
  assert.deepEqual([r.titulo, r.fecha, r.hora_inicio, r.hora_fin], ['Turno de grabación', '2026-11-26', '14:00', '18:00']);
  const n = interpretar('turno de noche hoy de 10 pm a 6 am', HOY);
  assert.deepEqual([n.hora_inicio, n.hora_fin], ['22:00', '06:00']);
  assert.equal(interpretar('turno hoy 14:30 a 18:00', HOY).hora_inicio, '14:30');
});

test('préstamos', () => {
  const r = interpretar('le presté 50 mil a Carlos', HOY);
  assert.deepEqual([r.tipo, r.monto, r.persona], ['prestamo', 50000, 'Carlos']);
});

test('eventos y tareas', () => {
  const e = interpretar('parcial de bases de datos el jueves a las 2', HOY);
  assert.deepEqual([e.tipo, e.fecha, e.hora, e.tipoEvento], ['evento', '2026-11-26', '14:00', 'entrega']);
  assert.equal(e.titulo, 'Parcial de bases de datos');
  const t = interpretar('tengo que entregar el taller de EDO mañana', HOY);
  assert.deepEqual([t.tipo, t.titulo, t.fecha], ['tarea', 'Entregar el taller de EDO', '2026-11-22']);
  assert.deepEqual(interpretar('nota: idea para la app', HOY), { tipo: 'nota', contenido: 'idea para la app' });
  assert.equal(interpretar('', HOY).tipo, 'desconocido');
});

test('cumpleaños, contacto y WhatsApp', () => {
  assert.deepEqual(proximoCumple({ cumple_mes: 11, cumple_dia: 25 }, HOY), { fecha: '2026-11-25', dias: 4 });
  assert.equal(proximoCumple({ cumple_mes: 1, cumple_dia: 2 }, HOY).fecha, '2027-01-02');
  assert.equal(proximoCumple({ cumple_mes: 2, cumple_dia: 29 }, '2026-03-01').fecha, '2027-02-28');
  assert.equal(estadoContacto({ frecuencia_dias: 7, ultimo_contacto: '2026-11-10' }, HOY).toca, true);
  assert.equal(estadoContacto({ frecuencia_dias: 30, ultimo_contacto: '2026-11-10' }, HOY).toca, false);
  assert.equal(enlaceWhatsApp('300 123 4567'), 'https://wa.me/573001234567');
  assert.equal(progresoMetaVida([{ hecho: true }, { hecho: false }]), 0.5);
});
