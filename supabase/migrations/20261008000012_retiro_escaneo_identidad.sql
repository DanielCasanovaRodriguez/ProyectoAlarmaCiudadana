-- =====================================================================
-- Alerta Ciudadana — Paso 12: retiro definitivo del escaneo de cédula
-- El escaneo se reemplazó por el formulario (paso 8) y los números ya
-- están en public.cedulas (cifrados). Las fotos y datos leídos del
-- documento ya no tienen finalidad: se eliminan (Ley 1581 de 2012, art. 4
-- lit. b, principio de finalidad, y art. 11 del Decreto 1377 de 2013).
-- Las fotos del bucket "documentos-identidad" se borran con la API de
-- Storage (no se permite desde SQL). Idempotente.
-- =====================================================================
delete from public.verificaciones_identidad;

-- Funciones del escaneo: ya no las usa la app
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('registrar_identidad', 'mi_identidad', 'admin_listar_identidades',
                        'admin_detalle_identidad', 'revisar_identidad')
  loop
    execute format('drop function if exists %s', f.firma);
  end loop;
end $$;

-- Sin lectura de documentos para nadie (la tabla queda vacía como histórico de esquema)
drop policy if exists documentos_select_admin on storage.objects;
