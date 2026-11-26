// Casos de uso de la app. Orquesta repositorios + reglas de dominio.
// Depende de abstracciones (repos inyectados), no de Supabase (DIP).
import { monthRange, today } from '../core/format.js';
import { resumenMovimientos, gastosPorCategoria, estadoDeuda, estadoMeta, sum } from '../domain/calculos.js';
import { redondeo, compararMeses, tramoMesAnterior } from '../domain/herramientas.js';
import { addDays } from '../core/format.js';

export class FinanzasService {
  constructor(repos) { this.repos = repos; }

  // ---------- Movimientos ----------
  async movimientosDelMes(ym) {
    const [desde, hasta] = monthRange(ym);
    const movimientos = await this.repos.movimientos.listEntre(desde, hasta);
    return { movimientos, resumen: resumenMovimientos(movimientos), porCategoria: gastosPorCategoria(movimientos) };
  }
  /**
   * Crea o edita un movimiento. Si el ahorro por redondeo está activo, cada gasto nuevo
   * aporta a la meta elegida lo que falta para el siguiente múltiplo (queda en `_redondeo`).
   */
  async guardarMovimiento(id, datos, { redondear = true } = {}) {
    if (id) return this.repos.movimientos.update(id, datos);
    const mov = await this.repos.movimientos.create(datos);
    if (redondear && datos.tipo === 'gasto') {
      try {
        const cfg = (await this.repos.ajustes.findOne([], 'updated_at'))?.redondeo;
        const extra = cfg?.activo && cfg.meta_id ? redondeo(datos.monto, cfg.multiplo || 1000) : 0;
        if (extra) { await this.repos.aportes.create({ meta_id: cfg.meta_id, monto: extra, fecha: datos.fecha || today() }); return { ...mov, _redondeo: extra }; }
      } catch { /* el gasto ya quedó guardado; el redondeo es un extra */ }
    }
    return mov;
  }

  /** Gastos de este mes contra el mismo tramo del mes pasado. */
  async compararConMesPasado(hoy = today()) {
    const ant = tramoMesAnterior(hoy);
    const [actual, anterior] = await Promise.all([
      this.repos.movimientos.listEntre(`${hoy.slice(0, 7)}-01`, addDays(hoy, 1)),
      this.repos.movimientos.listEntre(ant.desde, ant.hasta),
    ]);
    return { ...compararMeses(actual, anterior), ymAnterior: ant.ym, hayDatos: anterior.length > 0 };
  }
  eliminarMovimiento(id) { return this.repos.movimientos.remove(id); }

  // ---------- Deudas ----------
  async deudas() {
    const [deudas, pagos] = await Promise.all([
      this.repos.deudas.list({ orderBy: 'created_at', ascending: true }),
      this.repos.pagos.list({ orderBy: 'fecha' }),
    ]);
    const items = deudas.map((d) => ({ ...d, estado: estadoDeuda(d, pagos) }));
    return { items, totalPendiente: sum(items, (d) => d.estado.pendiente) };
  }
  guardarDeuda(id, datos) { return id ? this.repos.deudas.update(id, datos) : this.repos.deudas.create(datos); }
  eliminarDeuda(id) { return this.repos.deudas.remove(id); }

  async registrarPago(deuda, { monto, fecha, comoGasto }) {
    await this.repos.pagos.create({ deuda_id: deuda.id, monto, fecha });
    if (comoGasto) {
      await this.repos.movimientos.create({
        tipo: 'gasto', monto, fecha, categoria: 'Pago de deudas', descripcion: `Pago: ${deuda.nombre}`,
      });
    }
  }
  eliminarPago(id) { return this.repos.pagos.remove(id); }

  // ---------- Metas ----------
  async metas() {
    const [metas, aportes] = await Promise.all([
      this.repos.metas.list({ orderBy: 'prioridad', ascending: true }),
      this.repos.aportes.list({ orderBy: 'fecha' }),
    ]);
    const hoy = today();
    const items = metas.map((m) => ({ ...m, estado: estadoMeta(m, aportes, hoy) }));
    return { items, totalAhorrado: sum(items.filter((m) => !m.completada), (m) => m.estado.ahorrado) };
  }
  guardarMeta(id, datos) { return id ? this.repos.metas.update(id, datos) : this.repos.metas.create(datos); }
  eliminarMeta(id) { return this.repos.metas.remove(id); }
  aportar(metaId, monto, fecha) { return this.repos.aportes.create({ meta_id: metaId, monto, fecha }); }
  eliminarAporte(id) { return this.repos.aportes.remove(id); }

  // ---------- Resumen ----------
  async resumenGeneral(ym) {
    const [mes, deudas, metas] = await Promise.all([this.movimientosDelMes(ym), this.deudas(), this.metas()]);
    return { mes, deudas, metas };
  }
}
