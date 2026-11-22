// Reglas de negocio de los módulos de vida. Funciones puras, probadas en tests/vida.test.js.
import { addDays, weekday } from '../core/format.js';

// ---------- Hábitos ----------
export const tocaEnFecha = (habito, iso) => (habito.dias || []).includes(weekday(iso));

/**
 * Racha: días programados seguidos cumplidos hasta hoy.
 * Si hoy toca y aún no lo marcas, la racha no se rompe (cuenta desde ayer).
 */
export function racha(habito, fechasHechas, hoyIso, maxDias = 400) {
  let n = 0;
  let iso = hoyIso;
  if (tocaEnFecha(habito, iso) && !fechasHechas.has(iso)) iso = addDays(iso, -1);
  for (let i = 0; i < maxDias; i++, iso = addDays(iso, -1)) {
    if (habito.created_at && iso < habito.created_at.slice(0, 10)) break;
    if (!tocaEnFecha(habito, iso)) continue;
    if (fechasHechas.has(iso)) n++;
    else break;
  }
  return n;
}

/** % de cumplimiento en los últimos `dias` días programados. */
export function cumplimiento(habito, fechasHechas, hoyIso, dias = 30) {
  let prog = 0;
  let hechos = 0;
  for (let i = 0; i < dias; i++) {
    const iso = addDays(hoyIso, -i);
    if (habito.created_at && iso < habito.created_at.slice(0, 10)) break;
    if (!tocaEnFecha(habito, iso)) continue;
    prog++;
    if (fechasHechas.has(iso)) hechos++;
  }
  return prog ? hechos / prog : 0;
}

// ---------- Agenda ----------
export function eventosDelDia(eventos, iso) {
  return eventos
    .filter((e) => e.fecha === iso || (e.semanal && e.fecha <= iso && (!e.fecha_fin || iso <= e.fecha_fin) && weekday(e.fecha) === weekday(iso)))
    .sort((a, b) => (a.hora_inicio || '99') < (b.hora_inicio || '99') ? -1 : 1);
}

// ---------- Tareas ----------
export function agruparTareas(tareas, hoyIso) {
  const g = { vencidas: [], hoy: [], proximas: [], sinFecha: [], hechas: [] };
  const porPrioridad = (a, b) => a.prioridad - b.prioridad || (a.fecha_limite || '9') .localeCompare(b.fecha_limite || '9');
  for (const t of tareas) {
    if (t.hecha) g.hechas.push(t);
    else if (!t.fecha_limite) g.sinFecha.push(t);
    else if (t.fecha_limite < hoyIso) g.vencidas.push(t);
    else if (t.fecha_limite === hoyIso) g.hoy.push(t);
    else g.proximas.push(t);
  }
  for (const k of ['vencidas', 'hoy', 'sinFecha']) g[k].sort(porPrioridad);
  g.proximas.sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite) || a.prioridad - b.prioridad);
  g.hechas.sort((a, b) => (b.hecha_at || '').localeCompare(a.hecha_at || ''));
  return g;
}

// ---------- Universidad (escala colombiana 0.0 – 5.0) ----------
export const NOTA_APROBATORIA = 3.0;

export function estadoMateria(evaluaciones) {
  const calificadas = evaluaciones.filter((e) => e.nota != null);
  const pctTotal = evaluaciones.reduce((a, e) => a + Number(e.porcentaje), 0);
  const pctEvaluado = calificadas.reduce((a, e) => a + Number(e.porcentaje), 0);
  const acumulado = calificadas.reduce((a, e) => a + Number(e.nota) * Number(e.porcentaje) / 100, 0);
  const pctRestante = Math.max(0, 100 - pctEvaluado);
  const promedio = pctEvaluado > 0 ? acumulado / (pctEvaluado / 100) : null;
  let necesaria = null;
  if (pctRestante > 0) necesaria = Math.max(0, (NOTA_APROBATORIA - acumulado) / (pctRestante / 100));
  return {
    acumulado: round2(acumulado),
    promedio: promedio == null ? null : round2(promedio),
    pctEvaluado: round2(pctEvaluado),
    pctTotal: round2(pctTotal),
    pctRestante: round2(pctRestante),
    notaNecesaria: necesaria == null ? null : round2(necesaria),
    imposible: necesaria != null && necesaria > 5,
    aprobada: acumulado >= NOTA_APROBATORIA,
    perdida: pctRestante === 0 && acumulado < NOTA_APROBATORIA,
  };
}

/** Promedio ponderado por créditos de las materias con al menos una nota. */
export function promedioSemestre(materias) {
  const con = materias.filter((m) => m.estado.promedio != null);
  const peso = (m) => Number(m.creditos) || 1;
  const total = con.reduce((a, m) => a + peso(m), 0);
  return total ? round2(con.reduce((a, m) => a + m.estado.promedio * peso(m), 0) / total) : null;
}

// ---------- Trabajo por horas ----------
export function resumenHoras(registros) {
  const valor = (r) => Number(r.horas) * Number(r.tarifa);
  const pend = registros.filter((r) => !r.pagado);
  return {
    horasPendientes: round2(pend.reduce((a, r) => a + Number(r.horas), 0)),
    montoPendiente: Math.round(pend.reduce((a, r) => a + valor(r), 0)),
    horasTotales: round2(registros.reduce((a, r) => a + Number(r.horas), 0)),
    montoTotal: Math.round(registros.reduce((a, r) => a + valor(r), 0)),
    pendientes: pend,
  };
}

// ---------- Salud ----------
export function resumenSemanaSalud(entrenamientos, registros, hoyIso) {
  const desde = addDays(hoyIso, -6);
  const ent = entrenamientos.filter((e) => e.fecha >= desde && e.fecha <= hoyIso);
  const regs = registros.filter((r) => r.fecha >= desde && r.fecha <= hoyIso);
  const sueno = regs.filter((r) => r.horas_sueno != null);
  const agua = regs.filter((r) => r.vasos_agua != null);
  const pesos = registros.filter((r) => r.peso_kg != null).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    minutosEjercicio: ent.reduce((a, e) => a + Number(e.duracion_min), 0),
    sesiones: ent.length,
    suenoPromedio: sueno.length ? round2(sueno.reduce((a, r) => a + Number(r.horas_sueno), 0) / sueno.length) : null,
    aguaPromedio: agua.length ? round2(agua.reduce((a, r) => a + Number(r.vasos_agua), 0) / agua.length) : null,
    pesoActual: pesos[0]?.peso_kg != null ? Number(pesos[0].peso_kg) : null,
    pesoAnterior: pesos[1]?.peso_kg != null ? Number(pesos[1].peso_kg) : null,
  };
}

/** Nota final si las evaluaciones sin nota sacan lo indicado en `simuladas` ({id: nota}). */
export function simularMateria(evaluaciones, simuladas) {
  const ev = evaluaciones.map((e) => (e.nota == null && simuladas[e.id] != null ? { ...e, nota: simuladas[e.id] } : e));
  return estadoMateria(ev);
}

/** Primera fecha >= desde que cae en el día de la semana indicado (0 = domingo). */
export function primerDia(desdeIso, dia) {
  const delta = (dia - weekday(desdeIso) + 7) % 7;
  return addDays(desdeIso, delta);
}

/** Minutos de estudio por materia (y total) en un rango de fechas. */
export function minutosPorMateria(sesiones, desde, hasta) {
  const mapa = new Map();
  let total = 0;
  for (const s of sesiones) {
    if (s.fecha < desde || s.fecha > hasta) continue;
    const k = s.materia_id || 'sin';
    mapa.set(k, (mapa.get(k) || 0) + Number(s.minutos));
    total += Number(s.minutos);
  }
  return { porMateria: mapa, total };
}

/** Convierte "Ana - 3001234567\nLuis" en [{nombre, contacto}]. */
export function parseIntegrantes(texto) {
  return String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [nombre, ...resto] = l.split(/\s+[-–:]\s+/);
    return { nombre: nombre.trim(), contacto: resto.join(' - ').trim() || null };
  });
}

function round2(x) { return Math.round(x * 100) / 100; }
