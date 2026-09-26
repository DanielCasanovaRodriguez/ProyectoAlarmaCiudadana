import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/** Vibración corta (retroalimentación táctil). No hace nada en la web. */
export async function hapticTap(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
}

/** Vibración de confirmación/alerta (p. ej. al enviar un SOS). */
export async function hapticNotify(kind: 'success' | 'warning' | 'error' = 'warning'): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    navigator.vibrate?.(kind === 'success' ? 80 : [120, 60, 120]);
    return;
  }
  const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
  await Haptics.notification({ type: map[kind] }).catch(() => undefined);
}
