// =====================================================================
// Edge Function: notificar-alerta
//
// La llama la BD (trigger trg_z_notificar_alerta → pg_net) en cada INSERT
// o cambio de estado de public.alerts. Guarda la notificación en
// `notificaciones` (bandeja dentro de la app) y envía push por Firebase
// Cloud Messaging (API HTTP v1) a los celulares de `device_tokens`.
//
//   INSERT            → operadores y administradores activos, y personas
//                       a ≤ 1 km de la alerta (usuarios_cercanos)
//   UPDATE de estado  → quien creó la alerta (incluye el cierre automático
//                       a la hora de reportada)
//   DIAGNOSTICO       → solo verifica la configuración de Firebase
//   PRUEBA            → push de prueba a una cuenta (solo desde la BD, con el secreto)
//   MENSAJE           → mensaje del personal a quien reportó (enviar_mensaje_ciudadano)
//
// Secrets (supabase secrets set …), nunca en el código:
//   FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio (en una línea o en base64)
//   WEBHOOK_SECRET            valor que la BD envía en x-webhook-secret
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

type AlertRow = {
  id: string; user_id: string; type_code: string; status: string;
  description: string | null; lat: number; lng: number; cierre_automatico?: boolean;
};
type Payload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'DIAGNOSTICO' | 'PRUEBA' | 'MENSAJE';
  user_id?: string;
  alert_id?: string;
  mensaje?: string;
  table?: string;
  record?: AlertRow | null;
  old_record?: AlertRow | null;
};
type CuentaServicio = { client_email: string; private_key: string; project_id: string };

const TIPOS: Record<string, string> = {
  medical: 'Emergencia médica', robbery: 'Robo / Asalto', accident: 'Accidente',
  fire: 'Incendio', violence: 'Violencia',
};
const ESTADOS: Record<string, string> = { open: 'Activa', ack: 'En atención', resolved: 'Resuelta' };
const RADIO_AVISO_M = 1000;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// ------------------------------------------------- cuenta de servicio
function leerCuentaServicio(): CuentaServicio | null {
  const raw = (Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '').trim();
  if (!raw) return null;
  let texto = raw;
  if (!texto.startsWith('{')) {
    try { texto = atob(texto); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT no es JSON ni base64'); }
  }
  let sa: CuentaServicio;
  try { sa = JSON.parse(texto); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT no es un JSON completo (¿se guardó solo la primera línea?)'); }
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT incompleto');
  // Algunas formas de guardar el secreto dejan "\n" literales en la llave
  sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}

// ------------------------------------------------------- OAuth para FCM v1
let cachedToken: { value: string; exp: number } | null = null;

function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(sa: CuentaServicio): Promise<string> {
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
  if (!res.ok) throw new Error(`Google OAuth respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, exp: now + json.expires_in };
  return cachedToken.value;
}

// ------------------------------------------------------------ envío
type Aviso = { user_id: string; titulo: string; mensaje: string; data: Record<string, string> };

async function enviarAvisos(avisos: Aviso[], guardarEnBandeja = true) {
  const resultado = { destinatarios: avisos.length, dispositivos: 0, enviados: 0, invalidos: 0, errores: [] as string[] };
  if (avisos.length === 0) return resultado;

  // 1. Bandeja dentro de la app (web y Android): se guarda aunque falle el push
  if (guardarEnBandeja) {
    const { error: errBandeja } = await supabase.from('notificaciones').insert(avisos.map(a => ({
      usuario_id: a.user_id, alerta_id: a.data.alert_id ?? null, titulo: a.titulo, mensaje: a.mensaje,
    })));
    if (errBandeja) resultado.errores.push(`bandeja: ${errBandeja.message}`);
  }

  // 2. Push a los celulares
  const sa = leerCuentaServicio();
  if (!sa) { resultado.errores.push('Firebase sin configurar'); return resultado; }
  const accessToken = await getAccessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const { data: filas, error: errTokens } = await supabase.from('device_tokens').select('user_id, token')
    .in('user_id', avisos.map(a => a.user_id));
  if (errTokens) { resultado.errores.push(`tokens: ${errTokens.message}`); return resultado; }
  resultado.dispositivos = filas?.length ?? 0;
  const porUsuario = new Map(avisos.map(a => [a.user_id, a]));

  const invalidos: string[] = [];
  await Promise.all((filas ?? []).map(async ({ user_id, token }) => {
    const aviso = porUsuario.get(user_id);
    if (!aviso) return;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: aviso.titulo, body: aviso.mensaje },
            data: aviso.data,
            android: {
              priority: 'HIGH',          // despierta el teléfono aunque esté bloqueado o en reposo
              ttl: '3600s',
              collapse_key: aviso.data.alert_id ?? 'alerta',
              notification: {
                channel_id: 'alertas',
                icon: 'ic_stat_alerta',
                color: '#DC2626',
                tag: aviso.data.alert_id,  // una notificación por alerta (se actualiza, no se apila)
                default_sound: true,
                default_vibrate_timings: true,
                notification_priority: 'PRIORITY_MAX',
                visibility: 'PUBLIC',      // visible en la pantalla de bloqueo
              },
            },
          },
        }),
      });
      if (res.ok) { resultado.enviados++; return; }
      const texto = await res.text();
      // Token de un celular que desinstaló la app o de otro proyecto: se limpia
      if (res.status === 404 || /UNREGISTERED|registration token|SENDER_ID_MISMATCH/i.test(texto)) {
        invalidos.push(token);
      } else {
        resultado.errores.push(`FCM ${res.status}: ${texto.slice(0, 160)}`);
      }
    } catch (e) {
      resultado.errores.push(`FCM red: ${(e as Error).message}`);
    }
  }));

  if (invalidos.length) {
    resultado.invalidos = invalidos.length;
    await supabase.from('device_tokens').delete().in('token', invalidos);
  }
  return resultado;
}

function distanciaTexto(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(Math.floor(m / 100) / 10).toFixed(1).replace('.', ',')} km`;
}

// --------------------------------------------------------------- handler
Deno.serve(async (req) => {
  const secreto = Deno.env.get('WEBHOOK_SECRET');
  if (!secreto || req.headers.get('x-webhook-secret') !== secreto) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const payload = (await req.json()) as Payload;

    // Verificación de la configuración (sin enviar nada a nadie)
    if (payload.type === 'DIAGNOSTICO') {
      const sa = leerCuentaServicio();
      if (!sa) return Response.json({ ok: false, error: 'Firebase sin configurar' });
      await getAccessToken(sa);
      return Response.json({ ok: true, proyecto: sa.project_id });
    }

    if (payload.type === 'PRUEBA' && payload.user_id) {
      return Response.json(await enviarAvisos([{
        user_id: payload.user_id,
        titulo: '✅ Notificaciones activas',
        mensaje: 'Esta es una prueba de Alerta Ciudadana. Si la ves, las alertas te llegarán aunque la app esté cerrada.',
        data: { tipo: 'prueba' },
      }], false));
    }

    if (payload.type === 'MENSAJE' && payload.user_id && payload.mensaje) {
      return Response.json(await enviarAvisos([{
        user_id: payload.user_id,
        titulo: '💬 Mensaje sobre tu alerta',
        mensaje: payload.mensaje.slice(0, 300),
        data: { alert_id: payload.alert_id ?? '', tipo: 'mensaje' },
      }], false));   // la BD ya lo guardó en la bandeja
    }

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

      // 2. Personas a ≤ 1 km (última ubicación de las últimas 24 h, con avisos activos)
      const { data: cercanos, error } = await supabase.rpc('usuarios_cercanos', {
        p_alert_id: alerta.id, p_radio_m: RADIO_AVISO_M, p_horas: 24,
      });
      if (error) console.error('usuarios_cercanos', error.message);
      for (const c of (cercanos ?? []) as { user_id: string; distancia_m: number }[]) {
        if (idsPersonal.has(c.user_id)) continue; // ya recibe el aviso del personal
        avisos.push({
          user_id: c.user_id,
          titulo: `⚠️ Alerta cerca de ti: ${tipo}`,
          mensaje: `A ${distanciaTexto(c.distancia_m)} de tu ubicación. Toca para ver el lugar.`,
          data: { alert_id: alerta.id, tipo: 'cercana', tipo_alerta: alerta.type_code, distancia_m: String(c.distancia_m) },
        });
      }
    } else if (payload.type === 'UPDATE' && payload.old_record?.status !== alerta.status) {
      avisos.push(alerta.cierre_automatico ? {
        user_id: alerta.user_id,
        titulo: 'Tu alerta se cerró',
        mensaje: `Tu reporte de ${tipo.toLowerCase()} se cerró automáticamente después de 1 hora. Si la emergencia continúa, repórtala de nuevo o llama al 123.`,
        data: { alert_id: alerta.id, tipo: 'estado', estado: alerta.status },
      } : {
        user_id: alerta.user_id,
        titulo: 'Actualización de tu alerta',
        mensaje: `Tu reporte de ${tipo.toLowerCase()} está ahora: ${ESTADOS[alerta.status] ?? alerta.status}.`,
        data: { alert_id: alerta.id, tipo: 'estado', estado: alerta.status },
      });
    } else {
      return new Response('sin cambios relevantes', { status: 200 });
    }

    const resultado = await enviarAvisos(avisos);
    if (resultado.errores.length) console.error('notificar-alerta', JSON.stringify(resultado.errores));
    return Response.json(resultado);
  } catch (e) {
    const mensaje = (e as Error).message;
    console.error('notificar-alerta', mensaje);
    // 200 con el detalle: la BD guarda la respuesta en net._http_response (diagnóstico)
    return Response.json({ ok: false, error: mensaje });
  }
});
