import { h, fill, money } from '../dom.js';
import { monthLabel, today } from '../../core/format.js';

let anioSel = null;
const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

export async function renderAnio(cont, ctx) {
  const actual = Number(today().slice(0, 4));
  anioSel ||= actual;
  const recargar = () => renderAnio(cont, ctx);
  const a = await ctx.motivacion.anio(anioSel);
  const n = (x) => Number(x).toLocaleString('es-CO');
  const tarjeta = (icono, grande, texto, extra) => h('article', { class: 'year-card' },
    h('span', { class: 'year-icon', 'aria-hidden': 'true' }, icono), h('strong', {}, grande), h('p', {}, texto), extra ? h('small', { class: 'muted' }, extra) : null);
  fill(cont,
    h('section', { class: 'hero year-hero' },
      h('div', { class: 'row-between' },
        h('button', { class: 'round-btn', 'aria-label': 'Año anterior', onclick: () => { anioSel--; recargar(); } }, '‹'),
        h('span', { class: 'hero-label' }, a.parcial ? 'Tu año hasta hoy' : 'Tu año completo'),
        h('button', { class: 'round-btn', 'aria-label': 'Año siguiente', disabled: anioSel >= actual, onclick: () => { anioSel++; recargar(); } }, '›')),
      h('strong', { class: 'year-big' }, String(a.anio)),
      h('small', {}, `${a.logros} de ${a.totalLogros} logros desbloqueados`)),
    h('div', { class: 'year-grid' },
      tarjeta('💼', `${n(a.horasTrabajo)} h`, `trabajadas en ${n(a.turnos)} turnos`, a.diaFuerte != null ? `Tu día más pesado: los ${DIAS[a.diaFuerte]}` : null),
      tarjeta('✅', n(a.tareas), 'tareas terminadas'),
      tarjeta('💰', null, 'quedó a tu favor', null),
      tarjeta('🌱', n(a.habitosCumplidos), 'veces cumpliste un hábito', a.mejorRacha ? `Mejor racha: ${a.mejorRacha} días${a.mejorHabito ? ` (${a.mejorHabito.icono} ${a.mejorHabito.nombre})` : ''}` : null),
      tarjeta('⏱', `${n(a.horasEstudio)} h`, 'de estudio con Pomodoro', a.mejorMateria ? `Tu mejor nota: ${a.mejorMateria.final.toFixed(2)} en ${a.mejorMateria.nombre}` : null),
      tarjeta('💪', `${n(Math.round(a.minutosEjercicio / 60))} h`, `de ejercicio en ${n(a.entrenos)} entrenamientos`),
      tarjeta('📚', n(a.libros), 'libros o cursos terminados'),
      tarjeta('📔', n(a.diasDiario), 'días escribiste en tu diario', a.animoPromedio ? `Ánimo promedio: ${a.animoPromedio} de 5` : null),
    ),
  );
  // La tarjeta de plata lleva el monto formateado como dinero
  const plata = cont.querySelectorAll('.year-card')[2];
  plata.querySelector('strong').replaceWith(money(a.ahorro, a.ahorro < 0 ? 'neg' : 'pos'));
  plata.append(h('small', { class: 'muted' }, a.mejorMes ? `Tu mejor mes: ${monthLabel(a.mejorMes.ym)}` : `Ingresos ${n(a.ingresos)} · gastos ${n(a.gastos)}`));
}
