-- =====================================================================
-- Alerta Ciudadana — Paso 9: pg_net fuera del esquema público
-- (advertencia del analizador "extension_in_public"). Sus funciones siguen
-- en el esquema `net`, así que el trigger de notificaciones no cambia.
-- Idempotente; sin pg_net no hace nada.
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'pg_net' and n.nspname = 'public') then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
exception when others then
  raise notice 'No se pudo mover pg_net: %', sqlerrm;
end $$;
