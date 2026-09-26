import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
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

export function isPushAvailable(): boolean {
  return PUSH_ENABLED && Capacitor.isNativePlatform();
}

/**
 * Pide permiso de notificaciones (Android 13+), registra el dispositivo en
 * FCM y guarda el token en `device_tokens` para el usuario actual.
 * Devuelve false si el usuario no concedió el permiso o push no está activo.
 */
export async function registerForPush(
  onNotificationTap?: (data: Record<string, any>) => void,
): Promise<boolean> {
  if (!isPushAvailable()) return false;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return false;

  await PushNotifications.removeAllListeners();

  await PushNotifications.addListener('registration', async ({ value: token }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Un token por dispositivo: se elimina el anterior y se inserta el actual
    await supabase.from('device_tokens').delete().eq('user_id', user.id).eq('token', token);
    const { error } = await supabase.from('device_tokens').insert({ user_id: user.id, platform: 'android', token });
    if (error) console.warn('No se pudo guardar el token push:', error.message);
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.warn('Error registrando notificaciones push:', err.error);
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    onNotificationTap?.(action.notification.data ?? {});
  });

  // Canal de alta prioridad para alertas (Android 8+)
  await PushNotifications.createChannel({
    id: 'alertas',
    name: 'Alertas ciudadanas',
    description: 'Nuevas alertas y cambios de estado de tus reportes',
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch(() => undefined);

  await PushNotifications.register();
  return true;
}

/** Elimina el token del usuario al cerrar sesión (deja de recibir push). */
export async function unregisterPush(): Promise<void> {
  if (!isPushAvailable()) return;
  await PushNotifications.removeAllListeners().catch(() => undefined);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('device_tokens').delete().eq('user_id', user.id).eq('platform', 'android');
}
