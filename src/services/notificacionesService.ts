/** Prueba de notificaciones push desde el perfil (paso 15). */
import { supabase } from '../utils/supabase/client';
import { toAppError } from '../utils/errors';
import { registerForPush } from '../platform';

export type ResultadoPrueba =
  | { ok: true; dispositivos: number }
  | { ok: false; motivo: 'sin_permiso' | 'sin_dispositivo' | 'espera' | 'sin_configurar' };

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function probarNotificaciones(): Promise<ResultadoPrueba> {
  // Asegura permiso y registro del celular (el token llega por un evento)
  const permitido = await registerForPush();
  if (!permitido) return { ok: false, motivo: 'sin_permiso' };

  for (let intento = 0; intento < 3; intento++) {
    const { data, error } = await supabase.rpc('probar_mis_notificaciones');
    if (error) throw toAppError(error, 'No se pudo enviar la prueba.');
    const r = data as ResultadoPrueba;
    if (r.ok || r.motivo !== 'sin_dispositivo') return r;
    await esperar(2500);   // el registro en Firebase puede tardar unos segundos
  }
  return { ok: false, motivo: 'sin_dispositivo' };
}

export interface MensajeAlerta { id: string; mensaje: string; created_at: string }

/** Mensajes del personal sobre una alerta propia (paso 16). */
export async function getMensajesAlerta(alertId: string): Promise<MensajeAlerta[]> {
  const { data, error } = await supabase.from('notificaciones')
    .select('id, mensaje, created_at')
    .eq('alerta_id', alertId)
    .eq('titulo', 'Mensaje sobre tu alerta')
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as MensajeAlerta[];
}
