# Alerta Ciudadana — Instalación, ejecución y desarrollo

## 1. Arquitectura final

```
   ┌─────────────────────┐          ┌──────────────────────────┐
   │  CLIENTE WEB        │          │  CLIENTE ANDROID         │
   │  React + Vite       │          │  mismo código React      │
   │  (navegador/Vercel) │          │  + Capacitor 8 (APK)     │
   └─────────┬───────────┘          └────────────┬─────────────┘
             │   src/services/*  (lógica cliente compartida)
             │   src/platform/*  (GPS, push, vibración, botón atrás)
             └───────────────┬───────────────────┘
                             │ HTTPS + JWT (supabase-js)
                             ▼
       ┌──────────────────────────────────────────────────┐
       │  SUPABASE — backend único                        │
       │  Auth · PostgREST + RLS · RPC (lógica de negocio)│
       │  Storage (evidencias) · Realtime (alerts)        │
       │  Edge Function notificar-alerta → Firebase FCM   │
       └───────────────────────┬──────────────────────────┘
                               ▼
                 PostgreSQL de Supabase (BD única)
```

- **Una plataforma, dos clientes.** Web y Android usan el mismo proyecto Supabase, las mismas tablas y las mismas funciones. Lo que crea uno aparece en el otro (Realtime + consultas).
- **Lógica de negocio en la BD:** cambios de estado, cancelación, historial, auditoría y permisos están en funciones PostgreSQL y políticas RLS (`supabase/migrations`). Los clientes solo llaman.
- **Sin servidor local.** El backend está en la nube: el emulador y el teléfono se conectan directamente por HTTPS. No se necesita `10.0.2.2` ni la IP del PC (salvo el *live reload* opcional, §4.6).

## 2. Estructura de carpetas

```
ProyectoAlarmaCiudadana/
├─ src/
│  ├─ App.tsx                 Navegación (máquina de estados) y flujo SOS
│  ├─ components/             Pantallas y componentes (web y Android)
│  │  ├─ screens/             Ciudadano, operador y admin
│  │  ├─ HoldToConfirmButton  Botón "mantén para enviar" del SOS
│  │  └─ ui/                  Componentes base (shadcn/Radix) en uso
│  ├─ services/               Acceso a Supabase (auth, alertas, incidentes, admin, media, perfil)
│  ├─ platform/               Todo lo que difiere entre web y Android
│  │  ├─ location.ts          Permisos y GPS (navegador o nativo)
│  │  ├─ push.ts              Notificaciones FCM
│  │  ├─ device.ts            Vibración
│  │  └─ shell.ts             Barra de estado, splash, botón atrás
│  ├─ hooks/useSignedMediaUrls.ts  URLs firmadas de evidencias
│  ├─ types/database.types.ts Tipos de tablas y funciones RPC
│  └─ utils/supabase/         Cliente Supabase (singleton)
├─ android/                   Proyecto Android Studio (Gradle) generado por Capacitor
├─ supabase/
│  ├─ migrations/             SQL versionado (funciones, RLS, storage)
│  ├─ functions/              Edge Functions (notificar-alerta)
│  ├─ tests/                  Pruebas de las migraciones (PGlite, local)
│  └─ audit/                  Consultas de inspección (solo lectura)
├─ capacitor.config.ts        Configuración del cliente Android
└─ docs/                      Esta documentación
```

**Convenciones:** TypeScript estricto (`npm run typecheck` debe dar 0 errores); servicios en `src/services` devuelven datos o lanzan `Error` con mensaje en español; todo acceso a hardware pasa por `src/platform`; ningún secreto en el código (solo la *anon key* pública vía `.env`).

## 3. Requisitos (ya instalados en este equipo)

| Herramienta | Versión | Ubicación |
|---|---|---|
| Node.js / npm | 24.x / 11.x | `D:\Node` |
| Git | 2.53 | `D:\Git` |
| JDK (para Gradle) | Temurin 21 LTS | `D:\Dev\jdk-21` (`JAVA_HOME`) |
| Android Studio | 2026.1 | `C:\Users\danic\AndroidStudio` |
| Android SDK | platform 36/37, build-tools 36, emulator, cmdline-tools | `D:\Android\Sdk` (`ANDROID_HOME`) |
| Emulador | `AlertaPixel8` (Android 16, API 36, x86_64) | `D:\Android\avd` (`ANDROID_AVD_HOME`) |
| Caché de Gradle | — | `D:\Android\gradle-home` (`GRADLE_USER_HOME`) |
| Caché de npm | — | `D:\Dev\npm-cache` |

> ¿Por qué JDK 21 y no el de Android Studio? El proyecto usa Gradle 8.14.3, que no funciona con Java 25 (el JDK incluido en Android Studio 2026.1). En `D:\Android\gradle-home\gradle.properties` está `org.gradle.java.home=D:/Dev/jdk-21`.

### Variables de entorno de la app (`.env`, no se versiona)

| Variable | Obligatoria | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sí | Clave pública *anon* (la seguridad la da RLS) |
| `VITE_SUPABASE_PROJECT_ID` | No | Referencia del proyecto |
| `VITE_PUSH_ENABLED` | No | `true` solo cuando exista `android/app/google-services.json` |

Nunca poner en `.env` la *service role key* ni la contraseña de la BD: todo lo que empieza por `VITE_` termina dentro de la app.

## 4. Ejecución paso a paso

### 4.1 Base de datos
No se inicia nada localmente: es el PostgreSQL de Supabase (siempre activo en la nube). Las migraciones se aplican una vez (§6).

### 4.2 Backend
Tampoco se inicia localmente: es Supabase. La Edge Function se despliega con `npx supabase functions deploy notificar-alerta` (ver [03-NOTIFICACIONES.md](03-NOTIFICACIONES.md)).

### 4.3 Aplicación web
```bash
npm install
npm run dev
```
Abre `http://localhost:3000`. Para producción: `npm run build` (sale en `dist/`, que Vercel publica).

### 4.4 Aplicación Android desde Android Studio
```bash
npm run android:sync
```
Luego abre Android Studio > **Open** > `D:\ProyectoAlarmaCiudadana\android`, espera la sincronización de Gradle, elige el dispositivo `AlertaPixel8` y pulsa **Run ▶**.

Una vez en Android Studio, verifica (solo la primera vez):
- *Settings > Languages & Frameworks > Android SDK* → **Android SDK Location** = `D:\Android\Sdk`.
- *Settings > Build, Execution, Deployment > Build Tools > Gradle* → **Gradle JDK** = `JAVA_HOME (D:\Dev\jdk-21)`.

Cada vez que cambies código React: `npm run android:sync` y vuelve a ejecutar.

### 4.5 Android sin abrir Android Studio (terminal)
```bash
npm run android:sync
```
```bash
cd android && gradlew.bat assembleDebug
```
```bash
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

### 4.6 Emulador
- Iniciar: Android Studio > Device Manager > ▶ en `AlertaPixel8`, o `emulator -avd AlertaPixel8`.
- GPS simulado: en el emulador, **⋯ (Extended controls) > Location**, escribe coordenadas (p. ej. Kennedy 4.6280, -74.1477) y pulsa *Set location*.
- Cámara: el emulador usa una cámara virtual (escena 3D).
- **IP para el backend:** ninguna; Supabase es público por HTTPS.
- *Live reload* opcional (ver cambios sin recompilar): `npm run dev -- --host`, averigua tu IP con `ipconfig` (p. ej. 192.168.1.20) y ejecuta `set CAP_SERVER_URL=http://192.168.1.20:3000 && npx cap run android`. En el emulador también sirve `http://10.0.2.2:3000`.

### 4.7 Teléfono físico
1. En el teléfono: *Ajustes > Acerca del teléfono* → toca 7 veces *Número de compilación*.
2. *Opciones de desarrollador* → activa **Depuración USB**.
3. Conecta por USB, acepta la huella del PC y comprueba con `adb devices`.
4. En Android Studio elige el teléfono y pulsa Run, o `adb install -r app-debug.apk`.

## 5. API: servicios y funciones

La API es la de Supabase (PostgREST + RPC). Endpoints efectivos:

| Operación | Llamada | Quién |
|---|---|---|
| Registro / login / OTP / recuperación | Supabase Auth (`signUp`, `signInWithPassword`, `signInWithOtp`, `verifyOtp`, `resetPasswordForEmail`) | Todos |
| Crear alerta (SOS) | `insert alerts` (RLS: solo a nombre propio, estado `open`) | Ciudadano |
| Adjuntar evidencias | Storage `evidencias/alertas/<alert_id>/<archivo>` + `update alerts.media_urls` | Autor |
| Mapa de alertas activas | `rpc alertas_activas_publicas()` (sin `user_id`) | Autenticados |
| Mis alertas / detalle | `select alerts where user_id = yo` | Ciudadano |
| Cancelar alerta | `rpc cancelar_alerta(p_alert_id)` | Autor, solo si `open` |
| Cambiar estado | `rpc cambiar_estado_alerta(p_alert_id, p_nuevo, p_nota)` | Operador / admin |
| Historial de estado | `select alert_status_history` | Autor y colaboradores |
| Asignar unidad | `insert asignaciones_unidad` | Operador / admin |
| Contactos de emergencia | CRUD `emergency_contacts` (solo propios) | Ciudadano |
| Notificaciones | `select/update notificaciones` (propias) | Todos |
| Usuarios, auditoría, reportes | `profiles`, `auditoria`, `alerts` | Admin / auditor |
| Realtime | canal `postgres_changes` sobre `alerts` | Mapa y panel de operador |

Roles: `citizen`, `operator`, `admin`, `auditor` (lectura). Autenticación: JWT de Supabase Auth; en Android la sesión queda en el almacenamiento privado del WebView (copias de seguridad desactivadas).

## 6. Aplicar las migraciones en Supabase

1. **Inspección (solo lectura):** ejecuta `supabase/audit/00_inspeccion.sql` en el SQL Editor y guarda los resultados. El bloque 5 es la copia de las políticas actuales.
2. **Prueba local:** `npm run test:db` (29 pruebas, sin red).
3. **Aplicar**, en orden, en el SQL Editor o con `npx supabase db push`:
   1. `20260925000001_funciones_negocio.sql` (aditivo)
   2. `20260925000002_politicas_rls.sql` (reemplaza las políticas; revisar primero)
   3. `20260925000003_storage_evidencias.sql` (evidencias privadas)
4. Verifica el login ciudadano, un SOS y el panel de operador (ver [04-PRUEBAS.md](04-PRUEBAS.md)).

Los clientes funcionan antes y después de aplicarlas: si una RPC no existe todavía, usan la consulta anterior (`src/services/rpc.ts`). Una vez aplicadas en producción, esos caminos de respaldo se pueden borrar.

## 7. Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Web en desarrollo (puerto 3000) |
| `npm run build` | Build de producción web |
| `npm run typecheck` | Comprobación de tipos |
| `npm run test:db` | Pruebas de migraciones SQL (local) |
| `npm run android:sync` | Build web + copiar a `android/` |
| `npm run android:open` | Abrir el proyecto en Android Studio |
