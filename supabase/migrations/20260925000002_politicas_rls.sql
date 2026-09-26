-- =====================================================================
-- Alerta Ciudadana — Paso 2: políticas de acceso (RLS) definitivas
--
-- ⚠ Reemplaza TODAS las políticas existentes de estas tablas por un
--   conjunto explícito y revisable. Antes de aplicar:
--   1. Ejecuta supabase/audit/00_inspeccion.sql (bloque 5) y guarda el
--      resultado: es la copia de seguridad de las políticas actuales.
--   2. Aplica primero 20260925000001_funciones_negocio.sql.
--
-- Roles: citizen (ciudadano), operator, admin, auditor (solo lectura).
-- =====================================================================

-- Elimina las políticas actuales de las tablas gestionadas aquí
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'profiles', 'alerts', 'alert_types', 'alert_media', 'alert_status_history',
      'emergency_contacts', 'device_tokens', 'notificaciones', 'auditoria',
      'asignaciones_unidad', 'cola_sincronizacion')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.profiles             enable row level security;
alter table public.alerts               enable row level security;
alter table public.alert_types          enable row level security;
alter table public.alert_media          enable row level security;
alter table public.alert_status_history enable row level security;
alter table public.emergency_contacts   enable row level security;
alter table public.device_tokens        enable row level security;
alter table public.notificaciones       enable row level security;
alter table public.auditoria            enable row level security;
alter table public.asignaciones_unidad  enable row level security;
alter table public.cola_sincronizacion  enable row level security;

-- Ningún acceso anónimo a datos del sistema
revoke all on public.profiles, public.alerts, public.alert_media, public.alert_status_history,
              public.emergency_contacts, public.device_tokens, public.notificaciones,
              public.auditoria, public.asignaciones_unidad, public.cola_sincronizacion
  from anon;

-- ---------------------------------------------------------------- profiles
-- El trigger trg_proteger_campos_perfil impide cambiar rol/estado/bloqueo.
create policy perfiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.es_colaborador());
create policy perfiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() or public.es_admin());
create policy perfiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

-- ------------------------------------------------------------------ alerts
-- Ciudadano: ve y crea las suyas. El mapa usa alertas_activas_publicas()
-- (sin user_id). Cambios de estado: cambiar_estado_alerta() / cancelar_alerta().
create policy alertas_select on public.alerts for select to authenticated
  using (user_id = auth.uid() or public.es_colaborador());
create policy alertas_insert on public.alerts for insert to authenticated
  with check ((user_id = auth.uid() and status::text = 'open') or public.es_staff());
-- El ciudadano solo puede adjuntar evidencias (media_urls) a su alerta abierta;
-- el resto de columnas lo protege el trigger de abajo.
create policy alertas_update on public.alerts for update to authenticated
  using (public.es_staff() or (user_id = auth.uid() and status::text = 'open'))
  with check (public.es_staff() or user_id = auth.uid());
create policy alertas_delete on public.alerts for delete to authenticated
  using (public.es_admin());

create or replace function public.proteger_campos_alerta()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if public.es_staff()
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     -- Marcado solo por funciones de confianza (p. ej. cancelar_alerta), local a la transacción.
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
-- Nombre con prefijo "trg_a0_" para ejecutarse ANTES que trg_alerts_status_history
-- (PostgreSQL ejecuta los triggers BEFORE en orden alfabético): así un intento
-- no autorizado de cambiar el estado no deja un registro falso en el historial.
drop trigger if exists trg_proteger_campos_alerta on public.alerts;
drop trigger if exists trg_a0_proteger_campos_alerta on public.alerts;
create trigger trg_a0_proteger_campos_alerta
  before update on public.alerts
  for each row execute function public.proteger_campos_alerta();

-- ------------------------------------------------------------- alert_types
create policy tipos_select on public.alert_types for select to anon, authenticated using (true);
create policy tipos_admin  on public.alert_types for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ------------------------------------------------------------- alert_media
create policy media_select on public.alert_media for select to authenticated
  using (public.es_colaborador() or exists (
    select 1 from public.alerts a where a.id = alert_id and a.user_id = auth.uid()));
create policy media_insert on public.alert_media for insert to authenticated
  with check (exists (
    select 1 from public.alerts a where a.id = alert_id and a.user_id = auth.uid()));

-- ---------------------------------------------------- alert_status_history
create policy historial_select on public.alert_status_history for select to authenticated
  using (public.es_colaborador() or exists (
    select 1 from public.alerts a where a.id = alert_id and a.user_id = auth.uid()));
create policy historial_insert on public.alert_status_history for insert to authenticated
  with check (public.es_staff());

-- ------------------------------------------------------ asignaciones_unidad
create policy asignaciones_select on public.asignaciones_unidad for select to authenticated
  using (public.es_colaborador() or exists (
    select 1 from public.alerts a where a.id = alerta_id and a.user_id = auth.uid()));
create policy asignaciones_insert on public.asignaciones_unidad for insert to authenticated
  with check (public.es_staff());

-- ------------------------------------------------------- emergency_contacts
create policy contactos_propios on public.emergency_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------ device_tokens
create policy tokens_propios on public.device_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------- notificaciones
create policy notif_select on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid());
create policy notif_update on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ---------------------------------------------------------------- auditoria
-- Solo lectura para admin/auditor; se escribe desde funciones SECURITY DEFINER
-- o por un admin (suspensión de usuarios).
create policy auditoria_select on public.auditoria for select to authenticated
  using (public.rol_actual() in ('admin', 'auditor'));
create policy auditoria_insert on public.auditoria for insert to authenticated
  with check (public.es_admin() and usuario_id = auth.uid());

-- ------------------------------------------------------ cola_sincronizacion
-- Sin uso en los clientes actuales: solo administradores.
create policy cola_admin on public.cola_sincronizacion for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
