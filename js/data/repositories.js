// Capa de acceso a datos (patrón Repository).
// Las vistas nunca hablan con Supabase directamente: si mañana cambias de
// backend, solo se reemplaza esta capa.

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

  async list({ orderBy = 'created_at', ascending = false, filters = [] } = {}) {
    let q = this.client.from(this.table).select('*');
    for (const [col, op, val] of filters) q = q[op](col, val);
    return BaseRepository.#check(await q.order(orderBy, { ascending }));
  }

  async create(values) {
    return BaseRepository.#check(await this.client.from(this.table).insert(values).select().single());
  }

  async update(id, values) {
    return BaseRepository.#check(await this.client.from(this.table).update(values).eq('id', id).select().single());
  }

  async upsert(values, onConflict) {
    return BaseRepository.#check(await this.client.from(this.table).upsert(values, { onConflict }).select().single());
  }

  async findOne(filters = []) {
    let q = this.client.from(this.table).select('*');
    for (const [col, op, val] of filters) q = q[op](col, val);
    return BaseRepository.#check(await q.maybeSingle());
  }

  async removeWhere(filters) {
    let q = this.client.from(this.table).delete();
    for (const [col, op, val] of filters) q = q[op](col, val);
    BaseRepository.#check(await q);
  }

  async remove(id) {
    BaseRepository.#check(await this.client.from(this.table).delete().eq('id', id));
  }
}

export class MovimientosRepository extends BaseRepository {
  constructor(client) { super(client, 'movimientos'); }

  listEntre(desde, hasta) {
    return this.list({ orderBy: 'fecha', filters: [['fecha', 'gte', desde], ['fecha', 'lt', hasta]] });
  }
}

export const crearRepositorios = (client) => ({
  movimientos: new MovimientosRepository(client),
  deudas: new BaseRepository(client, 'deudas'),
  pagos: new BaseRepository(client, 'pagos_deuda'),
  metas: new BaseRepository(client, 'metas'),
  aportes: new BaseRepository(client, 'aportes_meta'),
  tareas: new BaseRepository(client, 'tareas'),
  habitos: new BaseRepository(client, 'habitos'),
  registrosHabito: new BaseRepository(client, 'registros_habito'),
  eventos: new BaseRepository(client, 'eventos'),
  notas: new BaseRepository(client, 'notas'),
  materias: new BaseRepository(client, 'materias'),
  evaluaciones: new BaseRepository(client, 'evaluaciones'),
  ajustes: new BaseRepository(client, 'ajustes'),
  horas: new BaseRepository(client, 'horas_trabajo'),
  entrenamientos: new BaseRepository(client, 'entrenamientos'),
  salud: new BaseRepository(client, 'registros_salud'),
});
