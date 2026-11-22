// Tema visual: claro/oscuro/automático y color de acento.
// Se guarda también en localStorage para aplicarlo al instante al abrir (sin parpadeo).
const KEY = 'rumbo-tema';

export const ACENTOS = [
  ['#2f55d4', 'Cobalto Rumbo'], ['#0f8f78', 'Verde'], ['#7c3aed', 'Morado'], ['#db2777', 'Rosa'],
  ['#ea580c', 'Naranja'], ['#dc2626', 'Rojo'], ['#0891b2', 'Cian'], ['#334155', 'Grafito'],
];

export function aplicarTema({ tema = 'auto', acento = '#2f55d4' } = {}) {
  const root = document.documentElement;
  if (tema === 'auto') delete root.dataset.theme; else root.dataset.theme = tema;
  root.style.setProperty('--acento', acento);
  const oscuro = tema === 'oscuro' || (tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0a1020' : '#13203d');
  try { localStorage.setItem(KEY, JSON.stringify({ tema, acento })); } catch { /* sin almacenamiento */ }
}

export function temaGuardado() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
