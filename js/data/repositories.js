// Capa de acceso a datos (patrón Repository) con soporte sin conexión.
// Las vistas nunca hablan con Supabase directamente: si mañana cambias de
// backend, solo se reemplaza esta capa.
import { outbox, sinConexion, esErrorDeRed, aplicarPendientes } from './outbox.js';

export class BaseRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }

  static #check({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
  }

  /** Ejecuta en línea; si no hay red, encola la operación y devuelve el resultado optimista. */
  async #escribir(enLinea, op, optimista) {
    if (!sinConexion()) {
      try { return await enLinea(); } catch (e) { if (!esErrorDeRed(e)) throw e; }
    }
    outbox.agregar({ table: this.table, ...op });
    return optimista;
  }

  #filtrar(q, filters) {
    for (const [col, op, val] of filters) q = q[op](col, val);
    return q;
  }

  async list({ orderBy = 'created_at', ascending = false, filters = [] } = {}) {
    const q = this.#filtrar(this.client.from(this.table).select('*'), filters);
    let rows;
    try {
      rows = BaseRepository.#check(await q.order(orderBy, { ascending }));
    } catch (e) {
      if (!esErrorDeRed(e)) throw e;
      throw new Error('Sin conexión y sin copia guardada de esta sección. Ábrela una vez con internet.');
    }
    return aplicarPendientes(this.table, rows, filters, orderBy, ascending);
  }

  create(values) {
    const row = { id: crypto.randomUUID(), ...values };
    return this.#escribir(
      async () => BaseRepository.#check(await this.client.from(this.table).insert(row).select().single()),
      { op: 'insert', values: row },
      { ...row, created_at: new Date().toISOString(), _pendiente: true },
    );
  }

  update(id, values) {
    return this.#escribir(
      async () => BaseRepository.#check(await this.client.from(this.table).update(values).eq('id', id).select().single()),
      { op: 'update', id, values },
      { id, ...values, _pendiente: true },
    );
  }

  upsert(values, onConflict) {
    return this.#escribir(
      async () => BaseRepository.#check(await this.client.from(this.table).upsert(values, { onConflict }).select().single()),
      { op: 'upsert', values, onConflict },
      { ...values, _pendiente: true },
    );
  }

  async findOne(filters = [], orderBy = 'created_at') {
    const rows = await this.list({ filters, orderBy });
    return rows[0] ?? null;
  }

  removeWhere(filters) {
    return this.#escribir(
      async () => BaseRepository.#check(await this.#filtrar(this.client.from(this.table).delete(), filters)),
      { op: 'deleteWhere', filters },
      null,
    );
  }

  remove(id) {
    return this.#escribir(
      async () => BaseRepository.#check(await this.client.from(this.table).delete().eq('id', id)),
      { op: 'delete', id },
      null,
    );
  }
}

export class MovimientosRepository extends BaseRepository {
  constructor(client) { super(client, 'movimientos'); }

  listEntre(desde, hasta) {
    return this.list({ orderBy: 'fecha', filters: [['fecha', 'gte', desde], ['fecha', 'lt', hasta]] });
  }
}

const TABLAS = {
  deudas: 'deudas', pagos: 'pagos_deuda', metas: 'metas', aportes: 'aportes_meta',
  tareas: 'tareas', habitos: 'habitos', registrosHabito: 'registros_habito', eventos: 'eventos', notas: 'notas',
  materias: 'materias', evaluaciones: 'evaluaciones', ajustes: 'ajustes', horas: 'horas_trabajo',
  entrenamientos: 'entrenamientos', salud: 'registros_salud',
  cuentas: 'cuentas', presupuestos: 'presupuestos', recurrentes: 'recurrentes', deseos: 'deseos', precios: 'precios_deseo',
  prestamos: 'prestamos', abonos: 'abonos_prestamo', apuntes: 'apuntes', proyectos: 'proyectos_grupo',
  sesiones: 'sesiones_estudio', rutinaItems: 'rutina_items', rutinaChecks: 'rutina_checks', metasVida: 'metas_vida',
  pasos: 'pasos_meta', lecturas: 'lecturas', contactos: 'contactos', revisiones: 'revisiones', push: 'push_suscripciones',
  flashcards: 'flashcards', compras: 'lista_compras',
};

export function crearRepositorios(client) {
  const repos = { movimientos: new MovimientosRepository(client) };
  for (const [clave, tabla] of Object.entries(TABLAS)) repos[clave] = new BaseRepository(client, tabla);
  return repos;
}

/** Sube a Supabase los cambios hechos sin conexión, en el orden en que se hicieron. */
export async function sincronizar(client) {
  const ops = outbox.leer();
  if (!ops.length || sinConexion()) return { subidas: 0, fallidas: 0 };
  let subidas = 0;
  let fallidas = 0;
  const restantes = [...ops];
  while (restantes.length) {
    const o = restantes[0];
    const t = client.from(o.table);
    let res;
    try {
      if (o.op === 'insert') res = await t.upsert(o.values, { onConflict: 'id', ignoreDuplicates: true });
      else if (o.op === 'update') res = await t.update(o.values).eq('id', o.id);
      else if (o.op === 'upsert') res = await t.upsert(o.values, { onConflict: o.onConflict });
      else if (o.op === 'delete') res = await t.delete().eq('id', o.id);
      else if (o.op === 'deleteWhere') { let q = t.delete(); for (const [c, op, v] of o.filters) q = q[op](c, v); res = await q; }
    } catch (e) {
      if (esErrorDeRed(e)) break;
      res = { error: e };
    }
    if (res?.error && esErrorDeRed(res.error)) break;
    if (res?.error) { fallidas++; console.warn('Cambio descartado al sincronizar', o, res.error); } else subidas++;
    restantes.shift();
    outbox.guardar(restantes);
  }
  return { subidas, fallidas };
}
