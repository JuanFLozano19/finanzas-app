// Motivación: mapa anual de hábitos, mejor racha, logros y "tu año en Rumbo".
// Funciones puras (ver tests/motivacion.test.js).
import { addDays, weekday } from '../core/format.js';
import { tocaEnFecha } from './vida.js';

/** Por cada día de los últimos `dias`: cuántos hábitos tocaban y cuántos se cumplieron. */
export function mapaHabitos(habitos, hoyIso, dias = 371) {
  const desde = addDays(hoyIso, -(dias - 1));
  const out = [];
  for (let d = desde; d <= hoyIso; d = addDays(d, 1)) {
    let tocan = 0;
    let hechos = 0;
    for (const h of habitos) {
      if (h.created_at && d < h.created_at.slice(0, 10)) continue;
      if (!tocaEnFecha(h, d)) continue;
      tocan++;
      if (h.fechas.has(d)) hechos++;
    }
    out.push({ fecha: d, tocan, hechos, nivel: tocan ? nivelDe(hechos / tocan) : null });
  }
  return out;
}
/** 0 = nada, 1–4 = intensidad creciente (escala secuencial de un solo tono). */
export const nivelDe = (r) => (r <= 0 ? 0 : r < 0.34 ? 1 : r < 0.67 ? 2 : r < 1 ? 3 : 4);

/** La racha más larga de días programados cumplidos seguidos. */
export function mejorRacha(habito, fechas) {
  const orden = [...fechas].sort();
  if (!orden.length) return 0;
  let mejor = 0;
  let actual = 0;
  let d = orden[0];
  const fin = orden[orden.length - 1];
  for (; d <= fin; d = addDays(d, 1)) {
    if (!tocaEnFecha(habito, d)) continue;
    if (fechas.has(d)) { actual++; mejor = Math.max(mejor, actual); } else actual = 0;
  }
  return mejor;
}

// ---------- Logros ----------
const DEF = [
  ['racha7', '🔥', 'Una semana sin fallar', 'Racha de 7 días en un hábito', (c) => c.mejorRacha, 7],
  ['racha30', '🌋', 'Un mes de constancia', 'Racha de 30 días en un hábito', (c) => c.mejorRacha, 30],
  ['racha100', '💎', 'Cien días', 'Racha de 100 días en un hábito', (c) => c.mejorRacha, 100],
  ['tareas10', '✅', 'Arrancando', 'Completa 10 tareas', (c) => c.tareas, 10],
  ['tareas100', '🏗️', 'Máquina de tareas', 'Completa 100 tareas', (c) => c.tareas, 100],
  ['meta1', '🎯', 'Meta cumplida', 'Compra algo que ahorraste en una meta', (c) => c.metas, 1],
  ['ahorro1m', '💰', 'Primer millón', 'Ahorra $1.000.000 en tus metas', (c) => c.ahorrado, 1000000],
  ['revision4', '🧭', 'Con rumbo', 'Haz 4 revisiones semanales', (c) => c.revisiones, 4],
  ['libro1', '📖', 'Lector', 'Termina un libro o curso', (c) => c.libros, 1],
  ['libro5', '📚', 'Biblioteca', 'Termina 5 libros o cursos', (c) => c.libros, 5],
  ['entreno20', '💪', 'Constancia física', 'Registra 20 entrenamientos', (c) => c.entrenos, 20],
  ['estudio10', '⏱', 'Diez horas de foco', 'Suma 10 horas de estudio con Pomodoro', (c) => c.horasEstudio, 10],
  ['turnos50', '💼', 'Trabajador incansable', 'Completa 50 turnos', (c) => c.turnos, 50],
  ['diario30', '📔', 'Querido diario', 'Escribe 30 días en tu diario', (c) => c.diario, 30],
  ['tarjetas50', '🃏', 'Memoria de elefante', 'Acierta 50 tarjetas de repaso', (c) => c.aciertos, 50],
  ['deuda0', '🕊️', 'Libre de deudas', 'Paga completa una deuda', (c) => c.deudasPagadas, 1],
];

export function logros(conteos) {
  return DEF.map(([id, icono, titulo, desc, valor, meta]) => {
    const v = Number(valor(conteos)) || 0;
    return { id, icono, titulo, desc, valor: v, meta, logrado: v >= meta, progreso: Math.min(1, v / meta) };
  });
}

// ---------- Tu año ----------
/** Mes (YYYY-MM) con mejor balance de una serie [{ym, balance}]. */
export const mejorMes = (serie) => serie.filter((s) => s.balance !== 0).sort((a, b) => b.balance - a.balance)[0] || null;

/** Día de la semana en que más turnos/horas hubo: devuelve 0–6 o null. */
export function diaMasOcupado(instancias, horasDe) {
  const tot = Array(7).fill(0);
  for (const i of instancias) tot[weekday(i.fecha)] += horasDe(i.evento);
  const max = Math.max(...tot);
  return max > 0 ? tot.indexOf(max) : null;
}
