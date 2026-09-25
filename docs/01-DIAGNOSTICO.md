# Alerta Ciudadana — Diagnóstico técnico y arquitectura propuesta

Fecha: 2026-09-25 · Estado del repo auditado: commit `242018c` (árbol limpio, 2 commits)

---

## 0. Entorno del equipo

| Elemento | Estado |
|---|---|
| Sistema operativo | Windows 11 Home 10.0.26200 |
| Proyecto | `D:\ProyectoAlarmaCiudadana` (Git, remoto `github.com/DanielCasanovaRodriguez/ProyectoAlarmaCiudadana`) |
| Node / npm | 24.14.0 / 11.9.0 (`D:\Node`) |
| Git | 2.53 (`D:\Git`) |
| Python | 3.14.3 (no lo usa el proyecto) |
| VS Code | `D:\Visual\Microsoft VS Code` |
| Android Studio | 2026.1 en `C:\Users\danic\AndroidStudio` (no está en PATH) |
| JDK | Solo el JBR de Android Studio (OpenJDK 25.0.3). Sin `JAVA_HOME`, sin `java` en PATH |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk`: platform `android-37.0`, build-tools 36.0.0, emulator, platform-tools. **Sin `cmdline-tools`, sin `system-images`, sin AVD creado.** Sin `ANDROID_HOME` |
| MySQL 8 / PostgreSQL 18 locales | Servicios activos (puertos 3306 / 5432) — **el proyecto no los usa** |
| Supabase CLI, gh, Docker | No instalados |

---

## 1. Qué es el proyecto realmente

- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind 4 + componentes shadcn/Radix. Es una exportación de **Figma Make** (“Alarma Ciudadana Móvil”): el diseño ya es *mobile-first*.
- **Backend:** **no existe un backend propio.** Todo el “backend” es **Supabase** (servicio en la nube):
  - Supabase Auth (registro, login, OTP por correo, recuperación de contraseña)
  - Supabase Postgres vía PostgREST (consultas directas desde el navegador con la *anon key*)
  - Supabase Storage (bucket `evidencias`)
  - Supabase Realtime (cambios en tabla `alerts`)
- **Base de datos:** PostgreSQL alojado en Supabase. **El esquema, las políticas RLS, triggers y funciones NO están en el repositorio**; solo existe `src/types/database.types.ts`, escrito a mano.
- **Despliegue:** Vercel (según commit `242018c`).
- **Mapas:** Leaflet 1.9.4 cargado en tiempo de ejecución desde `unpkg.com` + teselas OpenStreetMap.
- **Arquitectura:** cliente “grueso” (SPA) + BaaS. No es MVC ni API REST propia; es una SPA con una capa `services/` que habla directo con la BD. Navegación por máquina de estados (`currentScreen` en `App.tsx`), sin router.

```
Navegador (React SPA) ──supabase-js (HTTPS + JWT)──► Supabase
   src/services/*.ts                                   ├─ Auth
   App.tsx (estado + navegación)                       ├─ PostgREST → Postgres (RLS)
                                                       ├─ Storage (evidencias)
                                                       └─ Realtime (alerts)
```

**Consecuencia clave para la migración:** la “plataforma compartida” ya existe: es el proyecto Supabase. Android no necesita otra base de datos ni otro servidor; debe hablar con el mismo Supabase. La base local MySQL/PostgreSQL no forma parte de este sistema.

---

## 2. Modelo de datos (según `database.types.ts`)

| Tabla | Propósito | Notas |
|---|---|---|
| `profiles` | Perfil 1:1 con `auth.users` (rol, estado, bloqueo, consentimiento) | Roles: citizen, operator, admin, auditor. Se crea por trigger (según comentario en código) |
| `alerts` | Alerta / incidente (tipo, severidad, lat/lng, estado, anónimo, media_urls) | Estados: open → ack → resolved |
| `alert_types` | Catálogo (medical, robbery, accident, fire, violence) | |
| `alert_media` | Evidencias por alerta | **No se usa**: la app guarda URLs en `alerts.media_urls` (duplicidad de diseño) |
| `alert_status_history` | Historial de estados | Se inserta desde el cliente; el código sospecha que un trigger también lo hace |
| `asignaciones_unidad` | Unidad asignada a una alerta | Las unidades disponibles son **mock** en código (`getAvailableUnits`) |
| `emergency_contacts` | Contactos del ciudadano (`notificar_sos`) | Se guardan, **pero nunca se notifica a nadie** |
| `device_tokens` | Tokens push | **No se usa** (no hay push) |
| `notificaciones` | Notificaciones in-app | Se leen; en el código no se crean (¿trigger?) |
| `auditoria` | Bitácora | Solo se escribe al suspender usuarios |
| `cola_sincronizacion` | Cola offline | `saveAlertOffline` **nunca se llama** |

No se pudieron verificar: llaves foráneas, índices, triggers, vistas, funciones ni **políticas RLS** — están solo en Supabase. **Es el punto ciego más importante de la auditoría** (ver §6).

---

## 3. Funcionalidades existentes (verificadas en código)

| Módulo | Qué hace hoy |
|---|---|
| Onboarding / tutorial / consentimiento de datos / privacidad | Pantallas informativas |
| Registro ciudadano | `auth.signUp` + código de confirmación de 8 dígitos por correo |
| Login ciudadano | Email + contraseña; revisa `status` y `bloqueado_hasta` del perfil |
| Recuperar contraseña | OTP de recuperación por correo |
| Ubicación | `navigator.geolocation.getCurrentPosition` una vez; si se niega, zona manual de Kennedy o continuar sin ubicación |
| **SOS / reportar alerta** | Botón → hoja con tipo + descripción + evidencias → `insert` en `alerts` → subida a Storage → actualiza `media_urls` |
| Mapa ciudadano | Alertas activas (open/ack) de todos; Realtime + sondeo cada 15 s |
| Historial y detalle | Alertas propias, historial de estados, unidad asignada, cancelar (solo si `open`) |
| Contactos de emergencia | CRUD (borra todo y reinserta) |
| Perfil | Ver/editar; interruptor de notificaciones solo visual |
| Login colaboradores | Operador / admin / auditor + “2FA” por correo |
| Panel operador | Tabla + mapa de incidentes, cambio de estado, asignar unidad (mock), Realtime |
| Panel admin | KPIs, alertas CRUD, usuarios CRUD, auditoría, reportes (PDF por impresión, CSV), salud del sistema |

**No existe (y no se inventará):** integración con cámaras de vigilancia/CCTV (lo único es cámara/micrófono del dispositivo para evidencias), notificaciones push, envío de SMS/avisos a contactos de emergencia, ubicación en segundo plano, modo offline real, tabla de unidades.

---

## 4. Flujo SOS actual (Fase 9)

1. Disparo: un toque en `AlarmButton` abre `AlarmSheet` (no hay pulsación larga ni cuenta regresiva).
2. El usuario elige tipo y opcionalmente descripción/archivos, y pulsa enviar.
3. Datos enviados: `user_id` (del JWT), `type_code`, `lat/lng` (captura única, puede estar desactualizada o ser una zona manual), `description`, `severity=3` fija, `status='open'`. Fecha: `created_at` por defecto en BD.
4. Destinatarios: nadie recibe un aviso activo. Los operadores lo ven por Realtime si tienen el panel abierto. Los contactos de emergencia **no** se notifican.
5. Si falla el `insert`, la alerta queda mostrada solo localmente (el usuario puede creer que se envió).

---

## 5. Hallazgos por severidad

### Críticos (seguridad)

| # | Problema | Causa | Riesgo | Solución | Archivos |
|---|---|---|---|---|---|
| C1 | **La 2FA de colaboradores es decorativa** | La sesión Supabase ya existe tras la contraseña; si el OTP falla o hay rate-limit, el código se genera **en el navegador**, se imprime en consola y se compara contra `localStorage` | Cualquiera con la contraseña de un admin entra sin segundo factor | Usar MFA real de Supabase (TOTP, `aal2`) y exigir `aal2` en RLS para roles de colaborador; eliminar el código local | `utils/verificationCode.ts`, `EmailVerificationScreen.tsx`, `CollaboratorLoginScreen.tsx`, `LoginScreen.tsx` |
| C2 | **Autorización solo en el cliente** | Rol leído de `localStorage.admin_profile`; controles de rol en React | Toda la seguridad depende de RLS, que no está versionada ni verificada | Auditar y versionar RLS; checks de rol en BD (`auth.uid()` + `profiles.role`) | `AdminPanel.tsx`, `OperatorDashboard.tsx`, BD |
| C3 | **Posible escalada de privilegios** | `updateUserProfile` acepta cualquier campo de `profiles` (incluye `role`, `status`); el registro envía `role` en metadatos | Si la política UPDATE de `profiles` permite al usuario editar su fila, un ciudadano puede volverse `admin` | Política/trigger que impida cambiar `role/status/bloqueo` salvo admin; el trigger de alta debe ignorar `role` de metadatos | `profileService.tsx`, `authService.ts`, BD |
| C4 | **Evidencias públicas** | Bucket `evidencias` usado con `getPublicUrl` | Fotos/audios de incidentes (datos personales, Ley 1581) accesibles por cualquiera con la URL | Bucket privado + URLs firmadas + políticas de Storage por rol | `mediaService.tsx` |
| C5 | **Anonimato no protegido** | `getActiveAlerts` hace `select('*')` a todas las alertas activas | Cualquier ciudadano obtiene `user_id` de todos los reportes, incluidos los “anónimos” | Vista/función pública sin `user_id`; RLS por rol | `alertService.ts`, BD |
| C6 | **Modo desarrollo en producción** | `IS_DEVELOPMENT = true` fijo; se imprime el OTP fijo `12345678`, correos y contraseña de prueba en el bundle | Información sensible expuesta en el sitio de Vercel | Derivar de `import.meta.env.DEV`; eliminar mock | `config/environment.ts`, `devAuthService.ts` |

### Altos

- **H1** Bloqueo por intentos fallidos implementado en el cliente (`registrarIntentoFallido` nunca se llama; el reset lo hace el propio usuario) → no protege nada. Mover a BD/Auth hooks.
- **H2** Alta de usuarios por el admin con `auth.signUp` desde el navegador: puede reemplazar la sesión del admin si la confirmación de correo está desactivada, y el cambio de rol posterior depende de RLS. Debe ser una Edge Function con `auth.admin.createUser` (service role solo en servidor).
- **H3** Lógica de negocio en el cliente (cambios de estado, historial, `resolved_at`, auditoría). Con dos clientes se duplicaría → mover a funciones/trigger de Postgres (RPC) para que web y Android llamen lo mismo.
- **H4** Dependencias: 3 vulnerabilidades altas (`form-data`, `hono`, `ws`); ~30 dependencias con versión `"*"` (builds no reproducibles); `hono` y `@jsr/supabase__supabase-js` no se usan (duplicado del cliente Supabase).
- **H5** SOS sin confirmación del servidor visible: si falla el guardado, la alerta aparece “enviada” localmente.

### Medios / bajos

- Sin `tsconfig.json` → no hay comprobación de tipos; sin linter; **sin pruebas**.
- Bundle de 1,18 MB en un solo chunk.
- Leaflet desde `unpkg` sin SRI y fuera de `package.json` (duplicado en `MapView` y `OperatorMap`).
- Carpeta `build/` versionada y obsoleta (duplica `dist/`).
- Código muerto: `devAuthService.ts`, `saveAlertOffline`, `registrarIntentoFallido`, `updateSystemConfig`, tabla `alert_media`.
- `cancelAlert` marca `resolved` (no existe estado “cancelada”) → métricas mezcladas.
- `redirectTo: /reset-password` no tiene ruta (no hay router); funciona solo porque se usa OTP.
- Texto con codificación rota (`MÃ³vil`) en `package.json`, `index.html`, `README.md`.
- Ubicación: una sola lectura, sin refresco antes de enviar el SOS.
- `console.log` masivo con correos y códigos.

**Verificado:** `vite build` compila sin errores (solo aviso de tamaño). `.env` no está versionado (correcto). La *anon key* es pública por diseño; la seguridad real depende de RLS.

---

## 6. Qué falta para completar la auditoría

La BD vive en Supabase. Para auditar esquema, FK, índices, triggers, RLS y Storage necesito uno de estos accesos (en orden de preferencia):

1. **Supabase CLI** + `supabase login` y `supabase link` hechos **por ti** en tu terminal (la contraseña de BD la escribes tú); luego yo ejecuto `supabase db dump --schema public,storage` y versiono las migraciones en `supabase/`.
2. O exportas tú el esquema desde el panel (SQL Editor) y lo guardas en el proyecto.

Nunca pegues la *service role key* ni la contraseña de la BD en el chat.

---

## 7. Arquitectura objetivo

```
   ┌──────────────┐        ┌──────────────────────┐
   │   APP WEB    │        │    APP ANDROID       │
   │ React + Vite │        │ mismo código React + │
   │  (Vercel)    │        │ Capacitor (nativo)   │
   └──────┬───────┘        └──────────┬───────────┘
          │  src/services/* compartidos (supabase-js)
          └──────────────┬────────────┘
                         ▼
        ┌─────────────────────────────────────┐
        │  SUPABASE (backend único)           │
        │  Auth + MFA · PostgREST + RLS       │
        │  RPC/trigger (lógica de negocio)    │
        │  Edge Functions (admin, push FCM)   │
        │  Storage privado · Realtime         │
        └──────────────────┬──────────────────┘
                           ▼
              PostgreSQL de Supabase (única BD)
```

Principios:
- **Una sola BD y un solo backend** (el Supabase actual). No se crea nada paralelo para Android.
- **Lógica de negocio en la BD/servidor:** transiciones de estado, historial, auditoría, bloqueo, alta de usuarios, notificaciones → RPC de Postgres, triggers y Edge Functions. Los clientes solo llaman.
- **Esquema versionado** en `supabase/migrations/` para poder reproducir y revisar RLS.
- Capa de plataforma (`src/platform/`) que abstrae GPS, cámara, almacenamiento seguro y push: implementación web (navegador) y nativa (plugins Capacitor).

---

## 8. Tecnología móvil — evaluación (Fase 5)

| Opción | Reutilización | Esfuerzo | GPS / cámara / push / permisos | iOS futuro | Veredicto |
|---|---|---|---|---|---|
| **Capacitor + React existente** | ~85–90 %: servicios, tipos, pantallas, mapa, Realtime | Bajo–medio | Plugins oficiales: Geolocation, Camera, Push (FCM), Preferences; permisos nativos Android | Mismo código (requiere Mac + Xcode) | **Recomendado** |
| Kotlin + Jetpack Compose + supabase-kt | Solo BD/backend; ~50 pantallas a rehacer | Alto (semanas) | Excelente, el mejor para SOS en segundo plano | Rehacer en Swift (o KMP) | Mejor rendimiento, peor reutilización |
| React Native | Servicios y tipos; UI a rehacer (Radix/Tailwind no funcionan en RN) | Medio–alto | Bueno | Sí | Descartado: rehace UI sin ganar reutilización |
| Flutter | Solo BD/backend; todo en Dart | Alto | Bueno | Sí | Descartado: nueva base de código completa |

**Recomendación: Capacitor.** La UI ya fue diseñada como app móvil, toda la lógica cliente está en TypeScript y el backend es Supabase (que funciona igual en el WebView). El proyecto Android generado (`android/`) se abre, compila y ejecuta en **Android Studio** con Gradle. Si más adelante se requiere SOS en segundo plano robusto (servicio en primer plano, botón físico), se añade un plugin nativo en Kotlin dentro del mismo proyecto sin reescribir la app.

Limitaciones honestas: rendimiento de WebView inferior a nativo en listas/mapas muy grandes; ubicación en segundo plano requiere plugin adicional y justificación ante Google Play.

**Red en Android:** como el backend es Supabase en la nube (HTTPS), el emulador y el teléfono físico se conectan directo; no hace falta `10.0.2.2` ni la IP local. Solo el *live reload* en desarrollo usará la IP del PC.

---

## 9. Plan de implementación propuesto

| Etapa | Contenido | Toca |
|---|---|---|
| A. Base segura | Rama `migracion-android`, `tsconfig` + typecheck, fijar versiones, quitar deps muertas, `npm audit fix`, modo dev por `import.meta.env`, quitar código muerto y `build/` | `package.json`, `config/`, `services/`, `.gitignore` |
| B. Backend en BD | Volcar esquema a `supabase/migrations`; RLS revisadas; proteger `role/status`; vista pública sin `user_id`; RPC `cambiar_estado_alerta`; bucket privado + URLs firmadas; MFA real colaboradores | `supabase/`, `alertService`, `incidentService`, `mediaService`, pantallas de login |
| C. Capa de plataforma | `src/platform/` (geo, cámara, storage, push) web + nativa | `LocationPermissionScreen`, `MediaUpload`, `App.tsx` |
| D. Android | Capacitor, proyecto `android/`, permisos (ubicación fina/aproximada, cámara, micrófono, notificaciones), variables por entorno, ícono/splash | nuevo `android/`, `capacitor.config.ts` |
| E. SOS móvil | Pulsación sostenida 2–3 s o deslizar + cuenta regresiva cancelable, ubicación fresca antes de enviar, confirmación del servidor, reintento | `AlarmButton`, `AlarmSheet`, `App.tsx` |
| F. Notificaciones | FCM + Edge Function que notifica a operadores en alertas nuevas y al ciudadano en cambios de estado; `device_tokens` | `supabase/functions/`, Firebase (`google-services.json` fuera de Git) |
| G. Pruebas | Web, Android en emulador, integración cruzada Web ⇄ Android sobre la misma BD | — |
| H. Documentación | Instalación, ejecución, API/RPC, informe final | `docs/` |

Propuestas (no existen hoy, requieren tu aprobación): notificar contactos de emergencia (SMS vía Twilio o similar, con costo), ubicación en segundo plano, cola offline real.
