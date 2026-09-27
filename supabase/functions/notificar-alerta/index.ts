// =====================================================================
// Edge Function: notificar-alerta
//
// Disparada por un Database Webhook de Supabase sobre public.alerts
// (INSERT y UPDATE). Registra la notificación en `notificaciones` y envía
// push por Firebase Cloud Messaging (API HTTP v1) a los dispositivos en
// `device_tokens`.
//
//   INSERT            → operadores y administradores activos, y personas
//                       a 1 km o menos de la alerta (usuarios_cercanos)
//   UPDATE de estado  → el ciudadano que creó la alerta
//
// Secrets requeridos (supabase secrets set ...), nunca en el código:
//   FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio de Firebase
//   WEBHOOK_SECRET            valor que el webhook envía en x-webhook-secret
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

type AlertRow = {
  id: string; user_id: string; type_code: string; status: string;
  description: string | null; lat: number; lng: number;
};
type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: AlertRow | null;
  old_record: AlertRow | null;
};

const TIPOS: Record<string, string> = {
  medical: 'Emergencia médica', robbery: 'Robo / Asalto', accident: 'Accidente',
  fire: 'Incendio', violence: 'Violencia',
};
const ESTADOS: Record<string, string> = {
  open: 'Activa', ack: 'En atención', resolved: 'Resuelta',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// ------------------------------------------------------- OAuth para FCM v1
let cachedToken: { value: string; exp: number } | null = null;

function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const jwt = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`OAuth FCM: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, exp: now + json.expires_in };
  return cachedToken.value;
}

type Aviso = { user_id: string; titulo: string; mensaje: string; data: Record<string, string> };

/** Envía un mensaje FCM a cada dispositivo de cada destinatario (mensaje propio por usuario). */
async function enviarAvisos(avisos: Aviso[]) {
  if (avisos.length === 0) return { enviados: 0, invalidos: [] as string[], destinatarios: 0 };

  // Bandeja de notificaciones dentro de la app (web y Android)
  await supabase.from('notificaciones').insert(avisos.map(a => ({
    usuario_id: a.user_id, alerta_id: a.data.alert_id ?? null, titulo: a.titulo, mensaje: a.mensaje,
  })));

  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return { enviados: 0, invalidos: [] as string[], destinatarios: avisos.length };
  const sa = JSON.parse(raw);
  const accessToken = await getAccessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const { data: filas } = await supabase.from('device_tokens').select('user_id, token')
    .in('user_id', avisos.map(a => a.user_id));
  const porUsuario = new Map(avisos.map(a => [a.user_id, a]));

  const invalidos: string[] = [];
  let enviados = 0;
  await Promise.all((filas ?? []).map(async ({ user_id, token }) => {
    const aviso = porUsuario.get(user_id);
    if (!aviso) return;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: aviso.titulo, body: aviso.mensaje },
          data: aviso.data,
          android: { priority: 'HIGH', notification: { channel_id: 'alertas', default_sound: true } },
        },
      }),
    });
    if (res.ok) { enviados++; return; }
    // Token caducado o de otra app: se limpia
    if (res.status === 404 || res.status === 400) invalidos.push(token);
    else console.error('FCM', res.status, await res.text());
  }));

  if (invalidos.length) await supabase.from('device_tokens').delete().in('token', invalidos);
  return { enviados, invalidos, destinatarios: avisos.length };
}

function distanciaTexto(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

// --------------------------------------------------------------- handler
Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const alerta = payload.record;
  if (payload.table !== 'alerts' || !alerta) return new Response('ignorado', { status: 200 });

  const tipo = TIPOS[alerta.type_code] ?? alerta.type_code;
  const avisos: Aviso[] = [];

  if (payload.type === 'INSERT') {
    // 1. Personal: operadores y administradores activos
    const { data: personal } = await supabase.from('profiles').select('id')
      .in('role', ['operator', 'admin']).eq('status', 'active');
    const idsPersonal = new Set((personal ?? []).map(p => p.id));
    for (const id of idsPersonal) {
      if (id === alerta.user_id) continue;
      avisos.push({
        user_id: id,
        titulo: `🚨 Nueva alerta: ${tipo}`,
        mensaje: alerta.description?.slice(0, 120) || 'Un ciudadano reportó una emergencia.',
        data: { alert_id: alerta.id, tipo: 'nueva', tipo_alerta: alerta.type_code },
      });
    }

    // 2. Personas a 1 km o menos (última ubicación de las últimas 24 h, con avisos activos)
    const { data: cercanos, error } = await supabase.rpc('usuarios_cercanos', {
      p_alert_id: alerta.id, p_radio_m: 1000, p_horas: 24,
    });
    if (error) console.error('usuarios_cercanos', error.message);
    for (const c of (cercanos ?? []) as { user_id: string; distancia_m: number }[]) {
      if (idsPersonal.has(c.user_id)) continue; // ya recibe el aviso del personal
      avisos.push({
        user_id: c.user_id,
        titulo: `⚠️ Alerta cerca de ti: ${tipo}`,
        mensaje: `A ${distanciaTexto(c.distancia_m)} de tu ubicación. Toca para ver el detalle y el lugar.`,
        data: { alert_id: alerta.id, tipo: 'cercana', tipo_alerta: alerta.type_code, distancia_m: String(c.distancia_m) },
      });
    }
  } else if (payload.type === 'UPDATE' && payload.old_record?.status !== alerta.status) {
    avisos.push({
      user_id: alerta.user_id,
      titulo: 'Actualización de tu alerta',
      mensaje: `Tu reporte de ${tipo.toLowerCase()} está ahora: ${ESTADOS[alerta.status] ?? alerta.status}.`,
      data: { alert_id: alerta.id, tipo: 'estado', estado: alerta.status },
    });
  } else {
    return new Response('sin cambios relevantes', { status: 200 });
  }

  const resultado = await enviarAvisos(avisos);
  return Response.json(resultado);
});
