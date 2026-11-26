import { tarjetaRedondeo } from '../herramientas.js';
import { h, fill, money, progressBar, emptyState, formulario, toast, confirmar } from '../dom.js';
import { fmtDate, fmtMoney, fmtPct, today } from '../../core/format.js';
import { ICONOS_META } from '../../config.js';

const PRIORIDADES = [[1, 'Alta'], [2, 'Media'], [3, 'Baja']];

function formMeta(service, meta, recargar) {
  formulario({
    titulo: meta ? 'Editar meta' : 'Nueva meta',
    valores: meta || { prioridad: 2, icono: '🎯' },
    campos: [
      { name: 'icono', label: 'Ícono', type: 'emoji', options: ICONOS_META },
      { name: 'nombre', label: '¿Qué quieres comprar o lograr?', required: true, placeholder: 'Ej: Portátil gamer' },
      { name: 'monto_objetivo', label: '¿Cuánto cuesta?', type: 'money', required: true },
      { name: 'fecha_objetivo', label: '¿Para cuándo? (opcional)', type: 'date', hint: 'Con fecha te calculo cuánto ahorrar al mes.' },
      { name: 'prioridad', label: 'Prioridad', type: 'select', options: PRIORIDADES },
    ],
    onSubmit: async (d) => {
      await service.guardarMeta(meta?.id, { ...d, prioridad: Number(d.prioridad) });
      toast('Meta guardada 🎯'); recargar();
    },
    onEliminar: meta ? async () => { await service.eliminarMeta(meta.id); toast('Meta eliminada'); recargar(); } : null,
  });
}

function formAporte(service, meta, signo, recargar) {
  const retiro = signo < 0;
  formulario({
    titulo: retiro ? `Sacar plata de ${meta.nombre}` : `Ahorrar para ${meta.nombre}`,
    enviar: retiro ? 'Retirar' : 'Agregar ahorro',
    valores: { fecha: today(), monto: !retiro && meta.estado.ahorroMensualNecesario ? meta.estado.ahorroMensualNecesario : null },
    campos: [
      { name: 'monto', label: retiro ? 'Monto a retirar' : 'Monto a ahorrar', type: 'money', required: true,
        hint: retiro ? `Ahorrado: ${fmtMoney(meta.estado.ahorrado)}` : `Te faltan ${fmtMoney(meta.estado.restante)}` },
      { name: 'fecha', label: 'Fecha', type: 'date', required: true },
    ],
    onSubmit: async ({ monto, fecha }) => {
      if (retiro && monto > meta.estado.ahorrado) throw new Error('No puedes retirar más de lo ahorrado.');
      await service.aportar(meta.id, signo * monto, fecha);
      toast(retiro ? 'Retiro registrado' : '¡Bien! Un paso más cerca 🚀'); recargar();
    },
  });
}

function tarjeta(service, m, recargar) {
  const e = m.estado;
  const historial = h('div', { class: 'history', hidden: true },
    e.aportes.length ? h('ul', { class: 'list compact' }, e.aportes.map((a) => h('li', { class: 'list-item static' },
      h('span', { class: 'grow' }, fmtDate(a.fecha)), money(a.monto, a.monto < 0 ? 'neg' : 'pos'),
      h('button', { class: 'icon-btn', 'aria-label': 'Eliminar movimiento', onclick: async () => {
        if (await confirmar('¿Eliminar este movimiento de ahorro?')) { await service.eliminarAporte(a.id); toast('Eliminado'); recargar(); }
      } }, '🗑')))) : h('p', { class: 'muted' }, 'Aún no has ahorrado para esta meta.'));

  let mensaje;
  if (m.completada) mensaje = '¡Comprada! 🎉';
  else if (e.alcanzada) mensaje = '¡Ya tienes la plata completa! 🎉';
  else if (e.vencida) mensaje = `La fecha ya pasó y te faltan ${fmtMoney(e.restante)}. Ponle una fecha nueva.`;
  else if (e.ahorroMensualNecesario) mensaje = `Ahorra ${fmtMoney(e.ahorroMensualNecesario)} al mes durante ${e.mesesRestantes} mes${e.mesesRestantes === 1 ? '' : 'es'} para llegar.`;
  else mensaje = `Te faltan ${fmtMoney(e.restante)}.`;

  return h('article', { class: `card item-card ${m.completada ? 'done' : ''}` },
    h('div', { class: 'row-between' },
      h('div', { class: 'meta-title' }, h('span', { class: 'meta-icon' }, m.icono),
        h('div', {}, h('h3', {}, m.nombre),
          h('small', { class: 'muted' }, `Prioridad ${PRIORIDADES.find(([p]) => p === m.prioridad)?.[1].toLowerCase() || ''}`,
            m.fecha_objetivo ? ` · para ${fmtDate(m.fecha_objetivo)}` : ''))),
      h('span', { class: `badge ${e.alcanzada ? 'ok' : 'meta'}` }, fmtPct(e.progreso))),
    progressBar(e.progreso, 'meta'),
    h('div', { class: 'kv' },
      h('div', {}, h('small', {}, 'Ahorrado'), money(e.ahorrado, 'pos')),
      h('div', {}, h('small', {}, 'Falta'), money(e.restante)),
      h('div', {}, h('small', {}, 'Precio'), money(m.monto_objetivo)),
    ),
    h('p', { class: `meta-msg ${e.vencida ? 'warn' : ''}` }, mensaje),
    h('div', { class: 'card-actions' },
      !m.completada && !e.alcanzada ? h('button', { class: 'btn primary', onclick: () => formAporte(service, m, 1, recargar) }, '+ Ahorrar') : null,
      !m.completada && e.alcanzada ? h('button', { class: 'btn primary', onclick: async () => {
        if (await confirmar(`¿Ya compraste ${m.nombre}? La meta pasa a "Logradas".`, { aceptar: '¡Sí, la compré!', peligro: false })) {
          await service.guardarMeta(m.id, { completada: true }); toast('¡Felicitaciones! 🥳'); recargar();
        }
      } }, 'Marcar como comprada') : null,
      !m.completada && e.ahorrado > 0 ? h('button', { class: 'btn ghost', onclick: () => formAporte(service, m, -1, recargar) }, 'Retirar') : null,
      h('button', { class: 'btn ghost', onclick: () => { historial.hidden = !historial.hidden; } }, `Historial (${e.aportes.length})`),
      h('button', { class: 'btn ghost', onclick: () => formMeta(service, m, recargar) }, 'Editar'),
    ),
    historial,
  );
}

export async function renderMetas(cont, ctx) {
  const { service } = ctx;
  const recargar = () => renderMetas(cont, ctx);
  const { items, totalAhorrado } = await service.metas();
  const redondeo = await tarjetaRedondeo(ctx, items, recargar).catch(() => null);
  const activas = items.filter((m) => !m.completada);
  const logradas = items.filter((m) => m.completada);
  const totalObjetivo = activas.reduce((a, m) => a + Number(m.monto_objetivo), 0);

  fill(cont, 
    h('section', { class: 'hero hero-meta' },
      h('span', { class: 'hero-label' }, 'Ahorrado para tus metas'),
      money(totalAhorrado, 'hero-amount'),
      h('small', {}, activas.length ? `de ${fmtMoney(totalObjetivo)} en ${activas.length} meta${activas.length === 1 ? '' : 's'}` : 'Crea tu primera meta'),
    ),
    h('div', { class: 'action-row' }, h('button', { class: 'btn primary', onclick: () => formMeta(service, null, recargar) }, '+ Nueva meta')),
    redondeo,
    items.length ? null : emptyState('🎯', 'Aún no tienes metas', '¿Qué quieres comprar? Agrégalo y te digo cuánto ahorrar al mes.'),
    activas.map((m) => tarjeta(service, m, recargar)),
    logradas.length ? h('h4', { class: 'section-title' }, 'Logradas 🏆') : null,
    logradas.map((m) => tarjeta(service, m, recargar)),
  );
}
