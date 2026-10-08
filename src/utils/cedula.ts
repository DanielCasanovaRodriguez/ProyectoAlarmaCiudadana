/**
 * Cédula de ciudadanía colombiana: validaciones del formulario.
 *
 * Las mismas reglas se vuelven a aplicar en la base de datos
 * (public.normalizar_cedula y public.validar_fecha_expedicion): el cliente
 * solo da respuesta inmediata; la autoridad es el servidor.
 */

/** Deja solo los dígitos de un número escrito con puntos o espacios, sin ceros a la izquierda. */
export function soloDigitosCedula(s: string): string {
  return (s ?? '').replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * Número de cédula (CC): 5 a 10 dígitos. Las más antiguas tienen 5–8
 * dígitos; las expedidas desde 2004 suelen tener 10. No existe dígito de
 * verificación público, así que solo se descartan formatos imposibles.
 */
export function validarNumeroCedula(s: string): string | null {
  if (/[^\d.\s-]/.test(s ?? '')) return 'El número de cédula solo puede tener dígitos.';
  const n = soloDigitosCedula(s);
  if (!n) return 'Ingresa el número de tu cédula.';
  if (n.length < 5 || n.length > 10) return 'El número de cédula debe tener entre 5 y 10 dígitos.';
  if (/^(\d)\1+$/.test(n)) return 'El número de cédula no es válido.';
  return null;
}

export const FECHA_EXPEDICION_MINIMA = '1940-01-01';

/** Hoy en formato AAAA-MM-DD según la hora local del dispositivo. */
export function hoyISO(hoy = new Date()): string {
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${m}-${d}`;
}

/**
 * Fecha de expedición (AAAA-MM-DD): obligatoria, real (no 30 de febrero),
 * no futura y desde 1940.
 */
export function validarFechaExpedicion(s: string, hoy = new Date()): string | null {
  if (!s) return 'Ingresa la fecha de expedición de tu cédula.';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return 'La fecha no tiene un formato válido.';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(y, mo - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d) return 'Esa fecha no existe.';
  if (s > hoyISO(hoy)) return 'La fecha de expedición no puede ser futura.';
  if (s < FECHA_EXPEDICION_MINIMA) return 'Revisa la fecha de expedición.';
  return null;
}

/** Nombres y apellidos: letras (con tildes/ñ), espacios, guion y apóstrofo. */
export function validarNombrePersona(s: string, campo: 'nombres' | 'apellidos'): string | null {
  const v = (s ?? '').trim();
  if (v.length < 2) return campo === 'nombres' ? 'Ingresa tus nombres.' : 'Ingresa tus apellidos.';
  if (v.length > 60) return 'Es demasiado largo (máximo 60 caracteres).';
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/.test(v)) return 'Usa solo letras, espacios o guiones.';
  return null;
}

/** "••••••5678" */
export function enmascararCedula(numero: string): string {
  const n = soloDigitosCedula(numero);
  return n.length <= 4 ? n : '•'.repeat(Math.min(6, n.length - 4)) + n.slice(-4);
}
