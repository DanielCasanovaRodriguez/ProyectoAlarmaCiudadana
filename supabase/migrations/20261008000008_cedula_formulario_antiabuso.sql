-- =====================================================================
-- Alerta Ciudadana — Paso 8
--   A. Cédula por formulario (número + fecha de expedición) con UNICIDAD
--      REAL: restricción UNIQUE verificada dentro de la misma transacción
--      en que Supabase Auth crea el usuario.
--   B. Acceso con cédula (lo usa la Edge Function acceso-cedula):
--      búsqueda por huella, intentos y bloqueo temporal anti fuerza bruta.
--   C. Antiabuso de alertas: límite de envío, alertas falsas y bloqueo.
--   D. Endurecimiento señalado por el analizador.
-- Idempotente. Reemplaza el escaneo de cédula (las tablas anteriores
-- se conservan como histórico; ya no se usan).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilidades de cédula (solo servidor)
-- ---------------------------------------------------------------------
create or replace function public.normalizar_cedula(p text)
returns text language plpgsql immutable set search_path = public
as $$
declare v text := ltrim(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '0');
begin
  if char_length(v) not between 5 and 10 or v ~ '^(\d)\1+$' then
    raise exception 'El número de cédula no es válido' using errcode = '22023';
  end if;
  return v;
end;
$$;

create or replace function public.validar_fecha_expedicion(p date)
returns date language plpgsql stable set search_path = public
as $$
begin
  if p is null then
    raise exception 'La fecha de expedición es obligatoria' using errcode = '22023';
  end if;
  if p > current_date then
    raise exception 'La fecha de expedición no puede ser futura' using errcode = '22023';
  end if;
  if p < date '1940-01-01' then
    raise exception 'La fecha de expedición no es válida' using errcode = '22023';
  end if;
  return p;
end;
$$;

create or replace function public.huella_cedula(p_normalizada text)
returns text language sql stable security definer set search_path = public
as $$ select encode(extensions.hmac(p_normalizada, private.secreto('identidad_pepper'), 'sha256'), 'hex') $$;

revoke all on function public.normalizar_cedula(text), public.validar_fecha_expedicion(date),
                       public.huella_cedula(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- A. Tabla de cédulas: una cédula = una cuenta (UNIQUE real)
-- ---------------------------------------------------------------------
create table if not exists public.cedulas (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  numero_hash              text not null,
  numero_cifrado           bytea not null,
  ultimos_digitos          text not null,
  fecha_expedicion_cifrada bytea,          -- null solo en cuentas migradas que aún no la registran
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint cedulas_numero_hash_unico unique (numero_hash)
);
alter table public.cedulas enable row level security;
revoke all on public.cedulas from anon, authenticated;
grant select on public.cedulas to authenticated;
drop policy if exists cedula_propia on public.cedulas;
create policy cedula_propia on public.cedulas for select to authenticated using (user_id = auth.uid());

-- Cédulas ya registradas con el sistema anterior (sin fecha: se pedirá)
insert into public.cedulas (user_id, numero_hash, numero_cifrado, ultimos_digitos, created_at)
select v.user_id, v.numero_hash, v.numero_cifrado, v.ultimos_digitos, v.created_at
from public.verificaciones_identidad v
where v.estado <> 'rechazada'
on conflict do nothing;

-- Registro: Supabase Auth inserta en auth.users. Estos triggers toman la
-- cédula de los metadatos del registro, la validan, la QUITAN de los
-- metadatos (no queda en texto plano) y la guardan cifrada. Si la cédula ya
-- existe, el registro completo se revierte (no se crea el usuario).
create or replace function public.registro_validar_cedula()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  m      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_num  text;
  v_fecha date;
  v_hash text;
begin
  if not (m ? 'cedula') then
    return new;  -- personal creado por un administrador, cuentas antiguas
  end if;

  v_num := public.normalizar_cedula(m ->> 'cedula');
  begin
    v_fecha := (m ->> 'fecha_expedicion')::date;
  exception when others then
    raise exception 'La fecha de expedición no es válida' using errcode = '22023';
  end;
  perform public.validar_fecha_expedicion(v_fecha);
  v_hash := public.huella_cedula(v_num);

  -- Una cédula reservada por una cuenta que nunca confirmó su correo en
  -- 24 h se libera (evita que alguien "secuestre" la cédula de otra persona).
  delete from auth.users u
  using public.cedulas c
  where c.numero_hash = v_hash and c.user_id = u.id
    and u.email_confirmed_at is null and u.created_at < now() - interval '24 hours';

  if exists (select 1 from public.cedulas where numero_hash = v_hash) then
    raise exception 'cedula_no_disponible' using errcode = '23505';
  end if;

  perform set_config('app.cedula_registro', json_build_object('n', v_num, 'f', v_fecha)::text, true);
  new.raw_user_meta_data := m - 'cedula' - 'fecha_expedicion';
  return new;
end;
$$;

create or replace function public.registro_guardar_cedula()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v   text := nullif(current_setting('app.cedula_registro', true), '');
  d   jsonb;
  llave text;
begin
  if v is null then return null; end if;
  d := v::jsonb;
  llave := private.secreto('identidad_llave');
  -- La restricción UNIQUE resuelve registros simultáneos: el segundo falla y
  -- su usuario no se crea.
  insert into public.cedulas (user_id, numero_hash, numero_cifrado, ultimos_digitos, fecha_expedicion_cifrada)
  values (new.id, public.huella_cedula(d ->> 'n'),
          extensions.pgp_sym_encrypt(d ->> 'n', llave), right(d ->> 'n', 4),
          extensions.pgp_sym_encrypt(d ->> 'f', llave));
  perform set_config('app.cedula_registro', '', true);
  insert into public.auditoria (usuario_id, accion, entidad, entidad_id, detalle)
  values (new.id, 'registro', 'cedulas', new.id, jsonb_build_object('ultimos_digitos', right(d ->> 'n', 4)));
  return null;
end;
$$;

revoke execute on function public.registro_validar_cedula(), public.registro_guardar_cedula()
  from public, anon, authenticated;

drop trigger if exists trg_a_registro_validar_cedula on auth.users;
create trigger trg_a_registro_validar_cedula
  before insert on auth.users for each row execute function public.registro_validar_cedula();
drop trigger if exists trg_b_registro_guardar_cedula on auth.users;
create trigger trg_b_registro_guardar_cedula
  after insert on auth.users for each row execute function public.registro_guardar_cedula();

-- Cuentas existentes sin cédula (o sin fecha): la registran desde la app
create or replace function public.registrar_mi_cedula(p_numero text, p_fecha date)
returns table (ultimos_digitos text)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_num  text;
  v_hash text;
  v_prev public.cedulas;
  llave  text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión' using errcode = '42501'; end if;
  v_num := public.normalizar_cedula(p_numero);
  perform public.validar_fecha_expedicion(p_fecha);
  v_hash := public.huella_cedula(v_num);
  llave := private.secreto('identidad_llave');

  select * into v_prev from public.cedulas c where c.user_id = v_uid;
  if found then
    if v_prev.numero_hash <> v_hash then
      raise exception 'Tu cuenta ya tiene otra cédula registrada. Para cambiarla, contacta a soporte' using errcode = '22023';
    end if;
    update public.cedulas set fecha_expedicion_cifrada = extensions.pgp_sym_encrypt(p_fecha::text, llave),
                              updated_at = now()
    where user_id = v_uid;
  else
    begin
      insert into public.cedulas (user_id, numero_hash, numero_cifrado, ultimos_digitos, fecha_expedicion_cifrada)
      values (v_uid, v_hash, extensions.pgp_sym_encrypt(v_num, llave), right(v_num, 4),
              extensions.pgp_sym_encrypt(p_fecha::text, llave));
    exception when unique_violation then
      raise exception 'No fue posible registrar esa cédula. Si crees que alguien la está usando, contacta a soporte' using errcode = '23505';
    end;
  end if;

  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (v_uid, auth.jwt() ->> 'email', 'registrar_cedula', 'cedulas', v_uid, jsonb_build_object('ultimos_digitos', right(v_num, 4)));
  return query select right(v_num, 4);
end;
$$;

create or replace function public.mi_cedula()
returns table (ultimos_digitos text, completa boolean)
language sql stable security definer set search_path = public
as $$
  select c.ultimos_digitos, c.fecha_expedicion_cifrada is not null
  from public.cedulas c where c.user_id = auth.uid()
$$;

-- Administración (soporte): listado, ver número (queda auditado) y liberar
create or replace function public.admin_listar_cedulas()
returns table (user_id uuid, nombres text, apellidos text, email text, ultimos_digitos text,
               completa boolean, estado_cuenta text, reportes_falsos int, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(public.rol_actual(), '') not in ('admin', 'auditor') then
    raise exception 'Solo administradores o auditores' using errcode = '42501';
  end if;
  return query
    select c.user_id, p.nombres, p.apellidos, u.email::text, c.ultimos_digitos,
           c.fecha_expedicion_cifrada is not null, p.status, coalesce(p.reportes_falsos, 0), c.created_at
    from public.cedulas c
    join public.profiles p on p.id = c.user_id
    left join auth.users u on u.id = c.user_id
    order by c.created_at desc;
end;
$$;

create or replace function public.admin_ver_cedula(p_user_id uuid)
returns table (numero text, fecha_expedicion text)
language plpgsql security definer set search_path = public
as $$
declare llave text := private.secreto('identidad_llave');
begin
  if not public.es_admin() then
    raise exception 'Solo administradores pueden ver el número de cédula' using errcode = '42501';
  end if;
  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id)
  values (auth.uid(), auth.jwt() ->> 'email', 'ver_cedula', 'cedulas', p_user_id);
  return query
    select extensions.pgp_sym_decrypt(c.numero_cifrado, llave),
           case when c.fecha_expedicion_cifrada is null then null
                else extensions.pgp_sym_decrypt(c.fecha_expedicion_cifrada, llave) end
    from public.cedulas c where c.user_id = p_user_id;
end;
$$;

-- Caso de suplantación: suspende la cuenta y libera la cédula
create or replace function public.admin_liberar_cedula(p_user_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Indica el motivo' using errcode = '22023';
  end if;
  delete from public.cedulas where user_id = p_user_id;
  update public.profiles set status = 'suspended', updated_at = now() where id = p_user_id;
  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (auth.uid(), auth.jwt() ->> 'email', 'liberar_cedula', 'cedulas', p_user_id, jsonb_build_object('motivo', p_motivo));
end;
$$;

-- ---------------------------------------------------------------------
-- B. Acceso con cédula (solo la Edge Function, con service_role)
-- ---------------------------------------------------------------------
create table if not exists private.intentos_acceso (
  id          bigint generated always as identity primary key,
  cedula_hash text,
  ip_hash     text,
  exito       boolean not null,
  creado_at   timestamptz not null default now()
);
create index if not exists ix_intentos_cedula on private.intentos_acceso (cedula_hash, creado_at);
create index if not exists ix_intentos_ip     on private.intentos_acceso (ip_hash, creado_at);
revoke all on private.intentos_acceso from public, anon, authenticated;

-- Límites: 5 fallos por cédula o 20 por IP en 15 minutos → bloqueo de 15 minutos
create or replace function public.acceso_preparar(p_numero text, p_ip text)
returns table (user_id uuid, bloqueado_segundos int)
language plpgsql security definer set search_path = public
as $$
declare
  v_hash text;
  v_ip   text := encode(extensions.hmac(coalesce(p_ip, ''), private.secreto('identidad_pepper'), 'sha256'), 'hex');
  v_ultimo timestamptz;
  v_uid  uuid;
begin
  begin
    v_hash := public.huella_cedula(public.normalizar_cedula(p_numero));
  exception when others then
    v_hash := null;
  end;

  select max(creado_at) into v_ultimo from (
    select creado_at from private.intentos_acceso
    where cedula_hash = v_hash and not exito and creado_at > now() - interval '15 minutes'
    order by creado_at desc offset 4 limit 1
  ) t;
  if v_ultimo is null then
    select max(creado_at) into v_ultimo from (
      select creado_at from private.intentos_acceso
      where ip_hash = v_ip and not exito and creado_at > now() - interval '15 minutes'
      order by creado_at desc offset 19 limit 1
    ) t;
  end if;
  if v_ultimo is not null then
    return query select null::uuid, greatest(1, extract(epoch from (v_ultimo + interval '15 minutes' - now()))::int);
    return;
  end if;

  select c.user_id into v_uid
  from public.cedulas c join public.profiles p on p.id = c.user_id
  where c.numero_hash = v_hash and p.status = 'active';
  return query select v_uid, 0;
end;
$$;

create or replace function public.acceso_resultado(p_numero text, p_ip text, p_exito boolean, p_user_id uuid default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_hash text;
  v_ip   text := encode(extensions.hmac(coalesce(p_ip, ''), private.secreto('identidad_pepper'), 'sha256'), 'hex');
begin
  begin
    v_hash := public.huella_cedula(public.normalizar_cedula(p_numero));
  exception when others then
    v_hash := null;
  end;
  insert into private.intentos_acceso (cedula_hash, ip_hash, exito) values (v_hash, v_ip, p_exito);
  if p_exito then
    delete from private.intentos_acceso where cedula_hash = v_hash and not exito;
  end if;
  insert into public.auditoria (usuario_id, accion, entidad, entidad_id, detalle, ip_origen)
  values (p_user_id, case when p_exito then 'acceso_cedula' else 'acceso_cedula_fallido' end,
          'auth', p_user_id, null, left(v_ip, 16));
  delete from private.intentos_acceso where creado_at < now() - interval '2 days';
end;
$$;

revoke all on function public.acceso_preparar(text, text), public.acceso_resultado(text, text, boolean, uuid)
  from public, anon, authenticated;
do $$ begin
  execute 'grant execute on function public.acceso_preparar(text, text), public.acceso_resultado(text, text, boolean, uuid) to service_role';
exception when undefined_object then null; end $$;

-- ---------------------------------------------------------------------
-- C. Antiabuso de alertas
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists reportes_falsos int not null default 0;
alter table public.alerts   add column if not exists marcada_falsa boolean not null default false;
create index if not exists ix_alerts_user_created on public.alerts (user_id, created_at desc);

-- Para reportar: personal siempre; ciudadano con cédula completa, cuenta
-- activa y sin bloqueo temporal.
create or replace function public.puede_reportar()
returns boolean language sql stable security definer set search_path = public
as $$
  select public.es_staff() or exists (
    select 1 from public.cedulas c
    join public.profiles p on p.id = c.user_id
    where c.user_id = auth.uid()
      and c.fecha_expedicion_cifrada is not null
      and p.status = 'active'
      and (p.bloqueado_hasta is null or p.bloqueado_hasta < now()))
$$;

-- Límite de envío para ciudadanos: 1 por minuto, 3 en 10 minutos, 10 al día
create or replace function public.limitar_alertas()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  n_min int; n_10 int; n_dia int;
begin
  if public.es_staff() or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return new;
  end if;
  select count(*) filter (where created_at > now() - interval '1 minute'),
         count(*) filter (where created_at > now() - interval '10 minutes'),
         count(*) filter (where created_at > now() - interval '24 hours')
    into n_min, n_10, n_dia
  from public.alerts where user_id = new.user_id and created_at > now() - interval '24 hours';

  if n_min >= 1 or n_10 >= 3 or n_dia >= 10 then
    -- El rechazo revierte la transacción (una fila de auditoría se perdería):
    -- queda en el log del servidor (Supabase → Logs → Postgres).
    raise log 'limite_alertas usuario=% ultimo_minuto=% ultimos_10_min=% ultimas_24_h=%', new.user_id, n_min, n_10, n_dia;
    raise exception 'Enviaste varias alertas en poco tiempo. Espera unos minutos. Si es una emergencia, llama a la Línea 123'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.limitar_alertas() from public, anon, authenticated;
drop trigger if exists trg_a1_limitar_alertas on public.alerts;
create trigger trg_a1_limitar_alertas before insert on public.alerts
  for each row execute function public.limitar_alertas();

-- El personal marca una alerta como falsa: se cierra, cuenta para el autor
-- y 3 falsas en 30 días bloquean sus reportes 7 días.
create or replace function public.marcar_alerta_falsa(p_alert_id uuid, p_nota text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_autor uuid;
  v_falsas int;
begin
  if not public.es_staff() then
    raise exception 'Solo operadores o administradores' using errcode = '42501';
  end if;
  select user_id into v_autor from public.alerts where id = p_alert_id;
  if v_autor is null then raise exception 'La alerta no existe' using errcode = 'P0002'; end if;

  perform set_config('app.cambio_autorizado', 'on', true);
  update public.alerts set marcada_falsa = true, updated_at = now() where id = p_alert_id;
  perform set_config('app.cambio_autorizado', 'off', true);
  perform public.cambiar_estado_alerta(p_alert_id, 'resolved', coalesce(nullif(trim(p_nota), ''), 'Reporte falso'));

  select count(*) into v_falsas from public.alerts
  where user_id = v_autor and marcada_falsa and created_at > now() - interval '30 days';
  perform set_config('app.cambio_autorizado', 'on', true);
  update public.profiles set reportes_falsos = v_falsas,
    bloqueado_hasta = case when v_falsas >= 3 then now() + interval '7 days' else bloqueado_hasta end
  where id = v_autor;
  perform set_config('app.cambio_autorizado', 'off', true);

  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (auth.uid(), auth.jwt() ->> 'email', 'marcar_falsa', 'alerts', p_alert_id,
          jsonb_build_object('autor', v_autor, 'falsas_30_dias', v_falsas, 'bloqueado', v_falsas >= 3));
end;
$$;

-- Estado del ciudadano para la app: cédula, bloqueo y motivo
create or replace function public.mi_estado_reporte()
returns table (puede_reportar boolean, bloqueado_hasta timestamptz, reportes_falsos int)
language sql stable security definer set search_path = public
as $$
  select public.puede_reportar(), p.bloqueado_hasta, coalesce(p.reportes_falsos, 0)
  from public.profiles p where p.id = auth.uid()
$$;

-- Protección de campos del perfil (ajuste del paso 1):
--  · INSERT (alta por Supabase Auth): siempre 'citizen', como antes.
--  · UPDATE: se permite a admin, service_role, conexiones directas de
--    confianza (SQL Editor; no traen request.jwt.claims) y funciones del
--    servidor que lo autorizan (p. ej. marcar_alerta_falsa).
create or replace function public.proteger_campos_perfil()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  es_servidor boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if es_servidor or public.es_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and (coalesce(current_setting('request.jwt.claims', true), '') = ''
                           or current_setting('app.cambio_autorizado', true) = 'on') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role   := 'citizen';
    new.status := 'active';
    new.intentos_fallidos := 0;
    new.bloqueado_hasta   := null;
  else
    new.role              := old.role;
    new.status            := old.status;
    new.intentos_fallidos := old.intentos_fallidos;
    new.bloqueado_hasta   := old.bloqueado_hasta;
    new.reportes_falsos   := old.reportes_falsos;
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_campos_perfil() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- D. Endurecimiento (analizador de Supabase)
-- ---------------------------------------------------------------------
alter function public.distancia_m(double precision, double precision, double precision, double precision)
  set search_path = public;
revoke execute on function public.get_my_role() from authenticated;  -- ninguna política la usa

-- Permisos de las funciones nuevas
revoke all on function public.registrar_mi_cedula(text, date), public.mi_cedula(),
                       public.admin_listar_cedulas(), public.admin_ver_cedula(uuid),
                       public.admin_liberar_cedula(uuid, text), public.marcar_alerta_falsa(uuid, text),
                       public.mi_estado_reporte()
  from public, anon;
grant execute on function public.registrar_mi_cedula(text, date), public.mi_cedula(),
                          public.admin_listar_cedulas(), public.admin_ver_cedula(uuid),
                          public.admin_liberar_cedula(uuid, text), public.marcar_alerta_falsa(uuid, text),
                          public.mi_estado_reporte()
  to authenticated;

-- El escaneo de cédula queda retirado: su función ya no se puede llamar
-- desde la app (las verificaciones anteriores se conservan como histórico).
revoke execute on function public.registrar_identidad(text, text, text, boolean, boolean, jsonb, text, text)
  from public, anon, authenticated;
