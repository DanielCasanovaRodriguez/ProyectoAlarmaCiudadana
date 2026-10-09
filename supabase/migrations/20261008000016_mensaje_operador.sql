-- =====================================================================
-- Alerta Ciudadana — Paso 16: mensajes del personal al ciudadano.
-- Antes el botón "Enviar mensaje al ciudadano" solo mostraba un aviso en
-- pantalla y no enviaba nada. Ahora el mensaje queda en la bandeja del
-- ciudadano (lo ve en el detalle de su alerta) y le llega como push.
-- Idempotente.
-- =====================================================================
create or replace function public.enviar_mensaje_ciudadano(p_alert_id uuid, p_mensaje text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_autor uuid;
  v_tipo  text;
  v_msg   text := btrim(coalesce(p_mensaje, ''));
  v_url   text;
begin
  if not public.es_staff() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
  if char_length(v_msg) not between 3 and 300 then
    raise exception 'mensaje_invalido' using errcode = '22023',
      hint = 'El mensaje debe tener entre 3 y 300 caracteres.';
  end if;
  select user_id, type_code into v_autor, v_tipo from public.alerts where id = p_alert_id;
  if v_autor is null then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  -- Límite: 10 mensajes por alerta (evita insistencia o errores repetidos)
  if (select count(*) from public.notificaciones
       where alerta_id = p_alert_id and usuario_id = v_autor and titulo = 'Mensaje sobre tu alerta') >= 10 then
    raise exception 'demasiados_mensajes' using errcode = 'P0001',
      hint = 'Ya se enviaron 10 mensajes sobre esta alerta.';
  end if;

  insert into public.notificaciones (usuario_id, alerta_id, titulo, mensaje)
  values (v_autor, p_alert_id, 'Mensaje sobre tu alerta', v_msg);

  insert into public.auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, detalle)
  values (auth.uid(), auth.jwt() ->> 'email', 'mensaje_ciudadano', 'alerts', p_alert_id,
          jsonb_build_object('caracteres', char_length(v_msg)));

  -- Push (sin volver a guardar en la bandeja)
  select valor into v_url from private.config where clave = 'webhook_url';
  if v_url is not null and to_regnamespace('net') is not null then
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
    using v_url,
          jsonb_build_object('type', 'MENSAJE', 'user_id', v_autor, 'alert_id', p_alert_id, 'mensaje', v_msg),
          jsonb_build_object('Content-Type', 'application/json',
                             'x-webhook-secret', private.secreto('webhook_secret'));
    return jsonb_build_object('ok', true, 'push', true);
  end if;
  return jsonb_build_object('ok', true, 'push', false);
end;
$$;
revoke all on function public.enviar_mensaje_ciudadano(uuid, text) from public, anon;
grant execute on function public.enviar_mensaje_ciudadano(uuid, text) to authenticated;
