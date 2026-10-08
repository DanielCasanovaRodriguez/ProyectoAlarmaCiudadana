// =====================================================================
// Edge Function: acceso-cedula
//
// Inicio de sesión de ciudadanos con NÚMERO DE CÉDULA + CONTRASEÑA.
// La cédula es el identificador; la contraseña sigue siendo el secreto
// (la fecha de expedición NO se usa como contraseña: es un dato que aparece
// en documentos y fotocopias).
//
//   POST { accion: 'ingresar',  cedula, password }  → sesión de Supabase
//   POST { accion: 'confirmar', cedula, codigo }    → confirma el correo y entra
//   POST { accion: 'recuperar', cedula }            → envía el código para cambiar
//                                                     la contraseña al correo de la cuenta
//   POST { accion: 'verificar_recuperacion', cedula, codigo } → sesión para fijar
//                                                     la nueva contraseña
//
// Seguridad:
//  · El correo de la cuenta nunca se revela (solo enmascarado y únicamente
//    a quien ya demostró conocer la contraseña).
//  · Mismo mensaje para "cédula inexistente" y "contraseña incorrecta",
//    con demora aleatoria (evita enumerar cédulas).
//  · Límite: 5 fallos por cédula o 20 por IP en 15 min → bloqueo 15 min
//    (acceso_preparar / acceso_resultado en la BD). Todo queda auditado.
//  · CORS solo para los orígenes de la app.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const servidor = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const nuevoClientePublico = () =>
  createClient(URL_SB, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

const ORIGENES = [
  /^https:\/\/proyecto-alarma-ciudadana(-[a-z0-9-]+)?\.vercel\.app$/,
  /^https:\/\/localhost$/,                       // app Android (Capacitor)
  /^http:\/\/(localhost|127\.0\.0\.1):3000$/,    // desarrollo
];

function cors(origen: string | null): Record<string, string> {
  const permitido = origen && ORIGENES.some(r => r.test(origen)) ? origen : 'https://proyecto-alarma-ciudadana.vercel.app';
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const MSG_GENERICO = 'Cédula o contraseña incorrecta.';
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));
const demora = () => esperar(350 + Math.floor(Math.random() * 400));

function enmascararCorreo(email: string): string {
  const [u, d = ''] = email.split('@');
  const [dom, ...ext] = d.split('.');
  const m = (s: string) => (s.length <= 2 ? s[0] + '*' : s[0] + '*'.repeat(Math.min(5, s.length - 2)) + s[s.length - 1]);
  return `${m(u)}@${m(dom ?? '')}.${ext.join('.')}`;
}

function cedulaValida(c: unknown): string | null {
  if (typeof c !== 'string') return null;
  const n = c.replace(/\D/g, '').replace(/^0+/, '');
  return n.length >= 5 && n.length <= 10 ? n : null;
}

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  const responder = (status: number, cuerpo: Record<string, unknown>) =>
    new Response(JSON.stringify(cuerpo), { status, headers: h });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido.' });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return responder(400, { error: 'Solicitud no válida.' }); }

  const ACCIONES = ['ingresar', 'confirmar', 'recuperar', 'verificar_recuperacion'] as const;
  const accion = ACCIONES.find(a => a === body.accion) ?? 'ingresar';
  const conCodigo = accion === 'confirmar' || accion === 'verificar_recuperacion';
  const cedula = cedulaValida(body.cedula);
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconocida';
  if (!cedula) return responder(400, { error: 'Ingresa un número de cédula válido.' });

  const resultado = (exito: boolean, userId: string | null = null) =>
    servidor.rpc('acceso_resultado', { p_numero: cedula, p_ip: ip, p_exito: exito, p_user_id: userId });

  // 1. Bloqueo por intentos y búsqueda de la cuenta
  const { data: prep, error: errPrep } = await servidor.rpc('acceso_preparar', { p_numero: cedula, p_ip: ip });
  if (errPrep) { console.error('acceso_preparar', errPrep.message); return responder(503, { error: 'El servicio no está disponible. Intenta de nuevo.' }); }
  const fila = (prep ?? [])[0] as { user_id: string | null; bloqueado_segundos: number } | undefined;
  if (fila && fila.bloqueado_segundos > 0) {
    const min = Math.ceil(fila.bloqueado_segundos / 60);
    return responder(429, { error: `Demasiados intentos fallidos. Por seguridad, espera ${min} minuto${min === 1 ? '' : 's'} e intenta de nuevo.` });
  }
  // Recuperación: misma respuesta exista o no la cédula (no se puede usar
  // para averiguar qué cédulas están registradas)
  const MSG_RECUPERAR = 'Si la cédula está registrada, enviamos un código al correo de la cuenta. Revisa también la carpeta de spam.';
  if (!fila?.user_id) {
    await demora();
    await resultado(false);
    if (accion === 'recuperar') return responder(200, { ok: true, mensaje: MSG_RECUPERAR });
    return conCodigo ? responder(400, { error: 'El código es incorrecto o expiró.' }) : responder(401, { error: MSG_GENERICO });
  }

  const { data: u, error: errU } = await servidor.auth.admin.getUserById(fila.user_id);
  const email = u?.user?.email;
  if (errU || !email) { await demora(); await resultado(false); return responder(401, { error: MSG_GENERICO }); }

  const publico = nuevoClientePublico();

  if (accion === 'recuperar') {
    const { error } = await publico.auth.resetPasswordForEmail(email);
    if (error && /rate limit|too many|security purposes/i.test(error.message)) {
      return responder(429, { error: 'Ya enviamos un código hace poco. Espera un minuto e intenta de nuevo.' });
    }
    if (error) console.error('recuperar', error.message);
    await demora();
    return responder(200, { ok: true, mensaje: MSG_RECUPERAR });
  }

  if (accion === 'verificar_recuperacion') {
    const codigo = typeof body.codigo === 'string' ? body.codigo.replace(/\D/g, '') : '';
    if (codigo.length < 6 || codigo.length > 10) return responder(400, { error: 'Ingresa el código que te enviamos.' });
    const { data, error } = await publico.auth.verifyOtp({ email, token: codigo, type: 'recovery' });
    if (error || !data.session) { await resultado(false); return responder(400, { error: 'El código es incorrecto o expiró.' }); }
    await resultado(true, fila.user_id);
    return responder(200, sesion(data.session));
  }

  // 2a. Confirmar correo con el código de 8 dígitos
  if (accion === 'confirmar') {
    const codigo = typeof body.codigo === 'string' ? body.codigo.replace(/\D/g, '') : '';
    if (codigo.length < 6 || codigo.length > 10) return responder(400, { error: 'Ingresa el código que te enviamos.' });
    const { data, error } = await publico.auth.verifyOtp({ email, token: codigo, type: 'signup' });
    if (error || !data.session) { await resultado(false); return responder(400, { error: 'El código es incorrecto o expiró.' }); }
    await resultado(true, fila.user_id);
    return responder(200, sesion(data.session));
  }

  // 2b. Cédula + contraseña
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 200) { await demora(); return responder(401, { error: MSG_GENERICO }); }

  const { data, error } = await publico.auth.signInWithPassword({ email, password });
  if (error) {
    const codigo = (error as { code?: string }).code ?? '';
    if (codigo === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) {
      // La contraseña es correcta pero falta confirmar el correo: se reenvía el código
      await publico.auth.resend({ type: 'signup', email }).catch(() => undefined);
      return responder(403, {
        codigo: 'correo_sin_confirmar',
        email_enmascarado: enmascararCorreo(email),
        error: `Confirma tu correo: te enviamos un código a ${enmascararCorreo(email)}.`,
      });
    }
    if (/rate limit|too many/i.test(codigo + ' ' + error.message)) {
      return responder(429, { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
    }
    await resultado(false);
    return responder(401, { error: MSG_GENERICO });
  }

  await resultado(true, fila.user_id);
  return responder(200, sesion(data.session));
});

function sesion(s: { access_token: string; refresh_token: string; expires_in: number; expires_at?: number }) {
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at };
}
