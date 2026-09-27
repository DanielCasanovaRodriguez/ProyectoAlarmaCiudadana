-- =====================================================================
-- Alerta Ciudadana — Paso 7: mover los secretos del servidor a Vault
-- (cifrados en reposo). Conserva los MISMOS valores: la huella de las
-- cédulas ya registradas depende de ellos. Idempotente; sin Vault no hace nada.
-- =====================================================================
do $$
declare r record;
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'vault' and p.proname = 'create_secret') then
    raise notice 'Vault no disponible: los secretos siguen en private.config';
    return;
  end if;
  for r in select clave, valor from private.config
           where clave in ('identidad_pepper', 'identidad_llave', 'webhook_secret') loop
    if not exists (select 1 from vault.secrets where name = 'ac_' || r.clave) then
      perform vault.create_secret(r.valor, 'ac_' || r.clave, 'Alerta Ciudadana: ' || r.clave);
    end if;
    -- Solo se borra la copia local si Vault devuelve exactamente el mismo valor
    if (select decrypted_secret from vault.decrypted_secrets where name = 'ac_' || r.clave) = r.valor then
      delete from private.config where clave = r.clave;
    end if;
  end loop;
end $$;
