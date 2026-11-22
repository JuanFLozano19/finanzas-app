// Punto de entrada: arma las dependencias (composition root) y maneja la navegación.
import { supabase } from './core/supabase.js';
import { aplicarTema, temaGuardado } from './core/tema.js';
import { crearRepositorios, sincronizar } from './data/repositories.js';
import { outbox } from './data/outbox.js';
import { AuthService } from './services/AuthService.js';
import { FinanzasService } from './services/FinanzasService.js';
import { crearServiciosVida } from './services/VidaServices.js';
import { PlataService } from './services/PlataService.js';
import { HorarioService, ApuntesService, GruposService, EstudioService } from './services/UniversidadExtra.js';
import { BienestarService, AsistenteService } from './services/BienestarService.js';
import { abrirAsistente } from './ui/asistente.js';
import { NotificacionesService, PasskeyService } from './services/DispositivoService.js';
import { seccionNotificaciones, seccionPasskeys } from './ui/views/dispositivo.js';
import { renderRutinas, renderMetasVida, renderLectura, renderContactos, renderEnfoque, renderRevision } from './ui/views/bienestar.js';
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
import { renderAjustes, seccionesAjustes } from './ui/views/ajustes.js';
import { renderCuentas, renderPresupuestos, renderFijos, renderPrestamos, seccionReparto } from './ui/views/plata.js';
import { renderDeseos } from './ui/views/deseos.js';
import { renderEstadisticas } from './ui/views/estadisticas.js';
import { renderHorario } from './ui/views/horario.js';
import { renderApuntes } from './ui/views/apuntes.js';
import { renderGrupos } from './ui/views/grupos.js';
import { renderEstudio, iniciarTemporizador } from './ui/views/estudio.js';

aplicarTema(temaGuardado());

const repos = crearRepositorios(supabase);
const auth = new AuthService(supabase);
const service = new FinanzasService(repos);
const vida = crearServiciosVida(repos);
const plata = new PlataService(repos);
const uni = { horario: new HorarioService(repos), apuntes: new ApuntesService(repos, supabase), grupos: new GruposService(repos), estudio: new EstudioService(repos) };
iniciarTemporizador(uni.estudio);
const bienestar = new BienestarService(repos);
const asistente = new AsistenteService({ service, vida, plata, bienestar, repos });
const notificaciones = new NotificacionesService(repos, supabase);
const passkeys = new PasskeyService(supabase);
seccionesAjustes.unshift(seccionNotificaciones, seccionPasskeys);
seccionesAjustes.push(seccionReparto);

// Para agregar un módulo nuevo basta con registrarlo aquí (abierto/cerrado).
// tab = a qué botón de la barra inferior pertenece; grupo = sección del menú lateral.
const RUTAS = {
  hoy: { titulo: 'Hoy', icono: '🏠', render: renderHoy, tab: 'hoy', grupo: 'Mi día' },
  enfoque: { titulo: 'Modo enfoque', icono: '🎯', render: renderEnfoque, tab: 'hoy', grupo: 'Mi día', enMas: true, desc: 'Solo tus 3 cosas de hoy', menu: 'Enfoque' },
  agenda: { titulo: 'Agenda', icono: '🗓', render: renderAgenda, tab: 'agenda', grupo: 'Mi día' },
  tareas: { titulo: 'Tareas', icono: '✅', render: renderTareas, tab: 'tareas', grupo: 'Mi día' },
  habitos: { titulo: 'Hábitos', icono: '🌱', render: renderHabitos, tab: 'mas', grupo: 'Mi día', enMas: true, desc: 'Rachas y constancia' },
  rutinas: { titulo: 'Rutinas', icono: '☀️', render: renderRutinas, tab: 'mas', grupo: 'Mi día', enMas: true, desc: 'Mañana y noche' },
  notas: { titulo: 'Diario y notas', icono: '📔', render: renderNotas, tab: 'mas', grupo: 'Mi día', enMas: true, desc: 'Ideas y cómo te fue' },
  universidad: { titulo: 'Universidad', icono: '🎓', render: renderUniversidad, tab: 'mas', grupo: 'Universidad', enMas: true, desc: 'Materias, horario, apuntes y estudio', sub: 'universidad', menu: 'Materias' },
  horario: { titulo: 'Horario', icono: '🕘', render: renderHorario, tab: 'mas', grupo: 'Universidad', sub: 'universidad' },
  apuntes: { titulo: 'Apuntes', icono: '📎', render: renderApuntes, tab: 'mas', grupo: 'Universidad', sub: 'universidad' },
  grupos: { titulo: 'Trabajos en grupo', icono: '👥', render: renderGrupos, tab: 'mas', grupo: 'Universidad', sub: 'universidad', menu: 'Grupos' },
  estudio: { titulo: 'Estudio', icono: '⏱', render: renderEstudio, tab: 'mas', grupo: 'Universidad', sub: 'universidad', menu: 'Pomodoro' },
  trabajo: { titulo: 'Turnos de trabajo', icono: '💼', render: renderTrabajo, tab: 'mas', grupo: 'Áreas', enMas: true, desc: 'Tus turnos y horarios', menu: 'Turnos' },
  salud: { titulo: 'Salud', icono: '💪', render: renderSalud, tab: 'mas', grupo: 'Áreas', enMas: true, desc: 'Ejercicio, sueño y agua' },
  metasvida: { titulo: 'Metas de vida', icono: '⭐', render: renderMetasVida, tab: 'mas', grupo: 'Crecimiento', enMas: true, desc: 'Sueños grandes, paso a paso' },
  lectura: { titulo: 'Lectura y cursos', icono: '📖', render: renderLectura, tab: 'mas', grupo: 'Crecimiento', enMas: true, desc: 'Libros y cursos', menu: 'Lectura' },
  contactos: { titulo: 'Personas', icono: '🎂', render: renderContactos, tab: 'mas', grupo: 'Crecimiento', enMas: true, desc: 'Cumpleaños y contacto' },
  revision: { titulo: 'Revisión semanal', icono: '🧭', render: renderRevision, tab: 'mas', grupo: 'Crecimiento', enMas: true, desc: 'Cierra la semana y planea', menu: 'Revisión' },
  finanzas: { titulo: 'Plata', icono: '💰', render: renderResumen, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas', menu: 'Resumen' },
  movimientos: { titulo: 'Movimientos', icono: '↕️', render: renderMovimientos, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas' },
  cuentas: { titulo: 'Cuentas', icono: '🏦', render: renderCuentas, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas' },
  presupuestos: { titulo: 'Presupuestos', icono: '🧮', render: renderPresupuestos, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas' },
  fijos: { titulo: 'Pagos fijos', icono: '🔁', render: renderFijos, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas' },
  deudas: { titulo: 'Deudas', icono: '💳', render: renderDeudas, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas' },
  prestamos: { titulo: 'Préstamos', icono: '🤝', render: renderPrestamos, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas', menu: 'Me deben' },
  metas: { titulo: 'Metas', icono: '🎯', render: renderMetas, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas' },
  deseos: { titulo: 'Deseos', icono: '✨', render: renderDeseos, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas' },
  estadisticas: { titulo: 'Estadísticas', icono: '📊', render: renderEstadisticas, tab: 'finanzas', grupo: 'Plata', sub: 'finanzas' },
};

RUTAS.ajustes = { titulo: 'Ajustes', icono: '⚙️', render: renderAjustes, tab: 'mas', grupo: 'Rumbo', enMas: true, desc: 'Tema, respaldo y cuenta' };
RUTAS.mas = { titulo: 'Más', icono: '☰', render: crearVistaMas(RUTAS), tab: 'mas', oculta: true };

const TABS = [['hoy', '🏠', 'Hoy'], ['agenda', '🗓', 'Agenda'], ['tareas', '✅', 'Tareas'], ['finanzas', '💰', 'Plata'], ['mas', '☰', 'Más']];
const SUBTABS = { universidad: ['universidad', 'horario', 'apuntes', 'grupos', 'estudio'], finanzas: ['finanzas', 'movimientos', 'cuentas', 'presupuestos', 'fijos', 'deudas', 'prestamos', 'metas', 'deseos', 'estadisticas'] };

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
  const estadoRed = h('span', { class: 'net-badge', hidden: true });

  const layout = h('div', { class: 'layout' },
    h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, h('img', { src: 'icons/icon.svg', alt: '' }), h('span', {}, 'Rumbo')),
      sideNav,
      h('div', { class: 'sidebar-foot' }, correo, h('button', { class: 'btn ghost small', onclick: salir }, 'Salir'))),
    h('main', { class: 'main' }, h('header', { class: 'topbar' }, titulo, h('div', { class: 'top-actions' }, estadoRed,
      h('button', { class: 'assistant-btn', 'aria-label': 'Asistente: cuéntale a Rumbo', title: 'Cuéntale a Rumbo (tecla /)', onclick: () => abrirAsistente(asistente, mostrar) }, '✨'))), subnav, contenido),
    bottomNav,
  );
  return { layout, titulo, subnav, contenido, correo, estadoRed };
}

const ctxBase = () => ({ service, vida, plata, ...uni, bienestar, asistente, notificaciones, passkeys, irA, correo: sesion?.user.email, salir, abrirAsistente: () => abrirAsistente(asistente, mostrar) });

async function mostrar() {
  if (!sesion) return;
  const ruta = rutaActual();
  const r = RUTAS[ruta];
  shell.titulo.textContent = r.sub ? RUTAS[r.sub].titulo : r.titulo;
  document.title = `${r.titulo} · Rumbo`;
  document.querySelectorAll('.side-nav a').forEach((a) => a.classList.toggle('active', a.dataset.ruta === ruta));
  document.querySelectorAll('.bottom-nav a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
  shell.subnav.replaceChildren(...(r.sub
    ? [tabs(SUBTABS[r.sub].map((id) => [id, RUTAS[id].menu || RUTAS[id].titulo]), ruta, irA)] : []));
  shell.subnav.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  shell.contenido.replaceChildren(h('div', { class: 'loader' }, h('span'), h('span'), h('span')));
  window.scrollTo({ top: 0 });
  try {
    await r.render(shell.contenido, ctxBase());
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

async function salir() {
  outbox.vaciar();
  try { await caches.delete('rumbo-datos'); } catch { /* sin caché */ }
  await auth.salir();
}

function pintarEstadoRed() {
  if (!shell) return;
  const pend = outbox.leer().length;
  const off = !navigator.onLine;
  shell.estadoRed.hidden = !off && !pend;
  shell.estadoRed.className = `net-badge ${off ? 'off' : 'sync'}`;
  shell.estadoRed.textContent = off ? `📡 Sin internet${pend ? ` · ${pend} por subir` : ''}` : `⏳ Subiendo ${pend}…`;
}

async function sincronizarAhora() {
  if (!sesion || !navigator.onLine || !outbox.leer().length) { pintarEstadoRed(); return; }
  pintarEstadoRed();
  const { subidas, fallidas } = await sincronizar(supabase);
  pintarEstadoRed();
  if (subidas) { toast(`☁️ ${subidas} cambio${subidas === 1 ? '' : 's'} sincronizado${subidas === 1 ? '' : 's'}`); mostrar(); }
  if (fallidas) toast(`${fallidas} cambio${fallidas === 1 ? '' : 's'} no se pudo subir`, 'error');
}

async function cargarTema() {
  try {
    const aj = await vida.ajustes.obtener();
    if (aj.tema || aj.acento) aplicarTema({ tema: aj.tema, acento: aj.acento });
  } catch { /* se queda el tema guardado */ }
}

function aplicarSesion(nueva) {
  const cambioUsuario = nueva?.user?.id !== sesion?.user?.id;
  const yaEnLogin = !sesion && !nueva && root.querySelector('.auth-wrap');
  sesion = nueva;
  if (!sesion) { if (!yaEnLogin) { shell = null; renderAuth(root, auth, passkeys); } return; }
  if (!shell || cambioUsuario) {
    shell = construirShell();
    root.replaceChildren(shell.layout);
  }
  shell.correo.textContent = sesion.user.email;
  if (cambioUsuario) { mostrar(); cargarTema(); sincronizarAhora(); }
}

window.addEventListener('hashchange', mostrar);
window.addEventListener('keydown', (e) => {
  if (e.key === '/' && sesion && !document.querySelector('dialog[open]') && !/input|textarea|select/i.test(document.activeElement?.tagName)) {
    e.preventDefault(); abrirAsistente(asistente, mostrar);
  }
});
window.addEventListener('offline', () => { toast('Sin internet: tus cambios se guardan y se suben después', 'error'); pintarEstadoRed(); });
window.addEventListener('online', sincronizarAhora);
window.addEventListener('outbox', pintarEstadoRed);

auth.onChange((s) => aplicarSesion(s));
aplicarSesion(await auth.session());

// Service worker: busca actualizaciones al abrir y recarga una vez cuando hay versión nueva.
if ('serviceWorker' in navigator) {
  const teniaControl = Boolean(navigator.serviceWorker.controller);
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!teniaControl || recargando) return;
    recargando = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      reg.update();
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
    })
    .catch((e) => console.warn('SW no registrado', e));
}
