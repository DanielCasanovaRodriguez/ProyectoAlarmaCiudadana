import { supabase } from '../utils/supabase/client';
import { toAppError, toUserMessage } from '../utils/errors';

/**
 * Cédula del ciudadano (formulario: número + fecha de expedición).
 * La unicidad, la validación definitiva y el cifrado ocurren en la BD.
 */

export interface MiIdentidad {
  /** Últimos 4 dígitos de la cédula registrada. */
  ultimos_digitos: string;
  /** false: cuenta anterior a la que le falta registrar la fecha de expedición. */
  completa: boolean;
}

export interface EstadoReporte {
  puede_reportar: boolean;
  bloqueado_hasta: string | null;
  reportes_falsos: number;
}

/** Cédula del usuario actual (null si nunca la registró). */
export async function obtenerMiIdentidad(): Promise<MiIdentidad | null> {
  const { data, error } = await supabase.rpc('mi_cedula');
  if (error) throw toAppError(error);
  return ((data ?? [])[0] as MiIdentidad) ?? null;
}

export async function obtenerEstadoReporte(): Promise<EstadoReporte | null> {
  const { data, error } = await supabase.rpc('mi_estado_reporte');
  if (error) throw toAppError(error);
  return ((data ?? [])[0] as EstadoReporte) ?? null;
}

export const identidadPermiteReportar = (i: MiIdentidad | null | undefined) => !!i?.completa;

/** Cuentas existentes: registra (o completa) su cédula. */
export async function registrarMiCedula(numero: string, fechaExpedicion: string): Promise<string> {
  const { data, error } = await supabase.rpc('registrar_mi_cedula', { p_numero: numero, p_fecha: fechaExpedicion });
  if (error) throw toAppError(error, 'No se pudo registrar tu cédula.');
  return (data ?? [])[0]?.ultimos_digitos ?? '';
}

// ================================================================
// ADMINISTRACIÓN
// ================================================================

export type CedulaAdmin = {
  user_id: string; nombres: string | null; apellidos: string | null; email: string | null;
  ultimos_digitos: string; completa: boolean; estado_cuenta: string; reportes_falsos: number; created_at: string;
};

export async function listarCedulas(): Promise<{ data: CedulaAdmin[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_listar_cedulas');
  if (error) return { data: [], error: toUserMessage(error) };
  return { data: (data ?? []) as CedulaAdmin[], error: null };
}

/** Muestra el número completo (la consulta queda registrada en la auditoría). */
export async function verCedula(userId: string): Promise<{ numero: string; fecha_expedicion: string | null }> {
  const { data, error } = await supabase.rpc('admin_ver_cedula', { p_user_id: userId });
  if (error) throw toAppError(error);
  const fila = (data ?? [])[0];
  if (!fila) throw new Error('No se encontró la cédula.');
  return fila;
}

/** Caso de suplantación: libera la cédula y suspende la cuenta. */
export async function liberarCedula(userId: string, motivo: string) {
  const { error } = await supabase.rpc('admin_liberar_cedula', { p_user_id: userId, p_motivo: motivo });
  if (error) throw toAppError(error);
}
