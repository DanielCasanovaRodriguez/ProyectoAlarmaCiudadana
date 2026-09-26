// =====================================================================
// Edge Function: notificar-alerta
//
// Disparada por un Database Webhook de Supabase sobre public.alerts
// (INSERT y UPDATE). Registra la notificación en `notificaciones` y envía
// push por Firebase Cloud Messaging (API HTTP v1) a los dispositivos en
// `device_tokens`.
//
//   INSERT            → operadores y administradores activos
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

async function enviarPush(tokens: string[], titulo: string, mensaje: string, data: Record<string, string>) {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw || tokens.length === 0) return { enviados: 0, invalidos: [] as string[] };
  const sa = JSON.parse(raw);
  const accessToken = await getAccessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const invalidos: string[] = [];
  let enviados = 0;
  await Promise.all(tokens.map(async (token) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: titulo, body: mensaje },
          data,
          android: { priority: 'HIGH', notification: { channel_id: 'alertas' } },
        },
      }),
    });
    if (res.ok) { enviados++; return; }
    // Token caducado o de otra app: se limpia
    if (res.status === 404 || res.status === 400) invalidos.push(token);
    else console.error('FCM', res.status, await res.text());
  }));

  if (invalidos.length) await supabase.from('device_tokens').delete().in('token', invalidos);
  return { enviados, invalidos };
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
  let destinatarios: string[] = [];
  let titulo = '', mensaje = '';

  if (payload.type === 'INSERT') {
    const { data } = await supabase.from('profiles').select('id')
      .in('role', ['operator', 'admin']).eq('status', 'active');
    destinatarios = (data ?? []).map(p => p.id);
    titulo  = `🚨 Nueva alerta: ${tipo}`;
    mensaje = alerta.description?.slice(0, 120) || 'Un ciudadano reportó una emergencia.';
  } else if (payload.type === 'UPDATE' && payload.old_record?.status !== alerta.status) {
    destinatarios = [alerta.user_id];
    titulo  = 'Actualización de tu alerta';
    mensaje = `Tu reporte de ${tipo.toLowerCase()} está ahora: ${ESTADOS[alerta.status] ?? alerta.status}.`;
  } else {
    return new Response('sin cambios relevantes', { status: 200 });
  }

  if (destinatarios.length === 0) return new Response('sin destinatarios', { status: 200 });

  // Registro en la bandeja de notificaciones de la app (web y Android)
  await supabase.from('notificaciones').insert(destinatarios.map(uid => ({
    usuario_id: uid, alerta_id: alerta.id, titulo, mensaje,
  })));

  const { data: tokens } = await supabase.from('device_tokens').select('token').in('user_id', destinatarios);
  const resultado = await enviarPush((tokens ?? []).map(t => t.token), titulo, mensaje, {
    alert_id: alerta.id, tipo: alerta.type_code, estado: alerta.status,
  });

  return Response.json({ destinatarios: destinatarios.length, ...resultado });
});
