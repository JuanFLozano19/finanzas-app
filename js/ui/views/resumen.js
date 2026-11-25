import { h, fill, money, progressBar, emptyState, tablero } from '../dom.js';
import { currentMonth, monthLabel, fmtMoney, fmtPct } from '../../core/format.js';
import { filaPresupuesto, registrarFijo, etiquetaFijo } from './plata.js';

export async function renderResumen(cont, ctx) {
  const { service, plata, irA } = ctx;
  const ym = currentMonth();
  const [{ mes, deudas, metas }, pres, fijos, cuentas] = await Promise.all([
    service.resumenGeneral(ym), plata.presupuestos(ym), plata.recurrentes(), plata.cuentas()]);
  const alertas = pres.items.filter((p) => p.estado !== 'ok');
  const fijosUrgentes = fijos.pendientes.filter((x) => x.activo && (x.estado.atrasado || x.estado.proximo));
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
    tablero(
    [cuentas.items.length ? h('button', { class: 'card banner', onclick: () => irA('cuentas') },
      h('span', {}, '🏦'), h('span', { class: 'grow' }, h('strong', {}, `Tienes ${fmtMoney(cuentas.total)}`),
        h('small', { class: 'muted' }, cuentas.items.filter((c) => c.activa).map((c) => `${c.icono} ${fmtMoney(c.saldo)}`).join('  '))), h('span', {}, '›')) : null, 'lado'],
    fijosUrgentes.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Pagos fijos por pagar'), h('button', { class: 'link', onclick: () => irA('fijos') }, 'Ver')),
      h('ul', { class: 'list compact' }, fijosUrgentes.map((x) => h('li', { class: 'list-item static' },
        h('span', { class: 'grow' }, h('strong', {}, x.nombre), h('small', { class: 'muted' }, fmtMoney(x.monto))), etiquetaFijo(x.estado),
        h('button', { class: 'btn primary small', onclick: () => registrarFijo(plata, x, () => renderResumen(cont, ctx)) }, 'Pagar'))))) : null,
    alertas.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Presupuestos en alerta'), h('button', { class: 'link', onclick: () => irA('presupuestos') }, 'Ver')),
      alertas.map((p) => filaPresupuesto(p, () => irA('presupuestos')))) : null,
    [h('div', { class: 'stats' },
      h('button', { class: 'stat stat-deuda', onclick: () => irA('deudas') },
        h('small', {}, 'Debes en total'), money(deudas.totalPendiente)),
      h('button', { class: 'stat stat-meta', onclick: () => irA('metas') },
        h('small', {}, 'Ahorrado en metas'), money(metas.totalAhorrado)),
    ), 'lado'],

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

    [h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Gastos del mes por categoría'),
        h('button', { class: 'link', onclick: () => irA('movimientos') }, 'Movimientos')),
      porCategoria.length
        ? porCategoria.map((c) => h('div', { class: 'cat-row' },
          h('div', { class: 'row-between' }, h('span', {}, c.categoria), money(c.total)),
          progressBar(c.total / maxCat, 'gasto')))
        : emptyState('🧾', 'Sin gastos este mes', 'Registra tus gastos para ver en qué se te va la plata.'),
    ), 'lado'],

    [deudasActivas.length ? h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Deudas pendientes'),
        h('button', { class: 'link', onclick: () => irA('deudas') }, 'Ver todas')),
      deudasActivas.map((d) => h('div', { class: 'mini-row' },
        h('span', { class: 'mini-icon' }, '💳'),
        h('div', { class: 'grow' },
          h('div', { class: 'row-between' }, h('strong', {}, d.nombre), money(d.estado.pendiente)),
          progressBar(d.estado.progreso, 'deuda')))),
    ) : null, 'lado'],
    ),
  );
}
