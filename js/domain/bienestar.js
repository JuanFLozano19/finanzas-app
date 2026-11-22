// Reglas de bienestar: cumpleaños, contacto con personas, lectura y metas de vida.
import { addDays } from '../core/format.js';

const diasEntre = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

/** Próximo cumpleaños (maneja 29 de febrero en años no bisiestos → 28). */
export function proximoCumple(c, hoyIso) {
  if (!c.cumple_mes || !c.cumple_dia) return null;
  const anio = Number(hoyIso.slice(0, 4));
  const fechaEn = (y) => {
    const ultimo = new Date(y, c.cumple_mes, 0).getDate();
    return `${y}-${String(c.cumple_mes).padStart(2, '0')}-${String(Math.min(c.cumple_dia, ultimo)).padStart(2, '0')}`;
  };
  let fecha = fechaEn(anio);
  if (fecha < hoyIso) fecha = fechaEn(anio + 1);
  return { fecha, dias: diasEntre(hoyIso, fecha) };
}

/** ¿Toca escribirle? Según la frecuencia deseada y el último contacto. */
export function estadoContacto(c, hoyIso) {
  const desde = c.ultimo_contacto ? diasEntre(c.ultimo_contacto, hoyIso) : null;
  const toca = Boolean(c.frecuencia_dias) && (desde == null || desde >= c.frecuencia_dias);
  return { desde, toca, cumple: proximoCumple(c, hoyIso) };
}

export function progresoLectura(l) {
  const total = Number(l.total) || 1;
  return Math.min(1, Number(l.actual) / total);
}

export function progresoMetaVida(pasos) {
  return pasos.length ? pasos.filter((p) => p.hecho).length / pasos.length : 0;
}

/** Lunes (ISO) de la semana anterior a la fecha dada. */
export function semanaAnterior(lunesIso) { return addDays(lunesIso, -7); }

/** Enlace de WhatsApp para un número colombiano (agrega 57 si es un celular de 10 dígitos). */
export function enlaceWhatsApp(telefono) {
  const d = String(telefono || '').replace(/\D/g, '');
  if (!d) return null;
  const num = d.length === 10 && d.startsWith('3') ? `57${d}` : d;
  return `https://wa.me/${num}`;
}
