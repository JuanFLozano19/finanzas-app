// Punto de entrada: arma las dependencias (composition root) y maneja la navegación.
import { supabase } from './core/supabase.js';
import { crearRepositorios } from './data/repositories.js';
import { AuthService } from './services/AuthService.js';
import { FinanzasService } from './services/FinanzasService.js';
import { h, toast } from './ui/dom.js';
import { renderAuth } from './ui/views/auth.js';
import { renderResumen } from './ui/views/resumen.js';
import { renderMovimientos } from './ui/views/movimientos.js';
import { renderDeudas } from './ui/views/deudas.js';
import { renderMetas } from './ui/views/metas.js';

const auth = new AuthService(supabase);
const service = new FinanzasService(crearRepositorios(supabase));

// Para agregar una sección nueva basta con registrarla aquí (OCP).
const RUTAS = {
  resumen: { titulo: 'Resumen', icono: '🏠', render: renderResumen },
  movimientos: { titulo: 'Movimientos', icono: '↕️', render: renderMovimientos },
  deudas: { titulo: 'Deudas', icono: '💳', render: renderDeudas },
  metas: { titulo: 'Metas', icono: '🎯', render: renderMetas },
};

const root = document.getElementById('app');
let sesion = null;
let shell = null;

const rutaActual = () => (RUTAS[location.hash.slice(1)] ? location.hash.slice(1) : 'resumen');
const irA = (ruta) => { if (location.hash !== `#${ruta}`) location.hash = ruta; else mostrar(); };

function construirShell() {
  const nav = (clase) => h('nav', { class: clase }, Object.entries(RUTAS).map(([id, r]) =>
    h('a', { href: `#${id}`, 'data-ruta': id }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, r.icono), h('span', {}, r.titulo))));

  const titulo = h('h1', {});
  const contenido = h('div', { class: 'content', id: 'contenido' });
  const correo = h('small', { class: 'muted user-mail' });
  const salir = h('button', { class: 'btn ghost small', onclick: async () => { await auth.salir(); } }, 'Salir');

  const layout = h('div', { class: 'layout' },
    h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, h('img', { src: 'icons/icon.svg', alt: '' }), h('span', {}, 'Mis Finanzas')),
      nav('side-nav'),
      h('div', { class: 'sidebar-foot' }, correo, salir)),
    h('main', { class: 'main' },
      h('header', { class: 'topbar' }, titulo,
        h('button', { class: 'btn ghost small mobile-only', onclick: async () => { await auth.salir(); } }, 'Salir')),
      contenido),
    nav('bottom-nav'),
  );
  return { layout, titulo, contenido, correo };
}

async function mostrar() {
  if (!sesion) return;
  const ruta = rutaActual();
  const r = RUTAS[ruta];
  shell.titulo.textContent = r.titulo;
  document.title = `${r.titulo} · Mis Finanzas`;
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.dataset.ruta === ruta));
  shell.contenido.replaceChildren(h('div', { class: 'loader' }, h('span'), h('span'), h('span')));
  try {
    await r.render(shell.contenido, { service, irA });
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
