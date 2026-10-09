/**
 * Reglas comunes para el envío de códigos por correo (registro, acceso de
 * colaboradores y recuperación de contraseña).
 *
 * Supabase Auth impone dos límites que la app no puede saltarse:
 *  - Tiempo mínimo entre correos a la misma persona ("For security purposes,
 *    you can only request this after N seconds").
 *  - Cantidad de correos por hora de todo el proyecto ("email rate limit
 *    exceeded").
 * En lugar de mostrar un error, la app espera exactamente lo que pide el
 * servidor y deja usar el último código recibido, que sigue vigente.
 */
import { toUserMessage } from './errors.ts';

/** Espera de la app entre envíos (debe coincidir con la de Supabase Auth). */
export const ESPERA_REENVIO_S = 30;

/** Un código enviado hace menos de esto se reutiliza en vez de pedir otro. */
export const VIGENCIA_REUTILIZABLE_MS = 10 * 60 * 1000;

export interface ResultadoEnvio {
  success: boolean;
  error?: string;
  /** Segundos que pide esperar el servidor antes de otro envío. */
  esperaS?: number;
  /** Se alcanzó el límite de correos por hora del proyecto. */
  limiteHora?: boolean;
}

export function interpretarErrorEnvio(err: unknown): ResultadoEnvio {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  const segundos = /after (\d+) seconds?/i.exec(msg)?.[1] ?? /espera (\d+) s/i.exec(msg)?.[1];
  if (segundos) {
    const n = Math.max(1, parseInt(segundos, 10));
    return { success: false, esperaS: n, error: `Por seguridad, espera ${n} s para pedir otro código.` };
  }
  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(msg)) {
    return {
      success: false, limiteHora: true, esperaS: 120,
      error: 'Se enviaron muchos correos en poco tiempo. Usa el último código que te llegó (sigue sirviendo) o intenta de nuevo en unos minutos.',
    };
  }
  if (/rate limit|too many|429/i.test(msg)) {
    return { success: false, esperaS: 60, error: 'Pediste varios códigos seguidos. Espera un momento e intenta de nuevo.' };
  }
  return { success: false, error: toUserMessage(err, 'No se pudo enviar el código. Intenta de nuevo.') };
}

// ── Último envío por correo (solo en esta sesión del navegador/app) ──
const CLAVE = (email: string) => `ac_codigo_enviado:${email.trim().toLowerCase()}`;

export function registrarEnvio(email: string): void {
  try { sessionStorage.setItem(CLAVE(email), String(Date.now())); } catch { /* sin almacenamiento */ }
}

/** Milisegundos desde el último código enviado a este correo (null si no hay). */
export function tiempoDesdeEnvio(email: string): number | null {
  try {
    const t = Number(sessionStorage.getItem(CLAVE(email)));
    return t ? Date.now() - t : null;
  } catch { return null; }
}

/** Segundos que faltan para poder pedir otro código (0 si ya se puede). */
export function esperaRestante(email: string): number {
  const t = tiempoDesdeEnvio(email);
  if (t == null) return 0;
  return Math.max(0, ESPERA_REENVIO_S - Math.floor(t / 1000));
}
