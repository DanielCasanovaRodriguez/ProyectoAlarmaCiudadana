-- =====================================================================
-- Alerta Ciudadana — Paso 15: "Probar notificaciones" desde el perfil.
-- La persona recibe un push de prueba en SUS dispositivos (máx. 1 por
-- minuto). La llamada a la Edge Function la hace la BD con el secreto del
-- webhook; la app nunca lo conoce. Idempotente.
-- =====================================================================
create table if not exists private.pruebas_push (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ultima  timestamptz not null default now()
);

create or replace function public.probar_mis_notificaciones()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_url text;
  v_disp int;
begin
  if v_uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  select count(*) into v_disp from public.device_tokens where user_id = v_uid;
  if v_disp = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'sin_dispositivo');
  end if;
  if exists (select 1 from private.pruebas_push where user_id = v_uid and ultima > now() - interval '1 minute') then
    return jsonb_build_object('ok', false, 'motivo', 'espera');
  end if;
  select valor into v_url from private.config where clave = 'webhook_url';
  if v_url is null or to_regnamespace('net') is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_configurar');
  end if;

  insert into private.pruebas_push (user_id, ultima) values (v_uid, now())
  on conflict (user_id) do update set ultima = excluded.ultima;

  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
  using v_url,
        jsonb_build_object('type', 'PRUEBA', 'user_id', v_uid),
        jsonb_build_object('Content-Type', 'application/json',
                           'x-webhook-secret', private.secreto('webhook_secret'));
  return jsonb_build_object('ok', true, 'dispositivos', v_disp);
end;
$$;
revoke all on function public.probar_mis_notificaciones() from public, anon;
grant execute on function public.probar_mis_notificaciones() to authenticated;
