// Casos de uso de las herramientas: buscador, importar extractos, respaldos y cierre de semestre.
// Cada clase recibe sus dependencias por constructor (inyección de dependencias).
import { today, fmtDate, fmtMoney } from '../core/format.js';
import { marcarDuplicados, cierreSemestre } from '../domain/herramientas.js';

// ---------- Buscador general ----------
// Qué se busca, dónde, y a qué pantalla lleva cada resultado.
const FUENTES = [
  { repo: 'tareas', tipo: 'Tarea', ico: 'tareas', ruta: 'tareas', titulo: (r) => r.titulo, detalle: (r) => [r.descripcion, r.hecha ? 'Hecha' : r.fecha_limite && `Para el ${fmtDate(r.fecha_limite)}`].filter(Boolean).join(' · '), fecha: (r) => r.fecha_limite },
  { repo: 'notas', tipo: 'Nota', ico: 'notas', ruta: 'notas', titulo: (r) => r.titulo || (r.tipo === 'diario' ? `Diario del ${fmtDate(r.fecha)}` : 'Nota'), detalle: (r) => r.contenido, fecha: (r) => r.fecha },
  { repo: 'apuntes', tipo: 'Apunte', ico: 'apuntes', ruta: 'apuntes', titulo: (r) => r.titulo, detalle: (r) => [r.contenido, r.archivo_nombre].filter(Boolean).join(' · ') },
  { repo: 'eventos', tipo: 'Evento', ico: 'agenda', ruta: 'agenda', titulo: (r) => r.titulo, detalle: (r) => [r.lugar, r.notas, r.semanal ? 'Cada semana' : fmtDate(r.fecha)].filter(Boolean).join(' · '), fecha: (r) => r.fecha },
  { repo: 'movimientos', tipo: 'Movimiento', ico: 'movimientos', ruta: 'movimientos', titulo: (r) => r.descripcion || r.categoria, detalle: (r) => `${r.tipo === 'gasto' ? 'Gasto' : 'Ingreso'} · ${r.categoria} · ${fmtMoney(r.monto)} · ${fmtDate(r.fecha)}`, fecha: (r) => r.fecha },
  { repo: 'metas', tipo: 'Meta', ico: 'metas', ruta: 'metas', titulo: (r) => r.nombre, detalle: () => 'Meta de ahorro' },
  { repo: 'deseos', tipo: 'Deseo', ico: 'deseos', ruta: 'deseos', titulo: (r) => r.nombre, detalle: (r) => r.notas },
  { repo: 'materias', tipo: 'Materia', ico: 'universidad', ruta: 'universidad', titulo: (r) => r.nombre, detalle: (r) => [r.profesor, r.semestre && `Semestre ${r.semestre}`].filter(Boolean).join(' · ') },
  { repo: 'contactos', tipo: 'Persona', ico: 'contactos', ruta: 'contactos', titulo: (r) => r.nombre, detalle: (r) => [r.relacion, r.telefono].filter(Boolean).join(' · ') },
  { repo: 'lecturas', tipo: 'Lectura', ico: 'lectura', ruta: 'lectura', titulo: (r) => r.titulo, detalle: (r) => r.autor },
  { repo: 'metasVida', tipo: 'Meta de vida', ico: 'metasvida', ruta: 'metasvida', titulo: (r) => r.titulo, detalle: (r) => r.descripcion },
  { repo: 'flashcards', tipo: 'Tarjeta', ico: 'repaso', ruta: 'repaso', titulo: (r) => r.frente, detalle: (r) => r.reverso },
  { repo: 'deudas', tipo: 'Deuda', ico: 'deudas', ruta: 'deudas', titulo: (r) => r.nombre || r.acreedor, detalle: (r) => r.acreedor },
];

export class BuscadorService {
  constructor(repos) { this.repos = repos; this.cache = null; this.cacheAt = 0; }
  /** Arma el índice (se guarda 1 minuto para que buscar sea instantáneo mientras escribes). */
  async indice() {
    if (this.cache && Date.now() - this.cacheAt < 60_000) return this.cache;
    const partes = await Promise.all(FUENTES.map(async (f) => {
      const filas = await this.repos[f.repo]?.list().catch(() => []) ?? [];
      return filas.map((r) => ({ tipo: f.tipo, ico: f.ico, ruta: f.ruta, titulo: f.titulo(r) || '', detalle: f.detalle(r) || '', fecha: f.fecha?.(r) || r.created_at?.slice(0, 10) || '' }));
    }));
    this.cache = partes.flat();
    this.cacheAt = Date.now();
    return this.cache;
  }
}

// ---------- Importar extractos ----------
export class ImportarService {
  constructor(repos, finanzas) { this.repos = repos; this.finanzas = finanzas; }
  /** Marca como repetidos los movimientos que ya están registrados en esas fechas. */
  async revisar(movimientos) {
    if (!movimientos.length) return [];
    const fechas = movimientos.map((m) => m.fecha).sort();
    const existentes = await this.repos.movimientos.list({ orderBy: 'fecha', filters: [['fecha', 'gte', fechas[0]], ['fecha', 'lte', fechas.at(-1)]] });
    return marcarDuplicados(movimientos, existentes);
  }
  async importar(movimientos, cuentaId) {
    let n = 0;
    for (const m of movimientos) {
      const { duplicado, ...datos } = m;
      await this.finanzas.guardarMovimiento(null, { ...datos, cuenta_id: cuentaId || null }, { redondear: false });
      n += 1;
    }
    return n;
  }
}

// ---------- Copias de seguridad ----------
// Orden de restauración: primero las tablas de las que dependen las demás.
export const TABLAS_RESPALDO = ['ajustes', 'cuentas', 'materias', 'deudas', 'metas', 'deseos', 'prestamos', 'habitos', 'rutina_items', 'metas_vida',
  'proyectos_grupo', 'contactos', 'lecturas', 'recurrentes', 'presupuestos', 'movimientos', 'pagos_deuda', 'aportes_meta',
  'precios_deseo', 'abonos_prestamo', 'registros_habito', 'rutina_checks', 'pasos_meta', 'tareas', 'eventos', 'evaluaciones',
  'apuntes', 'flashcards', 'sesiones_estudio', 'notas', 'horas_trabajo', 'entrenamientos', 'registros_salud', 'revisiones', 'lista_compras'];

export class RespaldosService {
  constructor(client) { this.client = client; }
  async #uid() {
    const { data } = await this.client.auth.getUser();
    if (!data?.user) throw new Error('Inicia sesión de nuevo');
    return data.user.id;
  }
  async listar() {
    const uid = await this.#uid();
    const { data, error } = await this.client.storage.from('respaldos').list(uid, { limit: 20, sortBy: { column: 'name', order: 'desc' } });
    if (error) throw new Error(error.message);
    return (data || []).filter((f) => f.name.endsWith('.json')).map((f) => ({ nombre: f.name, fecha: f.name.slice(0, 10), ruta: `${uid}/${f.name}`, bytes: f.metadata?.size || 0 }));
  }
  async hacerAhora() {
    const { data, error } = await this.client.functions.invoke('respaldar', { body: {} });
    if (error) throw new Error('No se pudo hacer la copia. Revisa tu conexión.');
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async descargar(ruta) {
    const { data, error } = await this.client.storage.from('respaldos').download(ruta);
    if (error) throw new Error(error.message);
    return data; // Blob
  }
  /** Vuelve a poner los datos de la copia. No borra lo que hayas creado después; actualiza lo que coincida. */
  async restaurar(ruta, alAvanzar = () => {}) {
    const archivo = JSON.parse(await (await this.descargar(ruta)).text());
    if (archivo?.app !== 'Rumbo' || !archivo.datos) throw new Error('Ese archivo no es una copia de Rumbo');
    let hechas = 0;
    for (const tabla of TABLAS_RESPALDO) {
      const filas = archivo.datos[tabla] || [];
      for (let i = 0; i < filas.length; i += 400) {
        const lote = filas.slice(i, i + 400);
        const { error } = await this.client.from(tabla).upsert(lote, { onConflict: tabla === 'ajustes' ? 'user_id' : 'id' });
        if (error) throw new Error(`${tabla}: ${error.message}`);
      }
      hechas += 1;
      alAvanzar(hechas / TABLAS_RESPALDO.length);
    }
    return archivo.filas || 0;
  }
}

// ---------- Cierre de semestre ----------
export class SemestreService {
  constructor(repos, carrera) { this.r = repos; this.carrera = carrera; }
  async datos() {
    const [{ items }, aj, clases] = await Promise.all([
      this.carrera.datos(),
      this.r.ajustes.findOne([], 'updated_at'),
      this.r.eventos.list({ filters: [['tipo', 'eq', 'clase'], ['semanal', 'eq', true]] }),
    ]);
    const hoy = today();
    return {
      cursando: items.filter((m) => m.estado === 'cursando'),
      ajustes: aj || {},
      clasesActivas: clases.filter((c) => !c.fecha_fin || c.fecha_fin >= hoy),
    };
  }
  /** Guarda las notas finales, termina las clases semanales y deja listas las fechas del nuevo semestre. */
  async cerrar({ materias, notas, terminarClases, clases, inicio, fin }) {
    const cambios = cierreSemestre(materias, notas);
    for (const c of cambios) await this.carrera.guardarMateria(c.id, { estado: c.estado, nota_final: c.nota_final });
    if (terminarClases) for (const c of clases) await this.r.eventos.update(c.id, { fecha_fin: today() });
    if (inicio || fin) await this.r.ajustes.upsert({ semestre_inicio: inicio || null, semestre_fin: fin || null }, 'user_id');
    return cambios;
  }
}
