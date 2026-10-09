-- =====================================================================
-- Alerta Ciudadana — Paso 14: vigencia de 1 hora, radio de 1 km y mapa
-- explorable en todo el país.
--
--  A. Una alerta permanece activa (y en el mapa) máximo 1 hora desde que
--     se reportó; luego se CIERRA automáticamente (status = 'resolved',
--     cierre_automatico = true). Nunca se borra: queda en el historial,
--     en la auditoría y en los reportes.
--  B. "Cerca de ti" = 1 km (antes 5 km). Las consultas del mapa ignoran
--     también lo vencido aunque la tarea programada aún no haya corrido.
--  C. Explorar el mapa: área visible de hasta ~220 km por lado.
-- Idempotente.
-- =====================================================================

alter table public.alerts add column if not exists cierre_automatico boolean not null default false;

-- ---------------------------------------------------------------------
-- A. Cierre automático
-- ---------------------------------------------------------------------
create or replace function public.cerrar_alertas_vencidas(p_avisar boolean default true)
returns int language plpgsql security definer set search_path = public
as $$
declare
  v_ids uuid[];
begin
  perform set_config('app.cambio_autorizado', 'on', true);
  if not p_avisar then
    perform set_config('app.sin_aviso', 'on', true);   -- sin push (cierre del atraso inicial)
  end if;

  with cerradas as (
    update public.alerts
       set status = 'resolved', cierre_automatico = true
     where status in ('open', 'ack')
       and created_at < now() - interval '1 hour'
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from cerradas;

  if cardinality(v_ids) > 0 then
    update public.alert_status_history
       set note = 'Cierre automático: 1 hora desde el reporte'
     where alert_id = any(v_ids) and new_status = 'resolved' and note is null and changed_by is null;
  end if;

  perform set_config('app.sin_aviso', 'off', true);
  perform set_config('app.cambio_autorizado', 'off', true);
  return cardinality(v_ids);
end;
$$;
revoke all on function public.cerrar_alertas_vencidas(boolean) from public, anon, authenticated;

-- El aviso a la Edge Function se omite cuando se pide expresamente
create or replace function public.notificar_alerta_webhook()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_url text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  if current_setting('app.sin_aviso', true) = 'on' then
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

-- Tarea programada cada minuto (pg_cron, si el proyecto lo tiene)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'cerrar-alertas-vencidas';
    perform cron.schedule('cerrar-alertas-vencidas', '* * * * *', 'select public.cerrar_alertas_vencidas()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- B/C. Consultas del mapa: solo vigentes (≤ 1 h), radio 1 km por defecto
-- ---------------------------------------------------------------------
create or replace function public.alertas_cercanas(p_lat double precision, p_lng double precision,
                                                   p_radio_m int default 1000)
returns table (id uuid, type_code text, description text, severity int, lat double precision,
               lng double precision, status text, media_urls text[], created_at timestamptz,
               updated_at timestamptz, resolved_at timestamptz, es_propia boolean, distancia_m int)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_radio double precision := least(greatest(coalesce(p_radio_m, 1000), 100), 5000);
  v_uid uuid := auth.uid();
  v_staff boolean := public.es_colaborador();
begin
  if v_uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'ubicacion_invalida' using errcode = '22023';
  end if;

  if public.hay_postgis() then
    return query execute $q$
      select a.id, a.type_code::text, a.description, a.severity::int, a.lat, a.lng, a.status::text,
             case when a.user_id = $4 or $5 then a.media_urls else '{}'::text[] end,
             a.created_at, a.updated_at, a.resolved_at, a.user_id = $4,
             round(st_distance(a.geom, st_setsrid(st_makepoint($2, $1), 4326)::geography))::int
      from public.alerts a
      where a.status in ('open', 'ack')
        and a.created_at > now() - interval '1 hour'
        and st_dwithin(a.geom, st_setsrid(st_makepoint($2, $1), 4326)::geography, $3)
      order by 13, a.created_at desc
      limit 300 $q$
    using p_lat, p_lng, v_radio, v_uid, v_staff;
  else
    return query
      select a.id, a.type_code::text, a.description, a.severity::int, a.lat, a.lng, a.status::text,
             case when a.user_id = v_uid or v_staff then a.media_urls else '{}'::text[] end,
             a.created_at, a.updated_at, a.resolved_at, a.user_id = v_uid,
             round(public.distancia_m(p_lat, p_lng, a.lat, a.lng))::int
      from public.alerts a
      where a.status in ('open', 'ack')
        and a.created_at > now() - interval '1 hour'
        and a.lat between p_lat - v_radio / 110000.0 and p_lat + v_radio / 110000.0
        and a.lng between p_lng - v_radio / (110000.0 * greatest(cos(radians(p_lat)), 0.01))
                      and p_lng + v_radio / (110000.0 * greatest(cos(radians(p_lat)), 0.01))
        and public.distancia_m(p_lat, p_lng, a.lat, a.lng) <= v_radio
      order by 13, a.created_at desc
      limit 300;
  end if;
end;
$$;

create or replace function public.alertas_en_area(p_sur double precision, p_oeste double precision,
                                                  p_norte double precision, p_este double precision)
returns table (id uuid, type_code text, description text, severity int, lat double precision,
               lng double precision, status text, media_urls text[], created_at timestamptz,
               updated_at timestamptz, resolved_at timestamptz, es_propia boolean, distancia_m int)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_staff boolean := public.es_colaborador();
begin
  if v_uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  if p_sur is null or p_norte is null or p_oeste is null or p_este is null
     or p_sur >= p_norte or p_oeste >= p_este
     or p_sur < -90 or p_norte > 90 or p_oeste < -180 or p_este > 180 then
    raise exception 'area_invalida' using errcode = '22023';
  end if;
  if p_norte - p_sur > 2 or p_este - p_oeste > 2 then
    raise exception 'area_muy_grande' using errcode = '22023',
      hint = 'Acerca el mapa para ver las alertas de esa zona.';
  end if;

  if public.hay_postgis() then
    return query execute $q$
      select a.id, a.type_code::text, a.description, a.severity::int, a.lat, a.lng, a.status::text,
             case when a.user_id = $5 or $6 then a.media_urls else '{}'::text[] end,
             a.created_at, a.updated_at, a.resolved_at, a.user_id = $5, null::int
      from public.alerts a
      where a.status in ('open', 'ack')
        and a.created_at > now() - interval '1 hour'
        and a.geom && st_makeenvelope($2, $1, $4, $3, 4326)::geography
        and a.lat between $1 and $3 and a.lng between $2 and $4
      order by a.created_at desc
      limit 500 $q$
    using p_sur, p_oeste, p_norte, p_este, v_uid, v_staff;
  else
    return query
      select a.id, a.type_code::text, a.description, a.severity::int, a.lat, a.lng, a.status::text,
             case when a.user_id = v_uid or v_staff then a.media_urls else '{}'::text[] end,
             a.created_at, a.updated_at, a.resolved_at, a.user_id = v_uid, null::int
      from public.alerts a
      where a.status in ('open', 'ack')
        and a.created_at > now() - interval '1 hour'
        and a.lat between p_sur and p_norte and a.lng between p_oeste and p_este
      order by a.created_at desc
      limit 500;
  end if;
end;
$$;

-- Compatibilidad (web publicada hasta el merge): 1 km de la última ubicación
create or replace function public.alertas_activas_publicas()
returns table (id uuid, type_code text, description text, severity int, lat double precision,
               lng double precision, status text, media_urls text[], created_at timestamptz,
               updated_at timestamptz, resolved_at timestamptz, es_propia boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_lat double precision;
  v_lng double precision;
begin
  if public.es_colaborador() then
    return query
      select a.id, a.type_code::text, a.description, a.severity::int, a.lat::double precision,
             a.lng::double precision, a.status::text, a.media_urls, a.created_at, a.updated_at,
             a.resolved_at, a.user_id = auth.uid()
      from public.alerts a where a.status in ('open', 'ack') order by a.created_at desc;
    return;
  end if;
  select u.lat, u.lng into v_lat, v_lng
    from public.ubicaciones_usuario u
   where u.user_id = auth.uid() and u.lat is not null and u.actualizado_at > now() - interval '24 hours';
  if v_lat is null then
    return;
  end if;
  return query
    select c.id, c.type_code, c.description, c.severity, c.lat, c.lng, c.status, c.media_urls,
           c.created_at, c.updated_at, c.resolved_at, c.es_propia
    from public.alertas_cercanas(v_lat, v_lng, 1000) c;
end;
$$;

revoke all on function public.alertas_cercanas(double precision, double precision, int),
                       public.alertas_en_area(double precision, double precision, double precision, double precision),
                       public.alertas_activas_publicas()
  from public, anon;
grant execute on function public.alertas_cercanas(double precision, double precision, int),
                          public.alertas_en_area(double precision, double precision, double precision, double precision),
                          public.alertas_activas_publicas()
  to authenticated;
