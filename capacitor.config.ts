import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuración del cliente Android (y futuro iOS).
 *
 * La app nativa empaqueta el mismo build web (`dist/`) y habla con el mismo
 * proyecto Supabase que la web: no hay backend ni base de datos aparte.
 *
 * Live reload en desarrollo (opcional):
 *   CAP_SERVER_URL=http://<IP-del-PC>:3000 npx cap run android
 */
const liveReloadUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'co.alertaciudadana.app',
  appName: 'Alerta Ciudadana',
  webDir: 'dist',
  android: {
    // Solo se permite tráfico HTTP sin cifrar cuando se usa live reload local.
    allowMixedContent: false,
  },
  server: liveReloadUrl
    ? { url: liveReloadUrl, cleartext: true }
    : { androidScheme: 'https' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#DC2626',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
