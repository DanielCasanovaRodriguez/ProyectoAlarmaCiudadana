-- =====================================================================
-- Alerta Ciudadana — Paso 1: lógica de negocio centralizada en la BD
--
-- Web y Android llaman a estas funciones (RPC) en lugar de repetir la
-- lógica en cada cliente. Es un cambio aditivo: no borra ni altera datos.
-- Idempotente: se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ayudantes de rol. SECURITY DEFINER + search_path fijo evita la
-- "recursión infinita" que aparece cuando una política de `profiles`
-- consulta la propia tabla `profiles`.
-- ---------------------------------------------------------------------
create or replace function public.rol_actual()
returns text
language sql stable security definer set search_path = public
as $$
  select role::text from public.profiles
  where id = auth.uid() and status = 'active'
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.rol_actual() = 'admin', false) $$;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.rol_actual() in ('operator', 'admin'), false) $$;

create or replace function public.es_colaborador()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.rol_actual() in ('operator', 'admin', 'auditor'), false) $$;

revoke all on function public.rol_actual(), public.es_admin(), public.es_staff(), public.es_colaborador() from public, anon;
grant execute on function public.rol_actual(), public.es_admin(), public.es_staff(), public.es_colaborador() to authenticated;

-- ---------------------------------------------------------------------
-- Protección de campos sensibles de `profiles`.
-- Un usuario puede editar su nombre/teléfono/consentimiento, pero NO su
-- rol, estado ni contadores de bloqueo. Al registrarse siempre queda como
-- 'citizen' aunque envíe otro rol en los metadatos de signUp.
-- Solo un admin (o el service_role del servidor) puede cambiarlos.
-- ---------------------------------------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  es_servidor boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if es_servidor or public.es_admin() then
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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_perfil on public.profiles;
create trigger trg_proteger_campos_perfil
  before insert or update on public.profiles
  for each row execute function public.proteger_campos_perfil();

-- ---------------------------------------------------------------------
-- Alertas activas para el mapa ciudadano, SIN user_id.
-- Protege el anonimato: un ciudadano ve dónde hay alertas, no quién las creó.
-- ---------------------------------------------------------------------
create or replace function public.alertas_activas_publicas()
returns table (
  id uuid, type_code text, description text, severity int,
  lat double precision, lng double precision, status text,
  media_urls text[], created_at timestamptz, updated_at timestamptz,
  resolved_at timestamptz, es_propia boolean
)
language sql stable security definer set search_path = public
as $$
  select a.id, a.type_code::text, a.description, a.severity::int,
         a.lat::double precision, a.lng::double precision, a.status::text,
         case when a.user_id = auth.uid() or public.es_colaborador() then a.media_urls else '{}'::text[] end,
         a.created_at, a.updated_at, a.resolved_at,
         a.user_id = auth.uid()
  from public.alerts a
  where a.status in ('open', 'ack')
  order by a.created_at desc
$$;

revoke all on function public.alertas_activas_publicas() from public, anon;
grant execute on function public.alertas_activas_publicas() to authenticated;

-- ---------------------------------------------------------------------
-- ¿Ya existe un trigger en `alerts` que registre historial / auditoría?
-- (En producción: trg_alerts_status_history → log_status_change() y
--  trg_audit_alerts → log_alert_changes().) Evita registros duplicados.
-- ---------------------------------------------------------------------
create or replace function public._alerts_tiene_trigger(p_patron text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from information_schema.triggers
    where event_object_schema = 'public' and event_object_table = 'alerts'
      and (trigger_name ilike p_patron or action_statement ilike p_patron)
  )
$$;
revoke all on function public._alerts_tiene_trigger(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Cambio de estado de una alerta (operador / admin).
-- Valida la transición, fija ack_at / resolved_at, registra historial y
-- auditoría en una sola transacción. Antes esto lo hacía cada cliente.
-- ---------------------------------------------------------------------
create or replace function public.cambiar_estado_alerta(
  p_alert_id uuid,
  p_nuevo    text,
  p_nota     text default null
)
returns public.alerts
language plpgsql security definer set search_path = public
as $$
declare
  v_alerta  public.alerts;
  v_anterior text;
begin
  if not public.es_staff() then
    raise exception 'Solo operadores o administradores pueden cambiar el estado de una alerta'
      using errcode = '42501';
  end if;

  if p_nuevo not in ('open', 'ack', 'resolved') then
    raise exception 'Estado no válido: %', p_nuevo using errcode = '22023';
  end if;

  select * into v_alerta from public.alerts where id = p_alert_id for update;
  if not found then
    raise exception 'La alerta no existe' using errcode = 'P0002';
  end if;

  v_anterior := v_alerta.status::text;
  if v_anterior = p_nuevo then
    return v_alerta;
  end if;

  -- SQL dinámico con literales (%L): funciona tanto si `status` es text
  -- como si es un tipo enum en la base de datos.
  execute format(
    'update public.alerts a set
       status               = %L,
       updated_at           = now(),
       ack_at               = case when %L = ''ack'' and a.ack_at is null then now() else a.ack_at end,
       resolved_at          = case when %L = ''resolved'' then now() when %L = ''open'' then null else a.resolved_at end,
       operador_asignado_id = coalesce(a.operador_asignado_id, auth.uid())
     where a.id = $1
     returning *', p_nuevo, p_nuevo, p_nuevo, p_nuevo)
  into v_alerta using p_alert_id;

  -- Historial: si un trigger ya lo registró, solo se añade la nota;
  -- si no existe tal trigger, se inserta aquí.
  if public._alerts_tiene_trigger('%status_history%') or public._alerts_tiene_trigger('%log_status_change%') then
    if nullif(trim(p_nota), '') is not null then
      update public.alert_status_history set note = trim(p_nota)
      where id = (select max(id) from public.alert_status_history where alert_id = p_alert_id);
    end if;
  else
    execute format(
      'insert into public.alert_status_history (alert_id, old_status, new_status, changed_by, note)
       values ($1, %L, %L, $2, $3)', v_anterior, p_nuevo)
    using p_alert_id, auth.uid(), nullif(trim(p_nota), '');
  end if;

  -- Auditoría: solo si no existe ya un trigger de auditoría sobre alerts.
  if not (public._alerts_tiene_trigger('%audit%') or public._alerts_tiene_trigger('%log_alert_changes%')) then
    insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
    values (auth.uid(), auth.jwt() ->> 'email', 'cambiar_estado', 'alerts', p_alert_id,
            jsonb_build_object('de', v_anterior, 'a', p_nuevo, 'nota', p_nota));
  end if;

  return v_alerta;
end;
$$;

-- ---------------------------------------------------------------------
-- Cancelación por el ciudadano (solo su propia alerta y solo si está 'open').
-- ---------------------------------------------------------------------
create or replace function public.cancelar_alerta(p_alert_id uuid)
returns public.alerts
language plpgsql security definer set search_path = public
as $$
declare
  v_alerta public.alerts;
begin
  select * into v_alerta from public.alerts
  where id = p_alert_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'No se encontró la alerta o no tienes permiso para cancelarla' using errcode = '42501';
  end if;
  if v_alerta.status::text <> 'open' then
    raise exception 'Solo puedes cancelar alertas en estado Activa' using errcode = '22023';
  end if;

  perform set_config('app.cambio_autorizado', 'on', true);
  update public.alerts set status = 'resolved', resolved_at = now(), updated_at = now()
  where id = p_alert_id
  returning * into v_alerta;
  perform set_config('app.cambio_autorizado', 'off', true);

  if public._alerts_tiene_trigger('%status_history%') or public._alerts_tiene_trigger('%log_status_change%') then
    update public.alert_status_history set note = 'Cancelada por el ciudadano desde la aplicación'
    where id = (select max(id) from public.alert_status_history where alert_id = p_alert_id);
  else
    insert into public.alert_status_history (alert_id, old_status, new_status, changed_by, note)
    values (p_alert_id, 'open', 'resolved', auth.uid(), 'Cancelada por el ciudadano desde la aplicación');
  end if;

  return v_alerta;
end;
$$;

revoke all on function public.cambiar_estado_alerta(uuid, text, text), public.cancelar_alerta(uuid) from public, anon;
grant execute on function public.cambiar_estado_alerta(uuid, text, text), public.cancelar_alerta(uuid) to authenticated;
