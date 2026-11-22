// Cola de cambios hechos sin conexión (outbox). Se guarda en localStorage
// y se aplica sobre las lecturas para que la app muestre lo que acabas de registrar.
const KEY = 'rumbo-outbox';
const store = typeof localStorage !== 'undefined' ? localStorage : null;

export const outbox = {
  leer() {
    try { return JSON.parse(store?.getItem(KEY)) || []; } catch { return []; }
  },
  guardar(ops) {
    try { store?.setItem(KEY, JSON.stringify(ops)); } catch { /* sin almacenamiento */ }
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('outbox', { detail: ops.length }));
  },
  agregar(op) { this.guardar([...this.leer(), { ...op, at: Date.now() }]); },
  vaciar() { this.guardar([]); },
};

export const sinConexion = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function esErrorDeRed(e) {
  const m = String(e?.message || e || '');
  return /Failed to fetch|NetworkError|Load failed|network|fetch failed/i.test(m);
}

const OPS = {
  eq: (a, b) => String(a) === String(b),
  neq: (a, b) => String(a) !== String(b),
  gt: (a, b) => a > b, gte: (a, b) => a >= b, lt: (a, b) => a < b, lte: (a, b) => a <= b,
};
export const cumpleFiltros = (row, filters) =>
  filters.every(([col, op, val]) => (OPS[op] ? OPS[op](row[col], val) : true));

/** Aplica inserciones, ediciones y borrados pendientes de una tabla a las filas leídas. */
export function aplicarPendientes(table, rows, filters = [], orderBy, ascending, ops = outbox.leer()) {
  let res = [...rows];
  for (const o of ops) {
    if (o.table !== table) continue;
    if (o.op === 'insert' && !res.some((r) => r.id === o.values.id)) {
      const row = { created_at: new Date(o.at || Date.now()).toISOString(), ...o.values, _pendiente: true };
      if (cumpleFiltros(row, filters)) res.push(row);
    } else if (o.op === 'update') {
      res = res.map((r) => (r.id === o.id ? { ...r, ...o.values, _pendiente: true } : r));
    } else if (o.op === 'delete') {
      res = res.filter((r) => r.id !== o.id);
    } else if (o.op === 'deleteWhere') {
      res = res.filter((r) => !cumpleFiltros(r, o.filters));
    } else if (o.op === 'upsert') {
      const keys = (o.onConflict || 'id').split(',').filter((k) => k !== 'user_id');
      const i = res.findIndex((r) => keys.every((k) => String(r[k]) === String(o.values[k])));
      if (i >= 0) res[i] = { ...res[i], ...o.values, _pendiente: true };
      else if (cumpleFiltros(o.values, filters)) res.push({ ...o.values, _pendiente: true });
    }
  }
  if (orderBy && ops.some((o) => o.table === table)) {
    res.sort((a, b) => {
      const x = a[orderBy] ?? '';
      const y = b[orderBy] ?? '';
      return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
    });
  }
  return res;
}
