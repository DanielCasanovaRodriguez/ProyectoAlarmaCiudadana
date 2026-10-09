/**
 * Autorización de tratamiento de datos y solicitudes del titular
 * (Ley 1581 de 2012). Las reglas y plazos los aplica la BD (paso 10-11).
 */
import { supabase } from '../utils/supabase/client';
import { toAppError } from '../utils/errors';

/** Versión de la política aceptada por el usuario actual (null si nunca aceptó). */
export async function obtenerMiConsentimiento(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles')
    .select('consentimiento_version').eq('id', user.id).maybeSingle();
  if (error) throw toAppError(error);
  return (data?.consentimiento_version as string | null) ?? null;
}

export async function aceptarPolitica(version: string): Promise<void> {
  const { error } = await supabase.rpc('aceptar_politica', { p_version: version });
  if (error) throw toAppError(error, 'No se pudo guardar tu autorización. Intenta de nuevo.');
}

export type TipoSolicitud = 'consulta' | 'actualizacion' | 'rectificacion' | 'supresion' | 'revocatoria' | 'queja';
export type EstadoSolicitud = 'recibida' | 'en_tramite' | 'respondida' | 'cerrada';

export interface SolicitudTitular {
  id: string;
  tipo: TipoSolicitud;
  mensaje: string;
  estado: EstadoSolicitud;
  respuesta: string | null;
  creada_en: string;
  fecha_limite: string;
  respondida_en: string | null;
}

export interface SolicitudAdmin extends SolicitudTitular {
  user_id: string | null;
  nombre: string | null;
  email: string | null;
}

export const TIPOS_SOLICITUD: { valor: TipoSolicitud; titulo: string; ayuda: string }[] = [
  { valor: 'consulta',      titulo: 'Consultar mis datos',       ayuda: 'Qué datos tienen de mí y cómo los usan (respuesta en máx. 10 días hábiles).' },
  { valor: 'actualizacion', titulo: 'Actualizar mis datos',      ayuda: 'Algún dato cambió (respuesta en máx. 15 días hábiles).' },
  { valor: 'rectificacion', titulo: 'Corregir un dato',          ayuda: 'Algún dato es inexacto o incompleto.' },
  { valor: 'supresion',     titulo: 'Eliminar mi cuenta y datos', ayuda: 'Se borran tu cuenta, cédula, contactos, ubicación y alertas.' },
  { valor: 'revocatoria',   titulo: 'Revocar mi autorización',   ayuda: 'Dejar de autorizar el tratamiento (implica cerrar la cuenta).' },
  { valor: 'queja',         titulo: 'Queja o reclamo',           ayuda: 'Un uso de tus datos con el que no estás de acuerdo, o una suspensión que quieres que revisen.' },
];

export const ESTADOS_SOLICITUD: Record<EstadoSolicitud, string> = {
  recibida: 'Recibida', en_tramite: 'En trámite', respondida: 'Respondida', cerrada: 'Cerrada',
};

export async function crearSolicitud(tipo: TipoSolicitud, mensaje: string): Promise<{ fecha_limite: string }> {
  const { data, error } = await supabase.rpc('crear_solicitud_titular', { p_tipo: tipo, p_mensaje: mensaje });
  if (error) throw toAppError(error, 'No se pudo enviar tu solicitud. Intenta de nuevo.');
  return ((data ?? [])[0] as { fecha_limite: string });
}

export async function misSolicitudes(): Promise<SolicitudTitular[]> {
  const { data, error } = await supabase.from('solicitudes_titular')
    .select('id, tipo, mensaje, estado, respuesta, creada_en, fecha_limite, respondida_en')
    .order('creada_en', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []) as SolicitudTitular[];
}

// ── Panel de administración ──────────────────────────────────────
export async function listarSolicitudesAdmin(): Promise<SolicitudAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_solicitudes');
  if (error) throw toAppError(error);
  return (data ?? []) as SolicitudAdmin[];
}

export async function responderSolicitud(id: string, estado: Exclude<EstadoSolicitud, 'recibida'>, respuesta: string) {
  const { error } = await supabase.rpc('admin_responder_solicitud', { p_id: id, p_estado: estado, p_respuesta: respuesta });
  if (error) throw toAppError(error, 'No se pudo guardar la respuesta.');
}

/**
 * Supresión completa (art. 8 lit. e): primero se borran del Storage las
 * evidencias del titular y luego la BD elimina la cuenta y sus datos.
 */
export async function suprimirTitular(userId: string, solicitudId: string | null, respuesta: string) {
  const { data: rutas, error: e1 } = await supabase.rpc('admin_evidencias_titular', { p_user_id: userId });
  if (e1) throw toAppError(e1);
  const paths = ((rutas ?? []) as { ruta: string }[]).map(r => r.ruta).filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from('evidencias').remove(paths.slice(i, i + 100));
    if (error) throw toAppError(error, 'No se pudieron borrar las evidencias. Intenta de nuevo.');
  }
  const { error } = await supabase.rpc('admin_suprimir_titular', {
    p_user_id: userId, p_solicitud_id: solicitudId, p_respuesta: respuesta,
  });
  if (error) throw toAppError(error, 'No se pudo completar la supresión.');
}
