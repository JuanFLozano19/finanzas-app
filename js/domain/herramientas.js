// Reglas puras de las herramientas: escáner de recibos, buscador, calendario de mes,
// copiar semana de turnos, comparación entre meses, redondeo, cierre de semestre e
// importación de extractos. Sin DOM ni Supabase: todo se prueba en tests/herramientas.test.js.
import { addDays, today } from '../core/format.js';
import { sinTildes, categoriaDe } from './asistente.js';
import { NOTA_APROBATORIA } from './vida.js';

export const normalizar = (s) => sinTildes(String(s ?? '')).replace(/\s+/g, ' ').trim();

// ---------- Valores en pesos ----------
/** "$ 15.000", "-15,000.00", "(20.000)", "1.250.000,50" → número con signo (pesos enteros). */
export function parseValor(txt) {
  if (typeof txt === 'number') return Math.round(txt);
  let t = String(txt ?? '').trim();
  if (!t) return null;
  const negativo = /^\(.*\)$/.test(t) || /^-|-\s*\$|^\$\s*-|-$/.test(t);
  t = t.replace(/[^\d.,]/g, '');
  if (!/\d/.test(t)) return null;
  t = t.replace(/[.,]\d{1,2}$/, ''); // quita centavos
  t = t.replace(/[.,]/g, '');
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

const RE_PLATA = /\(?-?\s*\$?\s*-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\)?|\(?-?\s*\$\s*-?\d+(?:[.,]\d{1,2})?\)?|\b\d{4,9}\b/g;
const valoresEn = (linea) => (linea.match(RE_PLATA) || []).map(parseValor).filter((v) => v != null);

// ---------- Fechas en cualquier formato ----------
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const valida = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2100;

/** Reconoce 25/11/2026, 2026-11-25, 25-11-26, "25 nov 2026", "25 NOV", y números de fecha de Excel. */
export function parseFechaFlexible(valor, hoyIso = today()) {
  if (valor == null || valor === '') return null;
  if (valor instanceof Date && !Number.isNaN(valor)) return iso(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  if (typeof valor === 'number' && valor > 30000 && valor < 80000) { // fecha serial de Excel
    const d = new Date(Date.UTC(1899, 11, 30) + valor * 864e5);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const t = normalizar(valor);
  let m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  if (m && valida(+m[1], +m[2], +m[3])) return iso(+m[1], +m[2], +m[3]);
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(t);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (valida(y, +m[2], +m[1])) return iso(y, +m[2], +m[1]);
  }
  m = /\b(\d{1,2})(?:\s+de)?\s+([a-z]{3})[a-z]*\.?(?:\s+(?:de\s+)?(\d{4}))?/.exec(t);
  if (m && MESES[m[2]]) {
    let y = m[3] ? +m[3] : +hoyIso.slice(0, 4);
    if (!m[3] && iso(y, MESES[m[2]], +m[1]) > addDays(hoyIso, 1)) y -= 1; // "25 dic" en enero es del año pasado
    if (valida(y, MESES[m[2]], +m[1])) return iso(y, MESES[m[2]], +m[1]);
  }
  return null;
}

// ---------- Escáner de recibos ----------
const CLAVE_TOTAL = /\b(total(?!\s*items?)|vr\.?\s*total|valor\s*(?:total|a\s*pagar)|a\s*pagar|neto\s*a\s*pagar)\b/;
const CLAVE_PAGO = /\b(efectivo|tarjeta|pago)\b/;
const NO_TOTAL = /sub\s*-?\s*total|iva|impuesto|descuento|cambio|propina|base|items?\b|nit|tel|cant/;

/** Del texto leído en una foto de recibo saca el total, el comercio y la fecha. */
export function extraerTotal(texto, hoyIso = today()) {
  const lineas = String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const norm = lineas.map(normalizar);
  let monto = null;
  // 1) Líneas con "TOTAL" (no subtotal ni IVA); si no hay, las de "EFECTIVO"/"TARJETA".
  for (const clave of [CLAVE_TOTAL, CLAVE_PAGO]) {
    norm.forEach((l, i) => {
      if (!clave.test(l) || NO_TOTAL.test(l)) return;
      let vals = valoresEn(lineas[i]);
      if (!vals.length && lineas[i + 1]) vals = valoresEn(lineas[i + 1]); // a veces el valor queda en la línea siguiente
      for (const v of vals.map(Math.abs)) if (v >= 100 && v < 50e6 && (monto == null || v > monto)) monto = v;
    });
    if (monto != null) break;
  }
  // 2) Si no hay "TOTAL", el valor con separador de miles más grande del recibo.
  if (monto == null) {
    for (const l of lineas) for (const v of (l.match(/\$?\s*\d{1,3}(?:[.,]\d{3})+/g) || []).map(parseValor)) {
      if (v >= 100 && v < 50e6 && (monto == null || v > monto)) monto = v;
    }
  }
  const comercio = lineas.find((l) => /[a-záéíóúñ]{3,}/i.test(l) && !/factura|nit|fecha|regimen|tel|direcci|cra|calle|www/i.test(l)) || '';
  const fecha = lineas.map((l) => parseFechaFlexible(l, hoyIso)).find(Boolean) || null;
  const nombre = comercio.replace(/[^\p{L}\p{N}\s&.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return { monto, comercio: nombre, fecha, categoria: categoriaDe(lineas.join(' ')) };
}

// ---------- Buscador ----------
/**
 * @param {Array<{tipo:string,titulo:string,detalle?:string,fecha?:string}>} indice
 * Cada palabra buscada debe aparecer. Pesa más en el título y al inicio.
 */
export function buscar(indice, consulta, limite = 40) {
  const palabras = normalizar(consulta).split(' ').filter((p) => p.length >= 2 || /\d/.test(p));
  if (!palabras.length) return [];
  const out = [];
  for (const item of indice) {
    const titulo = normalizar(item.titulo);
    const todo = `${titulo} ${normalizar(item.detalle)}`;
    if (!palabras.every((p) => todo.includes(p))) continue;
    let puntaje = 0;
    for (const p of palabras) {
      if (titulo.startsWith(p)) puntaje += 4;
      else if (new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(titulo)) puntaje += 3;
      else if (titulo.includes(p)) puntaje += 2;
      else puntaje += 1;
    }
    out.push({ ...item, puntaje });
  }
  return out.sort((a, b) => b.puntaje - a.puntaje || String(b.fecha || '').localeCompare(String(a.fecha || ''))).slice(0, limite);
}

// ---------- Calendario de mes ----------
/** Semanas (lunes a domingo) que cubren el mes `ym`; cada día dice si es del mes. */
export function mesCalendario(ym) {
  const primero = `${ym}-01`;
  const wd = new Date(`${primero}T00:00:00`).getDay();
  let d = addDays(primero, wd === 0 ? -6 : 1 - wd);
  const semanas = [];
  do {
    const semana = [];
    for (let i = 0; i < 7; i++, d = addDays(d, 1)) semana.push({ fecha: d, delMes: d.startsWith(ym) });
    semanas.push(semana);
  } while (d.startsWith(ym));
  return semanas;
}

// ---------- Copiar semana de turnos ----------
const CAMPOS_TURNO = ['titulo', 'tipo', 'hora_inicio', 'hora_fin', 'lugar', 'descripcion', 'color', 'recordatorio_min', 'materia_id'];
/** Copia los turnos sueltos (no semanales) de la semana `origen` a la semana `destino`, sin duplicar. */
export function copiarSemana(eventos, origen, destino) {
  const dias = Math.round((new Date(`${destino}T00:00:00Z`) - new Date(`${origen}T00:00:00Z`)) / 864e5);
  const fin = addDays(origen, 6);
  const existe = new Set(eventos.map((e) => `${e.fecha}|${(e.hora_inicio || '').slice(0, 5)}`));
  return eventos
    .filter((e) => !e.semanal && e.fecha >= origen && e.fecha <= fin)
    .map((e) => {
      const copia = Object.fromEntries(CAMPOS_TURNO.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));
      return { ...copia, fecha: addDays(e.fecha, dias), semanal: false };
    })
    .filter((n) => !existe.has(`${n.fecha}|${(n.hora_inicio || '').slice(0, 5)}`));
}

// ---------- Comparar con el mes pasado ----------
const sumaGastos = (movs) => movs.filter((m) => m.tipo === 'gasto').reduce((a, m) => a + Number(m.monto), 0);
const porCategoria = (movs) => movs.filter((m) => m.tipo === 'gasto')
  .reduce((acc, m) => ({ ...acc, [m.categoria || 'Otros']: (acc[m.categoria || 'Otros'] || 0) + Number(m.monto) }), {});
const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

/**
 * Compara los gastos de este mes contra el mismo tramo del mes pasado (del día 1 al mismo día).
 * Alerta cuando una categoría sube al menos `minPct` % y `minDiff` pesos.
 */
export function compararMeses(actual, anterior, { minPct = 30, minDiff = 20000 } = {}) {
  const a = porCategoria(actual);
  const b = porCategoria(anterior);
  const categorias = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .map((c) => ({ categoria: c, actual: a[c] || 0, anterior: b[c] || 0, diff: (a[c] || 0) - (b[c] || 0), pct: pct(a[c] || 0, b[c] || 0) }))
    .sort((x, y) => y.diff - x.diff);
  const total = { actual: sumaGastos(actual), anterior: sumaGastos(anterior) };
  total.diff = total.actual - total.anterior;
  total.pct = pct(total.actual, total.anterior);
  const alertas = categorias.filter((c) => c.anterior > 0 && c.pct >= minPct && c.diff >= minDiff);
  return { total, categorias, alertas };
}

/** Mismo tramo del mes anterior: si hoy es 25 de nov → del 1 al 25 de oct (o al último día si oct es más corto). */
export function tramoMesAnterior(hoyIso) {
  const [y, m, d] = hoyIso.split('-').map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const ultimo = new Date(py, pm, 0).getDate();
  return { desde: iso(py, pm, 1), hasta: addDays(iso(py, pm, Math.min(d, ultimo)), 1), ym: `${py}-${String(pm).padStart(2, '0')}` };
}

// ---------- Ahorro por redondeo ----------
/** Lo que falta para llegar al siguiente múltiplo de `a` (13.500 → 500 con a = 1.000). */
export function redondeo(monto, a = 1000) {
  const n = Math.round(Number(monto));
  if (!(n > 0) || !(a > 0)) return 0;
  const sobra = n % a;
  return sobra === 0 ? 0 : a - sobra;
}

// ---------- Cierre de semestre ----------
/** Convierte las notas finales digitadas en el nuevo estado de cada materia que se estaba cursando. */
export function cierreSemestre(materias, notas) {
  return materias.filter((m) => m.estado === 'cursando' || m.activa).flatMap((m) => {
    const n = Number(String(notas[m.id] ?? '').replace(',', '.'));
    if (notas[m.id] === '' || notas[m.id] == null || !Number.isFinite(n) || n < 0 || n > 5) return [];
    return [{ id: m.id, nombre: m.nombre, nota_final: Math.round(n * 100) / 100, estado: n >= NOTA_APROBATORIA ? 'aprobada' : 'perdida' }];
  });
}

// ---------- Importar extractos ----------
const COLS = {
  fecha: /fecha|date|dia/,
  descripcion: /descrip|concepto|detalle|referencia|movimiento|transacc|comercio|nombre/,
  debito: /debito|cargo|retiro|egreso|salida|debit/,
  credito: /credito|abono|deposito|ingreso|entrada|credit/,
  valor: /valor|monto|importe|cantidad|amount|saldo mov/,
};
/** Adivina qué columna es la fecha, la descripción y el valor (o débito/crédito). */
export function detectarColumnas(encabezados) {
  const n = encabezados.map(normalizar);
  const usado = new Set();
  const buscarCol = (re, evitar) => {
    const i = n.findIndex((h, k) => !usado.has(k) && re.test(h) && !(evitar && evitar.test(h)));
    if (i >= 0) usado.add(i);
    return i >= 0 ? i : null;
  };
  const fecha = buscarCol(COLS.fecha);
  const debito = buscarCol(COLS.debito);
  const credito = buscarCol(COLS.credito);
  const valor = buscarCol(COLS.valor, /saldo$|^saldo\b(?!.*mov)/);
  const descripcion = buscarCol(COLS.descripcion);
  return { fecha, descripcion, valor, debito, credito };
}

const INGRESO = /recib|abono|deposit|consignac|nomina|salario|pago recibido|transferencia de|te envi|entrada|reembolso|devoluci/;

/** Filas de un CSV/Excel → movimientos. Valor negativo o en "débito" = gasto. */
export function filasAMovimientos(filas, cols, hoyIso = today()) {
  // Si el archivo trae valores negativos, el signo manda. Si no, decide la descripción.
  const hayNegativos = cols.valor != null && filas.some((f) => (parseValor(f[cols.valor]) ?? 0) < 0);
  const out = [];
  for (const fila of filas) {
    const fecha = parseFechaFlexible(fila[cols.fecha], hoyIso);
    if (!fecha) continue;
    const descripcion = String(fila[cols.descripcion] ?? '').replace(/\s+/g, ' ').trim();
    let valor = null;
    if (cols.debito != null || cols.credito != null) {
      const deb = parseValor(fila[cols.debito]);
      const cre = parseValor(fila[cols.credito]);
      if (deb) valor = -Math.abs(deb);
      else if (cre) valor = Math.abs(cre);
    }
    if (valor == null && cols.valor != null) {
      valor = parseValor(fila[cols.valor]);
      const explicito = /^\s*\+/.test(String(fila[cols.valor]));
      if (valor > 0 && !hayNegativos && !explicito && !INGRESO.test(normalizar(descripcion))) valor = -valor;
    }
    if (!valor) continue;
    out.push(movimiento(fecha, descripcion, valor));
  }
  return out;
}

function movimiento(fecha, descripcion, valor) {
  const tipo = valor < 0 ? 'gasto' : 'ingreso';
  return {
    fecha, tipo, monto: Math.abs(valor), descripcion: descripcion.slice(0, 80),
    categoria: tipo === 'gasto' ? categoriaDe(descripcion) : 'Otros',
  };
}

/** Texto de un PDF de extracto (Nequi, banco) → movimientos: cada línea con fecha y valor. */
export function lineasAMovimientos(texto, hoyIso = today()) {
  const out = [];
  for (const cruda of String(texto || '').split(/\r?\n/)) {
    const linea = cruda.replace(/\s+/g, ' ').trim();
    const fecha = parseFechaFlexible(linea, hoyIso);
    if (!fecha) continue;
    const tokens = linea.match(/[-+]?\s*\$\s*-?[\d.,]+|[-+]?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?/g) || [];
    if (!tokens.length) continue;
    const token = tokens[0]; // el primero suele ser el valor; el último, el saldo
    let valor = parseValor(token);
    if (!valor) continue;
    const descripcion = linea.replace(token, ' ').replace(/(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})|(\d{1,2}\s+(de\s+)?[a-záéíóú]{3,}\.?(\s+(de\s+)?\d{4})?)/i, ' ')
      .replace(/[-+]?\s*\$?\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/^[-+]/.test(token.trim()) && !/-/.test(token)) valor = INGRESO.test(normalizar(descripcion)) ? Math.abs(valor) : -Math.abs(valor);
    out.push(movimiento(fecha, descripcion || 'Movimiento', valor));
  }
  return out;
}

/** Marca como repetidos los que ya existen (misma fecha, tipo y monto). */
export function marcarDuplicados(nuevos, existentes) {
  const ya = new Map();
  for (const e of existentes) {
    const k = `${e.fecha}|${e.tipo}|${Math.round(Number(e.monto))}`;
    ya.set(k, (ya.get(k) || 0) + 1);
  }
  return nuevos.map((n) => {
    const k = `${n.fecha}|${n.tipo}|${n.monto}`;
    const c = ya.get(k) || 0;
    if (c > 0) { ya.set(k, c - 1); return { ...n, duplicado: true }; }
    return { ...n, duplicado: false };
  });
}
