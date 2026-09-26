-- =====================================================================
-- Alerta Ciudadana — Inspección del esquema real en Supabase (SOLO LECTURA)
--
-- Cómo usarlo: Supabase Dashboard > SQL Editor > pegar y ejecutar cada
-- bloque. No modifica nada. Guarda los resultados (Export CSV) en
-- supabase/audit/resultados/ para completar la auditoría de la Fase 1.
-- =====================================================================

-- 1. Tablas del esquema public y si tienen RLS activado / forzado
select c.relname as tabla, c.relrowsecurity as rls_activo, c.relforcerowsecurity as rls_forzado,
       c.reltuples::bigint as filas_estimadas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- 2. Columnas, tipos, nulos y valores por defecto
select table_name as tabla, column_name as columna, data_type as tipo, is_nullable as nulo, column_default as por_defecto
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3. Llaves primarias, foráneas, únicas y checks
select tc.table_name as tabla, tc.constraint_type as tipo, tc.constraint_name as nombre,
       pg_get_constraintdef(pc.oid) as definicion
from information_schema.table_constraints tc
join pg_constraint pc on pc.conname = tc.constraint_name
join pg_namespace n on n.oid = pc.connamespace and n.nspname = tc.table_schema
where tc.table_schema = 'public'
order by tc.table_name, tc.constraint_type;

-- 4. Índices
select tablename as tabla, indexname as indice, indexdef as definicion
from pg_indexes where schemaname = 'public' order by 1, 2;

-- 5. Políticas RLS (lo más importante para la seguridad)
select tablename as tabla, policyname as politica, cmd as operacion, roles,
       qual as condicion_using, with_check
from pg_policies where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 6. Triggers
select event_object_table as tabla, trigger_name as trigger, action_timing as momento,
       event_manipulation as evento, action_statement as accion
from information_schema.triggers
where trigger_schema in ('public', 'auth')
order by 1, 2;

-- 7. Funciones propias (incluye el trigger de alta de usuarios)
select p.proname as funcion, p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;

-- 8. Vistas
select table_name as vista, view_definition as definicion
from information_schema.views where table_schema = 'public';

-- 9. Tipos enumerados
select t.typname as enum, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as valores
from pg_type t join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'
group by t.typname;

-- 10. Buckets de Storage (¿evidencias es público?)
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets;

-- 11. Tablas publicadas en Realtime
select * from pg_publication_tables where pubname = 'supabase_realtime';

-- 12. Privilegios de los roles anon / authenticated sobre las tablas
select grantee, table_name as tabla, string_agg(privilege_type, ', ') as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by grantee, table_name order by 2, 1;

-- 13. Resumen de roles de usuario (sin datos personales)
select role, status, count(*) from public.profiles group by role, status order by 1, 2;
