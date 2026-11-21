// Reglas de negocio puras: sin red ni DOM, fáciles de probar.

export const sum = (items, pick = (x) => x.monto) => items.reduce((acc, x) => acc + Number(pick(x) || 0), 0);

export function resumenMovimientos(movimientos) {
  const ingresos = sum(movimientos.filter((m) => m.tipo === 'ingreso'));
  const gastos = sum(movimientos.filter((m) => m.tipo === 'gasto'));
  return { ingresos, gastos, balance: ingresos - gastos };
}

export function gastosPorCategoria(movimientos) {
  const mapa = new Map();
  for (const m of movimientos) {
    if (m.tipo !== 'gasto') continue;
    mapa.set(m.categoria, (mapa.get(m.categoria) || 0) + Number(m.monto));
  }
  return [...mapa.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}

export function estadoDeuda(deuda, pagos) {
  const propios = pagos.filter((p) => p.deuda_id === deuda.id);
  const total = Number(deuda.monto_total);
  const pagado = sum(propios);
  const pendiente = Math.max(0, total - pagado);
  const cuota = deuda.cuota ? Number(deuda.cuota) : null;
  return {
    pagado,
    pendiente,
    progreso: total > 0 ? Math.min(1, pagado / total) : 0,
    cuotasRestantes: cuota ? Math.ceil(pendiente / cuota) : null,
    saldada: pendiente === 0,
    pagos: propios.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
  };
}

/** Meses completos (redondeando hacia arriba) entre dos fechas ISO. */
export function mesesEntre(desdeIso, hastaIso) {
  const a = new Date(`${desdeIso}T00:00:00`);
  const b = new Date(`${hastaIso}T00:00:00`);
  if (b <= a) return 0;
  const dias = (b - a) / 86400000;
  return Math.max(1, Math.ceil(dias / 30.44));
}

export function estadoMeta(meta, aportes, hoyIso) {
  const propios = aportes.filter((a) => a.meta_id === meta.id);
  const objetivo = Number(meta.monto_objetivo);
  const ahorrado = Math.max(0, sum(propios));
  const restante = Math.max(0, objetivo - ahorrado);
  const meses = meta.fecha_objetivo ? mesesEntre(hoyIso, meta.fecha_objetivo) : null;
  return {
    ahorrado,
    restante,
    progreso: objetivo > 0 ? Math.min(1, ahorrado / objetivo) : 0,
    alcanzada: restante === 0,
    mesesRestantes: meses,
    vencida: meses === 0 && restante > 0,
    ahorroMensualNecesario: meses ? Math.ceil(restante / meses) : null,
    aportes: propios.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
  };
}
