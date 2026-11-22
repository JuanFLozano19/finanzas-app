// Casos de uso de bienestar: rutinas, metas de vida, lectura, contactos,
// modo enfoque y revisión semanal. Más el ejecutor del asistente.
import { today, addDays, startOfWeek } from '../core/format.js';
import { sum } from '../domain/calculos.js';
import { estadoContacto, progresoLectura, progresoMetaVida } from '../domain/bienestar.js';
import { eventosDelDia, horasTurnos } from '../domain/vida.js';

export class BienestarService {
  constructor(repos) { this.r = repos; }

  // ---------- Rutinas ----------
  async rutinas(hoy = today()) {
    const [items, checks] = await Promise.all([
      this.r.rutinaItems.list({ orderBy: 'orden', ascending: true }),
      this.r.rutinaChecks.list({ orderBy: 'fecha', filters: [['fecha', 'eq', hoy]] }),
    ]);
    const hechos = new Set(checks.map((c) => c.item_id));
    const con = items.map((i) => ({ ...i, hecho: hechos.has(i.id) }));
    return { manana: con.filter((i) => i.momento === 'manana'), noche: con.filter((i) => i.momento === 'noche') };
  }
  agregarRutina(momento, texto, orden) { return this.r.rutinaItems.create({ momento, texto, orden }); }
  editarRutina(id, texto) { return this.r.rutinaItems.update(id, { texto }); }
  eliminarRutina(id) { return this.r.rutinaItems.remove(id); }
  async alternarRutina(item, fecha = today()) {
    if (item.hecho) await this.r.rutinaChecks.removeWhere([['item_id', 'eq', item.id], ['fecha', 'eq', fecha]]);
    else await this.r.rutinaChecks.create({ item_id: item.id, fecha });
  }

  // ---------- Metas de vida ----------
  async metasVida() {
    const [metas, pasos] = await Promise.all([this.r.metasVida.list({ orderBy: 'created_at', ascending: true }), this.r.pasos.list({ orderBy: 'orden', ascending: true })]);
    return metas.map((m) => {
      const propios = pasos.filter((p) => p.meta_id === m.id);
      return { ...m, pasos: propios, progreso: progresoMetaVida(propios) };
    });
  }
  guardarMetaVida(id, d) { return id ? this.r.metasVida.update(id, d) : this.r.metasVida.create(d); }
  eliminarMetaVida(id) { return this.r.metasVida.remove(id); }
  agregarPaso(metaId, texto, orden) { return this.r.pasos.create({ meta_id: metaId, texto, orden }); }
  alternarPaso(p) { return this.r.pasos.update(p.id, { hecho: !p.hecho }); }
  eliminarPaso(id) { return this.r.pasos.remove(id); }

  // ---------- Lectura y cursos ----------
  async lecturas() {
    return (await this.r.lecturas.list()).map((l) => ({ ...l, progreso: progresoLectura(l) }));
  }
  guardarLectura(id, d) { return id ? this.r.lecturas.update(id, d) : this.r.lecturas.create(d); }
  eliminarLectura(id) { return this.r.lecturas.remove(id); }
  avanzar(l, cantidad) {
    const actual = Math.min(Number(l.total), Math.max(0, Number(l.actual) + cantidad));
    return this.r.lecturas.update(l.id, { actual, estado: actual >= Number(l.total) ? 'terminado' : 'leyendo' });
  }

  // ---------- Contactos ----------
  async contactos(hoy = today()) {
    const items = (await this.r.contactos.list({ orderBy: 'nombre', ascending: true })).map((c) => ({ ...c, estado: estadoContacto(c, hoy) }));
    const cumples = items.filter((c) => c.estado.cumple && c.estado.cumple.dias <= 30).sort((a, b) => a.estado.cumple.dias - b.estado.cumple.dias);
    return { items, cumples, pendientes: items.filter((c) => c.estado.toca) };
  }
  guardarContacto(id, d) { return id ? this.r.contactos.update(id, d) : this.r.contactos.create(d); }
  eliminarContacto(id) { return this.r.contactos.remove(id); }
  hableHoy(c) { return this.r.contactos.update(c.id, { ultimo_contacto: today() }); }

  // ---------- Modo enfoque ----------
  async enfoque(hoy = today()) {
    const [tareas, eventos] = await Promise.all([
      this.r.tareas.list({ filters: [['hecha', 'eq', false]] }),
      this.r.eventos.list({ orderBy: 'fecha', ascending: true, filters: [['fecha', 'lte', hoy]] }),
    ]);
    const mias = tareas.filter((t) => !t.proyecto_id || !t.responsable || /^yo$/i.test(t.responsable.trim()));
    const ahora = new Date().toTimeString().slice(0, 5);
    const proximo = eventosDelDia(eventos, hoy).find((e) => !e.hora_inicio || e.hora_inicio.slice(0, 5) >= ahora) || null;
    return { foco: mias.filter((t) => t.enfoque === hoy), candidatas: mias.filter((t) => t.enfoque !== hoy), proximo };
  }
  marcarFoco(t, activo) { return this.r.tareas.update(t.id, { enfoque: activo ? today() : null }); }
  completar(t) { return this.r.tareas.update(t.id, { hecha: true, hecha_at: new Date().toISOString() }); }

  // ---------- Revisión semanal ----------
  async revision(lunes = startOfWeek(today())) {
    const domingo = addDays(lunes, 6);
    const en = (f) => f >= lunes && f <= domingo;
    const [tareas, regsHab, habitos, movs, horas, sesiones, entrenos, revisiones] = await Promise.all([
      this.r.tareas.list({ filters: [['hecha', 'eq', true]] }),
      this.r.registrosHabito.list({ orderBy: 'fecha', filters: [['fecha', 'gte', lunes], ['fecha', 'lte', domingo]] }),
      this.r.habitos.list(),
      this.r.movimientos.list({ orderBy: 'fecha', filters: [['fecha', 'gte', lunes], ['fecha', 'lte', domingo]] }),
      this.r.eventos.list({ orderBy: 'fecha', filters: [['tipo', 'eq', 'trabajo'], ['fecha', 'lte', domingo]] }),
      this.r.sesiones.list({ orderBy: 'fecha', filters: [['fecha', 'gte', lunes], ['fecha', 'lte', domingo]] }),
      this.r.entrenamientos.list({ orderBy: 'fecha', filters: [['fecha', 'gte', lunes], ['fecha', 'lte', domingo]] }),
      this.r.revisiones.list({ orderBy: 'semana' }),
    ]);
    const activos = habitos.filter((x) => x.activo);
    let programados = 0;
    for (let i = 0; i < 7; i++) {
      const f = addDays(lunes, i);
      if (f > today()) break;
      const wd = new Date(`${f}T00:00:00`).getDay();
      programados += activos.filter((x) => (x.dias || []).includes(wd) && f >= x.created_at.slice(0, 10)).length;
    }
    return {
      lunes, domingo,
      tareasHechas: tareas.filter((t) => t.hecha_at && en(t.hecha_at.slice(0, 10))).length,
      habitos: programados ? Math.min(1, regsHab.length / programados) : null,
      ingresos: sum(movs.filter((m) => m.tipo === 'ingreso')),
      gastos: sum(movs.filter((m) => m.tipo === 'gasto')),
      horasTrabajo: horasTurnos(horas, lunes, domingo),
      minutosEstudio: sum(sesiones, (x) => x.minutos),
      minutosEjercicio: sum(entrenos, (x) => x.duracion_min),
      actual: revisiones.find((r) => r.semana === lunes) || null,
      historial: revisiones.filter((r) => r.semana !== lunes).slice(0, 8),
    };
  }
  guardarRevision(semana, d) { return this.r.revisiones.upsert({ semana, ...d }, 'user_id,semana'); }
}

/** Ejecuta lo que el asistente entendió, usando los servicios existentes. */
export class AsistenteService {
  constructor({ service, vida, plata, bienestar, repos }) { Object.assign(this, { service, vida, plata, bienestar, repos }); }

  async ejecutar(a) {
    switch (a.tipo) {
      case 'gasto':
      case 'ingreso':
        await this.service.guardarMovimiento(null, { tipo: a.tipo, monto: a.monto, categoria: a.tipo === 'gasto' ? a.categoria : 'Otros', descripcion: a.descripcion, fecha: a.fecha });
        return a.tipo === 'gasto' ? 'Gasto registrado' : 'Ingreso registrado';
      case 'turno':
        await this.vida.trabajo.guardar(null, { titulo: a.titulo, fecha: a.fecha, hora_inicio: a.hora_inicio, hora_fin: a.hora_fin, semanal: false, recordatorio_min: 60 });
        return 'Turno agregado 💼 (te aviso 1 hora antes)';
      case 'sueno':
        await this.vida.salud.guardarRegistro({ fecha: a.fecha, horas_sueno: a.horas });
        return 'Sueño registrado';
      case 'agua': {
        const { hoy } = await this.vida.salud.listado();
        await this.vida.salud.guardarRegistro({ fecha: hoy.fecha, vasos_agua: (hoy.vasos_agua || 0) + a.vasos });
        return `+${a.vasos} vaso${a.vasos === 1 ? '' : 's'} de agua 💧`;
      }
      case 'entreno':
        await this.vida.salud.guardarEntrenamiento(null, { tipo: a.actividad, duracion_min: a.minutos, fecha: a.fecha, intensidad: 2 });
        return 'Entrenamiento registrado 💪';
      case 'lectura': {
        const lecturas = await this.bienestar.lecturas();
        const actual = lecturas.find((l) => l.estado === 'leyendo');
        if (!actual) throw new Error('No tienes ningún libro o curso "leyendo" en Lectura.');
        await this.bienestar.avanzar(actual, a.cantidad);
        return `+${a.cantidad} en "${actual.titulo}"`;
      }
      case 'prestamo':
        await this.plata.guardarPrestamo(null, { persona: a.persona, monto: a.monto, fecha: a.fecha });
        return `Préstamo a ${a.persona} anotado`;
      case 'evento':
        await this.vida.agenda.guardar(null, { titulo: a.titulo, tipo: a.tipoEvento, fecha: a.fecha, hora_inicio: a.hora, semanal: false });
        return 'Agregado a tu agenda 🗓';
      case 'nota':
        await this.vida.notas.guardar(null, { tipo: 'nota', contenido: a.contenido, fijada: false });
        return 'Nota guardada 📝';
      case 'tarea':
        await this.vida.tareas.guardar(null, { titulo: a.titulo, fecha_limite: a.fecha, prioridad: 2 });
        return 'Tarea agregada ✅';
      default:
        throw new Error('No entendí esa frase.');
    }
  }
}

