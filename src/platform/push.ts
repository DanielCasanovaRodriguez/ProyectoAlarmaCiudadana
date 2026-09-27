import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotificationSchema } from '@capacitor/push-notifications';
import { supabase } from '../utils/supabase/client';

/**
 * Notificaciones push (Firebase Cloud Messaging) para el cliente Android.
 *
 * Requisitos para activarlas (ver docs/03-NOTIFICACIONES.md):
 *   1. android/app/google-services.json del proyecto Firebase (no se versiona).
 *   2. VITE_PUSH_ENABLED=true en .env
 * Sin google-services.json, llamar a register() cierra la app en Android;
 * por eso está desactivado por defecto.
 */
const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === 'true';
const CLAVE_TOKEN = 'ac_push_token';

export function isPushAvailable(): boolean {
  return PUSH_ENABLED && Capacitor.isNativePlatform();
}

export type DatosNotificacion = {
  alert_id?: string;
  /** cercana | nueva (personal) | estado (cambio en tu alerta) */
  tipo?: string;
  tipo_alerta?: string;
  distancia_m?: string;
};

/**
 * Escucha las notificaciones desde el arranque de la app, antes de
 * restaurar la sesión: si la app estaba cerrada y se abrió tocando una
 * notificación, Capacitor entrega el evento en cuanto hay un oyente.
 */
export async function iniciarEscuchaNotificaciones(h: {
  onTocada: (datos: DatosNotificacion) => void;
  onRecibidaEnPrimerPlano: (n: PushNotificationSchema) => void;
}): Promise<() => void> {
  if (!isPushAvailable()) return () => undefined;
  const a = await PushNotifications.addListener('pushNotificationActionPerformed', (accion) => {
    h.onTocada((accion.notification.data ?? {}) as DatosNotificacion);
  });
  const b = await PushNotifications.addListener('pushNotificationReceived', (n) => {
    h.onRecibidaEnPrimerPlano(n);
  });
  return () => { a.remove(); b.remove(); };
}

let oyentesRegistro: Array<{ remove: () => Promise<void> }> = [];

/**
 * Pide permiso de notificaciones (Android 13+), registra el dispositivo en
 * FCM y lo asocia al usuario actual (un dispositivo = una cuenta).
 * Devuelve false si el usuario no concedió el permiso o push no está activo.
 */
export async function registerForPush(): Promise<boolean> {
  if (!isPushAvailable()) return false;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return false;

  await Promise.all(oyentesRegistro.map(o => o.remove().catch(() => undefined)));
  oyentesRegistro = [
    await PushNotifications.addListener('registration', async ({ value: token }) => {
      const { error } = await supabase.rpc('registrar_dispositivo', { p_token: token, p_plataforma: 'android' });
      if (error) { console.warn('No se pudo registrar el dispositivo para notificaciones:', error.message); return; }
      try { localStorage.setItem(CLAVE_TOKEN, token); } catch { /* */ }
    }),
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('Error registrando notificaciones push:', err.error);
    }),
  ];

  // Canal de alta prioridad (Android 8+): sonido y vibración aunque el
  // teléfono esté en reposo.
  await PushNotifications.createChannel({
    id: 'alertas',
    name: 'Alertas ciudadanas',
    description: 'Alertas cerca de ti, nuevas alertas y cambios de estado de tus reportes',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  }).catch(() => undefined);

  await PushNotifications.register();
  return true;
}

/** Al cerrar sesión: este dispositivo deja de recibir avisos de la cuenta. */
export async function unregisterPush(): Promise<void> {
  if (!isPushAvailable()) return;
  let token: string | null = null;
  try { token = localStorage.getItem(CLAVE_TOKEN); localStorage.removeItem(CLAVE_TOKEN); } catch { /* */ }
  if (token) await supabase.rpc('eliminar_dispositivo', { p_token: token });
  await PushNotifications.unregister().catch(() => undefined);
}
