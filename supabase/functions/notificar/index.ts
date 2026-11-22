// Edge Function "notificar": revisa qué recordatorios tocan y los envía por Web Push.
// - Modo cron (cada 15 min): header x-cron-secret con el secreto guardado en Vault.
// - Modo prueba: el usuario autenticado pide { prueba: true } y recibe un aviso de prueba.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function secreto(nombre: string): Promise<string> {
  const { data, error } = await db.rpc('secreto_rumbo', { nombre });
  if (error || !data) throw new Error(`Falta el secreto ${nombre}`);
  return data as string;
}

// ---------- Fechas en Colombia (UTC−5, sin horario de verano) ----------
const OFFSET = -5 * 3600_000;
const local = () => new Date(Date.now() + OFFSET);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const weekday = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();
const minutos = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const h12 = (t: string) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };

type Msg = { clave: string; title: string; body: string; url: string; tag?: string };
const PREFS = { turnos: true, eventos: true, tareas: true, evaluaciones: true, habitos: true, cumpleanos: true, pagos: true };

async function mensajesPara(userId: string, prefs: typeof PREFS): Promise<Msg[]> {
  const ahora = local();
  const hoy = iso(ahora);
  const manana = addDays(hoy, 1);
  const hora = ahora.getUTCHours();
  const minAhora = hora * 60 + ahora.getUTCMinutes();
  const ym = hoy.slice(0, 7);
  const out: Msg[] = [];
  const q = (t: string) => db.from(t).select('*').eq('user_id', userId);

  // Clases, citas y turnos: aviso X minutos antes (recordatorio_min de cada evento)
  const { data: ev } = await q('eventos').lte('fecha', manana).not('hora_inicio', 'is', null);
  const tocaEn = (e: any, dia: string) => e.fecha === dia || (e.semanal && e.fecha <= dia && (!e.fecha_fin || e.fecha_fin >= dia) && weekday(e.fecha) === weekday(dia));
  for (const e of ev || []) {
    const esTurno = e.tipo === 'trabajo';
    if (esTurno ? !prefs.turnos : !prefs.eventos) continue;
    const aviso = e.recordatorio_min ?? 30;
    const falta = minutos(e.hora_inicio) - minAhora;
    if (aviso > 0 && tocaEn(e, hoy) && falta > 0 && falta <= aviso) {
      const cuanto = falta >= 60 ? `${Math.floor(falta / 60)} h${falta % 60 ? ` ${falta % 60} min` : ''}` : `${falta} min`;
      out.push(esTurno
        ? { clave: `ev:${e.id}:${hoy}`, title: `💼 Turno en ${cuanto}: ${e.titulo}`, body: `${h12(e.hora_inicio)} a ${h12(e.hora_fin)}${e.notas ? ` · ${e.notas}` : ''}`, url: './#trabajo', tag: `ev-${e.id}` }
        : { clave: `ev:${e.id}:${hoy}`, title: `En ${cuanto}: ${e.titulo}`, body: e.lugar || 'Revisa tu agenda', url: './#agenda', tag: `ev-${e.id}` });
    }
  }
  // Turnos de mañana: aviso la noche anterior (desde las 8 p. m.)
  if (hora >= 20 && prefs.turnos) {
    for (const e of (ev || []).filter((x) => x.tipo === 'trabajo' && tocaEn(x, manana))) {
      out.push({ clave: `noche:${e.id}:${manana}`, title: `💼 Mañana tienes turno: ${e.titulo}`,
        body: `De ${h12(e.hora_inicio)} a ${h12(e.hora_fin)}${e.notas ? ` · ${e.notas}` : ''}`, url: './#trabajo', tag: `noche-${e.id}` });
    }
  }

  if (hora >= 7) {
    if (prefs.tareas) {
      const { data: t } = await q('tareas').eq('hecha', false).lte('fecha_limite', hoy);
      const mias = (t || []).filter((x) => !x.proyecto_id || !x.responsable || /^yo$/i.test(x.responsable.trim()));
      if (mias.length) {
        const venc = mias.filter((x) => x.fecha_limite < hoy).length;
        out.push({ clave: `tareas:${hoy}`, title: `✅ Tienes ${mias.length} tarea${mias.length === 1 ? '' : 's'} para hoy`,
          body: `${mias.slice(0, 3).map((x) => x.titulo).join(' · ')}${venc ? ` (${venc} vencida${venc === 1 ? '' : 's'})` : ''}`, url: './#tareas' });
      }
    }
    if (prefs.pagos) {
      const { data: r } = await q('recurrentes').eq('activo', true);
      for (const x of r || []) {
        if (x.ultimo_mes === ym) continue;
        const [y, m] = ym.split('-').map(Number);
        const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const vence = `${ym}-${String(Math.min(x.dia_mes, ultimo)).padStart(2, '0')}`;
        if (vence === hoy || vence === manana) {
          out.push({ clave: `fijo:${x.id}:${vence}`, title: `🔁 ${x.nombre} se paga ${vence === hoy ? 'hoy' : 'mañana'}`,
            body: `$${Number(x.monto).toLocaleString('es-CO')}`, url: './#fijos' });
        }
      }
      const { data: p } = await q('prestamos').eq('fecha_pago', hoy);
      for (const x of p || []) out.push({ clave: `prest:${x.id}`, title: `🤝 Hoy te paga ${x.persona}`, body: `Préstamo de $${Number(x.monto).toLocaleString('es-CO')}`, url: './#prestamos' });
    }
    if (prefs.cumpleanos) {
      const [mm, dd] = [Number(hoy.slice(5, 7)), Number(hoy.slice(8, 10))];
      const { data: c } = await q('contactos').eq('cumple_mes', mm).eq('cumple_dia', dd);
      for (const x of c || []) out.push({ clave: `cumple:${x.id}:${hoy.slice(0, 4)}`, title: `🎂 Hoy cumple años ${x.nombre}`, body: '¡No se te olvide escribirle!', url: './#contactos' });
    }
  }

  if (hora >= 19 && prefs.evaluaciones) {
    const { data: ev } = await q('evaluaciones').eq('fecha', manana).is('nota', null);
    for (const x of ev || []) out.push({ clave: `eval:${x.id}`, title: `📚 Mañana: ${x.nombre}`, body: `Vale ${Number(x.porcentaje)}% de la materia. ¡A repasar!`, url: './#universidad' });
    const { data: en } = await q('eventos').eq('fecha', manana).eq('tipo', 'entrega');
    for (const x of en || []) out.push({ clave: `ent:${x.id}`, title: `📝 Mañana: ${x.titulo}`, body: 'Tienes una entrega o evaluación.', url: './#agenda' });
  }

  if (hora >= 20 && hora < 23 && prefs.habitos) {
    const [{ data: h }, { data: rg }] = await Promise.all([q('habitos').eq('activo', true), q('registros_habito').eq('fecha', hoy)]);
    const hechos = new Set((rg || []).map((x) => x.habito_id));
    const faltan = (h || []).filter((x) => (x.dias || []).includes(weekday(hoy)) && !hechos.has(x.id));
    if (faltan.length) out.push({ clave: `hab:${hoy}`, title: `🌱 Te falta${faltan.length === 1 ? '' : 'n'} ${faltan.length} hábito${faltan.length === 1 ? '' : 's'} hoy`, body: faltan.map((x) => `${x.icono} ${x.nombre}`).join(' · '), url: './#habitos' });
  }

  if (weekday(hoy) === 0 && hora >= 18) {
    out.push({ clave: `rev:${hoy}`, title: '🧭 Es domingo: revisa tu semana', body: '5 minutos para ver cómo te fue y planear la próxima.', url: './#revision' });
  }
  return out;
}

async function enviar(subs: any[], msg: Omit<Msg, 'clave'>) {
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600 });
      ok++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_suscripciones').delete().eq('id', s.id);
      else console.error('push error', e?.statusCode, e?.body);
    }
  }
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    webpush.setVapidDetails('mailto:jufranlogo@gmail.com', await secreto('vapid_public'), await secreto('vapid_private'));

    // Modo prueba: un usuario autenticado se manda un aviso a sí mismo
    const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const body = await req.json().catch(() => ({}));
    if (body?.prueba) {
      const { data: u } = await db.auth.getUser(auth || '');
      if (!u?.user) return json({ error: 'No autenticado' }, 401);
      const { data: subs } = await db.from('push_suscripciones').select('*').eq('user_id', u.user.id);
      const n = await enviar(subs || [], { title: '🧭 ¡Notificaciones activadas!', body: 'Así te van a llegar los recordatorios de Rumbo.', url: './#hoy' });
      return json({ enviadas: n });
    }

    // Modo cron
    if (req.headers.get('x-cron-secret') !== await secreto('cron_secret')) return json({ error: 'No autorizado' }, 401);
    const { data: subs } = await db.from('push_suscripciones').select('*');
    const porUsuario = new Map<string, any[]>();
    for (const s of subs || []) porUsuario.set(s.user_id, [...(porUsuario.get(s.user_id) || []), s]);
    let total = 0;
    for (const [userId, lista] of porUsuario) {
      const { data: aj } = await db.from('ajustes').select('notificaciones').eq('user_id', userId).maybeSingle();
      const prefs = { ...PREFS, ...(aj?.notificaciones || {}) };
      for (const m of await mensajesPara(userId, prefs)) {
        const { data: nueva } = await db.rpc('marcar_notificacion', { p_user: userId, p_clave: m.clave });
        if (!nueva) continue;
        const { clave: _c, ...msg } = m;
        total += await enviar(lista, msg);
      }
    }
    if (local().getUTCHours() === 3) await db.rpc('limpiar_notificaciones');
    return json({ usuarios: porUsuario.size, enviadas: total });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
