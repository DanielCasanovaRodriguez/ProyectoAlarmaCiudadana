-- =====================================================================
-- Alerta Ciudadana — Paso 13: proximidad real (5 km)
--
-- Problema: alertas_activas_publicas() devolvía TODAS las alertas activas
-- del país y la app las contaba como "cerca de ti" (una persona en
-- Medellín veía las 24 de Bogotá).
--
-- Regla: lo automático (mapa inicial, contador, listado, avisos) es lo que
-- está a ≤ 5 km de la ubicación real del usuario, medido con coordenadas.
-- Explorar el mapa a mano muestra lo del área visible (con límite).
--
-- Cálculo: con PostGIS (producción) ST_DWithin/ST_Distance sobre
-- geography — distancia geodésica exacta y el índice GiST alerts_geom_idx.
-- Sin PostGIS (pruebas locales) bounding box + Haversine. Idempotente.
-- =====================================================================

-- Índice para el respaldo sin PostGIS (y para el filtro por recuadro)
create index if not exists idx_alerts_activas_latlng on public.alerts (lat, lng)
  where status in ('open', 'ack');

create or replace function public.hay_postgis()
returns boolean language sql stable set search_path = public
as $$ select exists (select 1 from pg_extension where extname = 'postgis') $$;

-- ---------------------------------------------------------------------
-- Alertas activas a ≤ p_radio_m (máximo 5000 m) de un punto
-- ---------------------------------------------------------------------
create or replace function public.alertas_cercanas(p_lat double precision, p_lng double precision,
                                                   p_radio_m int default 5000)
returns table (id uuid, type_code text, description text, severity int, lat double precision,
               lng double precision, status text, media_urls text[], created_at timestamptz,
               updated_at timestamptz, resolved_at timestamptz, es_propia boolean, distancia_m int)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_radio double precision := least(greatest(coalesce(p_radio_m, 5000), 100), 5000);
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
        and a.lat between p_lat - v_radio / 110000.0 and p_lat + v_radio / 110000.0
        and a.lng between p_lng - v_radio / (110000.0 * greatest(cos(radians(p_lat)), 0.01))
                      and p_lng + v_radio / (110000.0 * greatest(cos(radians(p_lat)), 0.01))
        and public.distancia_m(p_lat, p_lng, a.lat, a.lng) <= v_radio
      order by 13, a.created_at desc
      limit 300;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Exploración manual: alertas activas dentro del área visible del mapa.
-- Límite de tamaño (≈ 55 km por lado) para no descargar el país entero.
-- ---------------------------------------------------------------------
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
  if p_norte - p_sur > 0.5 or p_este - p_oeste > 0.5 then
    raise exception 'area_muy_grande' using errcode = '22023',
      hint = 'Acerca el mapa para buscar alertas en esa zona.';
  end if;

  if public.hay_postgis() then
    return query execute $q$
      select a.id, a.type_code::text, a.description, a.severity::int, a.lat, a.lng, a.status::text,
             case when a.user_id = $5 or $6 then a.media_urls else '{}'::text[] end,
             a.created_at, a.updated_at, a.resolved_at, a.user_id = $5, null::int
      from public.alerts a
      where a.status in ('open', 'ack')
        and a.geom && st_makeenvelope($2, $1, $4, $3, 4326)::geography
        and a.lat between $1 and $3 and a.lng between $2 and $4
      order by a.created_at desc
      limit 300 $q$
    using p_sur, p_oeste, p_norte, p_este, v_uid, v_staff;
  else
    return query
      select a.id, a.type_code::text, a.description, a.severity::int, a.lat, a.lng, a.status::text,
             case when a.user_id = v_uid or v_staff then a.media_urls else '{}'::text[] end,
             a.created_at, a.updated_at, a.resolved_at, a.user_id = v_uid, null::int
      from public.alerts a
      where a.status in ('open', 'ack')
        and a.lat between p_sur and p_norte and a.lng between p_oeste and p_este
      order by a.created_at desc
      limit 300;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Compatibilidad: la función anterior (la usa la web publicada hasta que
-- se despliegue la versión nueva) deja de devolver todo el país.
-- Personal: todas. Ciudadano: ≤ 5 km de su última ubicación reportada
-- (últimas 24 h); sin ubicación reciente, ninguna.
-- ---------------------------------------------------------------------
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
    from public.alertas_cercanas(v_lat, v_lng, 5000) c;
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
revoke all on function public.hay_postgis() from public, anon, authenticated;
