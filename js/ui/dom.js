// Helpers de interfaz reutilizables: creación de nodos, avisos, diálogos y formularios.
import { fmtMoney } from '../core/format.js';

/** Crea un elemento. El texto siempre entra como textNode (sin riesgo de XSS). */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Reemplaza el contenido de un contenedor aceptando arreglos y valores nulos. */
export function fill(cont, ...children) {
  cont.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false));
}

export const money =(n, cls = '') => h('span', { class: `money ${cls}` }, fmtMoney(n));

export function progressBar(valor, variante = '') {
  const pct = Math.round(Math.min(1, Math.max(0, valor)) * 100);
  return h('div', { class: `progress ${variante}`, role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { class: 'progress-fill', style: `width:${pct}%` }));
}

/**
 * Tablero de dos columnas en pantallas anchas. En el celular queda una sola columna
 * en el mismo orden en que se pasan los elementos. Cada elemento: nodo o [nodo, 'lado'].
 */
export function tablero(...items) {
  const principal = h('div', { class: 'dash-col' });
  const lateral = h('div', { class: 'dash-col dash-side' });
  let orden = 0;
  for (const it of items) {
    const [nodo, lado] = Array.isArray(it) ? it : [it, 'principal'];
    if (!nodo) continue;
    nodo.style.order = String(++orden);
    (lado === 'lado' ? lateral : principal).append(nodo);
  }
  return h('div', { class: 'dash' }, principal, lateral);
}

export function emptyState(icono, titulo, texto) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-icon' }, icono), h('strong', {}, titulo), h('p', {}, texto));
}

export function toast(mensaje, tipo = 'ok') {
  const zona = document.getElementById('toasts');
  const t = h('div', { class: `toast toast-${tipo}`, role: 'status' }, mensaje);
  zona.append(t);
  setTimeout(() => t.classList.add('out'), 2800);
  setTimeout(() => t.remove(), 3200);
}

export function dialogo(contenido, onClose) {
  const d = h('dialog', { class: 'sheet' }, contenido);
  d.addEventListener('close', () => { d.remove(); onClose?.(); });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  document.body.append(d);
  d.showModal();
  return d;
}

export function confirmar(mensaje, { aceptar = 'Eliminar', peligro = true } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const d = dialogo(h('div', { class: 'sheet-body' },
      h('p', { class: 'confirm-text' }, mensaje),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Cancelar'),
        h('button', { class: `btn ${peligro ? 'danger' : 'primary'}`, type: 'button', onclick: () => { ok = true; d.close(); } }, aceptar),
      ),
    ), () => resolve(ok));
  });
}

function campo(f, valor) {
  const id = `f-${f.name}`;
  const comunes = { id, name: f.name, required: f.required, placeholder: f.placeholder };
  let input;
  if (f.type === 'select') {
    input = h('select', comunes, f.options.map((o) => {
      const [val, label] = Array.isArray(o) ? o : [o, o];
      return h('option', { value: val, selected: String(valor) === String(val) }, label);
    }));
  } else if (f.type === 'textarea') {
    input = h('textarea', { ...comunes, rows: f.rows || 2 }, valor ?? '');
  } else if (f.type === 'file') {
    input = h('input', { ...comunes, type: 'file', accept: f.accept });
  } else if (f.type === 'dias') {
    const sel = new Set((valor ?? f.default ?? []).map(Number));
    const grupo = h('div', { class: 'day-picker' });
    f.options.forEach(([v, lbl]) => grupo.append(h('label', {},
      h('input', { type: 'checkbox', name: f.name, value: v, checked: sel.has(v) }), h('span', {}, lbl))));
    return h('div', { class: 'field' }, h('span', { class: 'label' }, f.label), grupo);
  } else if (f.type === 'checkbox') {
    return h('label', { class: 'check' }, h('input', { type: 'checkbox', name: f.name, checked: Boolean(valor) }), f.label);
  } else if (f.type === 'emoji') {
    const grupo = h('div', { class: 'emoji-picker', role: 'radiogroup' });
    f.options.forEach((e, i) => grupo.append(h('label', {},
      h('input', { type: 'radio', name: f.name, value: e, checked: valor ? valor === e : i === 0 }), h('span', {}, e))));
    return h('div', { class: 'field' }, h('span', { class: 'label' }, f.label), grupo);
  } else {
    const esDinero = f.type === 'money';
    input = h('input', {
      ...comunes,
      type: esDinero ? 'number' : f.type || 'text',
      inputmode: esDinero ? 'numeric' : f.inputmode,
      min: f.min ?? (esDinero ? '1' : undefined), step: esDinero ? '1' : f.step,
      value: valor ?? '', list: f.list ? `${id}-list` : undefined, autocomplete: f.autocomplete || 'off',
    });
    if (f.list) input = [input, h('datalist', { id: `${id}-list` }, f.list.map((o) => h('option', { value: o })))];
  }
  return h('label', { class: 'field', for: id }, h('span', { class: 'label' }, f.label), input,
    f.hint ? h('small', { class: 'hint' }, f.hint) : null);
}

/**
 * Abre un formulario genérico en un diálogo.
 * onSubmit(valores) puede lanzar error: se muestra y el diálogo sigue abierto.
 */
export function formulario({ titulo, campos, valores = {}, enviar = 'Guardar', onSubmit, onEliminar, validar }) {
  const error = h('p', { class: 'form-error', hidden: true });
  const btn = h('button', { class: 'btn primary', type: 'submit' }, enviar);
  const form = h('form', { class: 'sheet-body', novalidate: false },
    h('div', { class: 'sheet-head' }, h('h2', {}, titulo),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕')),
    campos.map((f) => campo(f, valores[f.name])),
    error,
    h('div', { class: 'sheet-actions' },
      onEliminar ? h('button', { class: 'btn danger ghost', type: 'button', onclick: async () => {
        if (await confirmar('¿Seguro que quieres eliminar esto? No se puede deshacer.')) {
          try { await onEliminar(); d.close(); } catch (e) { toast(e.message, 'error'); }
        }
      } }, 'Eliminar') : h('span'),
      btn),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const datos = {};
    for (const f of campos) {
      if (f.type === 'checkbox') { datos[f.name] = fd.has(f.name); continue; }
      if (f.type === 'dias') { datos[f.name] = fd.getAll(f.name).map(Number); continue; }
      if (f.type === 'file') { const v = fd.get(f.name); datos[f.name] = v && v.size ? v : null; continue; }
      let v = fd.get(f.name);
      if (typeof v === 'string') v = v.trim();
      if (v === '' || v == null) v = null;
      else if (f.type === 'money' || f.type === 'number') v = Number(v);
      datos[f.name] = v;
    }
    btn.disabled = true; error.hidden = true;
    try { if (validar) validar(datos); await onSubmit(datos); d.close(); } catch (err) {
      error.textContent = err.message; error.hidden = false;
    } finally { btn.disabled = false; }
  });
  const d = dialogo(form);
  setTimeout(() => form.querySelector('input:not([type=radio]):not([type=checkbox]),select')?.focus(), 50);
  return d;
}

/** Casilla redonda para marcar algo como hecho. */
export function checkCircle(hecho, onToggle, etiqueta) {
  return h('button', {
    class: `check-circle ${hecho ? 'on' : ''}`, type: 'button', 'aria-pressed': String(hecho), 'aria-label': etiqueta,
    onclick: async (e) => { e.stopPropagation(); e.currentTarget.disabled = true; try { await onToggle(); } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; } },
  }, hecho ? '✓' : '');
}

/** Barra de pestañas internas. */
export function tabs(items, activo, onSelect) {
  return h('div', { class: 'tabs', role: 'tablist' }, items.map(([id, label]) =>
    h('button', { class: `tab ${id === activo ? 'active' : ''}`, role: 'tab', 'aria-selected': String(id === activo), onclick: () => onSelect(id) }, label)));
}
