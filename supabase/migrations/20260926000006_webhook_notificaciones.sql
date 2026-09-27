-- =====================================================================
-- Alerta Ciudadana — Paso 6: disparo de notificaciones
--
-- Al crear una alerta o cambiar su estado, la BD llama (de forma
-- asíncrona, con pg_net) a la Edge Function notificar-alerta, que avisa
-- al personal, a las personas a 1 km y al autor en cada cambio de estado.
--
-- Nunca bloquea ni hace fallar el registro de la alerta: si pg_net no
-- está disponible o falta la URL, simplemente no se envía el aviso.
-- La URL se configura aparte (depende del proyecto):
--   insert into private.config values ('webhook_url',
--     'https://<ref>.supabase.co/functions/v1/notificar-alerta')
--   on conflict (clave) do update set valor = excluded.valor;
-- El secreto compartido es 'webhook_secret' (Vault), el mismo que se
-- configura en la función como WEBHOOK_SECRET.
-- =====================================================================

do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net no disponible en este entorno: no se enviarán notificaciones';
end $$;

create or replace function public.notificar_alerta_webhook()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_url text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  select valor into v_url from private.config where clave = 'webhook_url';
  if v_url is null or to_regnamespace('net') is null then
    return null;
  end if;

  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
  using v_url,
        jsonb_build_object(
          'type', tg_op, 'table', 'alerts',
          'record', to_jsonb(new) - 'geom',
          'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) - 'geom' end),
        jsonb_build_object('Content-Type', 'application/json',
                           'x-webhook-secret', private.secreto('webhook_secret'));
  return null;
exception when others then
  raise log 'notificar_alerta_webhook: %', sqlerrm;  -- la alerta se guarda igual
  return null;
end;
$$;
revoke execute on function public.notificar_alerta_webhook() from public, anon, authenticated;

drop trigger if exists trg_z_notificar_alerta on public.alerts;
create trigger trg_z_notificar_alerta
  after insert or update of status on public.alerts
  for each row execute function public.notificar_alerta_webhook();
