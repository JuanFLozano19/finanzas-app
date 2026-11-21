// Autenticación: una sola responsabilidad, envuelve supabase.auth.
const MENSAJES = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Aún no confirmas tu correo. Revisa tu bandeja de entrada.',
  'User already registered': 'Ese correo ya tiene cuenta. Inicia sesión.',
};
const traducir = (e) => new Error(MENSAJES[e.message] || e.message);

export class AuthService {
  constructor(client) { this.auth = client.auth; }

  async session() {
    const { data } = await this.auth.getSession();
    return data.session;
  }

  onChange(cb) {
    this.auth.onAuthStateChange((_evt, session) => cb(session));
  }

  async login(email, password) {
    const { error } = await this.auth.signInWithPassword({ email, password });
    if (error) throw traducir(error);
  }

  /** Devuelve true si la cuenta quedó activa de una vez (sin confirmar correo). */
  async registrar(email, password) {
    const { data, error } = await this.auth.signUp({
      email, password, options: { emailRedirectTo: location.href.split('#')[0] },
    });
    if (error) throw traducir(error);
    return Boolean(data.session);
  }

  async salir() { await this.auth.signOut(); }
}
