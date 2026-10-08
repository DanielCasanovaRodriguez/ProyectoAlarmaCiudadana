-- =====================================================================
-- Alerta Ciudadana — Paso 11: supresión de datos a solicitud del titular
-- (Ley 1581 de 2012, art. 8 lit. e). El administrador la ejecuta desde el
-- panel; la constancia de la solicitud y de su respuesta se conserva sin
-- vínculo a la cuenta eliminada. Idempotente.
-- =====================================================================

-- La solicitud sobrevive a la cuenta (prueba de que se atendió)
alter table public.solicitudes_titular alter column user_id drop not null;
alter table public.solicitudes_titular drop constraint if exists solicitudes_titular_user_id_fkey;
alter table public.solicitudes_titular
  add constraint solicitudes_titular_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Rutas de las evidencias del titular (el panel las borra del Storage antes
-- de suprimir la cuenta: el Storage no permite borrar archivos desde SQL).
create or replace function public.admin_evidencias_titular(p_user_id uuid)
returns table (ruta text)
language sql stable security definer set search_path = public
as $$
  select regexp_replace(u, '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/evidencias/', '')
  from public.alerts a, unnest(coalesce(a.media_urls, '{}')) as u
  where a.user_id = p_user_id and public.es_admin()
$$;

create or replace function public.admin_suprimir_titular(p_user_id uuid, p_solicitud_id uuid, p_respuesta text)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare
  v_rol text;
begin
  if not public.es_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'no_permitido' using errcode = '42501', hint = 'No puedes suprimir tu propia cuenta.';
  end if;
  select role into v_rol from public.profiles where id = p_user_id;
  if v_rol is null then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_rol <> 'citizen' then
    raise exception 'no_permitido' using errcode = '42501',
      hint = 'Primero quita el rol de colaborador a esta cuenta.';
  end if;
  if char_length(btrim(coalesce(p_respuesta, ''))) < 10 then
    raise exception 'respuesta_requerida' using errcode = '22023';
  end if;
  if p_solicitud_id is not null and not exists (
       select 1 from public.solicitudes_titular s
        where s.id = p_solicitud_id and s.user_id = p_user_id and s.tipo in ('supresion', 'revocatoria')) then
    raise exception 'solicitud_invalida' using errcode = '22023';
  end if;

  -- Constancia antes de borrar (la fila queda con user_id null)
  if p_solicitud_id is not null then
    update public.solicitudes_titular
       set estado = 'cerrada', respuesta = btrim(p_respuesta), respondida_en = now(), respondida_por = auth.uid()
     where id = p_solicitud_id;
  end if;
  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (auth.uid(), auth.jwt() ->> 'email', 'suprimir_titular', 'profiles', p_user_id,
          jsonb_build_object('solicitud', p_solicitud_id,
                             'alertas', (select count(*) from public.alerts where user_id = p_user_id)));

  perform set_config('app.cambio_autorizado', 'on', true);
  delete from public.alert_status_history where changed_by = p_user_id;
  delete from public.alerts where user_id = p_user_id;          -- historial, evidencias (filas) y asignaciones en cascada
  -- Explícito (además de la cascada de auth.users) por si alguna FK cambia
  delete from public.emergency_contacts      where user_id = p_user_id;
  delete from public.device_tokens           where user_id = p_user_id;
  delete from public.notificaciones          where usuario_id = p_user_id;
  delete from public.ubicaciones_usuario     where user_id = p_user_id;
  delete from public.cedulas                 where user_id = p_user_id;
  delete from public.verificaciones_identidad where user_id = p_user_id;
  delete from auth.users where id = p_user_id;                  -- perfil, cédula, contactos, dispositivos, ubicación en cascada
  perform set_config('app.cambio_autorizado', 'off', true);
end;
$$;

revoke all on function public.admin_evidencias_titular(uuid), public.admin_suprimir_titular(uuid, uuid, text) from public, anon;
grant execute on function public.admin_evidencias_titular(uuid), public.admin_suprimir_titular(uuid, uuid, text) to authenticated;

-- Listado para el panel: solicitudes con datos básicos del titular
create or replace function public.admin_listar_solicitudes()
returns table (id uuid, user_id uuid, nombre text, email text, tipo text, mensaje text, estado text,
               respuesta text, creada_en timestamptz, fecha_limite date, respondida_en timestamptz)
language sql stable security definer set search_path = public, auth
as $$
  select s.id, s.user_id, p.full_name, u.email::text, s.tipo, s.mensaje, s.estado, s.respuesta,
         s.creada_en, s.fecha_limite, s.respondida_en
  from public.solicitudes_titular s
  left join public.profiles p on p.id = s.user_id
  left join auth.users u on u.id = s.user_id
  where public.rol_actual() in ('admin', 'auditor')
  order by (s.estado in ('recibida', 'en_tramite')) desc, s.fecha_limite, s.creada_en desc
$$;
revoke all on function public.admin_listar_solicitudes() from public, anon;
grant execute on function public.admin_listar_solicitudes() to authenticated;
