-- Reversión: recrea las políticas RLS de producción tal como estaban el 2026-09-25
-- (generado desde supabase/audit/resultados/q05.json). Ejecutar solo si hay que deshacer
-- 20260925000002_politicas_rls.sql y 20260925000003_storage_evidencias.sql.

begin;
drop policy if exists perfiles_select on public.profiles;
drop policy if exists perfiles_insert on public.profiles;
drop policy if exists perfiles_update on public.profiles;
drop policy if exists alertas_select on public.alerts;
drop policy if exists alertas_insert on public.alerts;
drop policy if exists alertas_update on public.alerts;
drop policy if exists alertas_delete on public.alerts;
drop policy if exists tipos_select on public.alert_types;
drop policy if exists tipos_admin on public.alert_types;
drop policy if exists media_select on public.alert_media;
drop policy if exists media_insert on public.alert_media;
drop policy if exists historial_select on public.alert_status_history;
drop policy if exists historial_insert on public.alert_status_history;
drop policy if exists asignaciones_select on public.asignaciones_unidad;
drop policy if exists asignaciones_insert on public.asignaciones_unidad;
drop policy if exists contactos_propios on public.emergency_contacts;
drop policy if exists tokens_propios on public.device_tokens;
drop policy if exists notif_select on public.notificaciones;
drop policy if exists notif_update on public.notificaciones;
drop policy if exists auditoria_select on public.auditoria;
drop policy if exists auditoria_insert on public.auditoria;
drop policy if exists cola_admin on public.cola_sincronizacion;
drop policy if exists evidencias_insert_propias on storage.objects;
drop policy if exists evidencias_select on storage.objects;
drop policy if exists evidencias_delete on storage.objects;
alter table public.alert_types disable row level security;
update storage.buckets set public = true, file_size_limit = null, allowed_mime_types = null where id = 'evidencias';

create policy "media c" on public.alert_media for INSERT to authenticated
  with check ((EXISTS ( SELECT 1
   FROM alerts a
  WHERE ((a.id = alert_media.alert_id) AND (a.user_id = auth.uid())))));
create policy "media r" on public.alert_media for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM alerts a
  WHERE ((a.id = alert_media.alert_id) AND ((a.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['operator'::text, 'admin'::text]))))))))));
create policy "history insert on change" on public.alert_status_history for INSERT to authenticated
  with check ((changed_by = auth.uid()));
create policy "history operator read" on public.alert_status_history for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['operator'::text, 'admin'::text]))))));
create policy "Admins can delete alerts" on public.alerts for DELETE to authenticated
  using ((get_my_role() = 'admin'::text));
create policy "Citizens can view active area alerts" on public.alerts for SELECT to authenticated
  using ((status = ANY (ARRAY['open'::alert_status, 'ack'::alert_status])));
create policy "Operators can update alerts" on public.alerts for UPDATE to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['operator'::text, 'admin'::text]))))));
create policy "Operators can view all alerts" on public.alerts for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['operator'::text, 'admin'::text, 'auditor'::text]))))));
create policy "Users can create their own alerts" on public.alerts for INSERT to authenticated
  with check ((auth.uid() = user_id));
create policy "Users can view their own alerts" on public.alerts for SELECT to authenticated
  using ((auth.uid() = user_id));
create policy "alerts operator read all" on public.alerts for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['operator'::text, 'admin'::text]))))));
create policy "alerts operator update all" on public.alerts for UPDATE to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['operator'::text, 'admin'::text]))))))
  with check (true);
create policy "alerts user insert own" on public.alerts for INSERT to authenticated
  with check ((user_id = auth.uid()));
create policy "alerts user read own" on public.alerts for SELECT to authenticated
  using ((user_id = auth.uid()));
create policy "alerts user update own (optional)" on public.alerts for UPDATE to authenticated
  using ((user_id = auth.uid()));
create policy "Operadores gestionan asignaciones" on public.asignaciones_unidad for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['operator'::text, 'admin'::text]))))));
create policy "Admins and auditors can read audit log" on public.auditoria for SELECT to authenticated
  using ((get_my_role() = ANY (ARRAY['admin'::text, 'auditor'::text, 'operator'::text])));
create policy "Solo admins leen auditoria" on public.auditoria for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'auditor'::text]))))));
create policy "Usuario gestiona su cola" on public.cola_sincronizacion for ALL to authenticated
  using ((alerta_id IN ( SELECT alerts.id
   FROM alerts
  WHERE (alerts.user_id = auth.uid()))));
create policy "tokens c" on public.device_tokens for INSERT to authenticated
  with check ((user_id = auth.uid()));
create policy "tokens d" on public.device_tokens for DELETE to authenticated
  using ((user_id = auth.uid()));
create policy "tokens r" on public.device_tokens for SELECT to authenticated
  using ((user_id = auth.uid()));
create policy "contacts c" on public.emergency_contacts for INSERT to authenticated
  with check ((user_id = auth.uid()));
create policy "contacts d" on public.emergency_contacts for DELETE to authenticated
  using ((user_id = auth.uid()));
create policy "contacts r" on public.emergency_contacts for SELECT to authenticated
  using ((user_id = auth.uid()));
create policy "contacts u" on public.emergency_contacts for UPDATE to authenticated
  using ((user_id = auth.uid()));
create policy "Ver propias notificaciones" on public.notificaciones for ALL to authenticated
  using ((auth.uid() = usuario_id));
create policy "Staff can read all profiles" on public.profiles for SELECT to authenticated
  using ((get_my_role() = ANY (ARRAY['admin'::text, 'operator'::text, 'auditor'::text])));
create policy "Users can read own profile" on public.profiles for SELECT to authenticated
  using ((id = auth.uid()));
create policy "profile read own" on public.profiles for SELECT to public
  using ((id = auth.uid()));
create policy "profile update own" on public.profiles for UPDATE to public
  using ((id = auth.uid()));
create policy "Anyone can view files" on storage.objects for SELECT to public
  using ((bucket_id = 'evidencias'::text));
create policy "Authenticated users can upload files" on storage.objects for INSERT to authenticated
  with check (((bucket_id = 'evidencias'::text) AND ((storage.foldername(name))[1] = 'alertas'::text)));
create policy "Users can delete their own files" on storage.objects for DELETE to authenticated
  using (((bucket_id = 'evidencias'::text) AND (owner = auth.uid())));

commit;
