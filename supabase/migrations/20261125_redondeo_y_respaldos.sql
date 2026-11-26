-- Ahorro por redondeo: { activo, multiplo, meta_id }
alter table public.ajustes add column if not exists redondeo jsonb not null default '{"activo": false, "multiplo": 1000, "meta_id": null}'::jsonb;

-- Respaldos automáticos: bucket privado, una carpeta por usuario. Solo la función (service role) escribe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('respaldos', 'respaldos', false, 52428800, array['application/json'])
on conflict (id) do nothing;

drop policy if exists "respaldos: leer los propios" on storage.objects;
create policy "respaldos: leer los propios" on storage.objects for select to authenticated
  using (bucket_id = 'respaldos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Domingos 3:00 a. m. hora Colombia (08:00 UTC).
select cron.unschedule('rumbo-respaldos') where exists (select 1 from cron.job where jobname = 'rumbo-respaldos');
select cron.schedule('rumbo-respaldos', '0 8 * * 0', $$
  select net.http_post(
    url := 'https://pvvjmgaielymmppyqzzp.supabase.co/functions/v1/respaldar',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
