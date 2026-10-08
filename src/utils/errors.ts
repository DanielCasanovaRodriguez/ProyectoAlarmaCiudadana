/**
 * Manejo centralizado de errores.
 *
 * Convierte cualquier error (red, Supabase Auth, PostgREST, Storage,
 * navegador) en un mensaje claro en español para el usuario. Ningún mensaje
 * técnico ("Failed to fetch", "JWT expired", "violates row-level security…")
 * debe llegar a la pantalla.
 */

export type ErrorKind =
  | 'offline'       // sin conexión a internet
  | 'timeout'       // la solicitud tardó demasiado
  | 'server'        // el servicio respondió con error interno
  | 'session'       // sesión caducada o inexistente
  | 'auth'          // credenciales, correo, contraseña, códigos
  | 'rate_limit'    // demasiados intentos
  | 'permission'    // sin permiso (RLS)
  | 'not_found'
  | 'duplicate'
  | 'validation'
  | 'storage'
  | 'unknown';

export const MENSAJES = {
  offline:  'Sin conexión a internet. Revisa tus datos móviles o Wi-Fi e intenta de nuevo.',
  timeout:  'La conexión está muy lenta y la solicitud tardó demasiado. Intenta de nuevo.',
  server:   'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.',
  session:  'Tu sesión expiró. Inicia sesión de nuevo para continuar.',
  permission: 'No tienes permiso para realizar esta acción.',
  not_found:  'No se encontró la información solicitada.',
  duplicate:  'Este registro ya existe.',
  rate_limit: 'Hiciste demasiados intentos seguidos. Espera unos minutos e intenta de nuevo.',
  unknown:  'Ocurrió un error inesperado. Intenta de nuevo.',
} as const;

/** Error propio con tipo y mensaje ya listos para mostrar. */
export class AppError extends Error {
  kind: ErrorKind;
  cause?: unknown;
  constructor(kind: ErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.cause = cause;
  }
}

/** Lanzado por el fetch de Supabase cuando el dispositivo no tiene red. */
export class OfflineError extends AppError {
  constructor(cause?: unknown) { super('offline', MENSAJES.offline, cause); this.name = 'OfflineError'; }
}

/** Lanzado por el fetch de Supabase cuando se agota el tiempo de espera. */
export class TimeoutError extends AppError {
  constructor(cause?: unknown) { super('timeout', MENSAJES.timeout, cause); this.name = 'TimeoutError'; }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

// ------------------------------------------------------------------ patrones
const RED = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected|err_network|err_name_not_resolved|err_connection|net::|the internet connection appears to be offline|sin conexi[oó]n/i;
const TIEMPO = /timeout|timed out|aborterror|the operation was aborted|tard[oó] demasiado/i;

/** Reglas: patrón del mensaje o código → tipo y texto amigable. */
const REGLAS: Array<{ test: (m: string, code: string, status?: number) => boolean; kind: ErrorKind; msg: string }> = [
  // Registro: la BD rechazó la cédula (ya registrada) dentro de la creación del usuario
  { test: (m, c) => /cedula_no_disponible|database error saving new user/i.test(m) || (c === 'unexpected_failure' && /saving new user/i.test(m)),
    kind: 'duplicate', msg: 'No fue posible completar el registro con esa cédula. Si ya tienes una cuenta, inicia sesión con tu cédula; si crees que alguien la está usando, contáctanos.' },
  // Autenticación (Supabase Auth)
  { test: (m, c) => c === 'invalid_credentials' || /invalid login credentials/i.test(m),
    kind: 'auth', msg: 'Credenciales inválidas: el correo o la contraseña no son correctos.' },
  { test: (m, c) => c === 'email_not_confirmed' || /email not confirmed/i.test(m),
    kind: 'auth', msg: 'Tu correo aún no está verificado. Revisa tu bandeja de entrada (y spam) e ingresa el código.' },
  { test: (m, c) => c === 'user_already_exists' || c === 'email_exists' || /already registered|already been registered|user already exists/i.test(m),
    kind: 'duplicate', msg: 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.' },
  { test: (m, c) => c === 'weak_password' || /password should be|password is too weak|weak password/i.test(m),
    kind: 'validation', msg: 'La contraseña es muy débil. Usa al menos 8 caracteres combinando letras y números.' },
  { test: (m, c) => c === 'same_password' || /new password should be different/i.test(m),
    kind: 'validation', msg: 'La nueva contraseña debe ser diferente a la anterior.' },
  { test: (m, c) => c === 'otp_expired' || /token has expired|otp.*expired|token.*invalid|invalid.*otp/i.test(m),
    kind: 'auth', msg: 'El código es incorrecto o ya expiró. Solicita uno nuevo.' },
  { test: (m, c) => /over_.*rate_limit|rate limit|too many requests/i.test(c + ' ' + m),
    kind: 'rate_limit', msg: MENSAJES.rate_limit },
  { test: (m, c) => /email address .* is invalid|unable to validate email|invalid email/i.test(m) || c === 'email_address_invalid',
    kind: 'validation', msg: 'El correo electrónico no es válido.' },
  { test: (m, c) => c === 'signup_disabled' || /signups not allowed/i.test(m),
    kind: 'auth', msg: 'El registro de nuevas cuentas está deshabilitado temporalmente.' },
  { test: (m, c) => c === 'user_banned' || /user is banned/i.test(m),
    kind: 'auth', msg: 'Tu cuenta está suspendida. Contacta al administrador.' },
  { test: (m, c) => /jwt expired|auth session missing|refresh token not found|invalid refresh token|session.*expired|session_not_found/i.test(c + ' ' + m),
    kind: 'session', msg: MENSAJES.session },

  // Base de datos (PostgREST / Postgres)
  { test: (m, c) => c === '42501' && /row-level security|permission denied/i.test(m),
    kind: 'permission', msg: MENSAJES.permission },
  { test: (m) => /row-level security|permission denied/i.test(m),
    kind: 'permission', msg: MENSAJES.permission },
  { test: (m, c) => c === 'PGRST116' || /contains 0 rows|no rows returned/i.test(m),
    kind: 'not_found', msg: MENSAJES.not_found },
  { test: (m, c) => c === '23505' && /duplicate key/i.test(m),
    kind: 'duplicate', msg: MENSAJES.duplicate },
  { test: (m, c) => c === '23503' || /violates foreign key/i.test(m),
    kind: 'validation', msg: 'La información hace referencia a un registro que no existe.' },
  { test: (m, c) => c === '23514' || /violates check constraint/i.test(m),
    kind: 'validation', msg: 'Algún dato no tiene un formato válido. Revisa e intenta de nuevo.' },
  { test: (m, c) => c === 'PGRST301' || c === 'PGRST302',
    kind: 'session', msg: MENSAJES.session },

  // Storage
  { test: (m) => /payload too large|exceeded the maximum allowed size|entity too large/i.test(m),
    kind: 'storage', msg: 'El archivo supera el tamaño máximo permitido (10 MB).' },
  { test: (m) => /mime type .* is not supported|invalid mime|not allowed.*type/i.test(m),
    kind: 'storage', msg: 'Ese tipo de archivo no está permitido.' },
  { test: (m) => /object not found|the resource was not found/i.test(m),
    kind: 'not_found', msg: 'El archivo ya no está disponible.' },

  // Servidor
  { test: (m, _c, s) => (s ?? 0) >= 500 || /internal server error|bad gateway|service unavailable|gateway timeout|upstream/i.test(m),
    kind: 'server', msg: MENSAJES.server },
];

/** Texto con aspecto técnico (inglés, nombres de excepción, SQL). */
const TECNICO = /\b(failed|error|exception|undefined|null|fetch|network|column|relation|violates|constraint|syntax|function|denied|token|jwt|typeerror|referenceerror|request|response|status|invalid|unexpected|cannot|could not|unable)\b|[a-z]+_[a-z_]+|PGRST\d+|^\s*\{/i;
const ESPANOL = /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|al|en|que|tu|su|sus|una|un|no|sin|se|para|por|con|es|este|esta|intenta|puedes|archivo|alerta|cuenta|correo|usuario|datos|perfil|sesi[oó]n|debes|solo)\b/i;

function partes(err: unknown): { msg: string; code: string; status?: number; name: string } {
  if (err == null) return { msg: '', code: '', name: '' };
  if (typeof err === 'string') return { msg: err, code: '', name: '' };
  const e = err as Record<string, any>;
  return {
    msg:    String(e.message ?? e.error_description ?? e.msg ?? e.error ?? ''),
    code:   String(e.code ?? e.error_code ?? ''),
    status: typeof e.status === 'number' ? e.status : (typeof e.statusCode === 'number' ? e.statusCode : Number(e.statusCode) || undefined),
    name:   String(e.name ?? ''),
  };
}

/** Clasifica el error. */
export function classifyError(err: unknown): { kind: ErrorKind; message: string } {
  if (err instanceof AppError) return { kind: err.kind, message: err.message };
  const { msg, code, status, name } = partes(err);

  if (RED.test(msg) || RED.test(name) || (status === 0 && !isOnline())) {
    return { kind: 'offline', message: MENSAJES.offline };
  }
  if (TIEMPO.test(msg) || /timeout|abort/i.test(name)) {
    return { kind: 'timeout', message: MENSAJES.timeout };
  }
  // Un fallo genérico de red estando sin conexión
  if (!isOnline() && /fetch|network|retryable/i.test(name + ' ' + msg)) {
    return { kind: 'offline', message: MENSAJES.offline };
  }
  for (const r of REGLAS) {
    if (r.test(msg, code, status)) return { kind: r.kind, message: r.msg };
  }
  // Mensajes propios (RPC de la BD, validaciones del cliente) ya vienen en español
  if (msg && ESPANOL.test(msg) && !TECNICO.test(msg.replace(/[áéíóúñ]/gi, ''))) {
    return { kind: 'validation', message: msg };
  }
  if (msg && ESPANOL.test(msg) && !/[a-z]+_[a-z_]+|PGRST|TypeError/i.test(msg)) {
    return { kind: 'unknown', message: msg };
  }
  return { kind: 'unknown', message: '' };
}

/**
 * Mensaje listo para mostrar al usuario.
 * @param fallback texto a usar si el error no es reconocible (p. ej. "No se pudo guardar el perfil").
 */
export function toUserMessage(err: unknown, fallback: string = MENSAJES.unknown): string {
  const { message } = classifyError(err);
  return message || fallback;
}

/** Convierte cualquier error en AppError (para `throw`). */
export function toAppError(err: unknown, fallback?: string): AppError {
  if (err instanceof AppError) return err;
  const { kind, message } = classifyError(err);
  return new AppError(kind, message || fallback || MENSAJES.unknown, err);
}

export function isOfflineError(err: unknown): boolean {
  return classifyError(err).kind === 'offline';
}

/**
 * Para textos sueltos (títulos o descripciones de avisos): si parecen
 * técnicos se traducen; si ya son amigables se dejan igual.
 */
export function friendlyText<T>(value: T): T {
  if (typeof value !== 'string' || !value) return value;
  const { kind, message } = classifyError(value);
  if (kind === 'unknown' && !message) {
    return (TECNICO.test(value) && !ESPANOL.test(value) ? MENSAJES.unknown : value) as T;
  }
  return (message || value) as T;
}
