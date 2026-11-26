// Movimiento de la interfaz: entrada con la brújula, aparición escalonada, números que cuentan,
// onda al tocar y explosión al marcar algo como hecho. Todo respeta "reducir movimiento" del sistema.

export const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- Entrada (pantalla de la brújula) ----------
const INICIO = performance.now();
const MINIMO_INTRO = 1250; // lo que tarda la aguja en asentarse
let introTerminada = false;

/** Quita la pantalla de entrada cuando la primera pantalla ya está lista (y la aguja se asentó). */
export function terminarIntro() {
  if (introTerminada) return;
  introTerminada = true;
  const el = document.getElementById('intro');
  if (!el) { document.body.classList.add('app-lista'); return; }
  if (sinMovimiento()) { el.remove(); document.body.classList.add('app-lista'); return; }
  const espera = Math.max(0, MINIMO_INTRO - (performance.now() - INICIO));
  setTimeout(() => {
    el.classList.add('sale');
    document.body.classList.add('app-lista');
    setTimeout(() => el.remove(), 700);
  }, espera);
}
setTimeout(terminarIntro, 7000); // por si algo falla, nunca se queda pegada

// ---------- Aparición escalonada de las tarjetas ----------
/** Las tarjetas de la pantalla suben una tras otra. En la primera carga esperan a que salga la brújula. */
export function escalonar(cont, { primera = false } = {}) {
  if (sinMovimiento()) return;
  const items = [...cont.children].flatMap((c) => (c.classList.contains('dash')
    ? [...c.querySelectorAll(':scope > .dash-col > *')].sort((a, b) => (Number(a.style.order) || 0) - (Number(b.style.order) || 0))
    : [c]));
  items.slice(0, 14).forEach((el, i) => {
    el.style.setProperty('--n', String(i));
    el.classList.remove('sube', 'sube-primera');
    void el.offsetWidth;
    el.classList.add(primera ? 'sube-primera' : 'sube');
    el.addEventListener('animationend', () => el.classList.remove('sube', 'sube-primera'), { once: true });
  });
}

// ---------- Números que cuentan ----------
function leerNumero(texto) {
  const m = /^([^\d-]*?)(-?)(\d[\d.,]*)(.*)$/.exec(texto.trim());
  if (!m) return null;
  const [, pre, signo, cuerpo, post] = m;
  if (/^\d+\.\d{1,2}$/.test(cuerpo) && !pre.includes('$')) { // decimal: 3.00, 4.5
    const dec = cuerpo.split('.')[1].length;
    return { valor: Number(signo + cuerpo), formato: (v) => `${pre}${v.toFixed(dec)}${post}` };
  }
  if (/^\d{1,3}(\.\d{3})*$/.test(cuerpo)) { // miles con punto: 925.000
    const valor = Number(signo + cuerpo.replace(/\./g, ''));
    return { valor, formato: (v) => `${pre}${v < 0 ? '-' : ''}${Math.round(Math.abs(v)).toLocaleString('es-CO')}${post}` };
  }
  return null;
}

/** Hace que las cifras grandes de la pantalla cuenten desde 0 hasta su valor. */
export function contarNumeros(cont) {
  if (sinMovimiento()) return;
  const els = cont.querySelectorAll('.hero-amount, .hero-row b, .stat b, .stat .money, .hero .money');
  const t0 = performance.now();
  const dur = 750;
  const tareas = [];
  els.forEach((el) => {
    if (el.children.length) return;
    const n = leerNumero(el.textContent);
    if (!n || Math.abs(n.valor) < 2) return;
    const final = el.textContent;
    el.style.fontVariantNumeric = 'tabular-nums';
    tareas.push({ el, n, final });
  });
  if (!tareas.length) return;
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - (1 - p) ** 3;
    for (const { el, n, final } of tareas) el.textContent = p === 1 ? final : n.formato(n.valor * e);
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// ---------- Onda al tocar ----------
const TOCABLES = '.btn, .add-item, .tool-btn, .fab, .side-add, .list-item, button.stat, .chip, .scan-drop, button.card, .banner, .search-item, .aviso-mini, .icon-btn, .assistant-btn';
export function activarOndas() {
  document.addEventListener('pointerdown', (e) => {
    if (sinMovimiento() || e.button > 0) return;
    const el = e.target.closest(TOCABLES);
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const tam = Math.max(r.width, r.height) * 2.2;
    const onda = document.createElement('span');
    onda.className = 'onda';
    onda.style.cssText = `width:${tam}px;height:${tam}px;left:${e.clientX - r.left - tam / 2}px;top:${e.clientY - r.top - tam / 2}px`;
    el.append(onda);
    onda.addEventListener('animationend', () => onda.remove(), { once: true });
  }, { passive: true });
}

// ---------- Explosión al completar ----------
/** Unas chispas salen del elemento (al marcar un hábito o una tarea). */
export function explosion(el) {
  navigator.vibrate?.(12);
  if (sinMovimiento() || !el) return;
  const r = el.getBoundingClientRect();
  const caja = document.createElement('div');
  caja.className = 'chispas';
  caja.style.left = `${r.left + r.width / 2}px`;
  caja.style.top = `${r.top + r.height / 2}px`;
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('i');
    s.style.setProperty('--a', `${i * 36 + (i % 2 ? 8 : -8)}deg`);
    s.style.setProperty('--d', `${22 + (i % 3) * 7}px`);
    caja.append(s);
  }
  document.body.append(caja);
  setTimeout(() => caja.remove(), 750);
}
