// Reglas de la carrera: promedio acumulado (PAPA), créditos, malla, plan de repaso
// y repetición espaciada (sistema Leitner). Funciones puras (ver tests/carrera.test.js).
import { addDays } from '../core/format.js';
import { estadoMateria, NOTA_APROBATORIA, eventosDelDia } from './vida.js';

const r2 = (x) => Math.round(x * 100) / 100;

/** Nota definitiva: la escrita a mano o, si ya se evaluó el 100%, la acumulada. */
export function notaFinal(m, evaluaciones = []) {
  if (m.nota_final != null) return Number(m.nota_final);
  const e = estadoMateria(evaluaciones);
  return e.pctEvaluado >= 100 ? e.acumulado : null;
}

export function resumenCarrera(materias, creditosCarrera = null) {
  const cred = (m) => Number(m.creditos) || 0;
  const conNota = materias.filter((m) => m.final != null && ['aprobada', 'perdida'].includes(m.estado));
  const pesoTotal = conNota.reduce((a, m) => a + (cred(m) || 1), 0);
  const papa = pesoTotal ? r2(conNota.reduce((a, m) => a + m.final * (cred(m) || 1), 0) / pesoTotal) : null;
  const aprobados = materias.filter((m) => m.estado === 'aprobada').reduce((a, m) => a + cred(m), 0);
  const cursando = materias.filter((m) => m.estado === 'cursando').reduce((a, m) => a + cred(m), 0);
  const semestres = [...new Set(materias.map((m) => m.semestre || 0))].sort((a, b) => a - b);
  const porSemestre = semestres.map((s) => {
    const ms = materias.filter((m) => (m.semestre || 0) === s);
    const cn = ms.filter((m) => m.final != null && m.estado !== 'pendiente');
    const p = cn.reduce((a, m) => a + (cred(m) || 1), 0);
    return { semestre: s, materias: ms, promedio: p ? r2(cn.reduce((a, m) => a + m.final * (cred(m) || 1), 0) / p) : null, creditos: ms.reduce((a, m) => a + cred(m), 0) };
  });
  return {
    papa, creditosAprobados: aprobados, creditosCursando: cursando,
    avance: creditosCarrera ? Math.min(1, aprobados / creditosCarrera) : null,
    faltan: creditosCarrera ? Math.max(0, creditosCarrera - aprobados) : null,
    perdidas: materias.filter((m) => m.estado === 'perdida').length,
    porSemestre,
  };
}

/** Estado sugerido según la nota final. */
export const estadoPorNota = (nota) => (nota == null ? null : nota >= NOTA_APROBATORIA ? 'aprobada' : 'perdida');

// ---------- Plan de repaso ----------
const aMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const aHora = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Primer hueco libre de `minutos` en un día, entre horaMin y horaMax, dejando `margen` entre actividades. */
export function huecoLibre(ocupados, minutos, { horaMin = '07:00', horaMax = '22:00', margen = 15 } = {}) {
  const bloques = ocupados.filter((o) => o.inicio).map((o) => {
    const i = aMin(o.inicio);
    let f = o.fin ? aMin(o.fin) : i + 60;
    if (f <= i) f = 1440;
    return [i - margen, f + margen];
  }).sort((a, b) => a[0] - b[0]);
  let t = aMin(horaMin);
  const limite = aMin(horaMax);
  for (const [i, f] of bloques) {
    if (t + minutos <= i) break;
    t = Math.max(t, f);
  }
  return t + minutos <= limite ? { inicio: aHora(t), fin: aHora(t + minutos) } : null;
}

/**
 * Reparte `sesiones` de repaso en días distintos antes de la evaluación,
 * en huecos que no choquen con clases, turnos ni otros eventos.
 */
export function planearRepaso(eventos, { desde, examen, sesiones = 3, minutos = 60, horaMin, horaMax }) {
  const dias = [];
  for (let d = desde; d < examen; d = addDays(d, 1)) {
    const ocupados = eventosDelDia(eventos, d).map((e) => ({ inicio: e.hora_inicio?.slice(0, 5), fin: e.hora_fin?.slice(0, 5) }));
    const hueco = huecoLibre(ocupados, minutos, { horaMin, horaMax });
    if (hueco) dias.push({ fecha: d, ...hueco });
  }
  if (dias.length <= sesiones) return dias;
  // Espaciado uniforme, terminando el día antes del examen (repaso más fresco).
  const elegidos = [];
  for (let i = 0; i < sesiones; i++) elegidos.push(dias[Math.round(((dias.length - 1) * (i + 1)) / sesiones)]);
  return [...new Map(elegidos.map((x) => [x.fecha, x])).values()];
}

// ---------- Repetición espaciada (Leitner) ----------
export const INTERVALOS = [1, 2, 4, 8, 16];

export function siguienteRepaso(tarjeta, acierto, hoyIso) {
  const caja = acierto ? Math.min(5, Number(tarjeta.caja || 1) + 1) : 1;
  return {
    caja,
    proxima: addDays(hoyIso, acierto ? INTERVALOS[caja - 1] : 1),
    aciertos: Number(tarjeta.aciertos || 0) + (acierto ? 1 : 0),
    fallos: Number(tarjeta.fallos || 0) + (acierto ? 0 : 1),
  };
}

export const tarjetasPendientes = (tarjetas, hoyIso) => tarjetas.filter((t) => t.proxima <= hoyIso);
