import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Inicializa la "carcasa" nativa (solo Android/iOS):
 * barra de estado, splash y botón atrás del sistema.
 *
 * `onBack` debe devolver true si la app manejó la navegación hacia atrás;
 * si devuelve false, la app se minimiza (comportamiento estándar de Android
 * en la pantalla raíz, sin cerrar la sesión ni perder el estado).
 */
export async function initNativeShell(onBack: () => boolean): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => undefined;

  // Android 15+ dibuja la app de borde a borde y la barra de estado es
  // transparente sobre fondo claro: se usan iconos/texto oscuros.
  await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
  await SplashScreen.hide().catch(() => undefined);

  const handle = await CapApp.addListener('backButton', () => {
    if (!onBack()) CapApp.minimizeApp().catch(() => undefined);
  });

  return () => { handle.remove(); };
}
