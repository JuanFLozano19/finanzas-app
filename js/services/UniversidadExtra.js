// Servicios extra de Universidad: horario del semestre, apuntes con archivos,
// trabajos en grupo y sesiones de estudio (Pomodoro).
import { today, addDays, startOfWeek } from '../core/format.js';
import { primerDia, minutosPorMateria, eventosDelDia } from '../domain/vida.js';

export class HorarioService {
  constructor(repos) { this.r = repos; }
  async datos() {
    const [eventos, materias, aj] = await Promise.all([
      this.r.eventos.list({ orderBy: 'hora_inicio', ascending: true, filters: [['tipo', 'eq', 'clase'], ['semanal', 'eq', true]] }),
      this.r.materias.list({ orderBy: 'nombre', ascending: true }),
      this.r.ajustes.findOne([], 'updated_at'),
    ]);
    const hoy = today();
    const vigentes = eventos.filter((e) => !e.fecha_fin || e.fecha_fin >= hoy);
    const lunes = startOfWeek(hoy);
    const dias = [1, 2, 3, 4, 5, 6].map((d, i) => {
      const fecha = addDays(lunes, i);
      return { dia: d, fecha, clases: eventosDelDia(vigentes, fecha) };
    });
    return { dias, materias, inicio: aj?.semestre_inicio || null, fin: aj?.semestre_fin || null, vigentes };
  }
  guardarSemestre(semestre_inicio, semestre_fin) { return this.r.ajustes.upsert({ semestre_inicio, semestre_fin }, 'user_id'); }
  /** Crea la clase como evento semanal desde el inicio hasta el fin del semestre. */
  agregarClase({ materia, dia, hora_inicio, hora_fin, lugar, inicio, fin }) {
    const desde = inicio && inicio > today() ? inicio : today();
    return this.r.eventos.create({
      titulo: materia.nombre, tipo: 'clase', materia_id: materia.id, semanal: true,
      fecha: primerDia(desde, Number(dia)), fecha_fin: fin || null, hora_inicio, hora_fin, lugar,
    });
  }
  eliminarClase(id) { return this.r.eventos.remove(id); }
}

export class ApuntesService {
  constructor(repos, client) { this.r = repos; this.client = client; this.bucket = client.storage.from('apuntes'); }
  async listado() {
    const [apuntes, materias] = await Promise.all([this.r.apuntes.list(), this.r.materias.list({ orderBy: 'nombre', ascending: true })]);
    return { apuntes, materias };
  }
  async #uid() { const { data } = await this.client.auth.getSession(); return data.session.user.id; }
  async guardar(id, { archivo, ...d }, anterior) {
    if (archivo && !navigator.onLine) throw new Error('Para subir archivos necesitas internet.');
    if (archivo && archivo.size > 20 * 1024 * 1024) throw new Error('El archivo pesa más de 20 MB.');
    const apunte = id ? await this.r.apuntes.update(id, d) : await this.r.apuntes.create(d);
    if (archivo) {
      const limpio = archivo.name.normalize('NFD').replace(/[^\w.\-]+/g, '_').slice(-80);
      const path = `${await this.#uid()}/${apunte.id}/${Date.now()}-${limpio}`;
      const { error } = await this.bucket.upload(path, archivo, { contentType: archivo.type || undefined });
      if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
      if (anterior?.archivo_path) await this.bucket.remove([anterior.archivo_path]);
      await this.r.apuntes.update(apunte.id, { archivo_path: path, archivo_nombre: archivo.name });
    }
    return apunte;
  }
  async eliminar(a) {
    if (a.archivo_path) await this.bucket.remove([a.archivo_path]);
    return this.r.apuntes.remove(a.id);
  }
  async quitarArchivo(a) {
    await this.bucket.remove([a.archivo_path]);
    return this.r.apuntes.update(a.id, { archivo_path: null, archivo_nombre: null });
  }
  async urlArchivo(a) {
    const { data, error } = await this.bucket.createSignedUrl(a.archivo_path, 120);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }
}

export class GruposService {
  constructor(repos) { this.r = repos; }
  async listado() {
    const [proyectos, tareas, materias] = await Promise.all([
      this.r.proyectos.list({ orderBy: 'fecha_entrega', ascending: true }),
      this.r.tareas.list({ orderBy: 'fecha_limite', ascending: true }),
      this.r.materias.list({ orderBy: 'nombre', ascending: true }),
    ]);
    const items = proyectos.map((p) => {
      const partes = tareas.filter((t) => t.proyecto_id === p.id);
      return { ...p, partes, avance: partes.length ? partes.filter((t) => t.hecha).length / partes.length : 0 };
    });
    return { items, materias };
  }
  guardar(id, d) { return id ? this.r.proyectos.update(id, d) : this.r.proyectos.create(d); }
  eliminar(id) { return this.r.proyectos.remove(id); }
  guardarParte(id, d) { return id ? this.r.tareas.update(id, d) : this.r.tareas.create({ prioridad: 2, ...d }); }
  marcarParte(t) { return this.r.tareas.update(t.id, { hecha: !t.hecha, hecha_at: t.hecha ? null : new Date().toISOString() }); }
  eliminarParte(id) { return this.r.tareas.remove(id); }
}

export class EstudioService {
  constructor(repos) { this.r = repos; }
  async resumen(hoy = today()) {
    const lunes = startOfWeek(hoy);
    const [sesiones, materias] = await Promise.all([
      this.r.sesiones.list({ orderBy: 'fecha', filters: [['fecha', 'gte', addDays(lunes, -28)]] }),
      this.r.materias.list({ orderBy: 'nombre', ascending: true }),
    ]);
    return {
      materias: materias.filter((m) => m.activa),
      hoy: minutosPorMateria(sesiones, hoy, hoy),
      semana: minutosPorMateria(sesiones, lunes, addDays(lunes, 6)),
      sesiones: sesiones.slice(0, 15),
    };
  }
  registrar(materia_id, minutos) { return this.r.sesiones.create({ materia_id: materia_id || null, minutos, fecha: today() }); }
  eliminar(id) { return this.r.sesiones.remove(id); }
}
