// Temporizador de estudio (Pomodoro) por materia.
// El estado vive en localStorage para que el tiempo siga corriendo aunque cambies de pantalla.
import { h, fill, toast, emptyState } from '../dom.js';
import { fmtDate } from '../../core/format.js';

const KEY = 'rumbo-pomodoro';
const base = { fase: 'enfoque', corriendo: false, fin: null, restante: 25 * 60000, enfoque: 25, descanso: 5, materia_id: '', ciclos: 0 };
const leer = () => { try { return { ...base, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...base }; } };
const guardar = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ } };
const msFase = (s) => (s.fase === 'enfoque' ? s.enfoque : s.descanso) * 60000;
const restante = (s) => (s.corriendo ? Math.max(0, s.fin - Date.now()) : s.restante);

let estudioSvc = null;
let pintar = null;

function sonar() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* sin audio */ }
}

async function avisar(titulo, cuerpo) {
  sonar();
  toast(titulo);
  try {
    if (Notification?.permission === 'granted') {
      const reg = await navigator.serviceWorker?.getRegistration();
      reg?.showNotification(titulo, { body: cuerpo, icon: 'icons/icon-192.png', tag: 'pomodoro' });
    }
  } catch { /* sin notificaciones */ }
}

/** Revisa si terminó una fase; se llama cada segundo desde cualquier pantalla. */
async function tick() {
  const s = leer();
  if (!s.corriendo || Date.now() < s.fin) { pintar?.(); return; }
  if (s.fase === 'enfoque') {
    const nuevo = { ...s, fase: 'descanso', ciclos: s.ciclos + 1, corriendo: true, fin: Date.now() + s.descanso * 60000 };
    guardar(nuevo);
    try { await estudioSvc?.registrar(s.materia_id, s.enfoque); } catch (e) { console.warn(e); }
    avisar('⏰ ¡Bloque de estudio terminado!', `${s.enfoque} min registrados. Toma ${s.descanso} min de descanso.`);
  } else {
    guardar({ ...s, fase: 'enfoque', corriendo: false, fin: null, restante: s.enfoque * 60000 });
    avisar('☕ Fin del descanso', 'Cuando quieras, arranca el siguiente bloque.');
  }
  pintar?.(true);
}

export function iniciarTemporizador(svc) {
  estudioSvc = svc;
  setInterval(tick, 1000);
}

const mmss = (ms) => { const t = Math.ceil(ms / 1000); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}` : `${min} min`);

export async function renderEstudio(cont, ctx) {
  const { estudio } = ctx;
  const recargar = () => renderEstudio(cont, ctx);
  const datos = await estudio.resumen();
  const nombre = (id) => datos.materias.find((m) => m.id === id)?.nombre || 'Sin materia';
  const s = leer();

  const reloj = h('div', { class: 'timer-clock' }, mmss(restante(s)));
  const anillo = h('div', { class: 'timer-ring' }, reloj, h('small', {}, s.fase === 'enfoque' ? '🎯 Enfoque' : '☕ Descanso'));
  const actualizarAnillo = (st) => anillo.style.setProperty('--p', `${(1 - restante(st) / msFase(st)) * 100}%`);
  actualizarAnillo(s);
  pintar = (recargarTodo) => {
    if (!cont.isConnected || !reloj.isConnected) { pintar = null; return; }
    if (recargarTodo) { recargar(); return; }
    const st = leer(); reloj.textContent = mmss(restante(st)); actualizarAnillo(st);
    document.title = st.corriendo ? `${mmss(restante(st))} · Rumbo` : 'Estudio · Rumbo';
  };

  const set = (cambios) => { guardar({ ...leer(), ...cambios }); recargar(); };
  const iniciar = () => { const st = leer(); set({ corriendo: true, fin: Date.now() + st.restante }); try { Notification?.permission === 'default' && Notification.requestPermission(); } catch { /* */ } };
  const pausar = () => { const st = leer(); set({ corriendo: false, restante: restante(st), fin: null }); };
  const reiniciar = () => { const st = leer(); set({ corriendo: false, fin: null, fase: 'enfoque', restante: st.enfoque * 60000 }); };
  const saltar = () => { const st = leer(); const fase = st.fase === 'enfoque' ? 'descanso' : 'enfoque'; set({ fase, corriendo: false, fin: null, restante: (fase === 'enfoque' ? st.enfoque : st.descanso) * 60000 }); };

  const selMateria = h('select', { class: 'month-input', disabled: s.corriendo, onchange: (e) => set({ materia_id: e.target.value }) },
    h('option', { value: '' }, '— Sin materia —'), datos.materias.map((m) => h('option', { value: m.id, selected: m.id === s.materia_id }, m.nombre)));
  const duraciones = [[25, 5], [50, 10], [15, 3]];
  const semanaMax = Math.max(1, ...datos.semana.porMateria.values());

  fill(cont,
    h('section', { class: `card timer ${s.fase}` },
      h('label', { class: 'field' }, h('span', { class: 'label' }, 'Estudiando'), selMateria),
      anillo,
      h('div', { class: 'timer-actions' },
        s.corriendo ? h('button', { class: 'btn ghost', onclick: pausar }, '⏸ Pausar') : h('button', { class: 'btn primary', onclick: iniciar }, s.restante < msFase(s) ? '▶ Seguir' : '▶ Empezar'),
        h('button', { class: 'btn ghost', onclick: reiniciar }, '↺'),
        h('button', { class: 'btn ghost', onclick: saltar }, '⏭')),
      !s.corriendo ? h('div', { class: 'chips' }, duraciones.map(([e, d]) => h('button', {
        class: `chip ${s.enfoque === e && s.descanso === d ? 'active' : ''}`,
        onclick: () => set({ enfoque: e, descanso: d, fase: 'enfoque', restante: e * 60000 }),
      }, `${e}/${d}`))) : null,
      h('small', { class: 'muted center' }, s.ciclos ? `${s.ciclos} bloque${s.ciclos === 1 ? '' : 's'} completado${s.ciclos === 1 ? '' : 's'} en esta racha` : 'Cada bloque completo se guarda solo en tus horas de estudio.')),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('small', {}, 'Hoy'), h('b', {}, horas(datos.hoy.total))),
      h('div', { class: 'stat' }, h('small', {}, 'Esta semana'), h('b', {}, horas(datos.semana.total)))),
    datos.semana.total ? h('section', { class: 'card' }, h('h3', {}, 'Esta semana por materia'),
      h('div', { class: 'hbars' }, [...datos.semana.porMateria.entries()].sort((a, b) => b[1] - a[1]).map(([id, min]) => h('div', { class: 'hbar-row' },
        h('span', { class: 'hbar-label' }, id === 'sin' ? 'Sin materia' : nombre(id)),
        h('div', { class: 'hbar-track' }, h('div', { class: 'hbar', style: `width:${(min / semanaMax) * 100}%;background:var(--series-1)` })),
        h('b', { class: 'hbar-val' }, horas(min)))))) : null,
    datos.sesiones.length ? h('section', { class: 'card' }, h('h3', {}, 'Últimas sesiones'),
      h('ul', { class: 'list compact' }, datos.sesiones.map((x) => h('li', { class: 'list-item static' },
        h('span', { class: 'grow' }, h('strong', {}, x.materia_id ? nombre(x.materia_id) : 'Sin materia'), h('small', { class: 'muted' }, fmtDate(x.fecha))),
        h('b', {}, `${x.minutos} min`),
        h('button', { class: 'icon-btn', 'aria-label': 'Eliminar sesión', onclick: async () => { await estudio.eliminar(x.id); recargar(); } }, '🗑')))))
      : emptyState('⏱', 'Aún no hay sesiones', 'Escoge la materia y dale a Empezar. 25 minutos de enfoque, 5 de descanso.'),
  );
}
