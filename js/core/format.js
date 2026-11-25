// Utilidades de formato (sin dependencias del DOM: se pueden probar en Node).
const moneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const fmtMoney = (n) => moneda.format(Number(n) || 0);

export const fmtPct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;

/** Fecha corta. El año solo aparece si no es el actual (o si se pide con { anio: true }). */
export function fmtDate(iso, { anio = false } = {}) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  const conAnio = anio || d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}) });
}

/** Fecha en palabras cuando está cerca: hoy, mañana, ayer, en 3 días, hace 2 días. */
export function fmtRelativa(iso, base = today()) {
  if (!iso) return '';
  const dias = Math.round((new Date(`${iso}T00:00:00Z`) - new Date(`${base}T00:00:00Z`)) / 864e5);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  if (dias > 1 && dias < 7) return `en ${dias} días`;
  if (dias < -1 && dias > -7) return `hace ${-dias} días`;
  return fmtDate(iso);
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

/** Suma n días a una fecha ISO (YYYY-MM-DD). */
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return today(d);
}

/** Día de la semana: 0 = domingo … 6 = sábado. */
export const weekday = (iso) => new Date(`${iso}T00:00:00`).getDay();

export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function fmtDayLong(iso) {
  const s = new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** '14:30:00' -> '2:30 p. m.' */
export function fmtTime(t) {
  if (!t) return '';
  const [hh, mm] = t.split(':').map(Number);
  const d = new Date(2000, 0, 1, hh, mm);
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/** Lunes de la semana de una fecha ISO. */
export function startOfWeek(iso) {
  const wd = weekday(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}
