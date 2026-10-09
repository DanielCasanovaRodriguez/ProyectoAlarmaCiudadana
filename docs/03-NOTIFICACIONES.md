# Notificaciones: alertas cercanas y avisos de estado

## Cómo funciona

```
Ciudadano reporta alerta ──► alerts (INSERT)
                               │  trigger trg_z_notificar_alerta (pg_net, asíncrono)
                               ▼
                 Edge Function notificar-alerta  (verifica x-webhook-secret)
                   ├─ personal activo (operador/admin) ........ "🚨 Nueva alerta: Robo"
                   ├─ usuarios_cercanos(alerta, 1000 m, 24 h) . "⚠️ Alerta cerca de ti: Robo · A 450 m"
                   │     (última ubicación ≤ 24 h, avisos activos, sin el autor)
                   └─ cambio de estado → autor ............... "Actualización de tu alerta"
                               │
                               ├─ fila en `notificaciones` (bandeja en la app)
                               └─ push FCM a cada dispositivo (`device_tokens`)
```

- **Ubicación:** la app envía la última ubicación del usuario mientras está abierta (al entrar, al volver a la app y mientras el mapa está visible; máximo cada 10 min o 150 m). La BD la guarda redondeada a ~100 m y nadie más puede leerla. No se usa ubicación en segundo plano.
- **Tocar la notificación** abre la pantalla *Alerta cerca de ti*: tipo, estado, hace cuánto, distancia, descripción y mapa con el lugar. No muestra quién la reportó.
- **Con la app abierta** (web o Android): aviso en pantalla con botón *Ver*, aunque no haya push.
- **Preferencia:** Perfil → *Alertas cerca de mí* (se guarda en el servidor).
- **Un dispositivo = una cuenta:** si otra persona inicia sesión en el mismo celular, deja de recibir los avisos de la anterior. Cerrar sesión solo desvincula ese dispositivo.

## Estado (2026-09-26)

| Pieza | Estado |
|---|---|
| Migraciones 5–7 (ubicaciones, `usuarios_cercanos`, dispositivos, trigger pg_net, secretos en Vault) | ✅ Aplicadas |
| Edge Function `notificar-alerta` | ✅ Desplegada (`--no-verify-jwt`, protegida con `WEBHOOK_SECRET`) |
| Secreto `WEBHOOK_SECRET` (mismo valor que `ac_webhook_secret` en Vault) | ✅ Configurado |
| Camino BD → pg_net → función | ✅ Probado (HTTP 200) |
| Avisos dentro de la app y bandeja `notificaciones` | ✅ Funcionan |
| **Push al celular con la app cerrada (Firebase)** | ⏳ Requiere los pasos de abajo |

## Activar el push al celular (una sola vez)

Firebase es de Google y se crea con tu cuenta; son 5 minutos:

1. Entra a https://console.firebase.google.com → **Crear un proyecto** (nombre: `alerta-ciudadana`; Google Analytics no es necesario).
2. En el proyecto: **Agregar app → Android**. Nombre del paquete: `co.alertaciudadana.app`. Registra la app.
3. Descarga **`google-services.json`** y guárdalo en `D:\ProyectoAlarmaCiudadana\android\app\google-services.json` (está en `.gitignore`: no se sube a GitHub).
4. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Guarda el JSON en `D:\Dev\keystores\firebase-cuenta-servicio.json` (fuera del proyecto). Es secreto.
5. Carga ese secreto en Supabase desde tu terminal, en la carpeta del proyecto:
   ```bash
   npx supabase secrets set --project-ref nrqtslesypwzzxpgoxos FIREBASE_SERVICE_ACCOUNT="$(cat D:/Dev/keystores/firebase-cuenta-servicio.json)"
   ```
6. Luego se compila la app con `VITE_PUSH_ENABLED=true` y se publica una nueva versión del APK.

## Verificación

- Inicia sesión en Android y acepta el permiso de notificaciones → aparece una fila en `device_tokens`.
- Desde otro dispositivo, reporta una alerta a menos de 1 km → llega “⚠️ Alerta cerca de ti: …”; al tocarla se abre el detalle.
- Cambia su estado desde el panel de operador → el autor recibe “Actualización de tu alerta”.
- Registros: Dashboard → Edge Functions → notificar-alerta → Logs; y `select * from net._http_response order by id desc limit 5;`

## Limitaciones conocidas

- Sin ubicación en segundo plano: el aviso llega según la **última ubicación conocida en las últimas 24 h** (la de la última vez que se abrió la app). Rastreo continuo requeriría `ACCESS_BACKGROUND_LOCATION` y justificarlo ante Google Play.
- En la web no hay push con la pestaña cerrada (solo aviso con la app abierta).
- Aviso a contactos de emergencia por SMS: no implementado (requiere proveedor con costo).


---

## v1.6.0 (2026-10-08): notificaciones funcionando de punta a punta

**Causa de que no llegara ningún push:** el secreto `FIREBASE_SERVICE_ACCOUNT` quedó guardado **incompleto** (solo la primera línea del archivo JSON de Google, que tiene varias líneas). La función `notificar-alerta` guardaba la notificación en la bandeja de la app y luego fallaba al leer la llave → HTTP 500 en cada alerta, 0 push enviados.

**Corrección:**
- Secreto guardado de nuevo en una sola línea (base64). La función acepta JSON o base64 y explica el error si la llave está incompleta.
- Modo `DIAGNOSTICO` (verifica la llave con Google sin enviar nada) → `{"ok":true,"proyecto":"alertaciudadana-fe5bd"}`.
- Push de prueba real a la cuenta del responsable → **enviado por FCM** (`enviados: 1`); el token de una instalación vieja se limpió solo.
- Errores por dispositivo no detienen a los demás; tokens de celulares que desinstalaron la app se eliminan; una notificación por alerta (`tag`), alta prioridad y visible en la pantalla de bloqueo.
- **Perfil → Probar notificaciones**: cualquier persona comprueba que le llegan (máx. 1 por minuto).
- Con la app abierta no se duplica el aviso (push + aviso interno).

**Quién recibe qué**
| Evento | Destinatarios |
|---|---|
| Alerta nueva | Operadores y administradores activos + personas a ≤ 1 km (última ubicación de las últimas 24 h, con "Alertas cerca de mí" activo) |
| Cambio de estado | Quien reportó |
| Cierre automático (1 hora) | Quien reportó: "Tu alerta se cerró… si continúa, repórtala de nuevo o llama al 123" |

Para que lleguen con la app cerrada: permiso de notificaciones concedido y batería de la app en "Sin restricciones" (Xiaomi, Huawei, Samsung y otros cierran apps en segundo plano).
