// Logros y resumen anual: junta datos de varios módulos (solo lectura).
import { today } from '../core/format.js';
import { sum, estadoDeuda } from '../domain/calculos.js';
import { instancias, duracionHoras } from '../domain/vida.js';
import { serieMensual } from '../domain/plata.js';
import { mejorRacha, logros, mejorMes, diaMasOcupado } from '../domain/motivacion.js';
import { notaFinal } from '../domain/carrera.js';

export class MotivacionService {
  constructor(repos) { this.r = repos; }

  async #habitosConFechas(desde) {
    const [habitos, regs] = await Promise.all([
      this.r.habitos.list({ orderBy: 'created_at', ascending: true }),
      this.r.registrosHabito.list({ orderBy: 'fecha', filters: desde ? [['fecha', 'gte', desde]] : [] }),
    ]);
    return habitos.map((h) => ({ ...h, fechas: new Set(regs.filter((x) => x.habito_id === h.id).map((x) => x.fecha)) }));
  }

  async conteos() {
    const hoy = today();
    const [habitos, tareas, metas, aportes, revisiones, lecturas, entrenos, sesiones, eventos, notas, tarjetas, deudas, pagos] = await Promise.all([
      this.#habitosConFechas(null),
      this.r.tareas.list({ filters: [['hecha', 'eq', true]] }),
      this.r.metas.list(), this.r.aportes.list({ orderBy: 'fecha' }), this.r.revisiones.list({ orderBy: 'semana' }),
      this.r.lecturas.list(), this.r.entrenamientos.list({ orderBy: 'fecha' }), this.r.sesiones.list({ orderBy: 'fecha' }),
      this.r.eventos.list({ orderBy: 'fecha', ascending: true, filters: [['tipo', 'eq', 'trabajo']] }),
      this.r.notas.list({ orderBy: 'fecha', filters: [['tipo', 'eq', 'diario']] }),
      this.r.flashcards.list(), this.r.deudas.list(), this.r.pagos.list({ orderBy: 'fecha' }),
    ]);
    const primero = eventos[0]?.fecha;
    return {
      mejorRacha: Math.max(0, ...habitos.map((h) => mejorRacha(h, h.fechas))),
      tareas: tareas.length,
      metas: metas.filter((m) => m.completada).length,
      ahorrado: Math.max(0, sum(aportes)),
      revisiones: revisiones.length,
      libros: lecturas.filter((l) => l.estado === 'terminado').length,
      entrenos: entrenos.length,
      horasEstudio: Math.round(sum(sesiones, (s) => s.minutos) / 6) / 10,
      turnos: primero ? instancias(eventos, primero, hoy).length : 0,
      diario: new Set(notas.map((n) => n.fecha)).size,
      aciertos: sum(tarjetas, (t) => t.aciertos),
      deudasPagadas: deudas.filter((d) => estadoDeuda(d, pagos).saldada).length,
    };
  }

  async logros() { return logros(await this.conteos()); }

  /** Resumen del año (hasta hoy si es el año actual). */
  async anio(y = Number(today().slice(0, 4))) {
    const desde = `${y}-01-01`;
    const hasta = [`${y}-12-31`, today()].sort()[0];
    const enAnio = (f) => f >= desde && f <= hasta;
    const [habitos, tareas, movs, lecturas, entrenos, sesiones, eventos, notas, materias, evals, lista] = await Promise.all([
      this.#habitosConFechas(desde),
      this.r.tareas.list({ filters: [['hecha', 'eq', true]] }),
      this.r.movimientos.list({ orderBy: 'fecha', filters: [['fecha', 'gte', desde], ['fecha', 'lte', hasta]] }),
      this.r.lecturas.list(),
      this.r.entrenamientos.list({ orderBy: 'fecha', filters: [['fecha', 'gte', desde], ['fecha', 'lte', hasta]] }),
      this.r.sesiones.list({ orderBy: 'fecha', filters: [['fecha', 'gte', desde], ['fecha', 'lte', hasta]] }),
      this.r.eventos.list({ orderBy: 'fecha', ascending: true, filters: [['tipo', 'eq', 'trabajo'], ['fecha', 'lte', hasta]] }),
      this.r.notas.list({ orderBy: 'fecha', filters: [['tipo', 'eq', 'diario'], ['fecha', 'gte', desde], ['fecha', 'lte', hasta]] }),
      this.r.materias.list(), this.r.evaluaciones.list({ orderBy: 'fecha' }), this.logros(),
    ]);
    const turnos = instancias(eventos, desde, hasta);
    const serie = serieMensual(movs, `${y}-${hasta.slice(5, 7)}`, Number(hasta.slice(5, 7)));
    const ingresos = sum(movs.filter((m) => m.tipo === 'ingreso'));
    const gastos = sum(movs.filter((m) => m.tipo === 'gasto'));
    const conNota = materias.map((m) => ({ ...m, final: notaFinal(m, evals.filter((e) => e.materia_id === m.id)) })).filter((m) => m.final != null);
    const animos = notas.filter((n) => n.animo);
    return {
      anio: y, desde, hasta, parcial: hasta < `${y}-12-31`,
      turnos: turnos.length, horasTrabajo: Math.round(turnos.reduce((a, i) => a + duracionHoras(i.evento), 0)),
      diaFuerte: diaMasOcupado(turnos, duracionHoras),
      tareas: tareas.filter((t) => t.hecha_at && enAnio(t.hecha_at.slice(0, 10))).length,
      ingresos, gastos, ahorro: ingresos - gastos, mejorMes: mejorMes(serie),
      habitosCumplidos: habitos.reduce((a, h) => a + [...h.fechas].filter(enAnio).length, 0),
      mejorRacha: Math.max(0, ...habitos.map((h) => mejorRacha(h, new Set([...h.fechas].filter(enAnio))))),
      mejorHabito: habitos.map((h) => ({ h, n: [...h.fechas].filter(enAnio).length })).sort((a, b) => b.n - a.n)[0]?.h || null,
      libros: lecturas.filter((l) => l.estado === 'terminado').length,
      minutosEjercicio: sum(entrenos, (e) => e.duracion_min), entrenos: entrenos.length,
      horasEstudio: Math.round(sum(sesiones, (s) => s.minutos) / 60),
      diasDiario: new Set(notas.map((n) => n.fecha)).size,
      animoPromedio: animos.length ? Math.round((animos.reduce((a, n) => a + n.animo, 0) / animos.length) * 10) / 10 : null,
      mejorMateria: conNota.sort((a, b) => b.final - a.final)[0] || null,
      logros: lista.filter((l) => l.logrado).length, totalLogros: lista.length,
    };
  }
}

