-- =====================================================================
-- Alerta Ciudadana — Paso 4: correcciones del analizador de seguridad
-- de Supabase (`supabase db advisors`, 2026-09-25). Idempotente.
-- =====================================================================

-- 1. Funciones heredadas SECURITY DEFINER que cualquiera (incluso sin
--    sesión) podía llamar por /rest/v1/rpc y que se saltan RLS para leer
--    evidencias de cualquier alerta. La app no las usa.
revoke execute on function public.get_alert_media(uuid)   from public, anon, authenticated;
revoke execute on function public.count_alert_media(uuid) from public, anon, authenticated;
revoke execute on function public.alert_has_videos(uuid)  from public, anon, authenticated;

-- 2. Funciones de trigger: no deben poder invocarse como RPC.
--    (Los triggers siguen funcionando: el permiso EXECUTE no se revisa al dispararse.)
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;
revoke execute on function public.log_alert_changes()          from public, anon, authenticated;
revoke execute on function public.log_status_change()          from public, anon, authenticated;
revoke execute on function public.proteger_campos_perfil()     from public, anon, authenticated;
revoke execute on function public.proteger_campos_alerta()     from public, anon, authenticated;
revoke execute on function public.set_geom_from_latlng()       from public, anon, authenticated;
revoke execute on function public.set_updated_at()             from public, anon, authenticated;
revoke execute on function public.actualizar_updated_at()      from public, anon, authenticated;

-- 3. get_my_role (usada por políticas antiguas) no debe ser pública.
revoke execute on function public.get_my_role() from public, anon;
grant  execute on function public.get_my_role() to authenticated;

-- 4. search_path fijo (evita secuestro de funciones por esquema).
alter function public.log_status_change()          set search_path = public;
alter function public.log_alert_changes()          set search_path = public;
alter function public.crear_perfil_nuevo_usuario() set search_path = public;
alter function public.set_updated_at()             set search_path = public;
alter function public.actualizar_updated_at()      set search_path = public;
alter function public.set_geom_from_latlng()       set search_path = public, extensions;
alter function public.alerts_near(double precision, double precision, integer) set search_path = public, extensions;
alter function public.get_alert_media(uuid)        set search_path = public;
alter function public.count_alert_media(uuid)      set search_path = public;
alter function public.alert_has_videos(uuid)       set search_path = public;

-- 5. El trigger de alta de usuarios ignora el rol enviado por el cliente
--    (defensa en profundidad además de trg_proteger_campos_perfil).
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, status, intentos_fallidos, created_at, updated_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'),
          'citizen', 'active', 0, now(), now())
  on conflict (id) do nothing;
  return new;
exception when others then
  raise log 'Error en trigger perfil, usuario %: %', new.id, sqlerrm;
  return new; -- no cancelar el registro
end;
$$;
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;

-- 6. spatial_ref_sys (catálogo de PostGIS, sin datos de usuarios): se
--    intenta activar RLS con lectura pública; si la tabla pertenece a la
--    extensión y no se puede, se deja constancia sin fallar.
do $$
begin
  execute 'alter table public.spatial_ref_sys enable row level security';
  execute 'drop policy if exists srs_lectura on public.spatial_ref_sys';
  execute 'create policy srs_lectura on public.spatial_ref_sys for select using (true)';
exception when insufficient_privilege then
  raise notice 'spatial_ref_sys pertenece a PostGIS; no se pudo activar RLS (sin datos sensibles).';
end $$;
