// Íconos de línea propios (24×24, trazo redondeado). Reemplazan los emojis de la navegación
// para que se vean iguales en Android, iPhone y Windows.
const NS = 'http://www.w3.org/2000/svg';

// Cada ícono es una lista de figuras: [etiqueta, atributos].
const P = (d) => ['path', { d }];
const C = (cx, cy, r, extra = {}) => ['circle', { cx, cy, r, ...extra }];
const R = (x, y, width, height, rx = 2.5) => ['rect', { x, y, width, height, rx }];

const ICONOS = {
  hoy: [P('M3.5 10.5 12 3.5l8.5 7'), P('M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9')],
  agenda: [R(3.5, 5, 17, 15.5), P('M3.5 10h17'), P('M8 3v4'), P('M16 3v4')],
  tareas: [R(3.5, 3.5, 17, 17, 4), P('m8 12.3 2.8 2.8 5.2-5.6')],
  plata: [P('M4 8V7a2.5 2.5 0 0 1 2.5-2.5H17V8'), R(3.5, 8, 17, 12), P('M20.5 12h-3.5a2 2 0 0 0 0 4h3.5')],
  mas: [R(4, 4, 6.5, 6.5, 2), R(13.5, 4, 6.5, 6.5, 2), R(4, 13.5, 6.5, 6.5, 2), R(13.5, 13.5, 6.5, 6.5, 2)],
  enfoque: [C(12, 12, 8.5), C(12, 12, 4.5), C(12, 12, 1, { fill: 'currentColor' })],
  habitos: [P('M12 21v-8'), P('M12 13c0-4.4 3-7.5 8-7.5 0 4.6-3 7.5-8 7.5Z'), P('M12 15.5c0-3.4-2.4-6-7-6 0 3.6 2.6 6 7 6Z')],
  rutinas: [C(12, 12, 4), P('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4')],
  mercado: [P('M3 4h2.3l2.2 10.5h10.3L20 7.5H6'), C(9, 19, 1.4), C(17, 19, 1.4)],
  notas: [R(5, 3, 14, 18, 2.5), P('M9 3v18'), P('M12.5 8H16M12.5 12H16')],
  universidad: [P('M2.5 9 12 4.5 21.5 9 12 13.5Z'), P('M6.5 11.2v4.3c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.3'), P('M21.5 9v5')],
  horario: [C(12, 12, 8.5), P('M12 7.5V12l3 2')],
  carrera: [P('m3.5 16.5 5.5-5.5 4 4 7.5-7.5'), P('M15 7.5h5.5V13')],
  malla: [P('M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8Z'), P('M9 4.5v12.7M15 6.8v12.7')],
  repaso: [R(8, 3.5, 12.5, 14, 2.5), P('M4.5 7.5v10.5a2.5 2.5 0 0 0 2.5 2.5h9')],
  apuntes: [P('m19.5 11.5-7.7 7.7a4.8 4.8 0 0 1-6.8-6.8l8-8a3.2 3.2 0 0 1 4.5 4.5l-7.9 7.9a1.6 1.6 0 0 1-2.3-2.3l7.3-7.3')],
  grupos: [C(9, 8, 3.3), P('M3 20c0-3.4 2.7-5.8 6-5.8s6 2.4 6 5.8'), P('M15.5 4.9a3.3 3.3 0 0 1 0 6.2'), P('M18 14.6c1.8.7 3 2.6 3 5.4')],
  estudio: [C(12, 13.5, 7.5), P('M12 13.5V10M9.5 2.5h5M12 2.5V6M18.5 6.5l1.2-1.2')],
  trabajo: [R(3, 7, 18, 13, 2.5), P('M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7'), P('M3 12.5h18')],
  salud: [P('M12 20.3s-8-4.6-8-10.6a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6c0 6-8 10.6-8 10.6Z'), P('M7 12h2.3l1.5-2.5 2.2 4.5 1.5-2H17')],
  metasvida: [P('M12 3.2 14.7 8.6l6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6-4.3-4.2 6-.9Z')],
  lectura: [P('M12 6.5C10 5 7.2 4.5 3.5 4.5v14c3.7 0 6.5.5 8.5 2 2-1.5 4.8-2 8.5-2v-14c-3.7 0-6.5.5-8.5 2Z'), P('M12 6.5v14')],
  contactos: [C(12, 8, 3.8), P('M4.5 20.5c0-4 3.4-6.7 7.5-6.7s7.5 2.7 7.5 6.7')],
  logros: [C(12, 15, 5.5), P('m8.6 10.7-2.6-7.2h4l2 4 2-4h4l-2.6 7.2'), P('m12 12.6.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3Z')],
  anio: [R(3.5, 5, 17, 15.5), P('M3.5 10h17M8 3v4M16 3v4'), P('m12 12 .9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3Z')],
  revision: [C(12, 12, 8.5), P('m15.5 8.5-2 5-5 2 2-5Z')],
  ajustes: [P('M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1'), C(15, 6.5, 2), C(9, 12, 2), C(17, 17.5, 2)],
  finanzas: [P('M4 8V7a2.5 2.5 0 0 1 2.5-2.5H17V8'), R(3.5, 8, 17, 12), P('M20.5 12h-3.5a2 2 0 0 0 0 4h3.5')],
  movimientos: [P('M7.5 19.5V5M4 8.5 7.5 5 11 8.5'), P('M16.5 4.5V19M13 15.5l3.5 3.5 3.5-3.5')],
  cuentas: [P('M3 9.5 12 4l9 5.5Z'), P('M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3 20.5h18')],
  presupuestos: [P('M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12Z'), P('M15 3a8.5 8.5 0 0 1 6 6h-6Z')],
  fijos: [P('m17 2.5 3 3-3 3'), P('M4 11v-1a4.5 4.5 0 0 1 4.5-4.5H20'), P('m7 21.5-3-3 3-3'), P('M20 13v1a4.5 4.5 0 0 1-4.5 4.5H4')],
  deudas: [R(2.5, 5, 19, 14), P('M2.5 10h19M6.5 15h4')],
  prestamos: [C(9, 8, 3.3), P('M3 20c0-3.4 2.7-5.8 6-5.8 1.4 0 2.6.4 3.6 1.1'), P('M15 17.5h6M18.5 15l2.5 2.5-2.5 2.5')],
  metas: [P('M5.5 21V3.5'), P('M5.5 4.5h12l-2.2 4 2.2 4h-12')],
  deseos: [R(3.5, 8, 17, 4.5, 1.2), P('M5 12.5V20h14v-7.5M12 8v12'), P('M12 8c-1.2-3-5-3.8-5-1.6C7 7.7 9.5 8 12 8Zm0 0c1.2-3 5-3.8 5-1.6 0 1.3-2.5 1.6-5 1.6Z')],
  estadisticas: [P('M4 20.5h16M7 16.5v-5M12 16.5v-10M17 16.5v-7')],
  mas_agregar: [P('M12 5v14M5 12h14')],
  chispa: [P('M12 3.5 13.9 9l5.6 2-5.6 2L12 18.5 10.1 13l-5.6-2 5.6-2Z'), P('M19 3v3.5M17.2 4.7h3.6')],
  gasto: [C(12, 12, 8.5), P('M12 7.5v9M8.5 13l3.5 3.5 3.5-3.5')],
  ingreso: [C(12, 12, 8.5), P('M12 16.5v-9M8.5 11l3.5-3.5 3.5 3.5')],
  diario: [P('M5 20.5h14'), P('M14.5 4.5l4 4L9 18H5v-4Z')],
  salir: [P('M14.5 4.5H18a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3.5'), P('M10 16.5 5.5 12 10 7.5M5.5 12H15')],
};

/** Devuelve un <svg> listo para insertar. Si el nombre no existe, un círculo vacío. */
export function icono(nombre, { size = 22, clase = 'ico' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: clase })) {
    svg.setAttribute(k, v);
  }
  for (const [tag, attrs] of ICONOS[nombre] || [C(12, 12, 8)]) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

export const hayIcono = (nombre) => Boolean(ICONOS[nombre]);
