// Servicios de los módulos de vida. Cada clase tiene una sola responsabilidad
// y recibe sus repositorios por constructor (inyección de dependencias).
import { today, addDays } from '../core/format.js';
import {
  racha, cumplimiento, tocaEnFecha, eventosDelDia, agruparTareas,
  estadoMateria, promedioSemestre, resumenHoras, resumenSemanaSalud,
} from '../domain/vida.js';

/** CRUD genérico reutilizable para servicios simples. */
class CrudService {
  constructor(repo) { this.repo = repo; }
  guardar(id, datos) { return id ? this.repo.update(id, datos) : this.repo.create(datos); }
  eliminar(id) { return this.repo.remove(id); }
}

export class TareasService extends CrudService {
  constructor(repos) { super(repos.tareas); this.materias = repos.materias; }
  async listado() {
    const [tareas, materias] = await Promise.all([this.repo.list(), this.materias.list({ orderBy: 'nombre', ascending: true })]);
    return { grupos: agruparTareas(tareas, today()), materias };
  }
  marcar(id, hecha) { return this.repo.update(id, { hecha, hecha_at: hecha ? new Date().toISOString() : null }); }
}

export class HabitosService extends CrudService {
  constructor(repos) { super(repos.habitos); this.registros = repos.registrosHabito; }
  async listado(hoy = today()) {
    const [habitos, regs] = await Promise.all([
      this.repo.list({ orderBy: 'created_at', ascending: true }),
      this.registros.list({ orderBy: 'fecha', filters: [['fecha', 'gte', addDays(hoy, -400)]] }),
    ]);
    const porHabito = new Map(habitos.map((h) => [h.id, new Set()]));
    for (const r of regs) porHabito.get(r.habito_id)?.add(r.fecha);
    return habitos.map((h) => {
      const fechas = porHabito.get(h.id);
      return {
        ...h, fechas,
        hechoHoy: fechas.has(hoy), tocaHoy: tocaEnFecha(h, hoy),
        racha: racha(h, fechas, hoy), cumplimiento: cumplimiento(h, fechas, hoy),
      };
    });
  }
  async alternar(habitoId, fecha, hecho) {
    if (hecho) await this.registros.removeWhere([['habito_id', 'eq', habitoId], ['fecha', 'eq', fecha]]);
    else await this.registros.create({ habito_id: habitoId, fecha });
  }
}

export class AgendaService extends CrudService {
  constructor(repos) { super(repos.eventos); this.materias = repos.materias; }
  async rango(desde, hasta) {
    const [eventos, materias] = await Promise.all([
      this.repo.list({ orderBy: 'fecha', ascending: true, filters: [['fecha', 'lte', hasta]] }),
      this.materias.list({ orderBy: 'nombre', ascending: true }),
    ]);
    const dias = [];
    for (let d = desde; d <= hasta; d = addDays(d, 1)) dias.push({ fecha: d, eventos: eventosDelDia(eventos, d) });
    return { dias, materias };
  }
}

export class NotasService extends CrudService {
  constructor(repos) { super(repos.notas); }
  async listado(tipo) {
    const items = await this.repo.list({ orderBy: 'fecha', filters: [['tipo', 'eq', tipo]] });
    return tipo === 'nota' ? items.sort((a, b) => Number(b.fijada) - Number(a.fijada) || b.updated_at.localeCompare(a.updated_at)) : items;
  }
}

export class UniversidadService {
  constructor(repos) { this.materias = repos.materias; this.evaluaciones = repos.evaluaciones; this.tareas = repos.tareas; }
  async listado() {
    const [materias, evals, tareas] = await Promise.all([
      this.materias.list({ orderBy: 'nombre', ascending: true }),
      this.evaluaciones.list({ orderBy: 'fecha', ascending: true }),
      this.tareas.list({ filters: [['hecha', 'eq', false]] }),
    ]);
    const items = materias.map((m) => {
      const ev = evals.filter((e) => e.materia_id === m.id);
      return { ...m, evaluaciones: ev, estado: estadoMateria(ev), pendientes: tareas.filter((t) => t.materia_id === m.id) };
    });
    const activas = items.filter((m) => m.activa);
    const hoy = today();
    const proximas = evals.filter((e) => e.fecha && e.fecha >= hoy && e.nota == null)
      .map((e) => ({ ...e, materia: materias.find((m) => m.id === e.materia_id) }));
    return { items, promedio: promedioSemestre(activas), proximas };
  }
  guardarMateria(id, d) { return id ? this.materias.update(id, d) : this.materias.create(d); }
  eliminarMateria(id) { return this.materias.remove(id); }
  guardarEvaluacion(id, d) { return id ? this.evaluaciones.update(id, d) : this.evaluaciones.create(d); }
  eliminarEvaluacion(id) { return this.evaluaciones.remove(id); }
}

export class TrabajoService extends CrudService {
  constructor(repos) { super(repos.horas); this.ajustes = repos.ajustes; this.movimientos = repos.movimientos; }
  async listado() {
    const [registros, ajustes] = await Promise.all([this.repo.list({ orderBy: 'fecha' }), this.ajustes.findOne()]);
    return { registros, tarifa: ajustes?.tarifa_hora ? Number(ajustes.tarifa_hora) : null, resumen: resumenHoras(registros) };
  }
  guardarTarifa(tarifa_hora) { return this.ajustes.upsert({ tarifa_hora }, 'user_id'); }

  /** Pasa las horas pendientes a un ingreso y las marca como pagadas. */
  async cobrar(pendientes, fecha) {
    const total = Math.round(pendientes.reduce((a, r) => a + Number(r.horas) * Number(r.tarifa), 0));
    const horas = pendientes.reduce((a, r) => a + Number(r.horas), 0);
    const mov = await this.movimientos.create({
      tipo: 'ingreso', monto: total, fecha, categoria: 'Trabajo por horas', descripcion: `Pago de ${horas} h trabajadas`,
    });
    await Promise.all(pendientes.map((r) => this.repo.update(r.id, { pagado: true, movimiento_id: mov.id })));
    return total;
  }
}

export class SaludService {
  constructor(repos) { this.entrenamientos = repos.entrenamientos; this.salud = repos.salud; }
  async listado(hoy = today()) {
    const [entrenamientos, registros] = await Promise.all([
      this.entrenamientos.list({ orderBy: 'fecha', filters: [['fecha', 'gte', addDays(hoy, -90)]] }),
      this.salud.list({ orderBy: 'fecha', filters: [['fecha', 'gte', addDays(hoy, -90)]] }),
    ]);
    return {
      entrenamientos, registros,
      hoy: registros.find((r) => r.fecha === hoy) || { fecha: hoy },
      semana: resumenSemanaSalud(entrenamientos, registros, hoy),
    };
  }
  guardarRegistro(datos) { return this.salud.upsert(datos, 'user_id,fecha'); }
  guardarEntrenamiento(id, d) { return id ? this.entrenamientos.update(id, d) : this.entrenamientos.create(d); }
  eliminarEntrenamiento(id) { return this.entrenamientos.remove(id); }
}

export const crearServiciosVida = (repos) => ({
  tareas: new TareasService(repos),
  habitos: new HabitosService(repos),
  agenda: new AgendaService(repos),
  notas: new NotasService(repos),
  universidad: new UniversidadService(repos),
  trabajo: new TrabajoService(repos),
  salud: new SaludService(repos),
});
