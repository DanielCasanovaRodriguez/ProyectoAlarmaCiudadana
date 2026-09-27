import { toUserMessage, friendlyText, OfflineError, classifyError } from '../../src/utils/errors.ts';
const casos: [string, unknown, string][] = [
  ['fetch sin red (Chrome)',     new TypeError('Failed to fetch'), 'Sin conexión'],
  ['fetch sin red (Safari)',     new TypeError('Load failed'), 'Sin conexión'],
  ['PostgREST sin red',          { message: 'TypeError: Failed to fetch', code: '' }, 'Sin conexión'],
  ['auth-js retryable',          { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }, 'Sin conexión'],
  ['OfflineError propio',        new OfflineError(), 'Sin conexión'],
  ['timeout',                    { name: 'AbortError', message: 'The operation was aborted.' }, 'tardó demasiado'],
  ['credenciales',               { name: 'AuthApiError', message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 }, 'Credenciales inválidas'],
  ['correo no confirmado',       { message: 'Email not confirmed', code: 'email_not_confirmed' }, 'no está verificado'],
  ['ya registrado',              { message: 'User already registered', code: 'user_already_exists' }, 'Ya existe una cuenta'],
  ['otp expirado',               { message: 'Token has expired or is invalid', code: 'otp_expired' }, 'expiró'],
  ['rate limit correo',          { message: 'email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 }, 'demasiados intentos'],
  ['jwt expirado',               { message: 'JWT expired', code: 'PGRST301' }, 'sesión expiró'],
  ['RLS',                        { message: 'new row violates row-level security policy for table "alerts"', code: '42501' }, 'No tienes permiso'],
  ['sin filas',                  { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, 'No se encontró'],
  ['storage tamaño',             { message: 'The object exceeded the maximum allowed size', statusCode: '413' }, '10 MB'],
  ['500',                        { message: 'Internal Server Error', status: 500 }, 'no está disponible'],
  ['RPC propia en español',      { message: 'Solo puedes cancelar alertas en estado Activa', code: '22023' }, 'Solo puedes cancelar'],
  ['RPC permiso en español',     { message: 'Solo operadores o administradores pueden cambiar el estado de una alerta', code: '42501' }, 'Solo operadores'],
  ['texto propio',               'Error al subir archivo', 'Error al subir archivo'],
  ['desconocido inglés',         { message: 'column "foo" does not exist', code: '42703' }, 'error inesperado'],
];
let ok = 0;
for (const [n, e, esperado] of casos) {
  const r = toUserMessage(e);
  const pasa = r.toLowerCase().includes(esperado.toLowerCase());
  ok += +pasa; console.log(pasa ? '✔' : '✘', n.padEnd(26), '→', r);
}
console.log('friendlyText técnico:', friendlyText('TypeError: Failed to fetch'));
console.log('friendlyText amigable:', friendlyText('Revisa tu correo electrónico'));
console.log(`\n${ok}/${casos.length} correctas`);
