/**
 * Pruebas de las migraciones de supabase/migrations sobre una PostgreSQL
 * local embebida (PGlite). No se conecta a Supabase ni a ninguna red.
 *
 * Recrea el esquema según src/types/database.types.ts, simula lo mínimo
 * de Supabase (roles anon/authenticated, auth.uid(), auth.jwt(), storage)
 * y verifica los escenarios de seguridad y de uso normal.
 *
 * Ejecutar:  npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();

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
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default true,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id serial primary key, bucket_id text references storage.buckets(id), name text);
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant usage, select on all sequences in schema storage to authenticated;
insert into storage.buckets (id, name) values ('evidencias', 'evidencias');
`;

// Esquema según database.types.ts. Se usan ENUMs a propósito para comprobar
// que las funciones funcionan aunque "status" no sea de tipo text.
const ESQUEMA = `
create type user_role    as enum ('citizen','operator','admin','auditor');
create type user_status  as enum ('active','inactive','suspended');
create type alert_status as enum ('open','ack','resolved');

create table public.profiles (
  id uuid primary key, full_name text, role user_role not null default 'citizen',
  status user_status not null default 'active', phone text,
  intentos_fallidos int not null default 0, bloqueado_hasta timestamptz,
  consentimiento_fecha timestamptz, consentimiento_version text,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table public.alert_types (id serial primary key, code text unique, label text,
  descripcion text, icono text, color text, activo boolean default true, orden int default 0);
create table public.alerts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  type_code text not null, description text, severity int default 3,
  lat double precision not null, lng double precision not null,
  status alert_status not null default 'open', anonimo boolean default false,
  operador_asignado_id uuid, ack_at timestamptz, resolved_at timestamptz,
  media_urls text[] default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.alert_media (id serial primary key, alert_id uuid references public.alerts(id),
  user_id uuid, kind text, storage_path text, tamano_bytes bigint, duracion_seg int, created_at timestamptz default now());
create table public.alert_status_history (id serial primary key, alert_id uuid references public.alerts(id),
  old_status alert_status, new_status alert_status not null, changed_by uuid, note text, changed_at timestamptz default now());
create table public.emergency_contacts (id serial primary key, user_id uuid not null, name text, phone text,
  relation text, notificar_sos boolean default true, created_at timestamptz default now());
create table public.device_tokens (id serial primary key, user_id uuid, platform text, token text, created_at timestamptz default now());
create table public.notificaciones (id uuid primary key default gen_random_uuid(), usuario_id uuid,
  alerta_id uuid, titulo text, mensaje text, leida boolean default false, created_at timestamptz default now());
create table public.auditoria (id uuid primary key default gen_random_uuid(), usuario_id uuid, usuario_email text,
  accion text, entidad text, entidad_id text, detalle jsonb, ip_origen text, created_at timestamptz default now());
create table public.asignaciones_unidad (id uuid primary key default gen_random_uuid(), alerta_id uuid,
  operador_id uuid, nombre_unidad text, tipo_unidad text, eta_minutos int, created_at timestamptz default now());
create table public.cola_sincronizacion (id uuid primary key default gen_random_uuid(), alerta_id uuid,
  payload jsonb, estado text default 'pendiente', intentos int default 0, hash_evento text,
  created_at timestamptz default now(), synced_at timestamptz);

-- Permisos por defecto de Supabase
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
`;

// ------------------------------------------------------------------ ayudas
const U = {
  ana:   '00000000-0000-0000-0000-00000000000a', // ciudadana
  beto:  '00000000-0000-0000-0000-00000000000b', // ciudadano
  oper:  '00000000-0000-0000-0000-0000000000c1', // operador
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
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg ?? ''} esperado=${JSON.stringify(b)} obtenido=${JSON.stringify(a)}`); }
async function debeFallar(p, codigo) {
  try { await p; } catch (e) {
    if (codigo && e.code !== codigo) throw new Error(`falló con código ${e.code} (${e.message}), se esperaba ${codigo}`);
    return;
  }
  throw new Error('se esperaba un error y la operación fue permitida');
}

// ------------------------------------------------------------------ montaje
await db.exec(SUPABASE_STUB);
await db.exec(ESQUEMA);

// Perfiles existentes antes de la migración (como en producción)
await comoSistema(`insert into public.profiles (id, full_name, role) values
  ($1,'Ana','citizen'), ($2,'Beto','citizen'), ($3,'Olga Operadora','operator'), ($4,'Admin','admin'), ($5,'Auditor','auditor')`,
  [U.ana, U.beto, U.oper, U.admin, U.audi]);

const dir = join(here, '..', 'migrations');
for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(dir, f), 'utf8'));
  console.log('Migración aplicada:', f);
}

// ------------------------------------------------------------------ pruebas
console.log('\nPerfiles');
await prueba('registro con role=admin en metadatos queda como citizen', async () => {
  const nuevo = '00000000-0000-0000-0000-0000000000f1';
  await comoSistema(`insert into public.profiles (id, full_name, role) values ($1, 'Intruso', 'admin')`, [nuevo]);
  const r = await comoSistema(`select role from public.profiles where id = $1`, [nuevo]);
  igual(r.rows[0].role, 'citizen');
});
await prueba('un ciudadano NO puede volverse admin editando su perfil', async () => {
  await como(U.ana, `update public.profiles set role = 'admin', full_name = 'Ana María' where id = $1`, [U.ana]);
  const r = await comoSistema(`select role, full_name from public.profiles where id = $1`, [U.ana]);
  igual(r.rows[0].role, 'citizen', 'rol:'); igual(r.rows[0].full_name, 'Ana María', 'nombre (sí debe cambiar):');
});
await prueba('un ciudadano NO ve perfiles ajenos', async () => {
  const r = await como(U.ana, `select id from public.profiles`);
  igual(r.rows.length, 1);
});
await prueba('un admin SÍ puede cambiar el rol de otro usuario', async () => {
  await como(U.admin, `update public.profiles set role = 'operator' where id = $1`, [U.beto]);
  const r = await comoSistema(`select role from public.profiles where id = $1`, [U.beto]);
  igual(r.rows[0].role, 'operator');
  await como(U.admin, `update public.profiles set role = 'citizen' where id = $1`, [U.beto]);
});

console.log('\nAlertas');
let alertaAna;
await prueba('ciudadana crea su alerta', async () => {
  const r = await como(U.ana, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'robbery',4.62,-74.14) returning id`, [U.ana]);
  alertaAna = r.rows[0].id;
});
await prueba('no puede crear alertas a nombre de otro usuario', async () => {
  await debeFallar(como(U.ana, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'fire',4.6,-74.1)`, [U.beto]));
});
await prueba('otro ciudadano NO lee la alerta directamente (tabla)', async () => {
  const r = await como(U.beto, `select * from public.alerts where id = $1`, [alertaAna]);
  igual(r.rows.length, 0);
});
await prueba('otro ciudadano la ve en el mapa SIN user_id ni evidencias', async () => {
  const r = await como(U.beto, `select * from public.alertas_activas_publicas()`);
  igual(r.rows.length, 1); igual('user_id' in r.rows[0], false, 'expone user_id:');
  igual(r.rows[0].es_propia, false); igual(r.rows[0].media_urls.length, 0);
});
await prueba('la autora sí la ve como propia', async () => {
  const r = await como(U.ana, `select es_propia from public.alertas_activas_publicas()`);
  igual(r.rows[0].es_propia, true);
});
await prueba('la ciudadana puede adjuntar evidencias (media_urls)', async () => {
  await como(U.ana, `update public.alerts set media_urls = array['alertas/x/1.jpg'] where id = $1`, [alertaAna]);
  const r = await comoSistema(`select media_urls from public.alerts where id = $1`, [alertaAna]);
  igual(r.rows[0].media_urls[0], 'alertas/x/1.jpg');
});
await prueba('la ciudadana NO puede cambiar el estado ni la ubicación directamente', async () => {
  await como(U.ana, `update public.alerts set status = 'resolved', lat = 0 where id = $1`, [alertaAna]);
  const r = await comoSistema(`select status, lat from public.alerts where id = $1`, [alertaAna]);
  igual(r.rows[0].status, 'open'); igual(r.rows[0].lat, 4.62);
});
await prueba('anónimo (sin sesión) no puede leer alertas', async () => {
  await debeFallar(como('anon', `select * from public.alerts`), '42501');
});
await prueba('anónimo no puede llamar a alertas_activas_publicas()', async () => {
  await debeFallar(como('anon', `select * from public.alertas_activas_publicas()`), '42501');
});

console.log('\nCambios de estado (RPC)');
await prueba('un ciudadano NO puede usar cambiar_estado_alerta', async () => {
  await debeFallar(como(U.beto, `select public.cambiar_estado_alerta($1, 'resolved')`, [alertaAna]), '42501');
});
await prueba('operadora atiende la alerta (ack): fija ack_at, historial y auditoría', async () => {
  await como(U.oper, `select public.cambiar_estado_alerta($1, 'ack', 'Patrulla en camino')`, [alertaAna]);
  const a = await comoSistema(`select status, ack_at, operador_asignado_id from public.alerts where id = $1`, [alertaAna]);
  igual(a.rows[0].status, 'ack'); igual(a.rows[0].ack_at !== null, true, 'ack_at:');
  igual(a.rows[0].operador_asignado_id, U.oper);
  const h = await comoSistema(`select old_status, new_status, note from public.alert_status_history where alert_id = $1`, [alertaAna]);
  igual(h.rows.length, 1); igual(h.rows[0].new_status, 'ack'); igual(h.rows[0].note, 'Patrulla en camino');
  const au = await comoSistema(`select accion from public.auditoria where entidad_id = $1`, [alertaAna]);
  igual(au.rows[0].accion, 'cambiar_estado');
});
await prueba('estado inválido es rechazado', async () => {
  await debeFallar(como(U.oper, `select public.cambiar_estado_alerta($1, 'borrada')`, [alertaAna]), '22023');
});
await prueba('la autora ve el historial de su alerta; otro ciudadano no', async () => {
  igual((await como(U.ana,  `select * from public.alert_status_history`)).rows.length, 1);
  igual((await como(U.beto, `select * from public.alert_status_history`)).rows.length, 0);
});
await prueba('un ciudadano NO puede escribir historial directamente', async () => {
  await debeFallar(como(U.ana, `insert into public.alert_status_history (alert_id, new_status) values ($1, 'resolved')`, [alertaAna]));
});
await prueba('no se puede cancelar una alerta ya atendida (ack)', async () => {
  await debeFallar(como(U.ana, `select public.cancelar_alerta($1)`, [alertaAna]), '22023');
});
await prueba('cancelar alerta propia abierta → resolved + historial', async () => {
  const r = await como(U.ana, `insert into public.alerts (user_id, type_code, lat, lng) values ($1,'fire',4.6,-74.1) returning id`, [U.ana]);
  const id = r.rows[0].id;
  await debeFallar(como(U.beto, `select public.cancelar_alerta($1)`, [id]), '42501');
  await como(U.ana, `select public.cancelar_alerta($1)`, [id]);
  const a = await comoSistema(`select status, resolved_at from public.alerts where id = $1`, [id]);
  igual(a.rows[0].status, 'resolved'); igual(a.rows[0].resolved_at !== null, true);
});
await prueba('el auditor ve alertas pero NO puede cambiarlas', async () => {
  igual((await como(U.audi, `select * from public.alerts`)).rows.length >= 1, true);
  await debeFallar(como(U.audi, `select public.cambiar_estado_alerta($1, 'resolved')`, [alertaAna]), '42501');
});

console.log('\nOtras tablas');
await prueba('contactos de emergencia: cada usuario solo ve los suyos', async () => {
  await como(U.ana,  `insert into public.emergency_contacts (user_id, name, phone) values ($1,'Mamá','300')`, [U.ana]);
  igual((await como(U.beto, `select * from public.emergency_contacts`)).rows.length, 0);
  await debeFallar(como(U.beto, `insert into public.emergency_contacts (user_id, name, phone) values ($1,'x','1')`, [U.ana]));
});
await prueba('auditoría: ciudadano no la lee; admin y auditor sí', async () => {
  igual((await como(U.ana,   `select * from public.auditoria`)).rows.length, 0);
  igual((await como(U.admin, `select * from public.auditoria`)).rows.length >= 1, true);
  igual((await como(U.audi,  `select * from public.auditoria`)).rows.length >= 1, true);
});
await prueba('tipos de alerta: lectura pública, escritura solo admin', async () => {
  await comoSistema(`insert into public.alert_types (code, label) values ('fire','Incendio')`);
  igual((await como('anon', `select * from public.alert_types`)).rows.length, 1);
  await debeFallar(como(U.ana, `insert into public.alert_types (code, label) values ('x','x')`));
});

console.log('\nStorage (evidencias)');
await prueba('el bucket evidencias queda privado', async () => {
  igual((await comoSistema(`select public from storage.buckets where id='evidencias'`)).rows[0].public, false);
});
await prueba('subir evidencia a una alerta propia: permitido', async () => {
  await como(U.ana, `insert into storage.objects (bucket_id, name) values ('evidencias', $1)`, [`alertas/${alertaAna}/foto.jpg`]);
});
await prueba('subir evidencia a una alerta ajena: rechazado', async () => {
  await debeFallar(como(U.beto, `insert into storage.objects (bucket_id, name) values ('evidencias', $1)`, [`alertas/${alertaAna}/x.jpg`]));
});
await prueba('ver evidencia: autora y operadora sí, otro ciudadano no', async () => {
  igual((await como(U.ana,  `select * from storage.objects`)).rows.length, 1);
  igual((await como(U.oper, `select * from storage.objects`)).rows.length, 1);
  igual((await como(U.beto, `select * from storage.objects`)).rows.length, 0);
});

await prueba('las migraciones se pueden volver a ejecutar (idempotentes)', async () => {
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    await comoSistema('select 1'); await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
});

console.log(`\nResultado: ${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
