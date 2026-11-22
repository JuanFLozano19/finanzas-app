// Casos de uso de plata: cuentas, presupuestos, pagos fijos, deseos, préstamos,
// reparto de ingresos, "¿me lo puedo permitir?" y estadísticas.
import { today, currentMonth, monthRange, addDays, startOfWeek } from '../core/format.js';
import { sum, gastosPorCategoria, estadoDeuda } from '../domain/calculos.js';
import {
  saldoCuenta, estadoPresupuestos, estadoRecurrente, estadoDeseo, repartir,
  serieMensual, puedoPermitirme, ahorroPromedio,
} from '../domain/plata.js';

export class PlataService {
  constructor(repos) { this.r = repos; }

  // ---------- Cuentas y bolsillos ----------
  async cuentas() {
    const [cuentas, movs] = await Promise.all([
      this.r.cuentas.list({ orderBy: 'created_at', ascending: true }),
      this.r.movimientos.list({ orderBy: 'fecha' }),
    ]);
    const items = cuentas.map((c) => ({ ...c, saldo: saldoCuenta(c, movs) }));
    const activas = items.filter((c) => c.activa);
    return { items, total: sum(activas, (c) => c.saldo), sinCuenta: movs.filter((m) => !m.cuenta_id).length };
  }
  guardarCuenta(id, d) { return id ? this.r.cuentas.update(id, d) : this.r.cuentas.create(d); }
  eliminarCuenta(id) { return this.r.cuentas.remove(id); }
  /** Ajusta el saldo inicial para que el saldo calculado coincida con el real. */
  ajustarSaldo(cuenta, saldoReal) {
    return this.r.cuentas.update(cuenta.id, { saldo_inicial: Number(cuenta.saldo_inicial) + (saldoReal - cuenta.saldo) });
  }
  listaCuentas() { return this.r.cuentas.list({ orderBy: 'created_at', ascending: true }); }

  // ---------- Presupuestos ----------
  async presupuestos(ym = currentMonth()) {
    const [desde, hasta] = monthRange(ym);
    const [pres, movs] = await Promise.all([this.r.presupuestos.list(), this.r.movimientos.listEntre(desde, hasta)]);
    const items = estadoPresupuestos(pres, movs);
    return { items, totalPresupuesto: sum(items), totalGastado: sum(items, (p) => p.gastado) };
  }
  guardarPresupuesto(id, d) { return id ? this.r.presupuestos.update(id, d) : this.r.presupuestos.create(d); }
  eliminarPresupuesto(id) { return this.r.presupuestos.remove(id); }

  // ---------- Pagos fijos ----------
  async recurrentes(hoy = today()) {
    const items = (await this.r.recurrentes.list({ orderBy: 'dia_mes', ascending: true }))
      .map((x) => ({ ...x, estado: estadoRecurrente(x, hoy) }));
    const activos = items.filter((x) => x.activo);
    return {
      items,
      pendientes: activos.filter((x) => !x.estado.pagado && x.tipo === 'gasto'),
      totalMensual: sum(activos.filter((x) => x.tipo === 'gasto')),
    };
  }
  guardarRecurrente(id, d) { return id ? this.r.recurrentes.update(id, d) : this.r.recurrentes.create(d); }
  eliminarRecurrente(id) { return this.r.recurrentes.remove(id); }
  async registrarRecurrente(x, { monto, fecha }) {
    await this.r.movimientos.create({
      tipo: x.tipo, monto, fecha, categoria: x.categoria, descripcion: x.nombre, cuenta_id: x.cuenta_id || null,
    });
    await this.r.recurrentes.update(x.id, { ultimo_mes: fecha.slice(0, 7) });
  }

  // ---------- Lista de deseos ----------
  async deseos(hoy = today()) {
    const [deseos, precios] = await Promise.all([this.r.deseos.list(), this.r.precios.list({ orderBy: 'fecha', ascending: true })]);
    return deseos.map((d) => ({ ...d, estado: estadoDeseo(d, precios, hoy) }));
  }
  async guardarDeseo(id, { precio, tienda, ...d }) {
    const deseo = id ? await this.r.deseos.update(id, d) : await this.r.deseos.create(d);
    if (!id && precio) await this.r.precios.create({ deseo_id: deseo.id, precio, tienda, fecha: today() });
    return deseo;
  }
  eliminarDeseo(id) { return this.r.deseos.remove(id); }
  agregarPrecio(deseoId, d) { return this.r.precios.create({ deseo_id: deseoId, ...d }); }
  eliminarPrecio(id) { return this.r.precios.remove(id); }
  convertirEnMeta(deseo) {
    return this.r.metas.create({ nombre: deseo.nombre, monto_objetivo: deseo.estado.actual, icono: '🛍️', prioridad: deseo.prioridad });
  }
  async marcarComprado(deseo, { monto, fecha, registrarGasto }) {
    await this.r.deseos.update(deseo.id, { comprado: true });
    if (registrarGasto) {
      await this.r.movimientos.create({ tipo: 'gasto', monto, fecha, categoria: 'Otros', descripcion: deseo.nombre });
    }
  }

  // ---------- Préstamos (plata que te deben) ----------
  async prestamos() {
    const [prestamos, abonos] = await Promise.all([this.r.prestamos.list(), this.r.abonos.list({ orderBy: 'fecha' })]);
    const items = prestamos.map((p) => ({
      ...p, estado: estadoDeuda({ id: p.id, monto_total: p.monto }, abonos.map((a) => ({ ...a, deuda_id: a.prestamo_id }))),
    }));
    return { items, totalPorCobrar: sum(items, (p) => p.estado.pendiente) };
  }
  guardarPrestamo(id, d) { return id ? this.r.prestamos.update(id, d) : this.r.prestamos.create(d); }
  eliminarPrestamo(id) { return this.r.prestamos.remove(id); }
  async abonar(prestamo, { monto, fecha, comoIngreso }) {
    await this.r.abonos.create({ prestamo_id: prestamo.id, monto, fecha });
    if (comoIngreso) {
      await this.r.movimientos.create({ tipo: 'ingreso', monto, fecha, categoria: 'Otros', descripcion: `Me pagó ${prestamo.persona}` });
    }
  }
  eliminarAbono(id) { return this.r.abonos.remove(id); }

  // ---------- Reparto de ingresos ----------
  async configReparto() {
    const [aj, metas] = await Promise.all([this.r.ajustes.findOne([], 'updated_at'), this.r.metas.list({ orderBy: 'prioridad', ascending: true })]);
    const activas = metas.filter((m) => !m.completada);
    const reparto = (aj?.reparto || []).filter((x) => activas.some((m) => m.id === x.meta_id));
    return { reparto, metas: activas };
  }
  guardarReparto(reparto) { return this.r.ajustes.upsert({ reparto }, 'user_id'); }
  calcularReparto(monto, reparto) { return repartir(monto, reparto); }
  async aplicarReparto(items, fecha) {
    for (const it of items) if (it.monto > 0) await this.r.aportes.create({ meta_id: it.meta_id, monto: it.monto, fecha });
  }

  // ---------- ¿Me lo puedo permitir? ----------
  async evaluarCompra(precio) {
    const ym = currentMonth();
    const [desde] = monthRange(serieMensual([], ym, 4)[0].ym);
    const [movs, metas, aj] = await Promise.all([
      this.r.movimientos.list({ orderBy: 'fecha', filters: [['fecha', 'gte', desde]] }),
      this.r.metas.list({ orderBy: 'prioridad', ascending: true }),
      this.r.ajustes.findOne([], 'updated_at'),
    ]);
    const serie = serieMensual(movs, ym, 4);
    const ahorro = ahorroPromedio(serie);
    const metaPrincipal = metas.find((m) => !m.completada) || null;
    const tarifaHora = aj?.tarifa_hora ? Number(aj.tarifa_hora) : null;
    return {
      ...puedoPermitirme({ precio, balanceMes: serie[serie.length - 1].balance, ahorroMensual: ahorro, metaPrincipal, tarifaHora }),
      balanceMes: serie[serie.length - 1].balance, ahorroMensual: ahorro, metaPrincipal, tarifaHora,
    };
  }

  // ---------- Estadísticas ----------
  async estadisticas(ym = currentMonth()) {
    const serie0 = serieMensual([], ym, 6);
    const [desde] = monthRange(serie0[0].ym);
    const hoy = today();
    const lunes = startOfWeek(hoy);
    const desdeSemanas = addDays(lunes, -7 * 7);
    const [movs, horas, diario, salud] = await Promise.all([
      this.r.movimientos.list({ orderBy: 'fecha', filters: [['fecha', 'gte', desde]] }),
      this.r.horas.list({ orderBy: 'fecha', filters: [['fecha', 'gte', desdeSemanas]] }),
      this.r.notas.list({ orderBy: 'fecha', filters: [['tipo', 'eq', 'diario'], ['fecha', 'gte', addDays(hoy, -60)]] }),
      this.r.salud.list({ orderBy: 'fecha', filters: [['fecha', 'gte', addDays(hoy, -60)]] }),
    ]);
    const serie = serieMensual(movs, ym, 6);
    const [d0, d1] = monthRange(ym);
    const semanas = Array.from({ length: 8 }, (_, i) => {
      const ini = addDays(desdeSemanas, i * 7);
      const fin = addDays(ini, 7);
      return { ini, horas: sum(horas.filter((x) => x.fecha >= ini && x.fecha < fin), (x) => x.horas) };
    });
    // Ánimo según horas dormidas: cruza diario y salud por fecha.
    const sueno = new Map(salud.filter((s) => s.horas_sueno != null).map((s) => [s.fecha, Number(s.horas_sueno)]));
    const pares = diario.filter((n) => n.animo && sueno.has(n.fecha)).map((n) => ({ animo: n.animo, sueno: sueno.get(n.fecha) }));
    const prom = (xs) => (xs.length ? Math.round((xs.reduce((a, x) => a + x.animo, 0) / xs.length) * 10) / 10 : null);
    return {
      serie, ahorroPromedio: ahorroPromedio(serie),
      categorias: gastosPorCategoria(movs.filter((m) => m.fecha >= d0 && m.fecha < d1)),
      semanas,
      animo: { dias: pares.length, conSueno: prom(pares.filter((p) => p.sueno >= 7)), sinSueno: prom(pares.filter((p) => p.sueno < 7)) },
    };
  }
}
