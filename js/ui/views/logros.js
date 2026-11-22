import { h, fill, toast } from '../dom.js';

const VISTOS = 'rumbo-logros-vistos';
const leerVistos = () => { try { return new Set(JSON.parse(localStorage.getItem(VISTOS)) || []); } catch { return new Set(); } };

/** Avisa de logros nuevos (una sola vez por logro y por dispositivo). */
export function avisarNuevos(lista) {
  const vistos = leerVistos();
  const nuevos = lista.filter((l) => l.logrado && !vistos.has(l.id));
  if (!nuevos.length) return;
  if (vistos.size || nuevos.length < 4) nuevos.slice(0, 2).forEach((l, i) => setTimeout(() => toast(`🏅 ¡Nuevo logro! ${l.icono} ${l.titulo}`), 400 + i * 1400));
  try { localStorage.setItem(VISTOS, JSON.stringify([...vistos, ...nuevos.map((l) => l.id)])); } catch { /* */ }
}

export async function renderLogros(cont, ctx) {
  const lista = await ctx.motivacion.logros();
  const hechos = lista.filter((l) => l.logrado);
  avisarNuevos(lista);
  const fmt = (l) => (l.meta >= 1000 ? `${Math.round(l.valor).toLocaleString('es-CO')} / ${l.meta.toLocaleString('es-CO')}` : `${Math.min(l.valor, l.meta)} / ${l.meta}`);
  fill(cont,
    h('section', { class: 'hero' },
      h('span', { class: 'hero-label' }, 'Tus logros'),
      h('strong', { class: 'hero-amount' }, `${hechos.length} de ${lista.length}`),
      h('div', { class: 'progress light' }, h('div', { class: 'progress-fill', style: `width:${(hechos.length / lista.length) * 100}%` }))),
    h('div', { class: 'badges' }, [...hechos, ...lista.filter((l) => !l.logrado).sort((a, b) => b.progreso - a.progreso)].map((l) => h('article', { class: `badge-card ${l.logrado ? 'got' : ''}` },
      h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, l.icono),
      h('strong', {}, l.titulo),
      h('small', { class: 'muted' }, l.desc),
      l.logrado ? h('span', { class: 'badge ok' }, '¡Logrado!') : [
        h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: `width:${l.progreso * 100}%` })),
        h('small', { class: 'muted' }, fmt(l))]))),
  );
}
