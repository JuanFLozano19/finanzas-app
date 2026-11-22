// Edge Function "calendario" (pública, protegida por token revocable):
//   ?t=<ical_token>                    → archivo iCal (.ics) con clases, turnos y eventos (para Google Calendar)
//   ?t=<compartir_token>&f=compartido  → JSON con los turnos de las próximas 3 semanas (página de solo lectura)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();
const hoyCol = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const aMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const durMin = (e: any) => { if (!e.hora_inicio || !e.hora_fin) return 0; let m = aMin(e.hora_fin) - aMin(e.hora_inicio); if (m <= 0) m += 1440; return m; };

// ---------- iCal ----------
const esc = (s: string) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line: string) => { const out = []; let l = line; while (l.length > 74) { out.push(l.slice(0, 74)); l = ` ${l.slice(74)}`; } out.push(l); return out.join('\r\n'); };
const fechaIcs = (d: string) => d.replace(/-/g, '');
const horaIcs = (d: string, t: string) => `${fechaIcs(d)}T${t.slice(0, 5).replace(':', '')}00`;
function finIcs(e: any) {
  const total = aMin(e.hora_inicio) + durMin(e);
  const dia = total >= 1440 ? addDays(e.fecha, 1) : e.fecha;
  const m = total % 1440;
  return horaIcs(dia, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
}
const ICONO: Record<string, string> = { clase: '📚', trabajo: '💼', cita: '📍', entrega: '📝', estudio: '🧠', otro: '🗓' };

function ical(eventos: any[]) {
  const ahora = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rumbo//Calendario//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Rumbo', 'X-WR-TIMEZONE:America/Bogota', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE', 'TZID:America/Bogota', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0500', 'TZNAME:-05', 'END:STANDARD', 'END:VTIMEZONE'];
  for (const e of eventos) {
    L.push('BEGIN:VEVENT', `UID:${e.id}@rumbo`, `DTSTAMP:${ahora}`);
    if (e.hora_inicio && e.hora_fin) {
      L.push(`DTSTART;TZID=America/Bogota:${horaIcs(e.fecha, e.hora_inicio)}`, `DTEND;TZID=America/Bogota:${finIcs(e)}`);
    } else if (e.hora_inicio) {
      L.push(`DTSTART;TZID=America/Bogota:${horaIcs(e.fecha, e.hora_inicio)}`, 'DURATION:PT1H');
    } else {
      L.push(`DTSTART;VALUE=DATE:${fechaIcs(e.fecha)}`, `DTEND;VALUE=DATE:${fechaIcs(addDays(e.fecha, 1))}`);
    }
    if (e.semanal) L.push(`RRULE:FREQ=WEEKLY${e.fecha_fin ? `;UNTIL=${fechaIcs(e.fecha_fin)}T235959Z` : ''}`);
    L.push(fold(`SUMMARY:${esc(`${ICONO[e.tipo] || ''} ${e.titulo}`.trim())}`));
    if (e.notas) L.push(fold(`DESCRIPTION:${esc(e.notas)}`));
    if (e.lugar) L.push(fold(`LOCATION:${esc(e.lugar)}`));
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

// ---------- Horario compartido ----------
function turnosProximos(eventos: any[], desde: string, dias: number) {
  const out = [];
  for (let i = 0; i < dias; i++) {
    const d = addDays(desde, i);
    for (const e of eventos) {
      const toca = e.fecha === d || (e.semanal && e.fecha <= d && (!e.fecha_fin || e.fecha_fin >= d) && weekday(e.fecha) === weekday(d));
      if (toca && e.hora_inicio) out.push({ fecha: d, inicio: e.hora_inicio.slice(0, 5), fin: e.hora_fin?.slice(0, 5) || null, tipo: e.titulo, horas: Math.round(durMin(e) / 6) / 10 });
    }
  }
  return out.sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const token = url.searchParams.get('t') || '';
  const formato = url.searchParams.get('f');
  if (!UUID.test(token)) return new Response('Enlace no válido', { status: 404, headers: cors });
  try {
    if (formato === 'compartido') {
      const { data: aj } = await db.from('ajustes').select('user_id, nombre').eq('compartir_token', token).maybeSingle();
      if (!aj) return Response.json({ error: 'Este enlace ya no está activo.' }, { status: 404, headers: cors });
      const { data: ev } = await db.from('eventos').select('*').eq('user_id', aj.user_id).eq('tipo', 'trabajo').lte('fecha', addDays(hoyCol(), 21));
      return Response.json({ nombre: aj.nombre || null, desde: hoyCol(), turnos: turnosProximos(ev || [], hoyCol(), 21) },
        { headers: { ...cors, 'Cache-Control': 'no-store' } });
    }
    const { data: aj } = await db.from('ajustes').select('user_id').eq('ical_token', token).maybeSingle();
    if (!aj) return new Response('Enlace no válido', { status: 404, headers: cors });
    const { data: ev } = await db.from('eventos').select('*').eq('user_id', aj.user_id).gte('fecha', addDays(hoyCol(), -400));
    const { data: sem } = await db.from('eventos').select('*').eq('user_id', aj.user_id).eq('semanal', true).lt('fecha', addDays(hoyCol(), -400));
    return new Response(ical([...(ev || []), ...(sem || [])]), {
      headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="rumbo.ics"', 'Cache-Control': 'max-age=900' },
    });
  } catch (e) {
    console.error(e);
    return new Response('Error interno', { status: 500, headers: cors });
  }
});
