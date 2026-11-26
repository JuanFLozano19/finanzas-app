import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseValor, parseFechaFlexible, extraerTotal, buscar, mesCalendario, copiarSemana, compararMeses, tramoMesAnterior,
  redondeo, cierreSemestre, detectarColumnas, filasAMovimientos, lineasAMovimientos, marcarDuplicados,
} from '../js/domain/herramientas.js';

const HOY = '2026-11-25';

test('parseValor entiende formatos de pesos y signos', () => {
  assert.equal(parseValor('$ 15.000'), 15000);
  assert.equal(parseValor('1.250.000,50'), 1250000);
  assert.equal(parseValor('-15,000.00'), -15000);
  assert.equal(parseValor('(20.000)'), -20000);
  assert.equal(parseValor('$ -8.500'), -8500);
  assert.equal(parseValor(''), null);
  assert.equal(parseValor(4200), 4200);
});

test('parseFechaFlexible reconoce los formatos de bancos y Excel', () => {
  assert.equal(parseFechaFlexible('25/11/2026'), '2026-11-25');
  assert.equal(parseFechaFlexible('2026-11-03'), '2026-11-03');
  assert.equal(parseFechaFlexible('03-11-26'), '2026-11-03');
  assert.equal(parseFechaFlexible('25 nov 2026'), '2026-11-25');
  assert.equal(parseFechaFlexible('25 de noviembre', HOY), '2026-11-25');
  assert.equal(parseFechaFlexible('28 dic', '2027-01-05'), '2026-12-28');
  assert.equal(parseFechaFlexible(46351), '2026-11-25');
  assert.equal(parseFechaFlexible('hola'), null);
});

test('extraerTotal toma el TOTAL y no el subtotal ni el IVA', () => {
  const recibo = `PANADERIA LA ESPIGA\nNIT 900.123.456-7\nFecha: 24/11/2026\nPan x2   4.000\nCafe     3.500\nSUBTOTAL 7.500\nIVA        0\nTOTAL   $ 7.500\nEFECTIVO 10.000\nCAMBIO   2.500`;
  const r = extraerTotal(recibo, HOY);
  assert.equal(r.comercio, 'PANADERIA LA ESPIGA');
  assert.equal(r.fecha, '2026-11-24');
  assert.equal(r.categoria, 'Comida');
  assert.equal(r.monto, 7500);
  const sinEfectivo = extraerTotal('DROGUERIA ALIVIO\nAcetaminofen 6.200\nVr. Total\n6.200', HOY);
  assert.equal(sinEfectivo.monto, 6200);
  assert.equal(sinEfectivo.categoria, 'Salud');
  assert.equal(extraerTotal('TIENDA\nArroz 3.200\nAceite 12.900', HOY).monto, 12900);
});

test('buscar exige todas las palabras, ignora tildes y prioriza el título', () => {
  const idx = [
    { tipo: 'nota', titulo: 'Ideas para el proyecto', detalle: 'ecuaciones diferenciales' },
    { tipo: 'tarea', titulo: 'Entregar taller de EDO', detalle: 'Ecuaciones Diferenciales' },
    { tipo: 'gasto', titulo: 'Almuerzo', detalle: 'Comida $15.000' },
  ];
  assert.deepEqual(buscar(idx, 'ecuacion').map((r) => r.tipo), ['nota', 'tarea']);
  assert.equal(buscar(idx, 'taller ecuaciones')[0].tipo, 'tarea');
  assert.equal(buscar(idx, 'almuérzo')[0].tipo, 'gasto');
  assert.deepEqual(buscar(idx, 'x'), []);
});

test('mesCalendario cubre el mes en semanas de lunes a domingo', () => {
  const s = mesCalendario('2026-11');
  assert.equal(s[0][0].fecha, '2026-10-26');
  assert.equal(s[0][6].fecha, '2026-11-01');
  assert.ok(s.every((w) => w.length === 7));
  assert.equal(s.flat().filter((d) => d.delMes).length, 30);
  assert.equal(s.at(-1).at(-1).fecha, '2026-12-06');
});

test('copiarSemana pasa los turnos sueltos a la semana siguiente sin duplicar', () => {
  const ev = [
    { id: 1, tipo: 'trabajo', titulo: 'Grabación', fecha: '2026-11-16', hora_inicio: '08:00:00', hora_fin: '14:00:00', semanal: false, user_id: 'u' },
    { id: 2, tipo: 'trabajo', titulo: 'Grabación', fecha: '2026-11-18', hora_inicio: '14:00:00', hora_fin: '20:00:00', semanal: false },
    { id: 3, tipo: 'trabajo', titulo: 'Fijo', fecha: '2026-11-17', hora_inicio: '08:00:00', semanal: true },
    { id: 4, tipo: 'trabajo', titulo: 'Ya puesto', fecha: '2026-11-25', hora_inicio: '14:00:00', semanal: false },
  ];
  const n = copiarSemana(ev, '2026-11-16', '2026-11-23');
  assert.deepEqual(n.map((x) => x.fecha), ['2026-11-23']);
  assert.equal(n[0].id, undefined);
  assert.equal(n[0].user_id, undefined);
  assert.equal(n[0].hora_fin, '14:00:00');
});

test('compararMeses avisa cuando una categoría se dispara', () => {
  const act = [{ tipo: 'gasto', categoria: 'Comida', monto: 260000 }, { tipo: 'gasto', categoria: 'Transporte', monto: 50000 }, { tipo: 'ingreso', monto: 1e6 }];
  const ant = [{ tipo: 'gasto', categoria: 'Comida', monto: 200000 }, { tipo: 'gasto', categoria: 'Transporte', monto: 60000 }];
  const c = compararMeses(act, ant);
  assert.equal(c.total.actual, 310000);
  assert.equal(c.total.pct, 19);
  assert.deepEqual(c.alertas.map((a) => a.categoria), ['Comida']);
  assert.equal(c.alertas[0].pct, 30);
  assert.deepEqual(tramoMesAnterior('2026-03-31'), { desde: '2026-02-01', hasta: '2026-03-01', ym: '2026-02' });
  assert.deepEqual(tramoMesAnterior('2026-01-10'), { desde: '2025-12-01', hasta: '2025-12-11', ym: '2025-12' });
});

test('redondeo calcula lo que falta para el siguiente múltiplo', () => {
  assert.equal(redondeo(13500), 500);
  assert.equal(redondeo(14000), 0);
  assert.equal(redondeo(13500, 5000), 1500);
  assert.equal(redondeo(-5), 0);
});

test('cierreSemestre convierte notas en aprobada o perdida', () => {
  const mats = [{ id: 'a', nombre: 'EDO', estado: 'cursando' }, { id: 'b', nombre: 'BD', estado: 'cursando' }, { id: 'c', estado: 'aprobada' }, { id: 'd', estado: 'cursando' }];
  const r = cierreSemestre(mats, { a: '3,8', b: '2.9', c: '5', d: '' });
  assert.deepEqual(r.map((x) => [x.id, x.estado, x.nota_final]), [['a', 'aprobada', 3.8], ['b', 'perdida', 2.9]]);
});

test('importar: detecta columnas y convierte filas de un extracto', () => {
  const cols = detectarColumnas(['Fecha', 'Descripción', 'Valor', 'Saldo']);
  assert.deepEqual([cols.fecha, cols.descripcion, cols.valor], [0, 1, 2]);
  const filas = [
    ['24/11/2026', 'COMPRA RAPPI', '-32.500', '100.000'],
    ['23/11/2026', 'PAGO NOMINA', '1.200.000', '132.500'],
    ['xx', 'basura', '1', ''],
  ];
  const m = filasAMovimientos(filas, cols, HOY);
  assert.deepEqual(m.map((x) => [x.fecha, x.tipo, x.monto, x.categoria]), [['2026-11-24', 'gasto', 32500, 'Comida'], ['2026-11-23', 'ingreso', 1200000, 'Otros']]);
  const dc = detectarColumnas(['FECHA', 'CONCEPTO', 'DEBITO', 'CREDITO']);
  const m2 = filasAMovimientos([['2026-11-20', 'Uber', '12.000', ''], ['2026-11-21', 'Transferencia de Ana', '', '50.000']], dc, HOY);
  assert.deepEqual(m2.map((x) => [x.tipo, x.monto, x.categoria]), [['gasto', 12000, 'Transporte'], ['ingreso', 50000, 'Otros']]);
});

test('importar: lee líneas de un PDF y marca repetidos', () => {
  const txt = `Extracto Nequi\n24 nov 2026 Pago en TIENDA D1 -$ 18.900 $ 81.100\n22 nov 2026 Recibiste de JUAN PEREZ $ 100.000 $ 100.000\nSaldo total $ 81.100`;
  const m = lineasAMovimientos(txt, HOY);
  assert.deepEqual(m.map((x) => [x.fecha, x.tipo, x.monto]), [['2026-11-24', 'gasto', 18900], ['2026-11-22', 'ingreso', 100000]]);
  const d = marcarDuplicados(m, [{ fecha: '2026-11-24', tipo: 'gasto', monto: '18900.00' }]);
  assert.deepEqual(d.map((x) => x.duplicado), [true, false]);
});
