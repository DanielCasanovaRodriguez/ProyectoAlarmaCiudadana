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
