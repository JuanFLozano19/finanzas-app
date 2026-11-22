// Asistente sin IA: entiende frases comunes en español colombiano y las convierte
// en una acción concreta. Todo es local, gratis y predecible (ver tests/asistente.test.js).
import { addDays, weekday } from '../core/format.js';

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Montos ----------
const MULT = [
  [/^(millones|millon|palos?|m|mill)$/, 1e6],
  [/^(mil|k|lucas?|barras?)$/, 1e3],
];

function numero(txt) {
  let t = txt.replace(/\s|\$/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Busca un monto: "15 mil", "15k", "$15.000", "1,5 millones", "20 lucas", "2 palos". */
export function parseMonto(texto) {
  const t = sinTildes(texto);
  const re = /\$?\s*(\d[\d.,]*)\s*(millones|millon|mill|palos?|mil|lucas?|barras?|k|m)?\b/g;
  let m;
  let mejor = null;
  while ((m = re.exec(t))) {
    const n = numero(m[1]);
    if (n == null) continue;
    const suf = m[2] || '';
    const mult = MULT.find(([r]) => r.test(suf))?.[1] || 1;
    const valor = Math.round(n * mult);
    // Ignora cantidades pequeñas sin sufijo que no parecen plata (ej. "2 vasos").
    if (mult === 1 && valor < 500) continue;
    if (!mejor || valor > mejor.valor) mejor = { valor, texto: m[0].trim() };
  }
  return mejor;
}

// ---------- Fechas ----------
const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

export function parseFecha(texto, hoyIso) {
  const t = sinTildes(texto);
  if (/pasado\s*manana/.test(t)) return { fecha: addDays(hoyIso, 2), texto: /pasado\s*mañana|pasado\s*manana/i.exec(texto)?.[0] };
  if (/\bmanana\b/.test(t)) return { fecha: addDays(hoyIso, 1), texto: /mañana|manana/i.exec(texto)?.[0] };
  if (/\bayer\b/.test(t)) return { fecha: addDays(hoyIso, -1), texto: 'ayer' };
  if (/\bhoy\b/.test(t)) return { fecha: hoyIso, texto: 'hoy' };
  const dm = /\b(\d{1,2})\s*(?:\/|-|de\s+)(\d{1,2}|[a-z]+)\b/.exec(t);
  if (dm) {
    const mes = /^\d+$/.test(dm[2]) ? Number(dm[2]) : MESES[dm[2]];
    const dia = Number(dm[1]);
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      let y = Number(hoyIso.slice(0, 4));
      let f = `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      if (f < hoyIso) { y += 1; f = `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`; }
      return { fecha: f, texto: dm[0] };
    }
  }
  const ds = /\b(?:el\s+|este\s+|para\s+el\s+|proximo\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/.exec(t);
  if (ds) {
    const objetivo = DIAS[ds[1]];
    const delta = ((objetivo - weekday(hoyIso) + 7) % 7) || 7;
    return { fecha: addDays(hoyIso, delta), texto: ds[0] };
  }
  return null;
}

// ---------- Categorías ----------
const CATEGORIAS = [
  ['Comida', /almuerzo|desayuno|comida|cena|mercado|onces|empanada|pizza|hamburguesa|restaurante|domicilio|rappi|cafe|tinto|arepa|pollo|perro|salchipapa|helado|gaseosa|snack|panaderia|corrientazo/],
  ['Transporte', /bus|buseta|taxi|uber|didi|indriver|gasolina|pasaje|transmilenio|moto|parqueadero|peaje|transporte|colectivo/],
  ['Universidad', /fotocopia|copias|libro|matricula|universidad|impresion|semestre|cuaderno|papeleria/],
  ['Celular e internet', /recarga|plan|datos|internet|celular|minutos/],
  ['Entretenimiento', /cine|juego|netflix|spotify|fiesta|cerveza|trago|salida|rumba|disney|hbo|steam|concierto|bolos/],
  ['Ropa', /ropa|zapatos|tenis|camisa|camiseta|pantalon|jean|chaqueta|buso|gorra/],
  ['Salud', /drogueria|medicamento|medico|cita medica|pastilla|eps|odontolog|gafas/],
  ['Tecnología', /audifonos|mouse|teclado|cargador|computador|portatil|memoria|usb|cable|monitor/],
  ['Servicios', /luz|energia|gas natural|acueducto|factura|servicios/],
  ['Hogar', /arriendo|arrendamiento|aseo|detergente|hogar|mueble/],
];
export function categoriaDe(texto) {
  const t = sinTildes(texto);
  return CATEGORIAS.find(([, r]) => r.test(t))?.[0] || 'Otros';
}

// ---------- Utilidades ----------
const quitar = (texto, ...partes) => partes.filter(Boolean).reduce((s, p) => s.replace(p, ' '), texto).replace(/\s+/g, ' ').trim();
const limpiarDescripcion = (s) => s.replace(/^(en|de|por|para|el|la|los|las|un|una|unos|unas|del|al)\s+/i, '').replace(/\s+(en|de|por|para)$/i, '').trim();
const decimal = (s) => Number(String(s).replace(',', '.'));
const primeraMayus = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Interpreta una frase. Devuelve { tipo, ...datos } o { tipo: 'desconocido' }.
 * Tipos: gasto, ingreso, horas, sueno, agua, entreno, lectura, prestamo, evento, tarea, nota.
 */
export function interpretar(frase, hoyIso) {
  const original = String(frase || '').trim();
  const t = sinTildes(original);
  if (!t) return { tipo: 'desconocido' };
  const fecha = parseFecha(original, hoyIso);

  // Horas de trabajo: "trabajé 4 horas", "4.5h de trabajo", "turno de 6 horas"
  let m = /(?:trabaje|turno de|labore)\s*(\d+(?:[.,]\d+)?)\s*(?:h\b|horas?)/.exec(t) || /(\d+(?:[.,]\d+)?)\s*(?:h\b|horas?)\s*(?:de\s+)?(?:trabajo|turno)/.exec(t);
  if (m) return { tipo: 'horas', horas: decimal(m[1]), fecha: fecha?.fecha || hoyIso };

  // Sueño: "dormí 7 horas", "dormi 6.5"
  m = /dormi\s*(\d+(?:[.,]\d+)?)\s*(?:h\b|horas?)?/.exec(t);
  if (m) return { tipo: 'sueno', horas: decimal(m[1]), fecha: fecha?.fecha || hoyIso };

  // Lectura: "leí 20 páginas", "lei 3 capitulos" (cuenta como unidades)
  m = /lei\s*(\d+)\s*(paginas?|pags?|capitulos?|lecciones?)/.exec(t);
  if (m) return { tipo: 'lectura', cantidad: Number(m[1]) };

  // Entrenamiento: "entrené 45 min de gimnasio", "corrí 30 minutos", "gym 1 hora"
  const act = /(gimnasio|gym|corri|correr|trote|camine|caminar|futbol|bici|bicicleta|nade|natacion|yoga|entrene|ejercicio|pesas|baloncesto)/.exec(t);
  const dur = /(\d+(?:[.,]\d+)?)\s*(min|minutos|h\b|horas?)/.exec(t);
  if (act && dur) {
    const minutos = Math.round(decimal(dur[1]) * (/^h/.test(dur[2]) ? 60 : 1));
    const nombres = { gym: 'Gimnasio', gimnasio: 'Gimnasio', pesas: 'Gimnasio', corri: 'Correr', correr: 'Correr', trote: 'Correr', camine: 'Caminar', caminar: 'Caminar',
      futbol: 'Fútbol', bici: 'Bicicleta', bicicleta: 'Bicicleta', nade: 'Natación', natacion: 'Natación', yoga: 'Yoga', baloncesto: 'Baloncesto' };
    const otra = /(gimnasio|gym|pesas|corri|correr|trote|camine|caminar|futbol|bici|bicicleta|nade|natacion|yoga|baloncesto)/.exec(t);
    return { tipo: 'entreno', minutos, actividad: nombres[otra?.[1]] || 'Ejercicio', fecha: fecha?.fecha || hoyIso };
  }

  const monto = parseMonto(original);

  // Préstamo: "le presté 50 mil a Carlos", "preste 20k a mi hermano"
  m = /prest(?:e|é)\b/.test(t) && monto && /\ba\s+([a-zñ]+(?:\s+[a-zñ]+)?)\s*$/.exec(quitar(t, monto.texto && sinTildes(monto.texto), fecha && sinTildes(fecha.texto || '')));
  if (m) return { tipo: 'prestamo', monto: monto.valor, persona: primeraMayus(m[1].replace(/^mi\s+/, '')), fecha: fecha?.fecha || hoyIso };

  // Ingreso: "me pagaron 200 mil", "recibí 50k de Juan", "gané 30 mil"
  if (monto && /(me pagaron|me pago|recibi|ingreso|gane|me dieron|me consignaron|me llego|me llegaron|cobre|vendi)/.test(t)) {
    const resto = quitar(original, monto.texto, fecha?.texto, /me pagaron|me pagó|me pago|recibí|recibi|ingreso de|ingresó|ingreso|gané|gane|me dieron|me consignaron|me llegó|me llego|me llegaron|cobré|cobre|vendí|vendi/i);
    return { tipo: 'ingreso', monto: monto.valor, descripcion: limpiarDescripcion(resto) || null, fecha: fecha?.fecha || hoyIso };
  }

  // Gasto: "gasté 15 mil en almuerzo", "pagué 45k del plan", "compré unos tenis en 120 mil", "almuerzo 12 mil"
  if (monto && (/(gaste|pague|compre|me costo|salio|invert|gasto)/.test(t) || !/(tengo|debo|tarea|recordar)/.test(t))) {
    const resto = quitar(original, monto.texto, fecha?.texto, /gasté|gaste|pagué|pague|compré|compre|me costó|me costo|salió|salio|gasto de|gasto/i);
    const desc = limpiarDescripcion(resto.replace(/^(en|de|por)\s+/i, ''));
    return { tipo: 'gasto', monto: monto.valor, categoria: categoriaDe(original), descripcion: desc || null, fecha: fecha?.fecha || hoyIso };
  }

  // Agua: "tomé 2 vasos de agua", "3 vasos", "tomé agua"
  m = /(\d+)\s*vasos?/.exec(t);
  if (m) return { tipo: 'agua', vasos: Number(m[1]) };
  if (/tome\s+agua|un vaso de agua/.test(t)) return { tipo: 'agua', vasos: 1 };

  // Evento / evaluación: "parcial de bases de datos el jueves", "cita médica mañana a las 3"
  m = /\b(parcial|quiz|examen|exposicion|sustentacion|entrega|cita|reunion)\b/.exec(t);
  if (m && fecha) {
    const hora = /\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la tarde|de la manana|de la noche)?/.exec(t);
    let hh = hora ? Number(hora[1]) : null;
    if (hora && /pm|tarde|noche/.test(hora[3] || '') && hh < 12) hh += 12;
    if (hora && !hora[3] && hh >= 1 && hh <= 6) hh += 12; // "a las 3" casi siempre es de la tarde
    const titulo = primeraMayus(quitar(original, fecha.texto, hora?.[0] && new RegExp(hora[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')));
    const tipoEvento = /cita|reunion/.test(m[1]) ? 'cita' : 'entrega';
    return { tipo: 'evento', titulo: titulo.replace(/^(tengo|hay)\s+/i, '').replace(/\s+(el|para)$/i, ''), tipoEvento, fecha: fecha.fecha,
      hora: hh != null ? `${String(hh).padStart(2, '0')}:${hora[2] || '00'}` : null };
  }

  // Nota rápida: "nota: idea para la app", "anotar que…"
  m = /^(nota|anotar|apunte|idea)\s*:?\s*(.+)$/i.exec(original);
  if (m) return { tipo: 'nota', contenido: m[2].trim() };

  // Tarea: "tengo que entregar el taller el viernes", "tarea: comprar marcadores", o cualquier otra cosa
  const sinPrefijo = original.replace(/^(tarea:?|tengo que|debo|recordar|recuerdame|recuérdame|pendiente:?|hacer)\s+/i, '');
  const titulo = primeraMayus(quitar(sinPrefijo, fecha?.texto).replace(/\s+(el|para|para el)$/i, ''));
  if (titulo.length < 2) return { tipo: 'desconocido' };
  return { tipo: 'tarea', titulo, fecha: fecha?.fecha || null };
}
