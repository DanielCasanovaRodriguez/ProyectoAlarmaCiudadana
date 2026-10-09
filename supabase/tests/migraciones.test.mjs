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
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}',
  email_confirmed_at timestamptz default now(), created_at timestamptz default now());
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
const espaciar = async (uid) => {
  // El límite de envío (desde el paso 8) exige espaciar las alertas: se
  // retrasan las anteriores del usuario para que la prueba no lo active.
  try { await comoSistema(`update public.alerts set created_at = created_at - interval '1 day' where user_id = $1 and created_at > now() - interval '1 day'`, [uid]); } catch { /* antes de migrar */ }
};
const nuevaAlerta = async (uid, tipo = 'robbery', lat = 4.62) => {
  await espaciar(uid);
  return (await como(uid, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,$2,$3,-74.14) returning id`,
    [uid, tipo, lat])).rows[0].id;
};

const nuevaAlertaEn = async (uid, lat, lng) => {
  await espaciar(uid);
  return (await como(uid, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'robbery',$2,$3) returning id`,
    [uid, lat, lng])).rows[0].id;
};

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

// Desde el paso 8 los ciudadanos necesitan su cédula completa para reportar
await como(U.ana, `select * from public.registrar_mi_cedula($1, $2)`, ['52000111', '2001-02-03']);

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
  // (paso 13: se consulta por cercanía; la alerta está en 4.62, -74.14)
  const r = await como(U.beto, `select * from public.alertas_cercanas(4.62, -74.14)`);
  igual(r.rows.length, 1); igual('user_id' in r.rows[0], false, 'expone user_id:');
  igual(r.rows[0].es_propia, false); igual(r.rows[0].media_urls.length, 0);
});
await prueba('la autora la ve como propia', async () => {
  igual((await como(U.ana, `select es_propia from public.alertas_cercanas(4.62, -74.14)`)).rows[0].es_propia, true);
});
await prueba('la autora adjunta evidencias (media_urls)', async () => {
  await como(U.ana, `update public.alerts set media_urls = array['alertas/' || $1 || '/1.jpg'] where id = $1::uuid`, [alertaAna]);
  igual((await comoSistema(`select media_urls from public.alerts where id = $1`, [alertaAna])).rows[0].media_urls[0], `alertas/${alertaAna}/1.jpg`);
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

// Ana ya no necesita su cédula de prueba
await comoSistema(`delete from public.cedulas where user_id = $1`, [U.ana]);
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

console.log('\nEscaneo de cédula (retirado en el paso 8)');
await prueba('la función de escaneo ya no se puede usar desde la app', async () => {
  // Paso 8: sin permiso (42501). Paso 12: la función ya no existe (42883).
  await debeFallar(como(U.beto, `select * from public.registrar_identidad('1012345678','amarilla','pdf417',true,true,null,'a','b')`));
});
await prueba('paso 12: sin funciones ni datos del escaneo', async () => {
  const r = await comoSistema(`select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('registrar_identidad','mi_identidad','admin_listar_identidades','admin_detalle_identidad','revisar_identidad')`);
  igual(r.rows[0].n, 0);
  igual((await comoSistema(`select count(*)::int n from public.verificaciones_identidad`)).rows[0].n, 0);
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
  await como(U.beto, `select * from public.registrar_mi_cedula($1, $2)`, ['1012345678', '2010-01-01']);
  await espaciar(U.beto);
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

console.log('\nRegistro con cédula (formulario) — unicidad real');
const registrarAuth = async (id, cedula, fecha, extra = {}) =>
  comoSistema(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at) values ($1, $2, $3, $4, coalesce($5::timestamptz, now()))`,
    [id, `${id}@test`, JSON.stringify({ nombres: 'Prueba', apellidos: 'Cédula', cedula, fecha_expedicion: fecha }),
     extra.confirmado === false ? null : new Date().toISOString(), extra.creado ?? null]);
const NUEVO1 = '00000000-0000-0000-0000-000000000101';
const NUEVO2 = '00000000-0000-0000-0000-000000000102';
const NUEVO3 = '00000000-0000-0000-0000-000000000103';
await prueba('el registro guarda la cédula cifrada y la QUITA de los metadatos', async () => {
  await registrarAuth(NUEVO1, '1.023.456.789', '2010-05-14');
  const c = await comoSistema(`select ultimos_digitos, numero_hash, encode(numero_cifrado,'escape') n, fecha_expedicion_cifrada is not null f from public.cedulas where user_id = $1`, [NUEVO1]);
  igual(c.rows[0].ultimos_digitos, '6789'); igual(c.rows[0].f, true);
  igual(c.rows[0].numero_hash.includes('1023456789') || c.rows[0].n.includes('1023456789'), false, 'texto plano:');
  const m = await comoSistema(`select raw_user_meta_data m from auth.users where id = $1`, [NUEVO1]);
  igual('cedula' in m.rows[0].m || 'fecha_expedicion' in m.rows[0].m, false, 'metadatos con cédula:');
});
await prueba('misma cédula (con puntos o ceros) → el usuario NO se crea', async () => {
  await debeFallar(registrarAuth(NUEVO2, '001023456789', '2011-01-01'), '23505');
  igual((await comoSistema(`select count(*)::int n from auth.users where id = $1`, [NUEVO2])).rows[0].n, 0);
});
await prueba('fecha futura, fecha imposible o cédula inválida → rechazadas', async () => {
  await debeFallar(registrarAuth(NUEVO2, '79111222', '2999-01-01'), '22023');
  await debeFallar(registrarAuth(NUEVO2, '79111222', '2023-02-30'), '22023');
  await debeFallar(registrarAuth(NUEVO2, '79111222', '1930-01-01'), '22023');
  await debeFallar(registrarAuth(NUEVO2, '1234', '2010-01-01'), '22023');
  await debeFallar(registrarAuth(NUEVO2, '1111111111', '2010-01-01'), '22023');
});
await prueba('una cédula reservada por una cuenta sin confirmar > 24 h se libera', async () => {
  await registrarAuth(NUEVO2, '80555666', '2005-03-03', { confirmado: false, creado: new Date(Date.now() - 2 * 864e5).toISOString() });
  await registrarAuth(NUEVO3, '80555666', '2005-03-03');
  igual((await comoSistema(`select count(*)::int n from auth.users where id = $1`, [NUEVO2])).rows[0].n, 0, 'cuenta vieja sin confirmar:');
  igual((await comoSistema(`select user_id from public.cedulas where user_id = $1`, [NUEVO3])).rows.length, 1);
});
await prueba('una cuenta CONFIRMADA nunca pierde su cédula', async () => {
  await comoSistema(`update auth.users set created_at = now() - interval '30 days' where id = $1`, [NUEVO1]);
  await debeFallar(registrarAuth(NUEVO2, '1023456789', '2010-05-14'), '23505');
});
await prueba('personal o cuentas sin cédula en metadatos se crean normalmente', async () => {
  await comoSistema(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"nombres":"Sin","apellidos":"Cedula"}')`, [NUEVO2]);
  igual((await comoSistema(`select count(*)::int n from public.cedulas where user_id = $1`, [NUEVO2])).rows[0].n, 0);
});

console.log('\nCuentas existentes: registrar mi cédula');
await prueba('una cuenta sin cédula la registra y ya puede reportar', async () => {
  igual((await como(NUEVO2, `select public.puede_reportar() p`)).rows[0].p, false);
  const r = await como(NUEVO2, `select * from public.registrar_mi_cedula($1, $2)`, ['52333444', '2008-08-08']);
  igual(r.rows[0].ultimos_digitos, '3444');
  igual((await como(NUEVO2, `select public.puede_reportar() p`)).rows[0].p, true);
  igual((await como(NUEVO2, `select completa from public.mi_cedula()`)).rows[0].completa, true);
});
await prueba('cédula de otra persona → mensaje controlado (sin revelar de quién es)', async () => {
  await debeFallar(como(U.oper, `select * from public.registrar_mi_cedula($1, $2)`, ['52333444', '2008-08-08']), '23505');
});
await prueba('no puede cambiar su cédula por otra; sí completar la fecha de una migrada', async () => {
  await debeFallar(como(NUEVO2, `select * from public.registrar_mi_cedula($1, $2)`, ['99888777', '2008-08-08']), '22023');
  await comoSistema(`update public.cedulas set fecha_expedicion_cifrada = null where user_id = $1`, [NUEVO2]);
  igual((await como(NUEVO2, `select public.puede_reportar() p`)).rows[0].p, false, 'sin fecha:');
  await como(NUEVO2, `select * from public.registrar_mi_cedula($1, $2)`, ['52.333.444', '2008-08-08']);
  igual((await como(NUEVO2, `select public.puede_reportar() p`)).rows[0].p, true);
});
await prueba('cada usuario solo ve su propia cédula', async () => {
  igual((await como(NUEVO2, `select * from public.cedulas`)).rows.length, 1);
  igual((await como(U.oper, `select * from public.cedulas`)).rows.length, 0);
  await debeFallar(como(NUEVO2, `insert into public.cedulas (user_id, numero_hash, numero_cifrado, ultimos_digitos) values ($1,'x','\\x00','1')`, [NUEVO2]));
});

console.log('\nAcceso con cédula (anti fuerza bruta)');
await prueba('acceso_preparar encuentra la cuenta por cédula; la app NO puede llamarla', async () => {
  const r = await comoSistema(`select * from public.acceso_preparar($1, '10.0.0.1')`, ['1.023.456.789']);
  igual(r.rows[0].user_id, NUEVO1); igual(r.rows[0].bloqueado_segundos, 0);
  await debeFallar(como(U.ana, `select * from public.acceso_preparar($1, 'x')`, ['1023456789']), '42501');
});
await prueba('cédula inexistente o inválida → sin cuenta, sin error', async () => {
  igual((await comoSistema(`select user_id from public.acceso_preparar('77777777', '10.0.0.1')`)).rows[0].user_id, null);
  igual((await comoSistema(`select user_id from public.acceso_preparar('abc', '10.0.0.1')`)).rows[0].user_id, null);
});
await prueba('5 contraseñas fallidas bloquean esa cédula 15 min; el éxito no se acepta durante el bloqueo', async () => {
  for (let i = 0; i < 5; i++) await comoSistema(`select public.acceso_resultado($1, '10.0.0.2', false)`, ['1023456789']);
  const r = await comoSistema(`select * from public.acceso_preparar($1, '10.0.0.3')`, ['1023456789']);
  igual(r.rows[0].user_id, null); igual(r.rows[0].bloqueado_segundos > 800, true, `segundos ${r.rows[0].bloqueado_segundos}:`);
  await comoSistema(`delete from private.intentos_acceso`);
});
await prueba('20 fallos desde una misma IP la bloquean (aunque cambie la cédula)', async () => {
  for (let i = 0; i < 20; i++) await comoSistema(`select public.acceso_resultado($1, '10.9.9.9', false)`, [String(60000000 + i)]);
  igual((await comoSistema(`select bloqueado_segundos b from public.acceso_preparar($1, '10.9.9.9')`, ['1023456789'])).rows[0].b > 0, true);
  igual((await comoSistema(`select bloqueado_segundos b from public.acceso_preparar($1, '10.1.1.1')`, ['1023456789'])).rows[0].b, 0, 'otra IP:');
  await comoSistema(`delete from private.intentos_acceso`);
});
await prueba('un ciudadano NO puede quitarse un bloqueo ni cambiar sus alertas falsas', async () => {
  await comoSistema(`update public.profiles set bloqueado_hasta = now() + interval '1 day', reportes_falsos = 2 where id = $1`, [U.ana]);
  await como(U.ana, `update public.profiles set bloqueado_hasta = null, reportes_falsos = 0 where id = $1`, [U.ana]);
  const r = await comoSistema(`select bloqueado_hasta is not null b, reportes_falsos f from public.profiles where id = $1`, [U.ana]);
  igual(r.rows[0].b, true); igual(r.rows[0].f, 2);
  await comoSistema(`update public.profiles set bloqueado_hasta = null, reportes_falsos = 0 where id = $1`, [U.ana]);
});
await prueba('cuenta suspendida no puede acceder', async () => {
  await comoSistema(`update public.profiles set status = 'suspended' where id = $1`, [NUEVO1]);
  igual((await comoSistema(`select user_id from public.acceso_preparar($1, '10.0.0.1')`, ['1023456789'])).rows[0].user_id, null);
  await comoSistema(`update public.profiles set status = 'active' where id = $1`, [NUEVO1]);
});
await prueba('los accesos quedan en la auditoría', async () => {
  await comoSistema(`select public.acceso_resultado($1, '10.0.0.4', true, $2)`, ['1023456789', NUEVO1]);
  igual((await comoSistema(`select count(*)::int n from public.auditoria where accion = 'acceso_cedula_fallido'`)).rows[0].n >= 25, true);
  igual((await comoSistema(`select count(*)::int n from public.auditoria where accion = 'acceso_cedula' and usuario_id = $1`, [NUEVO1])).rows[0].n, 1);
});

console.log('\nAntiabuso de alertas');
await prueba('límite: una segunda alerta en el mismo minuto es rechazada', async () => {
  await comoSistema(`update public.alerts set created_at = created_at - interval '1 day' where user_id = $1`, [NUEVO2]);
  await como(NUEVO2, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'fire',4.6,-74.1)`, [NUEVO2]);
  await debeFallar(como(NUEVO2, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'fire',4.6,-74.1)`, [NUEVO2]), 'P0001');
});
await prueba('el personal no tiene límite de envío', async () => {
  await nuevaAlerta(U.oper, 'fire'); await como(U.oper, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'fire',4.6,-74.1)`, [U.oper]);
});
await prueba('3 alertas falsas en 30 días bloquean los reportes 7 días', async () => {
  for (let i = 0; i < 3; i++) {
    const id = await nuevaAlerta(NUEVO2, 'robbery');
    await debeFallar(como(NUEVO2, `select public.marcar_alerta_falsa($1)`, [id]), '42501'); // un ciudadano no puede
    await como(U.oper, `select public.marcar_alerta_falsa($1, 'Llamada de broma')`, [id]);
    igual((await comoSistema(`select status, marcada_falsa from public.alerts where id = $1`, [id])).rows[0].marcada_falsa, true);
  }
  const p = await comoSistema(`select reportes_falsos, bloqueado_hasta > now() + interval '6 days' b from public.profiles where id = $1`, [NUEVO2]);
  igual(p.rows[0].reportes_falsos, 3); igual(p.rows[0].b, true);
  igual((await como(NUEVO2, `select public.puede_reportar() p`)).rows[0].p, false);
  await debeFallar(nuevaAlerta(NUEVO2, 'fire'));
  igual((await como(NUEVO2, `select puede_reportar from public.mi_estado_reporte()`)).rows[0].puede_reportar, false);
});

console.log('\nAdministración de cédulas');
await prueba('admin ve el número (y queda auditado); auditor y ciudadano no', async () => {
  const r = await como(U.admin, `select * from public.admin_ver_cedula($1)`, [NUEVO1]);
  igual(r.rows[0].numero, '1023456789'); igual(r.rows[0].fecha_expedicion, '2010-05-14');
  igual((await comoSistema(`select count(*)::int n from public.auditoria where accion = 'ver_cedula'`)).rows[0].n, 1);
  await debeFallar(como(U.audi, `select * from public.admin_ver_cedula($1)`, [NUEVO1]), '42501');
  await debeFallar(como(NUEVO2, `select * from public.admin_ver_cedula($1)`, [NUEVO1]), '42501');
  igual((await como(U.audi, `select * from public.admin_listar_cedulas()`)).rows.length >= 3, true);
});
await prueba('suplantación: el admin libera la cédula y suspende la cuenta', async () => {
  await debeFallar(como(U.admin, `select public.admin_liberar_cedula($1, '')`, [NUEVO3]), '22023');
  await como(U.admin, `select public.admin_liberar_cedula($1, 'Denuncia de suplantación')`, [NUEVO3]);
  igual((await comoSistema(`select status from public.profiles where id = $1`, [NUEVO3])).rows[0].status, 'suspended');
  const libre = '00000000-0000-0000-0000-000000000104';
  await registrarAuth(libre, '80555666', '2005-03-03'); // la cédula quedó libre
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

console.log('\n— Interventoría: validación de alertas, autorización de datos y habeas data');
await como(U.ana, `select public.registrar_mi_cedula('52000999', '2001-02-03')`);
await prueba('el ciudadano no fija campos internos al crear una alerta', async () => {
  await espaciar(U.ana);
  const r = await como(U.ana, `insert into public.alerts (user_id, type_code, lat, lng, created_at, marcada_falsa, operador_asignado_id)
    values ($1, 'robbery', 4.62, -74.14, now() - interval '30 days', true, $2) returning id`, [U.ana, U.oper]);
  const a = (await comoSistema(`select created_at > now() - interval '1 minute' reciente, marcada_falsa, operador_asignado_id
    from public.alerts where id = $1`, [r.rows[0].id])).rows[0];
  igual(a.reciente, true); igual(a.marcada_falsa, false); igual(a.operador_asignado_id, null);
});
await prueba('alerta fuera de Colombia rechazada', async () => {
  await espaciar(U.ana);
  await debeFallar(como(U.ana, `insert into public.alerts (user_id, type_code, lat, lng) values ($1, 'robbery', 37.42, -122.08)`, [U.ana]), '22023');
});
await prueba('alertas en San Andrés y Leticia sí se aceptan', async () => {
  await nuevaAlertaEn(U.ana, 12.58, -81.70);
  await nuevaAlertaEn(U.ana, -4.21, -69.94);
});
await prueba('descripción de más de 1000 caracteres rechazada; espacios se recortan', async () => {
  await espaciar(U.ana);
  await debeFallar(como(U.ana, `insert into public.alerts (user_id, type_code, lat, lng, description) values ($1, 'robbery', 4.62, -74.14, repeat('a', 1001))`, [U.ana]), '22001');
  const id = await nuevaAlerta(U.ana);
  await como(U.ana, `update public.alerts set description = '   ' where id = $1`, [id]);
  igual((await comoSistema(`select description from public.alerts where id = $1`, [id])).rows[0].description, null);
});
await prueba('evidencias: solo rutas de la misma alerta', async () => {
  const id = await nuevaAlerta(U.ana);
  await como(U.ana, `update public.alerts set media_urls = array['alertas/' || $1 || '/foto-1.jpg'] where id = $1::uuid`, [id]);
  await debeFallar(como(U.ana, `update public.alerts set media_urls = array['https://atacante.example/x.png'] where id = $1`, [id]), '22023');
  await debeFallar(como(U.ana, `update public.alerts set media_urls = array['alertas/00000000-0000-0000-0000-000000000000/x.jpg'] where id = $1`, [id]), '22023');
});
await prueba('el autor no puede quitar la marca de alerta falsa', async () => {
  const id = await nuevaAlerta(U.ana);
  await como(U.oper, `select public.marcar_alerta_falsa($1, 'prueba')`, [id]);
  await comoSistema(`update public.alerts set status = 'open' where id = $1`, [id]);
  await como(U.ana, `update public.alerts set marcada_falsa = false where id = $1`, [id]);
  igual((await comoSistema(`select marcada_falsa from public.alerts where id = $1`, [id])).rows[0].marcada_falsa, true);
  await comoSistema(`update public.profiles set bloqueado_hasta = null, reportes_falsos = 0 where id = $1`, [U.ana]);
  await comoSistema(`update public.alerts set marcada_falsa = false where user_id = $1`, [U.ana]);
});
await prueba('autorización de datos: solo por la función, con fecha del servidor y auditoría', async () => {
  await como(U.beto, `update public.profiles set consentimiento_version = '2099-01-01', consentimiento_fecha = now() where id = $1`, [U.beto]);
  igual((await comoSistema(`select consentimiento_version v from public.profiles where id = $1`, [U.beto])).rows[0].v, null);
  await como(U.beto, `select public.aceptar_politica('2026-10-08')`);
  const p = (await comoSistema(`select consentimiento_version v, consentimiento_fecha is not null f from public.profiles where id = $1`, [U.beto])).rows[0];
  igual(p.v, '2026-10-08'); igual(p.f, true);
  igual((await comoSistema(`select count(*)::int n from public.auditoria where accion = 'acepta_politica' and usuario_id = $1`, [U.beto])).rows[0].n, 1);
  await debeFallar(como(U.beto, `select public.aceptar_politica('x')`), '22023');
  await debeFallar(como('anon', `select public.aceptar_politica('2026-10-08')`), '42501');
});
await prueba('habeas data: plazo legal, privacidad entre titulares y respuesta del admin', async () => {
  const r = (await como(U.beto, `select * from public.crear_solicitud_titular('consulta', 'Quiero saber qué datos tienen de mí')`)).rows[0];
  const dias = (await comoSistema(`select count(*)::int n from generate_series(current_date + 1, $1::date, '1 day') d where extract(isodow from d) < 6`, [r.fecha_limite])).rows[0].n;
  igual(dias, 10);
  const rec = (await como(U.beto, `select * from public.crear_solicitud_titular('supresion', 'Eliminen mi cuenta por favor')`)).rows[0];
  const diasRec = (await comoSistema(`select count(*)::int n from generate_series(current_date + 1, $1::date, '1 day') d where extract(isodow from d) < 6`, [rec.fecha_limite])).rows[0].n;
  igual(diasRec, 15);
  igual((await como(U.ana, `select * from public.solicitudes_titular`)).rows.length, 0);
  await debeFallar(como(U.beto, `insert into public.solicitudes_titular (user_id, tipo, mensaje, fecha_limite) values ($1, 'queja', 'xxxxxxxxxxxx', current_date)`, [U.beto]));
  await debeFallar(como(U.beto, `select public.crear_solicitud_titular('consulta', 'corto')`), '22023');
  await debeFallar(como(U.oper, `select public.admin_responder_solicitud($1, 'respondida', 'Respuesta de prueba')`, [r.id]), '42501');
  await como(U.admin, `select public.admin_responder_solicitud($1, 'respondida', 'Tenemos su nombre, cédula y alertas.')`, [r.id]);
  igual((await como(U.beto, `select estado from public.solicitudes_titular where id = $1`, [r.id])).rows[0].estado, 'respondida');
});
await prueba('supresión: solo admin, solo ciudadanos, borra todo y conserva la constancia', async () => {
  const T = '00000000-0000-0000-0000-0000000000f9';
  await comoSistema(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'titular@test', '{"nombres":"Tita","apellidos":"Titular","cedula":"52000777","fecha_expedicion":"2010-01-01"}')`, [T]);
  const alerta = await nuevaAlerta(T);
  await como(T, `update public.alerts set media_urls = array['alertas/' || $1 || '/f.jpg'] where id = $1::uuid`, [alerta]);
  await como(T, `insert into public.emergency_contacts (user_id, name, phone) values ($1, 'Mamá', '3001234567')`, [T]);
  const sol = (await como(T, `select * from public.crear_solicitud_titular('supresion', 'Eliminen todos mis datos')`)).rows[0];
  igual((await como(U.admin, `select * from public.admin_evidencias_titular($1)`, [T])).rows[0].ruta, `alertas/${alerta}/f.jpg`);
  igual((await como(U.oper, `select * from public.admin_evidencias_titular($1)`, [T])).rows.length, 0);
  await debeFallar(como(U.oper, `select public.admin_suprimir_titular($1, $2, 'Solicitud atendida')`, [T, sol.id]), '42501');
  await debeFallar(como(U.admin, `select public.admin_suprimir_titular($1, null, 'Solicitud atendida')`, [U.oper]), '42501');
  await como(U.admin, `select public.admin_suprimir_titular($1, $2, 'Datos suprimidos el día de hoy')`, [T, sol.id]);
  const quedan = (await comoSistema(`select
    (select count(*) from auth.users where id = $1)::int u, (select count(*) from public.profiles where id = $1)::int p,
    (select count(*) from public.cedulas where user_id = $1)::int c, (select count(*) from public.alerts where user_id = $1)::int a,
    (select count(*) from public.emergency_contacts where user_id = $1)::int e`, [T])).rows[0];
  igual(JSON.stringify(quedan), JSON.stringify({ u: 0, p: 0, c: 0, a: 0, e: 0 }));
  const s = (await comoSistema(`select user_id, estado from public.solicitudes_titular where id = $1`, [sol.id])).rows[0];
  igual(s.user_id, null); igual(s.estado, 'cerrada');
  // la cédula queda libre para un registro nuevo
  await comoSistema(`insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000fa', 'nuevo@test', '{"nombres":"N","apellidos":"N","cedula":"52000777","fecha_expedicion":"2010-01-01"}')`);
});
console.log('\n— Proximidad real: 5 km');
// Medellín (lejos de las alertas de prueba de Bogotá). 1° de latitud ≈ 111 195 m (Haversine).
const MED = { lat: 6.2442, lng: -75.5812 };
const alNorte = (m) => MED.lat + m / 111195;
let idsMed = {};
await prueba('preparación: alertas en Medellín a 0,3 / 4,95 / 5,05 km', async () => {
  idsMed.cerca  = await nuevaAlertaEn(U.ana, alNorte(300),  MED.lng);
  idsMed.borde  = await nuevaAlertaEn(U.ana, alNorte(4950), MED.lng);
  idsMed.fuera  = await nuevaAlertaEn(U.ana, alNorte(5050), MED.lng);
  await comoSistema(`update public.alerts set created_at = now() where id = any($1::uuid[])`, [Object.values(idsMed)]);
});
await prueba('desde Medellín: solo alertas ≤ 5 km, ordenadas por distancia (ninguna de Bogotá)', async () => {
  const r = (await como(U.beto, `select id, distancia_m, lat from public.alertas_cercanas($1, $2, 5000)`, [MED.lat, MED.lng])).rows;
  const ids = r.map(x => x.id);
  igual(ids.includes(idsMed.cerca), true, 'a 300 m');
  igual(ids.includes(idsMed.borde), true, 'a 4,95 km');
  igual(ids.includes(idsMed.fuera), false, 'a 5,05 km');
  igual(r.every(x => x.lat > 5.5), true, 'ninguna de Bogotá');
  igual(r[0].id, idsMed.cerca, 'la más cercana primero');
  igual(r.every(x => x.distancia_m <= 5000), true);
});
await prueba('el radio nunca supera 5 km aunque se pida más', async () => {
  const ids = (await como(U.beto, `select id from public.alertas_cercanas($1, $2, 50000)`, [MED.lat, MED.lng])).rows.map(x => x.id);
  igual(ids.includes(idsMed.fuera), false);
});
await prueba('desde Bogotá no aparecen las de Medellín', async () => {
  const ids = (await como(U.beto, `select id from public.alertas_cercanas(4.62, -74.14, 5000)`)).rows.map(x => x.id);
  igual(Object.values(idsMed).some(id => ids.includes(id)), false);
});
await prueba('exploración manual: alertas del área visible; área enorme rechazada', async () => {
  const ids = (await como(U.beto, `select id from public.alertas_en_area($1, $2, $3, $4)`,
    [MED.lat - 0.1, MED.lng - 0.1, MED.lat + 0.1, MED.lng + 0.1])).rows.map(x => x.id);
  igual(ids.includes(idsMed.fuera), true, 'explorando sí se ve la de 5,05 km');
  await debeFallar(como(U.beto, `select * from public.alertas_en_area(-4, -79, 12, -67)`), '22023');
  await debeFallar(como('anon', `select * from public.alertas_cercanas($1, $2)`, [MED.lat, MED.lng]), '42501');
});
await prueba('no expone quién reportó ni evidencias ajenas', async () => {
  const cols = (await como(U.beto, `select * from public.alertas_cercanas($1, $2, 5000)`, [MED.lat, MED.lng])).fields.map(f => f.name);
  igual(cols.includes('user_id'), false);
  const r = (await como(U.beto, `select media_urls, es_propia from public.alertas_cercanas($1, $2, 5000)`, [MED.lat, MED.lng])).rows;
  igual(r.every(x => x.es_propia === false && x.media_urls.length === 0), true);
});
await prueba('función anterior (web publicada): ciudadano ve solo ≤ 1 km de su última ubicación', async () => {
  await como(U.beto, `select public.actualizar_mi_ubicacion($1, $2, 10)`, [MED.lat, MED.lng]);
  const ids = (await como(U.beto, `select id from public.alertas_activas_publicas()`)).rows.map(x => x.id);
  igual(ids.includes(idsMed.cerca), true); igual(ids.includes(idsMed.fuera), false);
  igual(ids.length, (await como(U.beto, `select id from public.alertas_cercanas($1, $2)`, [MED.lat, MED.lng])).rows.length);
  // el personal sigue viendo todas
  const todas = (await como(U.oper, `select id from public.alertas_activas_publicas()`)).rows.length;
  igual(todas > ids.length, true);
});
console.log('\n— Paso 14: radio de 1 km y vigencia de 1 hora');
await prueba('por defecto "cerca de ti" es 1 km', async () => {
  const ids = (await como(U.beto, `select id from public.alertas_cercanas($1, $2)`, [MED.lat, MED.lng])).rows.map(x => x.id);
  igual(ids.includes(idsMed.cerca), true, 'a 300 m');
  igual(ids.includes(idsMed.borde), false, 'a 4,95 km ya no es "cerca"');
});
await prueba('explorando el mapa se ven alertas lejanas (p. ej. Bogotá desde Montería) sin contarlas como cercanas', async () => {
  const bog = await nuevaAlertaEn(U.ana, 4.65, -74.08);
  await comoSistema(`update public.alerts set created_at = now() where id = $1`, [bog]);
  const enArea = (await como(U.beto, `select id from public.alertas_en_area(4.5, -74.2, 4.8, -73.9)`)).rows.map(x => x.id);
  igual(enArea.includes(bog), true);
  const cercaMonteria = (await como(U.beto, `select id from public.alertas_cercanas(8.75, -75.88)`)).rows.map(x => x.id);
  igual(cercaMonteria.includes(bog), false);
  // área grande (≈ 220 km) permitida; país completo no
  await como(U.beto, `select * from public.alertas_en_area(3.8, -75.0, 5.8, -73.0)`);
  await debeFallar(como(U.beto, `select * from public.alertas_en_area(-4, -79, 12, -67)`), '22023');
});
await prueba('después de 1 hora la alerta sale del mapa y se cierra sola, sin borrarse', async () => {
  const id = await nuevaAlertaEn(U.ana, MED.lat, MED.lng + 0.001);
  await comoSistema(`update public.alerts set created_at = now() - interval '61 minutes' where id = $1`, [id]);
  // fuera del mapa aunque la tarea programada no haya corrido
  const visibles = (await como(U.beto, `select id from public.alertas_cercanas($1, $2)`, [MED.lat, MED.lng])).rows.map(x => x.id);
  igual(visibles.includes(id), false);
  const total = (await comoSistema(`select count(*)::int n from public.alerts`)).rows[0].n;
  const cerradas = (await comoSistema(`select public.cerrar_alertas_vencidas() n`)).rows[0].n;
  igual(cerradas >= 1, true);
  const a = (await comoSistema(`select status, cierre_automatico, resolved_at is not null r from public.alerts where id = $1`, [id])).rows[0];
  igual(a.status, 'resolved'); igual(a.cierre_automatico, true); igual(a.r, true);
  igual((await comoSistema(`select count(*)::int n from public.alerts`)).rows[0].n, total, 'no se borra ninguna alerta');
  const h = (await comoSistema(`select note from public.alert_status_history where alert_id = $1 and new_status = 'resolved'`, [id])).rows;
  igual(h.length, 1); igual(/automático/.test(h[0].note), true);
  // la autora la sigue viendo en su historial
  igual((await como(U.ana, `select count(*)::int n from public.alerts where id = $1`, [id])).rows[0].n, 1);
});
await prueba('probar notificaciones: sin dispositivo avisa; con dispositivo, 1 por minuto', async () => {
  const sinDisp = (await como(U.audi, `select public.probar_mis_notificaciones() r`)).rows[0].r;
  igual(sinDisp.ok, false); igual(sinDisp.motivo, 'sin_dispositivo');
  await como(U.audi, `select public.registrar_dispositivo($1, 'android')`, ['token-de-prueba-auditor-0123456789abcdef']);
  // sin pg_net en las pruebas: queda "sin configurar", pero nunca falla
  const r = (await como(U.audi, `select public.probar_mis_notificaciones() r`)).rows[0].r;
  igual(typeof r.ok, 'boolean');
  await debeFallar(como('anon', `select public.probar_mis_notificaciones()`), '42501');
});
await prueba('mensaje del personal: llega a la bandeja del autor; ciudadanos no pueden enviarlo', async () => {
  const id = await nuevaAlerta(U.ana);
  const r = (await como(U.oper, `select public.enviar_mensaje_ciudadano($1, 'La patrulla va en camino') r`, [id])).rows[0].r;
  igual(r.ok, true);
  const bandeja = (await como(U.ana, `select titulo, mensaje from public.notificaciones where alerta_id = $1`, [id])).rows;
  igual(bandeja.length, 1); igual(bandeja[0].mensaje, 'La patrulla va en camino');
  igual((await como(U.beto, `select count(*)::int n from public.notificaciones where alerta_id = $1`, [id])).rows[0].n, 0, 'otro ciudadano no lo ve');
  await debeFallar(como(U.beto, `select public.enviar_mensaje_ciudadano($1, 'hola hola')`, [id]), '42501');
  await debeFallar(como(U.oper, `select public.enviar_mensaje_ciudadano($1, 'x')`, [id]), '22023');
});
await prueba('la tarea de cierre no se puede llamar desde la app', async () => {
  await debeFallar(como(U.ana, `select public.cerrar_alertas_vencidas()`), '42501');
});
await prueba('ya no se pueden subir fotos de cédula', async () => {
  await comoSistema(`insert into storage.buckets (id, name) values ('documentos-identidad', 'documentos-identidad') on conflict do nothing`);
  await debeFallar(como(U.ana, `insert into storage.objects (bucket_id, name) values ('documentos-identidad', $1 || '/frente.jpg')`, [U.ana]));
});

await prueba('las migraciones se pueden volver a ejecutar (idempotentes)', async () => {
  for (const f of migraciones) { await comoSistema('select 1'); await db.exec(readFileSync(join(dir, f), 'utf8')); }
});

console.log(`\nVulnerabilidades de producción reproducidas antes de migrar: ${vulnerabilidades}/7`);
console.log(`Resultado: ${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
