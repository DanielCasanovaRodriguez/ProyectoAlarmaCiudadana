-- =====================================================================
-- Alerta Ciudadana — Paso 10: interventoría (2026-10-08)
--   A. Validación de alertas en el servidor (solo Colombia, longitudes,
--      evidencias propias, campos internos que el ciudadano no fija).
--   B. Protección de "marcada_falsa" frente al autor de la alerta.
--   C. Se retira la subida de fotos de cédula (función eliminada en v1.3.0).
--   D. Prueba de la autorización de tratamiento de datos (Ley 1581 de 2012,
--      art. 9; Decreto 1377 de 2013, art. 8 —compilado en el Decreto 1074
--      de 2015—): versión y fecha aceptadas, con auditoría.
--   E. Canal para ejercer los derechos del titular (consultas: 10 días
--      hábiles, art. 14; reclamos: 15 días hábiles, art. 15).
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Validación de alertas
-- ---------------------------------------------------------------------
-- Evidencias: solo rutas de esta misma alerta en el bucket "evidencias"
-- (formato actual "alertas/<id>/<archivo>" o la URL pública antigua).
create or replace function public.evidencias_validas(p_alert_id uuid, p_urls text[])
returns boolean language sql immutable set search_path = public
as $$
  select coalesce(bool_and(
           u ~ ('^(https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/evidencias/)?alertas/'
                || p_alert_id::text || '/[A-Za-z0-9._-]{1,120}$')), true)
  from unnest(coalesce(p_urls, '{}')) as u
$$;

-- Territorio colombiano (continental e insular: San Andrés y Providencia,
-- Leticia, Puerto Carreño). Margen pequeño por la precisión del GPS.
create or replace function public.dentro_de_colombia(p_lat double precision, p_lng double precision)
returns boolean language sql immutable set search_path = public
as $$
  select p_lat between -4.30 and 13.60 and p_lng between -82.00 and -66.80
$$;

create or replace function public.validar_alerta()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  -- Solicitudes de la app (API): llevan request.jwt.claims. Las conexiones
  -- directas de confianza (SQL Editor, tareas del servidor) no se limitan.
  desde_api boolean := coalesce(current_setting('request.jwt.claims', true), '') <> ''
                       and coalesce(auth.jwt() ->> 'role', '') <> 'service_role';
begin
  -- Descripción: sin espacios sobrantes, vacía = null, máximo 1000 caracteres
  new.description := nullif(btrim(new.description), '');
  if char_length(new.description) > 1000 then
    raise exception 'descripcion_larga' using errcode = '22001',
      hint = 'La descripción admite máximo 1000 caracteres.';
  end if;

  if cardinality(coalesce(new.media_urls, '{}')) > 10 then
    raise exception 'demasiadas_evidencias' using errcode = '22023',
      hint = 'Máximo 10 archivos por alerta.';
  end if;
  if not public.evidencias_validas(new.id, new.media_urls) then
    raise exception 'evidencia_invalida' using errcode = '22023',
      hint = 'Las evidencias deben subirse desde la app.';
  end if;

  if not desde_api then
    return new;
  end if;

  if new.lat is null or new.lng is null or new.lat not between -90 and 90 or new.lng not between -180 and 180 then
    raise exception 'ubicacion_invalida' using errcode = '22023';
  end if;
  if (tg_op = 'INSERT' or new.lat is distinct from old.lat or new.lng is distinct from old.lng)
     and not public.dentro_de_colombia(new.lat, new.lng) then
    raise exception 'fuera_de_colombia' using errcode = '22023',
      hint = 'Alerta Ciudadana solo recibe reportes ubicados en Colombia.';
  end if;

  -- Alta por un ciudadano: los campos internos los fija el servidor
  if tg_op = 'INSERT' and not public.es_staff() then
    new.user_id              := auth.uid();
    new.status               := 'open';
    new.created_at           := now();
    new.updated_at           := now();
    new.ack_at               := null;
    new.resolved_at          := null;
    new.operador_asignado_id := null;
    new.marcada_falsa        := false;
  end if;
  return new;
end;
$$;
revoke execute on function public.validar_alerta() from public, anon, authenticated;

drop trigger if exists trg_a00_validar_alerta on public.alerts;
create trigger trg_a00_validar_alerta
  before insert or update on public.alerts
  for each row execute function public.validar_alerta();

-- ---------------------------------------------------------------------
-- B. El autor no puede quitar (ni poner) la marca de alerta falsa
-- ---------------------------------------------------------------------
create or replace function public.proteger_campos_alerta()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true), '') = ''   -- conexión directa de confianza
     or public.es_staff()
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or current_setting('app.cambio_autorizado', true) = 'on' then
    return new;
  end if;
  -- Ciudadano: solo puede modificar descripción, media_urls y updated_at
  new.user_id              := old.user_id;
  new.type_code            := old.type_code;
  new.severity             := old.severity;
  new.lat                  := old.lat;
  new.lng                  := old.lng;
  new.status               := old.status;
  new.anonimo              := old.anonimo;
  new.operador_asignado_id := old.operador_asignado_id;
  new.ack_at               := old.ack_at;
  new.resolved_at          := old.resolved_at;
  new.created_at           := old.created_at;
  new.marcada_falsa        := old.marcada_falsa;
  return new;
end;
$$;
revoke execute on function public.proteger_campos_alerta() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- C. Sin subida de documentos de identidad (el escaneo se retiró)
-- ---------------------------------------------------------------------
drop policy if exists documentos_insert_propios on storage.objects;

-- ---------------------------------------------------------------------
-- D. Autorización de tratamiento de datos (prueba de la aceptación)
-- ---------------------------------------------------------------------
create or replace function public.aceptar_politica(p_version text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'version_invalida' using errcode = '22023';
  end if;
  perform set_config('app.cambio_autorizado', 'on', true);
  update public.profiles
     set consentimiento_version = p_version, consentimiento_fecha = now()
   where id = v_uid;
  perform set_config('app.cambio_autorizado', 'off', true);
  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (v_uid, auth.jwt() ->> 'email', 'acepta_politica', 'profiles', v_uid,
          jsonb_build_object('version', p_version));
end;
$$;

-- El titular no fija a mano la fecha de su autorización (solo vía la función)
create or replace function public.proteger_consentimiento()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true), '') = ''
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or current_setting('app.cambio_autorizado', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.consentimiento_version := null;
    new.consentimiento_fecha   := null;
  else
    new.consentimiento_version := old.consentimiento_version;
    new.consentimiento_fecha   := old.consentimiento_fecha;
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_consentimiento() from public, anon, authenticated;
drop trigger if exists trg_proteger_consentimiento on public.profiles;
create trigger trg_proteger_consentimiento
  before insert or update on public.profiles
  for each row execute function public.proteger_consentimiento();

-- ---------------------------------------------------------------------
-- E. Solicitudes del titular (habeas data)
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes_titular (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  tipo          text not null check (tipo in ('consulta', 'actualizacion', 'rectificacion',
                                              'supresion', 'revocatoria', 'queja')),
  mensaje       text not null check (char_length(mensaje) between 10 and 2000),
  estado        text not null default 'recibida' check (estado in ('recibida', 'en_tramite', 'respondida', 'cerrada')),
  respuesta     text check (char_length(respuesta) <= 4000),
  creada_en     timestamptz not null default now(),
  fecha_limite  date not null,
  respondida_en timestamptz,
  respondida_por uuid references auth.users(id) on delete set null
);
create index if not exists idx_solicitudes_usuario on public.solicitudes_titular (user_id, creada_en desc);
create index if not exists idx_solicitudes_estado  on public.solicitudes_titular (estado, fecha_limite);
alter table public.solicitudes_titular enable row level security;

drop policy if exists solicitudes_propias on public.solicitudes_titular;
create policy solicitudes_propias on public.solicitudes_titular for select to authenticated
  using (user_id = auth.uid() or public.rol_actual() in ('admin', 'auditor'));
revoke all on public.solicitudes_titular from anon;
revoke insert, update, delete on public.solicitudes_titular from authenticated;
grant select on public.solicitudes_titular to authenticated;

-- Suma días hábiles (lunes a viernes). No descuenta festivos: el plazo que
-- calcula es igual o MÁS CORTO que el legal, nunca más largo.
create or replace function public.sumar_dias_habiles(p_desde date, p_dias int)
returns date language plpgsql immutable set search_path = public
as $$
declare d date := p_desde; n int := 0;
begin
  while n < p_dias loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  return d;
end;
$$;

create or replace function public.crear_solicitud_titular(p_tipo text, p_mensaje text)
returns table (id uuid, fecha_limite date)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg text := btrim(p_mensaje);
  v_lim date;
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  if p_tipo not in ('consulta', 'actualizacion', 'rectificacion', 'supresion', 'revocatoria', 'queja') then
    raise exception 'tipo_invalido' using errcode = '22023';
  end if;
  if char_length(coalesce(v_msg, '')) not between 10 and 2000 then
    raise exception 'mensaje_invalido' using errcode = '22023',
      hint = 'Describe tu solicitud (entre 10 y 2000 caracteres).';
  end if;
  if (select count(*) from public.solicitudes_titular s
       where s.user_id = v_uid and s.estado in ('recibida', 'en_tramite')) >= 5 then
    raise exception 'demasiadas_solicitudes' using errcode = 'P0001',
      hint = 'Ya tienes 5 solicitudes en trámite. Espera la respuesta antes de enviar otra.';
  end if;
  -- Consultas: 10 días hábiles (art. 14). Reclamos: 15 días hábiles (art. 15).
  v_lim := public.sumar_dias_habiles((now() at time zone 'America/Bogota')::date,
                                     case when p_tipo = 'consulta' then 10 else 15 end);
  insert into public.solicitudes_titular (user_id, tipo, mensaje, fecha_limite)
  values (v_uid, p_tipo, v_msg, v_lim)
  returning solicitudes_titular.id into v_id;
  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (v_uid, auth.jwt() ->> 'email', 'solicitud_titular', 'solicitudes_titular', v_id,
          jsonb_build_object('tipo', p_tipo, 'fecha_limite', v_lim));
  return query select v_id, v_lim;
end;
$$;

create or replace function public.admin_responder_solicitud(p_id uuid, p_estado text, p_respuesta text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
  if p_estado not in ('en_tramite', 'respondida', 'cerrada') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;
  if p_estado in ('respondida', 'cerrada') and char_length(btrim(coalesce(p_respuesta, ''))) < 10 then
    raise exception 'respuesta_requerida' using errcode = '22023',
      hint = 'Escribe la respuesta que recibirá el titular.';
  end if;
  update public.solicitudes_titular
     set estado = p_estado,
         respuesta = coalesce(nullif(btrim(p_respuesta), ''), respuesta),
         respondida_en = case when p_estado in ('respondida', 'cerrada') then now() else respondida_en end,
         respondida_por = case when p_estado in ('respondida', 'cerrada') then auth.uid() else respondida_por end
   where id = p_id;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (auth.uid(), auth.jwt() ->> 'email', 'responder_solicitud', 'solicitudes_titular', p_id,
          jsonb_build_object('estado', p_estado));
end;
$$;

revoke all on function public.aceptar_politica(text), public.crear_solicitud_titular(text, text),
                       public.admin_responder_solicitud(uuid, text, text)
  from public, anon;
grant execute on function public.aceptar_politica(text), public.crear_solicitud_titular(text, text),
                          public.admin_responder_solicitud(uuid, text, text)
  to authenticated;
