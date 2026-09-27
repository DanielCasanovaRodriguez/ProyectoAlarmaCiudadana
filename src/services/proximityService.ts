import { supabase } from '../utils/supabase/client';
import { toAppError } from '../utils/errors';

/**
 * Alertas cercanas: el servidor avisa a quienes estén a 1 km de una alerta
 * nueva. Para eso guarda la ÚLTIMA ubicación conocida de cada usuario
 * (redondeada a ~100 m en la BD), que la app envía mientras está abierta.
 */

const MIN_METROS   = 150;           // no reenviar si se movió menos de esto…
const MIN_INTERVALO = 10 * 60_000;  // …y pasaron menos de 10 minutos
const CLAVE = 'ac_ultima_ubicacion_enviada';

type Enviada = { lat: number; lng: number; t: number };

function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function leerUltima(): Enviada | null {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? 'null'); } catch { return null; }
}

let enCurso = false;

/**
 * Envía la ubicación actual al servidor si cambió lo suficiente.
 * Nunca interrumpe al usuario: los errores (p. ej. sin conexión) se ignoran
 * y se reintenta en la próxima actualización.
 */
export async function reportarUbicacion(coords: { lat: number; lng: number; accuracy?: number }, forzar = false): Promise<void> {
  if (enCurso) return;
  const ultima = leerUltima();
  if (!forzar && ultima && Date.now() - ultima.t < MIN_INTERVALO && distanciaM(ultima, coords) < MIN_METROS) return;

  enCurso = true;
  try {
    const { error } = await supabase.rpc('actualizar_mi_ubicacion', {
      p_lat: coords.lat, p_lng: coords.lng,
      p_precision_m: coords.accuracy != null ? Math.round(coords.accuracy) : null,
    });
    if (!error) {
      try { localStorage.setItem(CLAVE, JSON.stringify({ lat: coords.lat, lng: coords.lng, t: Date.now() })); } catch { /* sin almacenamiento */ }
    }
  } catch { /* sin conexión: se reintentará */ } finally {
    enCurso = false;
  }
}

export function olvidarUbicacionEnviada() {
  try { localStorage.removeItem(CLAVE); } catch { /* */ }
}

/** ¿El usuario quiere recibir avisos de alertas cercanas? (por defecto sí) */
export async function obtenerPreferenciaCercanas(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;
  const { data, error } = await supabase.from('ubicaciones_usuario').select('notificar_cercanas').eq('user_id', user.id).maybeSingle();
  if (error) throw toAppError(error);
  return data?.notificar_cercanas ?? true;
}

export async function configurarAlertasCercanas(activar: boolean): Promise<void> {
  const { error } = await supabase.rpc('configurar_alertas_cercanas', { p_activar: activar });
  if (error) throw toAppError(error, 'No se pudo guardar tu preferencia de notificaciones.');
}

export type AlertaPublica = {
  id: string; type_code: string; description: string | null; severity: number;
  lat: number; lng: number; status: 'open' | 'ack' | 'resolved'; created_at: string; updated_at: string;
  es_propia: boolean; distancia_m: number | null;
};

/** Detalle de una alerta para quien recibió el aviso (sin datos de quien la reportó). */
export async function obtenerAlertaPublica(alertId: string): Promise<AlertaPublica | null> {
  const { data, error } = await supabase.rpc('detalle_alerta_publica', { p_alert_id: alertId });
  if (error) throw toAppError(error, 'No se pudo cargar la alerta.');
  return ((data ?? [])[0] as AlertaPublica) ?? null;
}

/** "a 350 m" / "a 1,2 km" */
export function formatearDistancia(m: number | null | undefined): string | null {
  if (m == null) return null;
  if (m < 1000) return `a ${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `a ${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export { distanciaM };
