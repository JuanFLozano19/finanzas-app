// Punto de entrada: arma las dependencias (composition root) y maneja la navegación.
import { supabase } from './core/supabase.js';
import { crearRepositorios } from './data/repositories.js';
import { AuthService } from './services/AuthService.js';
import { FinanzasService } from './services/FinanzasService.js';
import { crearServiciosVida } from './services/VidaServices.js';
import { h, toast, tabs } from './ui/dom.js';
import { renderAuth } from './ui/views/auth.js';
import { renderHoy } from './ui/views/hoy.js';
import { renderAgenda } from './ui/views/agenda.js';
import { renderTareas } from './ui/views/tareas.js';
import { renderHabitos } from './ui/views/habitos.js';
import { renderNotas } from './ui/views/notas.js';
import { renderUniversidad } from './ui/views/universidad.js';
import { renderTrabajo } from './ui/views/trabajo.js';
import { renderSalud } from './ui/views/salud.js';
import { renderResumen } from './ui/views/resumen.js';
import { renderMovimientos } from './ui/views/movimientos.js';
import { renderDeudas } from './ui/views/deudas.js';
import { renderMetas } from './ui/views/metas.js';
import { crearVistaMas } from './ui/views/mas.js';

const repos = crearRepositorios(supabase);
const auth = new AuthService(supabase);
const service = new FinanzasService(repos);
const vida = crearServiciosVida(repos);

// Para agregar un módulo nuevo basta con registrarlo aquí (abierto/cerrado).
// tab = a qué botón de la barra inferior pertenece; grupo = sección del menú lateral.
const RUTAS = {
  hoy: { titulo: 'Hoy', icono: '🏠', render: renderHoy, tab: 'hoy', grupo: 'Mi día' },
  agenda: { titulo: 'Agenda', icono: '🗓', render: renderAgenda, tab: 'agenda', grupo: 'Mi día' },
  tareas: { titulo: 'Tareas', icono: '✅', render: renderTareas, tab: 'tareas', grupo: 'Mi día' },
  habitos: { titulo: 'Hábitos', icono: '🌱', render: renderHabitos, tab: 'mas', grupo: 'Mi día', enMas: true, desc: 'Rachas y constancia' },
  notas: { titulo: 'Diario y notas', icono: '📔', render: renderNotas, tab: 'mas', grupo: 'Mi día', enMas: true, desc: 'Ideas y cómo te fue' },
  universidad: { titulo: 'Universidad', icono: '🎓', render: renderUniversidad, tab: 'mas', grupo: 'Áreas', enMas: true, desc: 'Materias, notas y promedio' },
  trabajo: { titulo: 'Trabajo', icono: '💼', render: renderTrabajo, tab: 'mas', grupo: 'Áreas', enMas: true, desc: 'Horas y pagos' },
  salud: { titulo: 'Salud', icono: '💪', render: renderSalud, tab: 'mas', grupo: 'Áreas', enMas: true, desc: 'Ejercicio, sueño y agua' },
  finanzas: { titulo: 'Finanzas', icono: '💰', render: renderResumen, tab: 'finanzas', grupo: 'Finanzas', sub: 'finanzas', menu: 'Resumen' },
  movimientos: { titulo: 'Movimientos', icono: '↕️', render: renderMovimientos, tab: 'finanzas', grupo: 'Finanzas', sub: 'finanzas' },
  deudas: { titulo: 'Deudas', icono: '💳', render: renderDeudas, tab: 'finanzas', grupo: 'Finanzas', sub: 'finanzas' },
  metas: { titulo: 'Metas', icono: '🎯', render: renderMetas, tab: 'finanzas', grupo: 'Finanzas', sub: 'finanzas' },
};
RUTAS.mas = { titulo: 'Más', icono: '☰', render: crearVistaMas(RUTAS, auth), tab: 'mas', oculta: true };

const TABS = [['hoy', '🏠', 'Hoy'], ['agenda', '🗓', 'Agenda'], ['tareas', '✅', 'Tareas'], ['finanzas', '💰', 'Finanzas'], ['mas', '☰', 'Más']];
const SUBTABS = { finanzas: ['finanzas', 'movimientos', 'deudas', 'metas'] };

const root = document.getElementById('app');
let sesion = null;
let shell = null;

const rutaActual = () => (RUTAS[location.hash.slice(1)] ? location.hash.slice(1) : 'hoy');
const irA = (ruta) => { if (location.hash !== `#${ruta}`) location.hash = ruta; else mostrar(); };

function construirShell() {
  const grupos = {};
  for (const [id, r] of Object.entries(RUTAS)) if (!r.oculta) (grupos[r.grupo] ||= []).push([id, r]);
  const sideNav = h('nav', { class: 'side-nav' }, Object.entries(grupos).map(([g, items]) => [
    h('span', { class: 'nav-group' }, g),
    items.map(([id, r]) => h('a', { href: `#${id}`, 'data-ruta': id },
      h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, r.icono), h('span', {}, r.menu || r.titulo))),
  ]));
  const bottomNav = h('nav', { class: 'bottom-nav' }, TABS.map(([id, icono, label]) =>
    h('a', { href: `#${id}`, 'data-tab': id }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icono), h('span', {}, label))));

  const titulo = h('h1', {});
  const subnav = h('div', { class: 'subnav' });
  const contenido = h('div', { class: 'content', id: 'contenido' });
  const correo = h('small', { class: 'muted user-mail' });

  const layout = h('div', { class: 'layout' },
    h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, h('img', { src: 'icons/icon.svg', alt: '' }), h('span', {}, 'Mi Vida')),
      sideNav,
      h('div', { class: 'sidebar-foot' }, correo, h('button', { class: 'btn ghost small', onclick: () => auth.salir() }, 'Salir'))),
    h('main', { class: 'main' }, h('header', { class: 'topbar' }, titulo), subnav, contenido),
    bottomNav,
  );
  return { layout, titulo, subnav, contenido, correo };
}

async function mostrar() {
  if (!sesion) return;
  const ruta = rutaActual();
  const r = RUTAS[ruta];
  shell.titulo.textContent = r.sub ? 'Finanzas' : r.titulo;
  document.title = `${r.titulo} · Mi Vida`;
  document.querySelectorAll('.side-nav a').forEach((a) => a.classList.toggle('active', a.dataset.ruta === ruta));
  document.querySelectorAll('.bottom-nav a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
  shell.subnav.replaceChildren(...(r.sub
    ? [tabs(SUBTABS[r.sub].map((id) => [id, RUTAS[id].menu || RUTAS[id].titulo]), ruta, irA)] : []));
  shell.contenido.replaceChildren(h('div', { class: 'loader' }, h('span'), h('span'), h('span')));
  window.scrollTo({ top: 0 });
  try {
    await r.render(shell.contenido, { service, vida, irA, correo: sesion.user.email });
  } catch (e) {
    console.error(e);
    const offline = !navigator.onLine;
    shell.contenido.replaceChildren(h('div', { class: 'empty' },
      h('div', { class: 'empty-icon' }, offline ? '📡' : '⚠️'),
      h('strong', {}, offline ? 'Estás sin internet' : 'No se pudieron cargar los datos'),
      h('p', {}, offline ? 'Conéctate y vuelve a intentarlo.' : e.message),
      h('button', { class: 'btn primary', onclick: mostrar }, 'Reintentar')));
  }
}

function aplicarSesion(nueva) {
  const cambioUsuario = nueva?.user?.id !== sesion?.user?.id;
  const yaEnLogin = !sesion && !nueva && root.querySelector('.auth-wrap');
  sesion = nueva;
  if (!sesion) { if (!yaEnLogin) { shell = null; renderAuth(root, auth); } return; }
  if (!shell || cambioUsuario) {
    shell = construirShell();
    root.replaceChildren(shell.layout);
  }
  shell.correo.textContent = sesion.user.email;
  if (cambioUsuario) mostrar();
}

window.addEventListener('hashchange', mostrar);
window.addEventListener('offline', () => toast('Sin conexión a internet', 'error'));

auth.onChange((s) => aplicarSesion(s));
aplicarSesion(await auth.session());

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW no registrado', e));
}
