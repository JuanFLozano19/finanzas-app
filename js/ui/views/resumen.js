import { h, fill, money, progressBar, emptyState } from '../dom.js';
import { currentMonth, monthLabel, fmtMoney, fmtPct } from '../../core/format.js';

export async function renderResumen(cont, { service, irA }) {
  const ym = currentMonth();
  const { mes, deudas, metas } = await service.resumenGeneral(ym);
  const { resumen, porCategoria } = mes;
  const maxCat = porCategoria[0]?.total || 1;
  const metasActivas = metas.items.filter((m) => !m.completada).slice(0, 3);
  const deudasActivas = deudas.items.filter((d) => !d.estado.saldada).slice(0, 3);

  fill(cont, 
    h('section', { class: 'hero' },
      h('span', { class: 'hero-label' }, `Balance de ${monthLabel(ym).toLowerCase()}`),
      money(resumen.balance, `hero-amount ${resumen.balance < 0 ? 'neg' : ''}`),
      h('div', { class: 'hero-row' },
        h('div', {}, h('small', {}, '↑ Ingresos'), money(resumen.ingresos, 'pos')),
        h('div', {}, h('small', {}, '↓ Gastos'), money(resumen.gastos, 'neg')),
      ),
    ),
    h('div', { class: 'stats' },
      h('button', { class: 'stat stat-deuda', onclick: () => irA('deudas') },
        h('small', {}, 'Debes en total'), money(deudas.totalPendiente)),
      h('button', { class: 'stat stat-meta', onclick: () => irA('metas') },
        h('small', {}, 'Ahorrado en metas'), money(metas.totalAhorrado)),
    ),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Tus metas'),
        h('button', { class: 'link', onclick: () => irA('metas') }, 'Ver todas')),
      metasActivas.length
        ? metasActivas.map((m) => h('div', { class: 'mini-row' },
          h('span', { class: 'mini-icon' }, m.icono),
          h('div', { class: 'grow' },
            h('div', { class: 'row-between' }, h('strong', {}, m.nombre), h('small', {}, fmtPct(m.estado.progreso))),
            progressBar(m.estado.progreso, 'meta'),
            h('small', { class: 'muted' }, m.estado.alcanzada ? '¡Ya la puedes comprar! 🎉'
              : `Te faltan ${fmtMoney(m.estado.restante)}`))))
        : emptyState('🎯', 'Sin metas todavía', 'Agrega lo que quieres comprar y ve ahorrando para eso.'),
    ),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Gastos del mes por categoría'),
        h('button', { class: 'link', onclick: () => irA('movimientos') }, 'Movimientos')),
      porCategoria.length
        ? porCategoria.map((c) => h('div', { class: 'cat-row' },
          h('div', { class: 'row-between' }, h('span', {}, c.categoria), money(c.total)),
          progressBar(c.total / maxCat, 'gasto')))
        : emptyState('🧾', 'Sin gastos este mes', 'Registra tus gastos para ver en qué se te va la plata.'),
    ),

    deudasActivas.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Deudas pendientes'),
        h('button', { class: 'link', onclick: () => irA('deudas') }, 'Ver todas')),
      deudasActivas.map((d) => h('div', { class: 'mini-row' },
        h('span', { class: 'mini-icon' }, '💳'),
        h('div', { class: 'grow' },
          h('div', { class: 'row-between' }, h('strong', {}, d.nombre), money(d.estado.pendiente)),
          progressBar(d.estado.progreso, 'deuda')))),
    ) : null,
  );
}
