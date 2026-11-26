// Edge Function "respaldar": guarda una copia JSON de todos los datos de cada usuario
// en el bucket privado "respaldos" (carpeta = id del usuario) y deja solo las 8 más recientes.
// - Modo cron (domingos): header x-cron-secret → respalda a todos los usuarios.
// - Modo usuario: Authorization: Bearer <jwt> → respalda solo a ese usuario ("Hacer copia ahora").
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// Mismo orden que usa la app para restaurar: primero las tablas "padre".
const TABLAS = ['ajustes', 'cuentas', 'materias', 'deudas', 'metas', 'deseos', 'prestamos', 'habitos', 'rutina_items', 'metas_vida',
  'proyectos_grupo', 'contactos', 'lecturas', 'recurrentes', 'presupuestos', 'movimientos', 'pagos_deuda', 'aportes_meta',
  'precios_deseo', 'abonos_prestamo', 'registros_habito', 'rutina_checks', 'pasos_meta', 'tareas', 'eventos', 'evaluaciones',
  'apuntes', 'flashcards', 'sesiones_estudio', 'notas', 'horas_trabajo', 'entrenamientos', 'registros_salud', 'revisiones', 'lista_compras'];
const GUARDAR = 8;
const hoyCo = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

async function respaldarUsuario(uid: string) {
  const datos: Record<string, unknown[]> = {};
  let filas = 0;
  for (const t of TABLAS) {
    const { data, error } = await db.from(t).select('*').eq('user_id', uid);
    if (error) throw new Error(`${t}: ${error.message}`);
    datos[t] = data ?? [];
    filas += datos[t].length;
  }
  const archivo = { app: 'Rumbo', version: 1, creado: new Date().toISOString(), filas, datos };
  const ruta = `${uid}/${hoyCo()}.json`;
  const cuerpo = new Blob([JSON.stringify(archivo)], { type: 'application/json' });
  const { error } = await db.storage.from('respaldos').upload(ruta, cuerpo, { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(error.message);
  // Borra las copias más viejas.
  const { data: lista } = await db.storage.from('respaldos').list(uid, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
  const viejas = (lista ?? []).filter((f) => f.name.endsWith('.json')).slice(GUARDAR).map((f) => `${uid}/${f.name}`);
  if (viejas.length) await db.storage.from('respaldos').remove(viejas);
  return { ruta, filas };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const cron = req.headers.get('x-cron-secret');
    if (cron) {
      const { data: secreto } = await db.rpc('secreto_rumbo', { nombre: 'cron_secret' });
      if (!secreto || cron !== secreto) return json({ error: 'No autorizado' }, 401);
      const { data: usuarios, error } = await db.from('ajustes').select('user_id');
      if (error) throw error;
      const resultados = [];
      for (const { user_id } of usuarios ?? []) {
        try { resultados.push({ ok: true, ...(await respaldarUsuario(user_id)) }); } catch (e) { resultados.push({ ok: false, error: String(e) }); }
      }
      return json({ respaldados: resultados.filter((r) => r.ok).length, total: resultados.length });
    }
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return json({ error: 'Inicia sesión para hacer la copia' }, 401);
    return json(await respaldarUsuario(user.id));
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
