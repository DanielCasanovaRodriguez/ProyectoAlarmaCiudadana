-- =====================================================================
-- Alerta Ciudadana — Paso 5
--   A. Nombres y apellidos separados (full_name se mantiene sincronizado)
--   B. Secretos del servidor (Vault de Supabase, con respaldo local)
--   C. Verificación de identidad con cédula de ciudadanía (una cuenta por cédula)
--   D. Ubicación para notificar alertas cercanas (1 km)
-- Idempotente.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- A. NOMBRES Y APELLIDOS
-- =====================================================================
alter table public.profiles add column if not exists nombres   text;
alter table public.profiles add column if not exists apellidos text;

do $$ begin
  alter table public.profiles add constraint profiles_nombres_len   check (char_length(nombres)   <= 80);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_apellidos_len check (char_length(apellidos) <= 80);
exception when duplicate_object then null; end $$;

create schema if not exists private;
revoke all on schema private from public;

-- Divide un nombre completo heredado: 1 palabra → nombre; 2 → 1+1;
-- 3 → 1 nombre + 2 apellidos; 4 o más → 2 nombres + resto apellidos.
create or replace function private.dividir_nombre(p text, out nombres text, out apellidos text)
language plpgsql immutable set search_path = public
as $$
declare
  t text[] := regexp_split_to_array(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'), ' ');
  n int := coalesce(array_length(t, 1), 0);
begin
  if trim(coalesce(p, '')) = '' then nombres := null; apellidos := null; return; end if;
  if n = 1 then nombres := t[1]; apellidos := null;
  elsif n = 2 then nombres := t[1]; apellidos := t[2];
  elsif n = 3 then nombres := t[1]; apellidos := array_to_string(t[2:3], ' ');
  else nombres := array_to_string(t[1:2], ' '); apellidos := array_to_string(t[3:n], ' ');
  end if;
end;
$$;

-- Mantiene full_name = nombres + apellidos (todo el código que lee full_name sigue igual).
-- Si un cliente antiguo solo envía full_name, se divide automáticamente.
create or replace function public.sincronizar_nombre_perfil()
returns trigger language plpgsql security definer set search_path = public
as $$
declare d record;
begin
  new.nombres   := nullif(regexp_replace(trim(coalesce(new.nombres, '')),   '\s+', ' ', 'g'), '');
  new.apellidos := nullif(regexp_replace(trim(coalesce(new.apellidos, '')), '\s+', ' ', 'g'), '');

  if tg_op = 'INSERT' then
    if new.nombres is null and new.apellidos is null and new.full_name is not null then
      select * into d from private.dividir_nombre(new.full_name);
      new.nombres := d.nombres; new.apellidos := d.apellidos;
    end if;
  elsif (new.nombres is distinct from old.nombres or new.apellidos is distinct from old.apellidos) then
    null; -- se editaron los campos separados: mandan ellos
  elsif new.full_name is distinct from old.full_name then
    select * into d from private.dividir_nombre(new.full_name);
    new.nombres := d.nombres; new.apellidos := d.apellidos;
  end if;

  if new.nombres is not null or new.apellidos is not null then
    new.full_name := nullif(trim(concat_ws(' ', new.nombres, new.apellidos)), '');
  end if;
  return new;
end;
$$;
revoke execute on function public.sincronizar_nombre_perfil() from public, anon, authenticated;

drop trigger if exists trg_b0_sincronizar_nombre on public.profiles;
create trigger trg_b0_sincronizar_nombre
  before insert or update on public.profiles
  for each row execute function public.sincronizar_nombre_perfil();

-- Datos existentes
update public.profiles p set nombres = d.nombres, apellidos = d.apellidos
from (select id, (private.dividir_nombre(full_name)).* from public.profiles) d
where p.id = d.id and p.nombres is null and p.apellidos is null and p.full_name is not null;

-- Alta de usuarios: nombres, apellidos y teléfono desde el registro (el rol
-- siempre es citizen; lo protege además trg_proteger_campos_perfil).
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_tel text := regexp_replace(coalesce(m->>'phone', ''), '\D', '', 'g');
begin
  insert into public.profiles (id, full_name, nombres, apellidos, phone, role, status, intentos_fallidos, created_at, updated_at)
  values (new.id,
          coalesce(nullif(trim(concat_ws(' ', m->>'nombres', m->>'apellidos')), ''), m->>'full_name', 'Usuario'),
          nullif(trim(m->>'nombres'), ''), nullif(trim(m->>'apellidos'), ''),
          case when char_length(v_tel) between 7 and 15 then v_tel end,
          'citizen', 'active', 0, now(), now())
  on conflict (id) do nothing;
  return new;
exception when others then
  raise log 'Error en trigger perfil, usuario %: %', new.id, sqlerrm;
  return new;
end;
$$;
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;

-- =====================================================================
-- B. SECRETOS DEL SERVIDOR
--    En Supabase se guardan en Vault (cifrado); si Vault no existe
--    (pruebas locales) se usa private.config. Nunca son accesibles
--    desde la API.
-- =====================================================================
create table if not exists private.config (clave text primary key, valor text not null);
revoke all on private.config from public, anon, authenticated;

create or replace function private.secreto(p_nombre text)
returns text language plpgsql stable security definer set search_path = public
as $$
declare v text;
begin
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v using 'ac_' || p_nombre;
  end if;
  if v is null then
    select valor into v from private.config where clave = p_nombre;
  end if;
  if v is null then raise exception 'Falta configurar el secreto %', p_nombre; end if;
  return v;
end;
$$;
revoke all on function private.secreto(text) from public, anon, authenticated;

do $$
declare
  s text;
  v_hay_vault boolean := exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'vault' and p.proname = 'create_secret');
begin
  foreach s in array array['identidad_pepper', 'identidad_llave', 'webhook_secret'] loop
    if v_hay_vault then
      if not exists (select 1 from vault.secrets where name = 'ac_' || s) then
        perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ac_' || s,
                                    'Alerta Ciudadana: ' || s);
      end if;
    elsif not exists (select 1 from private.config where clave = s) then
      insert into private.config values (s, encode(extensions.gen_random_bytes(32), 'hex'));
    end if;
  end loop;
end $$;

-- =====================================================================
-- C. VERIFICACIÓN DE IDENTIDAD
-- =====================================================================
create table if not exists public.verificaciones_identidad (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  tipo_documento    text not null default 'CC' check (tipo_documento = 'CC'),
  numero_hash       text not null,                 -- HMAC-SHA256: unicidad sin guardar el número
  numero_cifrado    bytea not null,                -- pgp_sym_encrypt: solo lo descifra un admin
  ultimos_digitos   text not null,                 -- para mostrar "••••1234"
  modelo_documento  text not null default 'desconocido' check (modelo_documento in ('amarilla', 'digital', 'desconocido')),
  metodo_lectura    text not null check (metodo_lectura in ('pdf417', 'mrz', 'manual')),
  coincide_numero   boolean not null default false, -- el número leído del documento = el digitado
  coincide_nombre   boolean not null default false, -- nombres del documento = los del registro
  datos_documento   bytea,                         -- cifrado: datos leídos del documento
  frente_path       text not null,
  reverso_path      text not null,
  estado            text not null default 'pendiente' check (estado in ('pendiente', 'verificada', 'rechazada')),
  motivo_rechazo    text,
  revisado_por      uuid references auth.users(id) on delete set null,
  revisado_at       timestamptz,
  intentos          int not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Una cédula = una cuenta (las rechazadas liberan el número)
create unique index if not exists uq_identidad_numero_activa
  on public.verificaciones_identidad (numero_hash) where estado <> 'rechazada';
create index if not exists ix_identidad_estado on public.verificaciones_identidad (estado, created_at);

alter table public.verificaciones_identidad enable row level security;
revoke all on public.verificaciones_identidad from anon, authenticated;
grant select on public.verificaciones_identidad to authenticated;  -- filas limitadas por RLS

drop policy if exists identidad_select on public.verificaciones_identidad;
create policy identidad_select on public.verificaciones_identidad for select to authenticated
  using (user_id = auth.uid() or public.rol_actual() in ('admin', 'auditor'));

-- Bucket privado para fotos del documento
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-identidad', 'documentos-identidad', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documentos_insert_propios on storage.objects;
drop policy if exists documentos_select_admin   on storage.objects;
drop policy if exists documentos_delete_admin   on storage.objects;
-- Subir: solo a la carpeta propia <user_id>/...
create policy documentos_insert_propios on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-identidad' and (storage.foldername(name))[1] = auth.uid()::text);
-- Ver: solo administradores (ni el propio usuario vuelve a descargarlas)
create policy documentos_select_admin on storage.objects for select to authenticated
  using (bucket_id = 'documentos-identidad' and public.es_admin());
create policy documentos_delete_admin on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-identidad' and public.es_admin());

-- Registrar (o reenviar) la verificación del usuario actual
create or replace function public.registrar_identidad(
  p_numero          text,
  p_modelo          text,
  p_metodo          text,
  p_coincide_numero boolean,
  p_coincide_nombre boolean,
  p_datos           jsonb,
  p_frente          text,
  p_reverso         text
)
returns table (estado text, ultimos_digitos text)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_num   text := ltrim(regexp_replace(coalesce(p_numero, ''), '\D', '', 'g'), '0');
  v_hash  text;
  v_prev  public.verificaciones_identidad;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para verificar tu identidad' using errcode = '42501';
  end if;
  if char_length(v_num) not between 5 and 10 then
    raise exception 'El número de cédula no es válido: debe tener entre 5 y 10 dígitos' using errcode = '22023';
  end if;
  if p_metodo not in ('pdf417', 'mrz', 'manual') or coalesce(p_modelo, 'desconocido') not in ('amarilla', 'digital', 'desconocido') then
    raise exception 'Datos de lectura del documento no válidos' using errcode = '22023';
  end if;
  if p_frente not like v_uid::text || '/%' or p_reverso not like v_uid::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'documentos-identidad' and o.name = p_frente)
     or not exists (select 1 from storage.objects o where o.bucket_id = 'documentos-identidad' and o.name = p_reverso) then
    raise exception 'No se encontraron las fotos de la cédula. Vuelve a tomarlas' using errcode = '22023';
  end if;

  v_hash := encode(extensions.hmac(v_num, private.secreto('identidad_pepper'), 'sha256'), 'hex');

  if exists (select 1 from public.verificaciones_identidad v
             where v.numero_hash = v_hash and v.user_id <> v_uid and v.estado <> 'rechazada') then
    raise exception 'Esta cédula ya está registrada en otra cuenta. Si crees que es un error, contacta a soporte'
      using errcode = '23505';
  end if;

  select * into v_prev from public.verificaciones_identidad v where v.user_id = v_uid;
  if found and v_prev.estado = 'verificada' then
    raise exception 'Tu identidad ya está verificada' using errcode = '22023';
  end if;
  if found and v_prev.intentos >= 5 then
    raise exception 'Superaste el número de intentos de verificación. Contacta a soporte' using errcode = '22023';
  end if;

  insert into public.verificaciones_identidad as v (
    user_id, numero_hash, numero_cifrado, ultimos_digitos, modelo_documento, metodo_lectura,
    coincide_numero, coincide_nombre, datos_documento, frente_path, reverso_path, estado)
  values (
    v_uid, v_hash,
    extensions.pgp_sym_encrypt(v_num, private.secreto('identidad_llave')),
    right(v_num, 4), coalesce(p_modelo, 'desconocido'), p_metodo,
    coalesce(p_coincide_numero, false), coalesce(p_coincide_nombre, false),
    case when p_datos is null then null
         else extensions.pgp_sym_encrypt(p_datos::text, private.secreto('identidad_llave')) end,
    p_frente, p_reverso, 'pendiente')
  on conflict (user_id) do update set
    numero_hash = excluded.numero_hash, numero_cifrado = excluded.numero_cifrado,
    ultimos_digitos = excluded.ultimos_digitos, modelo_documento = excluded.modelo_documento,
    metodo_lectura = excluded.metodo_lectura, coincide_numero = excluded.coincide_numero,
    coincide_nombre = excluded.coincide_nombre, datos_documento = excluded.datos_documento,
    frente_path = excluded.frente_path, reverso_path = excluded.reverso_path,
    estado = 'pendiente', motivo_rechazo = null, revisado_por = null, revisado_at = null,
    intentos = v.intentos + 1, updated_at = now();

  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (v_uid, auth.jwt() ->> 'email', 'registrar_identidad', 'verificaciones_identidad', v_uid,
          jsonb_build_object('metodo', p_metodo, 'modelo', p_modelo,
                             'coincide_numero', p_coincide_numero, 'coincide_nombre', p_coincide_nombre));

  return query select 'pendiente'::text, right(v_num, 4);
end;
$$;

-- Estado de verificación del usuario actual
create or replace function public.mi_identidad()
returns table (estado text, ultimos_digitos text, motivo_rechazo text, intentos int, actualizado_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select v.estado, v.ultimos_digitos, v.motivo_rechazo, v.intentos, v.updated_at
  from public.verificaciones_identidad v where v.user_id = auth.uid()
$$;

-- ¿Puede el usuario actual reportar alertas? (personal: siempre; ciudadano:
-- con verificación enviada y no rechazada)
create or replace function public.puede_reportar()
returns boolean language sql stable security definer set search_path = public
as $$
  select public.es_staff() or exists (
    select 1 from public.verificaciones_identidad v
    where v.user_id = auth.uid() and v.estado in ('pendiente', 'verificada'))
$$;

-- Administración: listado, detalle (descifrado) y revisión
create or replace function public.admin_listar_identidades(p_estado text default null)
returns table (user_id uuid, nombres text, apellidos text, email text, estado text,
               ultimos_digitos text, modelo_documento text, metodo_lectura text,
               coincide_numero boolean, coincide_nombre boolean, intentos int,
               motivo_rechazo text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(public.rol_actual(), '') not in ('admin', 'auditor') then
    raise exception 'Solo administradores o auditores pueden ver las verificaciones' using errcode = '42501';
  end if;
  return query
    select v.user_id, p.nombres, p.apellidos, u.email::text, v.estado, v.ultimos_digitos,
           v.modelo_documento, v.metodo_lectura, v.coincide_numero, v.coincide_nombre,
           v.intentos, v.motivo_rechazo, v.created_at, v.updated_at
    from public.verificaciones_identidad v
    join public.profiles p on p.id = v.user_id
    left join auth.users u on u.id = v.user_id
    where p_estado is null or v.estado = p_estado
    order by (v.estado = 'pendiente') desc, v.updated_at desc;
end;
$$;

create or replace function public.admin_detalle_identidad(p_user_id uuid)
returns table (numero text, datos_documento jsonb, frente_path text, reverso_path text, estado text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores pueden ver el número de documento' using errcode = '42501';
  end if;
  return query
    select extensions.pgp_sym_decrypt(v.numero_cifrado, private.secreto('identidad_llave')),
           case when v.datos_documento is null then null
                else extensions.pgp_sym_decrypt(v.datos_documento, private.secreto('identidad_llave'))::jsonb end,
           v.frente_path, v.reverso_path, v.estado
    from public.verificaciones_identidad v where v.user_id = p_user_id;
end;
$$;

create or replace function public.revisar_identidad(p_user_id uuid, p_estado text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores pueden revisar verificaciones' using errcode = '42501';
  end if;
  if p_estado not in ('verificada', 'rechazada') then
    raise exception 'Estado de revisión no válido' using errcode = '22023';
  end if;
  if p_estado = 'rechazada' and nullif(trim(p_motivo), '') is null then
    raise exception 'Indica el motivo del rechazo' using errcode = '22023';
  end if;
  update public.verificaciones_identidad set
    estado = p_estado, motivo_rechazo = case when p_estado = 'rechazada' then trim(p_motivo) end,
    revisado_por = auth.uid(), revisado_at = now(), updated_at = now()
  where user_id = p_user_id;
  if not found then
    raise exception 'No existe una verificación para ese usuario' using errcode = 'P0002';
  end if;
  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (auth.uid(), auth.jwt() ->> 'email', 'revisar_identidad', 'verificaciones_identidad', p_user_id,
          jsonb_build_object('estado', p_estado, 'motivo', p_motivo));
end;
$$;

-- Reportar alertas exige verificación enviada (ciudadanos)
drop policy if exists alertas_insert on public.alerts;
create policy alertas_insert on public.alerts for insert to authenticated
  with check ((user_id = auth.uid() and status::text = 'open' and public.puede_reportar()) or public.es_staff());

-- =====================================================================
-- D. UBICACIÓN PARA ALERTAS CERCANAS
--    Solo la última ubicación conocida (redondeada a ~100 m), enviada
--    mientras la app está abierta. Nadie más puede leerla.
-- =====================================================================
create table if not exists public.ubicaciones_usuario (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  lat                double precision check (lat between -90 and 90),
  lng                double precision check (lng between -180 and 180),
  precision_m        int,
  actualizado_at     timestamptz,
  notificar_cercanas boolean not null default true,
  radio_m            int not null default 1000 check (radio_m between 200 and 5000)
);
alter table public.ubicaciones_usuario enable row level security;
revoke all on public.ubicaciones_usuario from anon, authenticated;
grant select on public.ubicaciones_usuario to authenticated;       -- solo la propia (RLS)
drop policy if exists ubicacion_propia on public.ubicaciones_usuario;
create policy ubicacion_propia on public.ubicaciones_usuario for select to authenticated
  using (user_id = auth.uid());

create or replace function public.distancia_m(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.actualizar_mi_ubicacion(p_lat double precision, p_lng double precision, p_precision_m int default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode = '42501'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación no válida' using errcode = '22023';
  end if;
  insert into public.ubicaciones_usuario as u (user_id, lat, lng, precision_m, actualizado_at)
  values (auth.uid(), round(p_lat::numeric, 3), round(p_lng::numeric, 3), p_precision_m, now())
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng,
    precision_m = excluded.precision_m, actualizado_at = now();
end;
$$;

create or replace function public.configurar_alertas_cercanas(p_activar boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode = '42501'; end if;
  insert into public.ubicaciones_usuario as u (user_id, notificar_cercanas)
  values (auth.uid(), coalesce(p_activar, true))
  on conflict (user_id) do update set notificar_cercanas = coalesce(p_activar, true);
end;
$$;

-- Destinatarios de una alerta nueva: usuarios activos a <= radio de su
-- última ubicación reciente, con avisos activados, excepto quien la reportó.
-- Solo la usa el servidor (Edge Function con service_role).
create or replace function public.usuarios_cercanos(p_alert_id uuid, p_radio_m int default 1000, p_horas int default 24)
returns table (user_id uuid, distancia_m int)
language sql stable security definer set search_path = public
as $$
  with a as (select id, user_id, lat, lng from public.alerts where id = p_alert_id)
  select u.user_id, round(public.distancia_m(a.lat, a.lng, u.lat, u.lng))::int
  from a
  join public.ubicaciones_usuario u
    on u.user_id <> a.user_id
   and u.notificar_cercanas
   and u.lat is not null
   and u.actualizado_at > now() - make_interval(hours => greatest(p_horas, 1))
   and u.lat between a.lat - p_radio_m / 111320.0 and a.lat + p_radio_m / 111320.0
   and u.lng between a.lng - p_radio_m / (111320.0 * greatest(cos(radians(a.lat)), 0.01))
                 and a.lng + p_radio_m / (111320.0 * greatest(cos(radians(a.lat)), 0.01))
  join public.profiles p on p.id = u.user_id and p.status = 'active'
  where public.distancia_m(a.lat, a.lng, u.lat, u.lng) <= least(p_radio_m, u.radio_m)
$$;

-- Detalle público de una alerta (abrir una notificación de alerta cercana).
-- Sin user_id ni evidencias; solo alertas activas o de las últimas 48 h.
create or replace function public.detalle_alerta_publica(p_alert_id uuid)
returns table (id uuid, type_code text, description text, severity int, lat double precision,
               lng double precision, status text, created_at timestamptz, updated_at timestamptz,
               es_propia boolean, distancia_m int)
language sql stable security definer set search_path = public
as $$
  select a.id, a.type_code::text, a.description, a.severity::int, a.lat, a.lng, a.status::text,
         a.created_at, a.updated_at, a.user_id = auth.uid(),
         case when u.lat is not null then round(public.distancia_m(a.lat, a.lng, u.lat, u.lng))::int end
  from public.alerts a
  left join public.ubicaciones_usuario u on u.user_id = auth.uid()
  where a.id = p_alert_id
    and auth.uid() is not null
    and (a.status::text in ('open', 'ack') or a.created_at > now() - interval '48 hours')
$$;

-- Permisos de ejecución
revoke all on function public.registrar_identidad(text, text, text, boolean, boolean, jsonb, text, text),
                       public.mi_identidad(), public.puede_reportar(),
                       public.admin_listar_identidades(text), public.admin_detalle_identidad(uuid),
                       public.revisar_identidad(uuid, text, text),
                       public.actualizar_mi_ubicacion(double precision, double precision, int),
                       public.configurar_alertas_cercanas(boolean),
                       public.detalle_alerta_publica(uuid),
                       public.usuarios_cercanos(uuid, int, int)
  from public, anon;
grant execute on function public.registrar_identidad(text, text, text, boolean, boolean, jsonb, text, text),
                          public.mi_identidad(), public.puede_reportar(),
                          public.admin_listar_identidades(text), public.admin_detalle_identidad(uuid),
                          public.revisar_identidad(uuid, text, text),
                          public.actualizar_mi_ubicacion(double precision, double precision, int),
                          public.configurar_alertas_cercanas(boolean),
                          public.detalle_alerta_publica(uuid)
  to authenticated;
-- usuarios_cercanos: solo el servidor
revoke execute on function public.usuarios_cercanos(uuid, int, int) from authenticated;
do $$ begin
  execute 'grant execute on function public.usuarios_cercanos(uuid, int, int) to service_role';
exception when undefined_object then null; end $$;

-- =====================================================================
-- E. Ajuste de la protección de alertas (migración 2): solo limita las
--    solicitudes que llegan por la API (llevan request.jwt.claims). Las
--    conexiones directas de confianza (SQL Editor, tareas del servidor)
--    pueden corregir datos. En perfiles NO se aplica esta excepción: el
--    registro de usuarios de Supabase Auth también llega sin claims.
-- =====================================================================
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
  -- Ciudadano: solo puede modificar media_urls y updated_at
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
  return new;
end;
$$;
revoke execute on function public.proteger_campos_alerta() from public, anon, authenticated;

-- =====================================================================
-- F. Registro de dispositivos para notificaciones push
--    Un token pertenece a una sola cuenta: si otra persona inicia sesión
--    en el mismo celular, deja de recibir los avisos de la anterior.
-- =====================================================================
create or replace function public.registrar_dispositivo(p_token text, p_plataforma text default 'android')
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode = '42501'; end if;
  if coalesce(char_length(p_token), 0) not between 20 and 4096 or p_plataforma not in ('android', 'ios', 'web') then
    raise exception 'Token de dispositivo no válido' using errcode = '22023';
  end if;
  delete from public.device_tokens where token = p_token and user_id is distinct from auth.uid();
  if not exists (select 1 from public.device_tokens where token = p_token and user_id = auth.uid()) then
    insert into public.device_tokens (user_id, platform, token) values (auth.uid(), p_plataforma, p_token);
  end if;
end;
$$;

create or replace function public.eliminar_dispositivo(p_token text)
returns void language sql security definer set search_path = public
as $$ delete from public.device_tokens where token = p_token and user_id = auth.uid() $$;

revoke all on function public.registrar_dispositivo(text, text), public.eliminar_dispositivo(text) from public, anon;
grant execute on function public.registrar_dispositivo(text, text), public.eliminar_dispositivo(text) to authenticated;
