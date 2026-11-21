// Utilidades de formato (sin dependencias del DOM: se pueden probar en Node).
const moneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const fmtMoney = (n) => moneda.format(Number(n) || 0);

export const fmtPct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function today(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export const currentMonth = (d = new Date()) => today(d).slice(0, 7);

/** 'YYYY-MM' -> ['YYYY-MM-01', primer día del mes siguiente] */
export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return [`${ym}-01`, `${next}-01`];
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
