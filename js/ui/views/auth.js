import { h } from '../dom.js';

export function renderAuth(root, authService, passkeys) {
  let modo = 'login';
  const error = h('p', { class: 'form-error', hidden: true });
  const info = h('p', { class: 'form-info', hidden: true });
  const titulo = h('h2', {}, 'Inicia sesión');
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Entrar');
  const cambio = h('button', { class: 'link', type: 'button' }, '¿No tienes cuenta? Regístrate');
  const pass = h('input', { name: 'password', type: 'password', required: true, minlength: '6', autocomplete: 'current-password' });

  const pintar = () => {
    const login = modo === 'login';
    titulo.textContent = login ? 'Inicia sesión' : 'Crea tu cuenta';
    btn.textContent = login ? 'Entrar' : 'Crear cuenta';
    cambio.textContent = login ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión';
    pass.autocomplete = login ? 'current-password' : 'new-password';
    error.hidden = true;
  };
  cambio.addEventListener('click', () => { modo = modo === 'login' ? 'registro' : 'login'; pintar(); });

  const form = h('form', { class: 'auth-card' },
    h('div', { class: 'brand-big' }, h('img', { src: 'icons/icon.svg', alt: '' }), h('span', {}, 'Rumbo')),
    h('p', { class: 'muted' }, 'Tu agenda, tareas, hábitos, universidad, trabajo, salud y plata en un solo lugar.'),
    titulo,
    h('label', { class: 'field' }, h('span', { class: 'label' }, 'Correo'),
      h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
    h('label', { class: 'field' }, h('span', { class: 'label' }, 'Contraseña'), pass,
      h('small', { class: 'hint' }, 'Mínimo 6 caracteres.')),
    error, info, btn,
    passkeys?.soportado() ? h('button', { class: 'btn ghost block', type: 'button', onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true; error.hidden = true;
      try { await passkeys.entrar(); } catch (err) { error.textContent = err.message; error.hidden = false; } finally { b.disabled = false; }
    } }, '🔐 Entrar con huella o rostro') : null,
    cambio,
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email')).trim();
    const password = String(fd.get('password'));
    btn.disabled = true; error.hidden = true; info.hidden = true;
    try {
      if (modo === 'login') await authService.login(email, password);
      else {
        const activa = await authService.registrar(email, password);
        if (!activa) {
          info.textContent = 'Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión aquí.';
          info.hidden = false; modo = 'login'; pintar();
        }
      }
    } catch (err) {
      error.textContent = err.message; error.hidden = false;
    } finally { btn.disabled = false; }
  });

  root.replaceChildren(h('main', { class: 'auth-wrap' }, form));
}
