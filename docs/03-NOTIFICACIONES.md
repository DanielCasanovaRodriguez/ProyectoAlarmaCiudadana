# Notificaciones push (Firebase Cloud Messaging)

El código está listo pero **desactivado** porque requiere un proyecto de Firebase propio (tu cuenta de Google). Sin `google-services.json`, Android cierra la app al registrar push; por eso se controla con `VITE_PUSH_ENABLED`.

## Qué hace

| Evento | Destinatarios | Registro |
|---|---|---|
| Nueva alerta (`INSERT alerts`) | Operadores y administradores activos | `notificaciones` + push |
| Cambio de estado (`UPDATE alerts.status`) | Ciudadano autor | `notificaciones` + push |

Tocar la notificación abre el detalle de la alerta en la app.

## Activación (una sola vez)

1. **Firebase:** en https://console.firebase.google.com crea un proyecto → *Agregar app Android* con el paquete `co.alertaciudadana.app`.
2. Descarga `google-services.json` y guárdalo en `android/app/google-services.json` (está en `.gitignore`; no se sube a GitHub).
3. **Cuenta de servicio:** *Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada* (JSON). Ese archivo es secreto: no lo pongas en el proyecto.
4. **Secrets en Supabase** (en tu terminal, con la sesión de Supabase CLI iniciada):
   ```bash
   npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat ruta\a\cuenta-servicio.json)"
   ```
   ```bash
   npx supabase secrets set WEBHOOK_SECRET=<un-valor-aleatorio-largo>
   ```
5. **Desplegar la función:**
   ```bash
   npx supabase functions deploy notificar-alerta --no-verify-jwt
   ```
   (`--no-verify-jwt` porque la llama el webhook, que se autentica con `x-webhook-secret`.)
6. **Webhook:** Supabase Dashboard > *Database > Webhooks > Create*: tabla `alerts`, eventos `INSERT` y `UPDATE`, tipo *Supabase Edge Function* → `notificar-alerta`, cabecera `x-webhook-secret: <el mismo valor>`.
7. En `.env`: `VITE_PUSH_ENABLED=true`, y luego `npm run android:sync` y ejecutar.

## Verificación

- Inicia sesión como operador en Android y acepta el permiso de notificaciones → aparece una fila en `device_tokens`.
- Crea una alerta desde la web como ciudadano → el teléfono del operador recibe “🚨 Nueva alerta”.
- Cambia el estado desde el panel de operador → el ciudadano recibe “Actualización de tu alerta”.
- Logs: Dashboard > Edge Functions > notificar-alerta > Logs.

## Pendiente / propuestas (no existen hoy)

- Web push para el panel web de operadores (hoy el panel se actualiza por Realtime mientras está abierto).
- Aviso por SMS a `emergency_contacts` con `notificar_sos` (requiere un proveedor de SMS con costo, p. ej. Twilio).
