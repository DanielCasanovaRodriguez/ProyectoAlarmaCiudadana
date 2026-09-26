-- =====================================================================
-- Alerta Ciudadana — Paso 3: evidencias privadas
--
-- El bucket `evidencias` deja de ser público. Los clientes (web y Android)
-- ya muestran las evidencias con URLs firmadas temporales, que funcionan
-- con bucket público o privado; por eso este paso no rompe nada.
--
-- Ruta de cada archivo: alertas/<alert_id>/<archivo>
-- =====================================================================

update storage.buckets
set public = false,
    file_size_limit = 10485760, -- 10 MB (igual que la validación del cliente)
    allowed_mime_types = array[
      'image/jpeg','image/jpg','image/png','image/webp','image/heic',
      'video/mp4','video/webm','video/quicktime',
      'audio/mpeg','audio/mp3','audio/wav','audio/webm','audio/ogg']
where id = 'evidencias';

-- Políticas anteriores del bucket (producción, 2026-09-25): lectura pública
-- para cualquiera, subida a cualquier carpeta de alerta y borrado por dueño.
drop policy if exists "Anyone can view files"                on storage.objects;
drop policy if exists "Authenticated users can upload files" on storage.objects;
drop policy if exists "Users can delete their own files"     on storage.objects;

drop policy if exists evidencias_insert_propias on storage.objects;
drop policy if exists evidencias_select       on storage.objects;
drop policy if exists evidencias_delete_admin on storage.objects;
drop policy if exists evidencias_delete       on storage.objects;

-- Subir: solo a la carpeta de una alerta propia
create policy evidencias_insert_propias on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = 'alertas'
    and exists (
      select 1 from public.alerts a
      where a.id::text = (storage.foldername(name))[2] and a.user_id = auth.uid())
  );

-- Ver: el autor de la alerta y los colaboradores
create policy evidencias_select on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias'
    and (
      public.es_colaborador()
      or exists (
        select 1 from public.alerts a
        where a.id::text = (storage.foldername(name))[2] and a.user_id = auth.uid())
    )
  );

-- Borrar: quien subió el archivo o un administrador
create policy evidencias_delete on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and (owner = auth.uid() or public.es_admin()));
