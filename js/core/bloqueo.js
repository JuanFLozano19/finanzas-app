// Bloqueo local de la app con PIN y, opcionalmente, huella o rostro del dispositivo.
// Es una capa de privacidad en este dispositivo (que nadie que tome tu celular vea tus datos);
// la seguridad de tus datos en la nube la da el inicio de sesión y RLS.
const KEY = 'rumbo-bloqueo';
const leer = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const guardar = (c) => { try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* */ } };
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hash(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return b64(await crypto.subtle.digest('SHA-256', data));
}

export const bloqueo = {
  config: leer,
  activo: () => Boolean(leer()?.pinHash),
  async definirPin(pin, minutos = 1) {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    guardar({ ...(leer() || {}), salt, pinHash: await hash(pin, salt), minutos, largo: pin.length });
  },
  async verificarPin(pin) { const c = leer(); return Boolean(c) && (await hash(pin, c.salt)) === c.pinHash; },
  desactivar() { guardar(null); },
  cambiarMinutos(minutos) { guardar({ ...leer(), minutos }); },

  huellaDisponible: async () => Boolean(window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()),
  tieneHuella: () => Boolean(leer()?.credId),
  async registrarHuella() {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Rumbo (bloqueo)', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'bloqueo-rumbo', displayName: 'Bloqueo de Rumbo' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    } });
    guardar({ ...leer(), credId: b64(cred.rawId) });
  },
  quitarHuella() { const c = leer(); delete c.credId; guardar(c); },
  async verificarHuella() {
    const c = leer();
    await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: deB64(c.credId) }],
      userVerification: 'required', timeout: 60000,
    } });
    return true;
  },
};

// ---------- Pantalla de bloqueo ----------
let abierto = false;
let ocultoDesde = null;

export function montarBloqueo({ alOlvidar }) {
  const bloquear = () => {
    if (!bloqueo.activo() || abierto) return;
    abierto = true;
    let pin = '';
    let intentos = 0;
    const puntos = document.createElement('div'); puntos.className = 'lock-dots';
    const msg = document.createElement('p'); msg.className = 'lock-msg';
    const capa = document.createElement('div');
    capa.className = 'lock'; capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true'); capa.setAttribute('aria-label', 'Rumbo está bloqueado');
    const largo = () => (bloqueo.config()?.largo || 4);
    const pintar = () => { puntos.replaceChildren(...Array.from({ length: Math.max(largo(), pin.length) }, (_, i) => { const s = document.createElement('i'); if (i < pin.length) s.className = 'on'; return s; })); };
    const desbloquear = () => { abierto = false; capa.remove(); document.removeEventListener('keydown', teclado); };
    const probar = async () => {
      if (await bloqueo.verificarPin(pin)) { desbloquear(); return; }
      intentos++; pin = ''; pintar();
      capa.classList.remove('shake'); void capa.offsetWidth; capa.classList.add('shake');
      if (intentos >= 5) {
        msg.textContent = 'Demasiados intentos. Espera 30 segundos.';
        capa.querySelectorAll('.lock-key').forEach((b) => { b.disabled = true; });
        setTimeout(() => { intentos = 0; msg.textContent = ''; capa.querySelectorAll('.lock-key').forEach((b) => { b.disabled = false; }); }, 30000);
      } else msg.textContent = 'PIN incorrecto';
    };
    const tecla = (d) => { if (pin.length >= 8) return; pin += d; msg.textContent = ''; pintar(); if (pin.length === largo()) probar(); };
    const teclado = (e) => { if (/^\d$/.test(e.key)) tecla(e.key); else if (e.key === 'Backspace') { pin = pin.slice(0, -1); pintar(); } };
    document.addEventListener('keydown', teclado);
    const huella = async () => { try { await bloqueo.verificarHuella(); desbloquear(); } catch { msg.textContent = 'No se pudo verificar. Usa tu PIN.'; } };
    const teclas = document.createElement('div'); teclas.className = 'lock-keys';
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', bloqueo.tieneHuella() ? 'huella' : '', '0', 'borrar']) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lock-key';
      if (k === '') { b.disabled = true; b.style.visibility = 'hidden'; }
      else if (k === 'huella') { b.textContent = '👆'; b.setAttribute('aria-label', 'Usar huella o rostro'); b.onclick = huella; }
      else if (k === 'borrar') { b.textContent = '⌫'; b.setAttribute('aria-label', 'Borrar'); b.onclick = () => { pin = pin.slice(0, -1); pintar(); }; }
      else { b.textContent = k; b.onclick = () => tecla(k); }
      teclas.append(b);
    }
    const titulo = document.createElement('h2'); titulo.textContent = 'Ingresa tu PIN';
    const ayuda = document.createElement('small'); ayuda.className = 'lock-help'; ayuda.textContent = 'Al tocarlo se cierra la sesión: entras de nuevo con tu correo y contraseña y creas otro PIN.';
    const logo = document.createElement('img'); logo.src = 'icons/icon.svg'; logo.alt = ''; logo.className = 'lock-logo';
    const olvide = document.createElement('button'); olvide.className = 'link lock-forgot'; olvide.textContent = 'Olvidé mi PIN';
    olvide.onclick = () => { desbloquear(); bloqueo.desactivar(); alOlvidar(); };
    capa.append(logo, titulo, puntos, msg, teclas, olvide, ayuda);
    document.body.append(capa);
    pintar();
    if (bloqueo.tieneHuella()) setTimeout(huella, 300);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') ocultoDesde = Date.now();
    else if (ocultoDesde && Date.now() - ocultoDesde >= (bloqueo.config()?.minutos ?? 1) * 60000) bloquear();
  });
  return bloquear;
}
