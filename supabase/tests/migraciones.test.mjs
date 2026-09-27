/**
 * Pruebas de las migraciones de supabase/migrations sobre una PostgreSQL
 * local embebida (PGlite). No se conecta a Supabase ni a ninguna red.
 *
 * El esquema es una RÉPLICA del de producción según la inspección del
 * 2026-09-25 (supabase/audit): tipos de columna, triggers, funciones y las
 * políticas RLS vigentes, incluidas las vulnerables.
 *
 *   1. Demuestra que las vulnerabilidades existen ANTES de migrar.
 *   2. Aplica las migraciones y verifica seguridad y uso normal.
 *
 * Ejecutar:  npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite({ extensions: { pgcrypto } });

// ------------------------------------------------------------------ entorno
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default true,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id serial primary key, bucket_id text references storage.buckets(id),
  name text, owner uuid default auth.uid());
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant usage, select on all sequences in schema storage to anon, authenticated;
insert into storage.buckets (id, name) values ('evidencias', 'evidencias');
`;

const ESQUEMA_PRODUCCION = `
create type public.alert_status as enum ('open','ack','resolved');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text,
  role text default 'citizen' check (role in ('citizen','operator','admin','auditor')),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  phone text, intentos_fallidos smallint default 0, bloqueado_hasta timestamptz,
  consentimiento_fecha timestamptz, consentimiento_version varchar,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table public.alert_types (id serial primary key, code text unique not null, label text not null,
  descripcion text, icono varchar, color varchar, activo boolean default true, orden smallint default 0);
create table public.alerts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  type_code text not null references public.alert_types(code), description text,
  severity int default 3 check (severity between 1 and 5),
  lat double precision not null, lng double precision not null,
  status public.alert_status not null default 'open', ack_at timestamptz, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  media_urls text[] default '{}', operador_asignado_id uuid references auth.users(id), anonimo boolean default false);
create table public.alert_media (id bigserial primary key, alert_id uuid references public.alerts(id) on delete cascade,
  user_id uuid, kind text, storage_path text, tamano_bytes bigint, duracion_seg int, created_at timestamptz default now());
create table public.alert_status_history (id bigserial primary key, alert_id uuid references public.alerts(id) on delete cascade,
  old_status public.alert_status, new_status public.alert_status not null, changed_by uuid, note text,
  changed_at timestamptz default now());
create table public.emergency_contacts (id bigserial primary key, user_id uuid not null, name text, phone text,
  relation text, notificar_sos boolean default true, created_at timestamptz default now());
create table public.device_tokens (id bigserial primary key, user_id uuid, platform text, token text,
  created_at timestamptz default now());
create table public.notificaciones (id uuid primary key default gen_random_uuid(), usuario_id uuid,
  alerta_id uuid, titulo text, mensaje text, leida boolean default false, created_at timestamptz default now());
create table public.auditoria (id uuid primary key default gen_random_uuid(), usuario_id uuid, usuario_email varchar,
  accion varchar not null, entidad varchar not null, entidad_id uuid, detalle jsonb, ip_origen varchar,
  created_at timestamptz default now());
create table public.asignaciones_unidad (id uuid primary key default gen_random_uuid(),
  alerta_id uuid references public.alerts(id) on delete cascade, operador_id uuid, nombre_unidad text,
  tipo_unidad text, eta_minutos int, created_at timestamptz default now());
create table public.cola_sincronizacion (id uuid primary key default gen_random_uuid(), alerta_id uuid,
  payload jsonb, estado text default 'pendiente', intentos int default 0, hash_evento text unique,
  created_at timestamptz default now(), synced_at timestamptz);

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Funciones y triggers de producción (copiados de la inspección)
create function public.crear_perfil_nuevo_usuario() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role, status, intentos_fallidos, created_at, updated_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'),
          coalesce(new.raw_user_meta_data->>'role', 'citizen'), 'active', 0, now(), now())
  on conflict (id) do nothing;
  return new;
end $$;
create trigger trg_crear_perfil after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

create function public.get_my_role() returns text language sql stable security definer set search_path to 'public'
  as $$ select role::text from profiles where id = auth.uid() limit 1 $$;

create function public.log_status_change() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'ack' and old.ack_at is null then new.ack_at := now(); end if;
    if new.status = 'resolved' and old.resolved_at is null then new.resolved_at := now(); end if;
    insert into public.alert_status_history(alert_id, old_status, new_status, changed_by, note)
    values (old.id, old.status, new.status, auth.uid(), null);
  end if;
  return new;
end $$;
create trigger trg_alerts_status_history before update on public.alerts
  for each row execute function public.log_status_change();

create function public.log_alert_changes() returns trigger language plpgsql security definer as $$
begin
  insert into auditoria (usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(),
          case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end,
          'alerts', coalesce(new.id, old.id),
          jsonb_build_object('old_status', old.status, 'new_status', new.status,
                             'type_code', coalesce(new.type_code, old.type_code)));
  return coalesce(new, old);
end $$;
create trigger trg_audit_alerts after insert or update or delete on public.alerts
  for each row execute function public.log_alert_changes();

-- Otras funciones heredadas de producción (cuerpos simplificados; PostGIS no existe en PGlite)
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create function public.actualizar_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create function public.set_geom_from_latlng() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.alerts_near(_lat double precision, _lng double precision, _meters integer) returns setof public.alerts
  language sql stable as $$ select * from public.alerts $$;
create function public.get_alert_media(alert_id uuid) returns text[] language plpgsql security definer as
  $$ declare urls text[]; begin select media_urls into urls from alerts where id = alert_id; return coalesce(urls, '{}'); end $$;
create function public.count_alert_media(alert_id uuid) returns integer language plpgsql security definer as
  $$ begin return 0; end $$;
create function public.alert_has_videos(alert_id uuid) returns boolean language plpgsql security definer as
  $$ begin return false; end $$;
create table public.spatial_ref_sys (srid int primary key, auth_name varchar);
grant select on public.spatial_ref_sys to anon, authenticated;

-- Políticas vigentes en producción (las relevantes, tal como están)
alter table public.profiles             enable row level security;
alter table public.alerts               enable row level security;
alter table public.alert_status_history enable row level security;
alter table public.emergency_contacts   enable row level security;
alter table public.auditoria            enable row level security;
alter table public.asignaciones_unidad  enable row level security;
alter table public.notificaciones       enable row level security;
alter table public.device_tokens        enable row level security;
alter table public.alert_media          enable row level security;
alter table public.cola_sincronizacion  enable row level security;
-- alert_types: SIN RLS en producción
create policy "profile read own"   on public.profiles for select using (id = auth.uid());
create policy "profile update own" on public.profiles for update using (id = auth.uid());
create policy "Staff can read all profiles" on public.profiles for select to authenticated
  using (get_my_role() = any (array['admin','operator','auditor']));
create policy "Citizens can view active area alerts" on public.alerts for select to authenticated
  using (status = any (array['open'::alert_status, 'ack'::alert_status]));
create policy "alerts user read own"   on public.alerts for select to authenticated using (user_id = auth.uid());
create policy "alerts user insert own" on public.alerts for insert to authenticated with check (user_id = auth.uid());
create policy "alerts user update own (optional)" on public.alerts for update to authenticated using (user_id = auth.uid());
create policy "alerts operator update all" on public.alerts for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = any (array['operator','admin'])))
  with check (true);
create policy "history insert on change" on public.alert_status_history for insert to authenticated
  with check (changed_by = auth.uid());
create policy "contacts r" on public.emergency_contacts for select to authenticated using (user_id = auth.uid());
create policy "contacts c" on public.emergency_contacts for insert to authenticated with check (user_id = auth.uid());
create policy "Anyone can view files" on storage.objects for select using (bucket_id = 'evidencias');
create policy "Authenticated users can upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = 'alertas');
`;

// ------------------------------------------------------------------ ayudas
const U = {
  ana:   '00000000-0000-0000-0000-00000000000a', // ciudadana
  beto:  '00000000-0000-0000-0000-00000000000b', // ciudadano
  oper:  '00000000-0000-0000-0000-0000000000c1', // operadora
  admin: '00000000-0000-0000-0000-0000000000d1', // administrador
  audi:  '00000000-0000-0000-0000-0000000000e1', // auditor
};

async function como(uid, sql, params = []) {
  await db.exec('reset role');
  if (uid === 'anon') {
    await db.exec(`set request.jwt.claims = '{"role":"anon"}'; set role anon;`);
  } else {
    await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: uid, role: 'authenticated', email: uid + '@test' })}'; set role authenticated;`);
  }
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role; set request.jwt.claims = '';`); }
}
async function comoSistema(sql, params = []) {
  await db.exec(`reset role; set request.jwt.claims = '';`);
  return db.query(sql, params);
}

let ok = 0, fallos = 0;
async function prueba(nombre, fn) {
  try { await fn(); ok++; console.log('  ✔', nombre); }
  catch (e) { fallos++; console.log('  ✘', nombre, '\n     →', e.message); }
}
function igual(a, b, msg) {
  if (a !== b) throw new Error(`${msg ?? ''} esperado=${JSON.stringify(b)} obtenido=${JSON.stringify(a)}`);
}
async function debeFallar(p, codigo) {
  try { await p; } catch (e) {
    if (codigo && e.code !== codigo) throw new Error(`falló con código ${e.code} (${e.message}), se esperaba ${codigo}`);
    return;
  }
  throw new Error('se esperaba un error y la operación fue permitida');
}
const nuevaAlerta = async (uid, tipo = 'robbery', lat = 4.62) =>
  (await como(uid, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,$2,$3,-74.14) returning id`,
    [uid, tipo, lat])).rows[0].id;

// ------------------------------------------------------------------ montaje
await db.exec(SUPABASE_STUB);
await db.exec(ESQUEMA_PRODUCCION);

// Usuarios existentes: se crean en auth.users y el trigger crea el perfil
for (const [id, nombre, rol] of [[U.ana, 'Ana', 'citizen'], [U.beto, 'Beto', 'citizen'],
  [U.oper, 'Olga Operadora', 'operator'], [U.admin, 'Admin', 'admin'], [U.audi, 'Auditor', 'auditor']]) {
  await comoSistema(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`,
    [id, JSON.stringify({ full_name: nombre, role: rol })]);
}
await comoSistema(`insert into public.alert_types (code, label) values ('robbery','Robo'), ('fire','Incendio')`);

// ------------------------------------------------ 1. producción ANTES
console.log('Producción ANTES de las migraciones (cada ✔ = vulnerabilidad reproducida)');
await prueba('registrarse enviando role=admin crea un administrador', async () => {
  const id = '00000000-0000-0000-0000-0000000000f0';
  await comoSistema(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"role":"admin"}')`, [id]);
  igual((await comoSistema(`select role from public.profiles where id = $1`, [id])).rows[0].role, 'admin');
});
await prueba('un ciudadano puede cambiarse el rol a admin', async () => {
  await como(U.beto, `update public.profiles set role = 'admin' where id = $1`, [U.beto]);
  igual((await comoSistema(`select role from public.profiles where id = $1`, [U.beto])).rows[0].role, 'admin');
  await comoSistema(`update public.profiles set role = 'citizen' where id = $1`, [U.beto]);
});
let previa;
await prueba('un ciudadano ve el user_id de alertas ajenas', async () => {
  previa = await nuevaAlerta(U.ana);
  igual((await como(U.beto, `select user_id from public.alerts where id = $1`, [previa])).rows[0].user_id, U.ana);
});
await prueba('un ciudadano escribe historial falso en una alerta ajena', async () => {
  await como(U.beto, `insert into public.alert_status_history (alert_id, new_status, changed_by)
                      values ($1, 'resolved', $2)`, [previa, U.beto]);
});
await prueba('un ciudadano modifica los tipos de alerta (tabla sin RLS)', async () => {
  await como(U.beto, `update public.alert_types set label = 'hackeado' where code = 'fire'`);
  igual((await comoSistema(`select label from public.alert_types where code = 'fire'`)).rows[0].label, 'hackeado');
  await comoSistema(`update public.alert_types set label = 'Incendio' where code = 'fire'`);
});
await prueba('cualquiera (sin sesión) lista las evidencias', async () => {
  await comoSistema(`insert into storage.objects (bucket_id, name, owner) values ('evidencias', $1, $2)`,
    [`alertas/${previa}/previa.jpg`, U.ana]);
  igual((await como('anon', `select * from storage.objects`)).rows.length, 1);
});
await prueba('sin sesión se leen rutas de evidencias con get_alert_media()', async () => {
  await comoSistema(`update public.alerts set media_urls = array['alertas/p/secreta.jpg'] where id = $1`, [previa]);
  igual((await como('anon', `select public.get_alert_media($1) as m`, [previa])).rows[0].m[0], 'alertas/p/secreta.jpg');
});
const vulnerabilidades = ok;
if (fallos) { console.log('\nLa réplica de producción no se comporta como se esperaba.'); process.exit(1); }
await db.exec(`reset role; set request.jwt.claims = '';
  delete from storage.objects; delete from public.alert_status_history;
  delete from public.auditoria; delete from public.alerts;`);
ok = 0;

// ------------------------------------------------ 2. aplicar migraciones
const dir = join(here, '..', 'migrations');
const migraciones = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
for (const f of migraciones) {
  await db.exec(readFileSync(join(dir, f), 'utf8'));
  console.log('\nMigración aplicada:', f);
}

// ------------------------------------------------ 3. DESPUÉS
console.log('\nPerfiles');
await prueba('registrarse enviando role=admin queda como citizen', async () => {
  const id = '00000000-0000-0000-0000-0000000000f1';
  await comoSistema(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"full_name":"Intruso","role":"admin"}')`, [id]);
  igual((await comoSistema(`select role from public.profiles where id = $1`, [id])).rows[0].role, 'citizen');
});
await prueba('un ciudadano NO puede cambiarse el rol (sí su nombre)', async () => {
  await como(U.ana, `update public.profiles set role = 'admin', full_name = 'Ana María' where id = $1`, [U.ana]);
  const r = await comoSistema(`select role, full_name from public.profiles where id = $1`, [U.ana]);
  igual(r.rows[0].role, 'citizen', 'rol:'); igual(r.rows[0].full_name, 'Ana María', 'nombre:');
});
await prueba('un ciudadano NO ve perfiles ajenos', async () => {
  igual((await como(U.ana, `select id from public.profiles`)).rows.length, 1);
});
await prueba('un admin SÍ puede cambiar el rol de otro usuario', async () => {
  await como(U.admin, `update public.profiles set role = 'operator' where id = $1`, [U.beto]);
  igual((await comoSistema(`select role from public.profiles where id = $1`, [U.beto])).rows[0].role, 'operator');
  await como(U.admin, `update public.profiles set role = 'citizen' where id = $1`, [U.beto]);
});

// Desde el paso 5 los ciudadanos necesitan verificación de identidad enviada para reportar
for (const f of ['f.jpg', 'r.jpg']) {
  await como(U.ana, `insert into storage.objects (bucket_id, name) values ('documentos-identidad', $1)`, [`${U.ana}/${f}`]);
}
await como(U.ana, `select public.registrar_identidad($1,'amarilla','pdf417',true,true,null,$2,$3)`,
  ['52000111', `${U.ana}/f.jpg`, `${U.ana}/r.jpg`]);

console.log('\nAlertas');
let alertaAna;
await prueba('la ciudadana crea su alerta', async () => { alertaAna = await nuevaAlerta(U.ana); });
await prueba('no puede crear alertas a nombre de otro usuario', async () => {
  await debeFallar(como(U.ana, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'fire',4.6,-74.1)`, [U.beto]));
});
await prueba('otro ciudadano NO lee la alerta en la tabla', async () => {
  igual((await como(U.beto, `select * from public.alerts where id = $1`, [alertaAna])).rows.length, 0);
});
await prueba('otro ciudadano la ve en el mapa SIN user_id ni evidencias', async () => {
  const r = await como(U.beto, `select * from public.alertas_activas_publicas()`);
  igual(r.rows.length, 1); igual('user_id' in r.rows[0], false, 'expone user_id:');
  igual(r.rows[0].es_propia, false); igual(r.rows[0].media_urls.length, 0);
});
await prueba('la autora la ve como propia', async () => {
  igual((await como(U.ana, `select es_propia from public.alertas_activas_publicas()`)).rows[0].es_propia, true);
});
await prueba('la autora adjunta evidencias (media_urls)', async () => {
  await como(U.ana, `update public.alerts set media_urls = array['alertas/x/1.jpg'] where id = $1`, [alertaAna]);
  igual((await comoSistema(`select media_urls from public.alerts where id = $1`, [alertaAna])).rows[0].media_urls[0], 'alertas/x/1.jpg');
});
await prueba('la autora NO cambia estado ni ubicación directamente (ni deja historial falso)', async () => {
  await como(U.ana, `update public.alerts set status = 'resolved', lat = 0 where id = $1`, [alertaAna]);
  const r = await comoSistema(`select status, lat from public.alerts where id = $1`, [alertaAna]);
  igual(r.rows[0].status, 'open'); igual(r.rows[0].lat, 4.62);
  igual((await comoSistema(`select count(*)::int n from public.alert_status_history where alert_id = $1`, [alertaAna])).rows[0].n, 0);
});
await prueba('sin sesión no se leen alertas', async () => {
  await debeFallar(como('anon', `select * from public.alerts`), '42501');
});
await prueba('sin sesión no se llama a alertas_activas_publicas()', async () => {
  await debeFallar(como('anon', `select * from public.alertas_activas_publicas()`), '42501');
});

console.log('\nCambios de estado (RPC) con los triggers de producción');
await prueba('un ciudadano NO usa cambiar_estado_alerta', async () => {
  await debeFallar(como(U.beto, `select public.cambiar_estado_alerta($1, 'resolved')`, [alertaAna]), '42501');
});
await prueba('la operadora atiende (ack): ack_at, historial con nota y auditoría, sin duplicados', async () => {
  await como(U.oper, `select public.cambiar_estado_alerta($1, 'ack', 'Patrulla en camino')`, [alertaAna]);
  const a = await comoSistema(`select status, ack_at, operador_asignado_id from public.alerts where id = $1`, [alertaAna]);
  igual(a.rows[0].status, 'ack'); igual(a.rows[0].ack_at !== null, true, 'ack_at:');
  igual(a.rows[0].operador_asignado_id, U.oper);
  const h = await comoSistema(`select new_status, note, changed_by from public.alert_status_history where alert_id = $1`, [alertaAna]);
  igual(h.rows.length, 1, 'filas de historial:'); igual(h.rows[0].note, 'Patrulla en camino');
  igual(h.rows[0].changed_by, U.oper, 'changed_by:');
  // El trigger de producción audita cada UPDATE; el cambio a 'ack' debe quedar una sola vez.
  const au = await comoSistema(`select 1 from public.auditoria
    where entidad_id = $1 and accion = 'update' and detalle ->> 'new_status' = 'ack'
      and detalle ->> 'old_status' = 'open'`, [alertaAna]);
  igual(au.rows.length, 1, 'auditoría del cambio open→ack:');
});
await prueba('estado inválido rechazado', async () => {
  await debeFallar(como(U.oper, `select public.cambiar_estado_alerta($1, 'borrada')`, [alertaAna]), '22023');
});
await prueba('la autora ve el historial de su alerta; otro ciudadano no', async () => {
  igual((await como(U.ana,  `select * from public.alert_status_history`)).rows.length, 1);
  igual((await como(U.beto, `select * from public.alert_status_history`)).rows.length, 0);
});
await prueba('un ciudadano NO escribe historial directamente', async () => {
  await debeFallar(como(U.beto, `insert into public.alert_status_history (alert_id, new_status, changed_by)
                                 values ($1, 'resolved', $2)`, [alertaAna, U.beto]));
});
await prueba('no se cancela una alerta ya atendida', async () => {
  await debeFallar(como(U.ana, `select public.cancelar_alerta($1)`, [alertaAna]), '22023');
});
await prueba('cancelar alerta propia abierta: resolved + historial con nota', async () => {
  const id = await nuevaAlerta(U.ana, 'fire');
  await debeFallar(como(U.beto, `select public.cancelar_alerta($1)`, [id]), '42501');
  await como(U.ana, `select public.cancelar_alerta($1)`, [id]);
  const a = await comoSistema(`select status, resolved_at from public.alerts where id = $1`, [id]);
  igual(a.rows[0].status, 'resolved'); igual(a.rows[0].resolved_at !== null, true);
  const h = await comoSistema(`select note from public.alert_status_history where alert_id = $1`, [id]);
  igual(h.rows.length, 1); igual(h.rows[0].note, 'Cancelada por el ciudadano desde la aplicación');
});
await prueba('el auditor ve alertas pero NO las cambia', async () => {
  igual((await como(U.audi, `select * from public.alerts`)).rows.length >= 1, true);
  await debeFallar(como(U.audi, `select public.cambiar_estado_alerta($1, 'resolved')`, [alertaAna]), '42501');
});

console.log('\nOtras tablas');
await prueba('contactos de emergencia: solo los propios', async () => {
  await como(U.ana, `insert into public.emergency_contacts (user_id, name, phone) values ($1,'Mamá','300')`, [U.ana]);
  igual((await como(U.beto, `select * from public.emergency_contacts`)).rows.length, 0);
  await debeFallar(como(U.beto, `insert into public.emergency_contacts (user_id, name, phone) values ($1,'x','1')`, [U.ana]));
});
await prueba('auditoría: ciudadano no la lee; admin y auditor sí', async () => {
  igual((await como(U.ana,   `select * from public.auditoria`)).rows.length, 0);
  igual((await como(U.admin, `select * from public.auditoria`)).rows.length >= 1, true);
  igual((await como(U.audi,  `select * from public.auditoria`)).rows.length >= 1, true);
});
await prueba('tipos de alerta: lectura pública, escritura solo admin', async () => {
  igual((await como('anon', `select * from public.alert_types`)).rows.length, 2);
  await debeFallar(como(U.ana, `insert into public.alert_types (code, label) values ('x','x')`));
  await como(U.ana, `update public.alert_types set label = 'hackeado' where code = 'fire'`);
  igual((await comoSistema(`select label from public.alert_types where code = 'fire'`)).rows[0].label, 'Incendio');
});

console.log('\nStorage (evidencias)');
await prueba('el bucket evidencias queda privado', async () => {
  igual((await comoSistema(`select public from storage.buckets where id = 'evidencias'`)).rows[0].public, false);
});
await prueba('subir evidencia a una alerta propia: permitido', async () => {
  await como(U.ana, `insert into storage.objects (bucket_id, name) values ('evidencias', $1)`, [`alertas/${alertaAna}/foto.jpg`]);
});
await prueba('subir evidencia a una alerta ajena: rechazado', async () => {
  await debeFallar(como(U.beto, `insert into storage.objects (bucket_id, name) values ('evidencias', $1)`, [`alertas/${alertaAna}/x.jpg`]));
});
await prueba('sin sesión ya NO se listan evidencias', async () => {
  igual((await como('anon', `select * from storage.objects`)).rows.length, 0);
});
await prueba('ver evidencia: autora y operadora sí, otro ciudadano no', async () => {
  igual((await como(U.ana,  `select * from storage.objects`)).rows.length, 1);
  igual((await como(U.oper, `select * from storage.objects`)).rows.length, 1);
  igual((await como(U.beto, `select * from storage.objects`)).rows.length, 0);
});

console.log('\nEndurecimiento (advisors)');
await prueba('sin sesión ya NO se llama a get_alert_media()', async () => {
  await debeFallar(como('anon', `select public.get_alert_media($1)`, [alertaAna]), '42501');
});
await prueba('las funciones de trigger no se pueden invocar como RPC', async () => {
  await debeFallar(como(U.ana, `select public.crear_perfil_nuevo_usuario()`), undefined);
  const r = await comoSistema(`select has_function_privilege('authenticated', 'public.log_alert_changes()', 'execute') as p`);
  igual(r.rows[0].p, false);
});
await prueba('los triggers siguen funcionando tras revocar EXECUTE (alta de usuario)', async () => {
  const id = '00000000-0000-0000-0000-0000000000f2';
  await comoSistema(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"full_name":"Nuevo","role":"admin"}')`, [id]);
  const r = await comoSistema(`select role, full_name from public.profiles where id = $1`, [id]);
  igual(r.rows[0].role, 'citizen'); igual(r.rows[0].full_name, 'Nuevo');
});

// Ana ya no necesita su verificación de prueba
await comoSistema(`delete from public.verificaciones_identidad where user_id = $1`, [U.ana]);
// ---- Paso 5: se inserta antes de "las migraciones se pueden volver a ejecutar"
console.log('\nNombres y apellidos');
await prueba('los perfiles existentes se dividieron en nombres y apellidos', async () => {
  const r = await comoSistema(`select nombres, apellidos from public.profiles where id = $1`, [U.oper]);
  igual(r.rows[0].nombres, 'Olga'); igual(r.rows[0].apellidos, 'Operadora');
});
await prueba('registro con nombres, apellidos y teléfono en metadatos', async () => {
  const id = '00000000-0000-0000-0000-0000000000f3';
  await comoSistema(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`,
    [id, JSON.stringify({ nombres: ' María  José ', apellidos: 'Gómez Ruiz', phone: '300 123 4567', role: 'admin' })]);
  const r = await comoSistema(`select nombres, apellidos, full_name, phone, role from public.profiles where id = $1`, [id]);
  igual(r.rows[0].nombres, 'María José'); igual(r.rows[0].apellidos, 'Gómez Ruiz');
  igual(r.rows[0].full_name, 'María José Gómez Ruiz'); igual(r.rows[0].phone, '3001234567'); igual(r.rows[0].role, 'citizen');
});
await prueba('editar nombres/apellidos actualiza full_name', async () => {
  await como(U.ana, `update public.profiles set nombres = 'Ana Lucía', apellidos = 'Pérez' where id = $1`, [U.ana]);
  igual((await comoSistema(`select full_name from public.profiles where id = $1`, [U.ana])).rows[0].full_name, 'Ana Lucía Pérez');
});
await prueba('un cliente antiguo que solo envía full_name sigue funcionando', async () => {
  await como(U.ana, `update public.profiles set full_name = 'Ana Pérez Gómez' where id = $1`, [U.ana]);
  const r = await comoSistema(`select nombres, apellidos, full_name from public.profiles where id = $1`, [U.ana]);
  igual(r.rows[0].nombres, 'Ana'); igual(r.rows[0].apellidos, 'Pérez Gómez'); igual(r.rows[0].full_name, 'Ana Pérez Gómez');
});

console.log('\nVerificación de identidad (cédula)');
const subirDoc = async (uid, nombre) => {
  await como(uid, `insert into storage.objects (bucket_id, name) values ('documentos-identidad', $1)`, [`${uid}/${nombre}`]);
  return `${uid}/${nombre}`;
};
const registrar = async (uid, numero, extra = {}) => {
  const f = await subirDoc(uid, `frente-${Date.now()}-${Math.random()}.jpg`);
  const r = await subirDoc(uid, `reverso-${Date.now()}-${Math.random()}.jpg`);
  return como(uid, `select * from public.registrar_identidad($1, $2, $3, $4, $5, $6, $7, $8)`,
    [numero, extra.modelo ?? 'amarilla', extra.metodo ?? 'pdf417', true, true,
     JSON.stringify({ nombres: 'X' }), extra.frente ?? f, extra.reverso ?? r]);
};
const CED_BETO = '1012345678';
await prueba('un ciudadano sube fotos a su carpeta pero no a la ajena', async () => {
  await subirDoc(U.beto, 'prueba.jpg');
  await debeFallar(como(U.beto, `insert into storage.objects (bucket_id, name) values ('documentos-identidad', $1)`, [`${U.ana}/x.jpg`]));
});
await prueba('nadie (ni el dueño) puede volver a leer las fotos; solo admin', async () => {
  igual((await como(U.beto, `select * from storage.objects where bucket_id = 'documentos-identidad'`)).rows.length, 0);
  igual((await como(U.oper, `select * from storage.objects where bucket_id = 'documentos-identidad'`)).rows.length, 0);
  igual((await como(U.admin, `select * from storage.objects where bucket_id = 'documentos-identidad'`)).rows.length >= 1, true);
});
await prueba('registrar la cédula deja estado pendiente y muestra solo los últimos 4 dígitos', async () => {
  const r = await registrar(U.beto, '1.012.345.678');
  igual(r.rows[0].estado, 'pendiente'); igual(r.rows[0].ultimos_digitos, '5678');
});
await prueba('el número NO se guarda en texto plano', async () => {
  const r = await comoSistema(`select numero_hash, encode(numero_cifrado, 'escape') c from public.verificaciones_identidad where user_id = $1`, [U.beto]);
  igual(r.rows[0].numero_hash.includes(CED_BETO), false); igual(r.rows[0].c.includes(CED_BETO), false);
});
await prueba('la misma cédula en otra cuenta es rechazada (una cédula = una cuenta)', async () => {
  await debeFallar(registrar(U.ana, CED_BETO), '23505');
  await debeFallar(registrar(U.ana, '001012345678'), '23505'); // ceros a la izquierda: misma cédula
});
await prueba('rechaza números inválidos y fotos que no existen o son ajenas', async () => {
  await debeFallar(registrar(U.ana, '12ab'), '22023');
  await debeFallar(registrar(U.ana, '98765432', { frente: `${U.ana}/no-existe.jpg` }), '22023');
  await debeFallar(registrar(U.ana, '98765432', { frente: `${U.beto}/prueba.jpg` }), '22023');
});
await prueba('un ciudadano no puede escribir la tabla de verificaciones directamente', async () => {
  await debeFallar(como(U.ana, `update public.verificaciones_identidad set estado = 'verificada'`));
  await debeFallar(como(U.ana, `insert into public.verificaciones_identidad (user_id, numero_hash, numero_cifrado, ultimos_digitos, metodo_lectura, frente_path, reverso_path) values ($1,'h','\\x00','1','manual','a','b')`, [U.ana]));
});
await prueba('cada usuario solo ve su propia verificación', async () => {
  igual((await como(U.ana, `select * from public.verificaciones_identidad`)).rows.length, 0);
  igual((await como(U.beto, `select estado from public.mi_identidad()`)).rows[0].estado, 'pendiente');
});
await prueba('sin verificación no se puede reportar; con verificación enviada sí', async () => {
  igual((await como(U.ana, `select public.puede_reportar() p`)).rows[0].p, false);
  await debeFallar(nuevaAlerta(U.ana, 'fire'));
  igual((await como(U.beto, `select public.puede_reportar() p`)).rows[0].p, true);
  await nuevaAlerta(U.beto, 'fire');
  igual((await como(U.oper, `select public.puede_reportar() p`)).rows[0].p, true); // personal: siempre
});
await prueba('solo el admin descifra el número; auditor y ciudadano no', async () => {
  igual((await como(U.admin, `select numero from public.admin_detalle_identidad($1)`, [U.beto])).rows[0].numero, CED_BETO);
  await debeFallar(como(U.audi, `select * from public.admin_detalle_identidad($1)`, [U.beto]), '42501');
  await debeFallar(como(U.beto, `select * from public.admin_detalle_identidad($1)`, [U.beto]), '42501');
});
await prueba('admin y auditor listan verificaciones; el ciudadano no', async () => {
  igual((await como(U.admin, `select * from public.admin_listar_identidades('pendiente')`)).rows.length >= 1, true);
  igual((await como(U.audi, `select * from public.admin_listar_identidades()`)).rows.length >= 1, true);
  await debeFallar(como(U.ana, `select * from public.admin_listar_identidades()`), '42501');
});
await prueba('revisión: el rechazo exige motivo, bloquea reportes y libera la cédula', async () => {
  await debeFallar(como(U.admin, `select public.revisar_identidad($1, 'rechazada', '')`, [U.beto]), '22023');
  await debeFallar(como(U.audi, `select public.revisar_identidad($1, 'verificada')`, [U.beto]), '42501');
  await como(U.admin, `select public.revisar_identidad($1, 'rechazada', 'Foto ilegible')`, [U.beto]);
  igual((await como(U.beto, `select public.puede_reportar() p`)).rows[0].p, false);
  await registrar(U.ana, CED_BETO); // ya liberada
  await comoSistema(`delete from public.verificaciones_identidad where user_id = $1`, [U.ana]);
});
await prueba('reenviar tras rechazo vuelve a pendiente; admin la aprueba', async () => {
  const r = await registrar(U.beto, CED_BETO);
  igual(r.rows[0].estado, 'pendiente');
  await como(U.admin, `select public.revisar_identidad($1, 'verificada')`, [U.beto]);
  igual((await como(U.beto, `select estado from public.mi_identidad()`)).rows[0].estado, 'verificada');
  await debeFallar(registrar(U.beto, CED_BETO), '22023'); // ya verificada
});
await prueba('máximo 5 intentos de verificación', async () => {
  await registrar(U.ana, '55555555');
  for (let i = 0; i < 4; i++) await registrar(U.ana, '55555555');
  await debeFallar(registrar(U.ana, '55555555'), '22023');
});

console.log('\nAlertas cercanas (1 km)');
// Alerta en Kennedy; ubicaciones: oper a ~450 m, admin a ~1,6 km
const K = { lat: 4.6280, lng: -74.1477 };
let alertaCercana;
await prueba('cada usuario guarda su ubicación (redondeada) y nadie más la ve', async () => {
  await como(U.oper,  `select public.actualizar_mi_ubicacion($1, $2, 12)`, [K.lat + 0.00404, K.lng]);   // ~450 m
  await como(U.admin, `select public.actualizar_mi_ubicacion($1, $2, 12)`, [K.lat + 0.0144, K.lng]);    // ~1,6 km
  await como(U.audi,  `select public.actualizar_mi_ubicacion($1, $2, 12)`, [K.lat, K.lng + 0.003]);     // ~330 m
  const r = await comoSistema(`select lat from public.ubicaciones_usuario where user_id = $1`, [U.oper]);
  igual(Number(r.rows[0].lat), 4.632, 'redondeo a 3 decimales:');
  igual((await como(U.oper, `select * from public.ubicaciones_usuario`)).rows.length, 1);
  await debeFallar(como(U.oper, `update public.ubicaciones_usuario set lat = 0`));
});
await prueba('usuarios_cercanos: incluye a quien está a <1 km, excluye a quien está lejos y al autor', async () => {
  await como(U.beto, `select public.actualizar_mi_ubicacion($1, $2)`, [K.lat, K.lng]);
  alertaCercana = (await como(U.beto, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'robbery',$2,$3) returning id`, [U.beto, K.lat, K.lng])).rows[0].id;
  const r = await comoSistema(`select user_id, distancia_m from public.usuarios_cercanos($1)`, [alertaCercana]);
  const ids = r.rows.map(x => x.user_id);
  igual(ids.includes(U.oper), true, 'operadora a 450 m:'); igual(ids.includes(U.audi), true, 'auditor a 330 m:');
  igual(ids.includes(U.admin), false, 'admin a 1,6 km:'); igual(ids.includes(U.beto), false, 'autor:');
  const d = r.rows.find(x => x.user_id === U.oper).distancia_m;
  igual(d > 350 && d < 550, true, `distancia ${d} m:`);
});
await prueba('respeta la preferencia de no recibir avisos y las ubicaciones antiguas', async () => {
  await como(U.audi, `select public.configurar_alertas_cercanas(false)`);
  await comoSistema(`update public.ubicaciones_usuario set actualizado_at = now() - interval '3 days' where user_id = $1`, [U.oper]);
  const ids = (await comoSistema(`select user_id from public.usuarios_cercanos($1)`, [alertaCercana])).rows.map(x => x.user_id);
  igual(ids.includes(U.audi), false, 'desactivado:'); igual(ids.includes(U.oper), false, 'ubicación de hace 3 días:');
  await como(U.audi, `select public.configurar_alertas_cercanas(true)`);
});
await prueba('usuarios_cercanos no se puede llamar desde la app', async () => {
  await debeFallar(como(U.ana, `select * from public.usuarios_cercanos($1)`, [alertaCercana]), '42501');
});
await prueba('detalle público de la alerta: sin user_id, con distancia', async () => {
  const r = await como(U.audi, `select * from public.detalle_alerta_publica($1)`, [alertaCercana]);
  igual(r.rows.length, 1); igual('user_id' in r.rows[0], false); igual(r.rows[0].es_propia, false);
  igual(r.rows[0].distancia_m > 250 && r.rows[0].distancia_m < 400, true, `distancia ${r.rows[0].distancia_m}:`);
  await debeFallar(como('anon', `select * from public.detalle_alerta_publica($1)`, [alertaCercana]), '42501');
});
await prueba('alertas resueltas de hace más de 48 h ya no se muestran', async () => {
  await comoSistema(`update public.alerts set status = 'resolved', created_at = now() - interval '3 days' where id = $1`, [alertaCercana]);
  igual((await como(U.audi, `select * from public.detalle_alerta_publica($1)`, [alertaCercana])).rows.length, 0);
});

console.log('\nDispositivos y disparo de notificaciones');
const TOKEN = 'fcm-token-de-prueba-0123456789abcdef';
await prueba('un dispositivo queda asociado a una sola cuenta (celular compartido)', async () => {
  await como(U.ana, `select public.registrar_dispositivo($1, 'android')`, [TOKEN]);
  await como(U.beto, `select public.registrar_dispositivo($1, 'android')`, [TOKEN]);
  const r = await comoSistema(`select user_id from public.device_tokens where token = $1`, [TOKEN]);
  igual(r.rows.length, 1); igual(r.rows[0].user_id, U.beto);
});
await prueba('cerrar sesión borra solo el dispositivo actual', async () => {
  await como(U.beto, `select public.registrar_dispositivo($1, 'android')`, ['otro-dispositivo-0123456789abcdef']);
  await como(U.beto, `select public.eliminar_dispositivo($1)`, [TOKEN]);
  const r = await comoSistema(`select token from public.device_tokens where user_id = $1`, [U.beto]);
  igual(r.rows.length, 1); igual(r.rows[0].token, 'otro-dispositivo-0123456789abcdef');
});
await prueba('token inválido rechazado; sin sesión no se registra', async () => {
  await debeFallar(como(U.ana, `select public.registrar_dispositivo('x')`), '22023');
  await debeFallar(como('anon', `select public.registrar_dispositivo($1)`, [TOKEN]), '42501');
});
await prueba('si el aviso no puede enviarse (URL configurada sin pg_net), la alerta se guarda igual', async () => {
  await comoSistema(`insert into private.config values ('webhook_url', 'https://ejemplo.invalid/fn') on conflict (clave) do update set valor = excluded.valor`);
  const id = await nuevaAlerta(U.oper, 'fire');
  igual((await comoSistema(`select count(*)::int n from public.alerts where id = $1`, [id])).rows[0].n, 1);
  await como(U.oper, `select public.cambiar_estado_alerta($1, 'ack')`, [id]);
  await comoSistema(`delete from private.config where clave = 'webhook_url'`);
});

await prueba('las migraciones se pueden volver a ejecutar (idempotentes)', async () => {
  for (const f of migraciones) { await comoSistema('select 1'); await db.exec(readFileSync(join(dir, f), 'utf8')); }
});

console.log(`\nVulnerabilidades de producción reproducidas antes de migrar: ${vulnerabilidades}/7`);
console.log(`Resultado: ${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
