# Informe final — Migración a Web + Android

Rama: `migracion-android` · Fecha: 2026-09-25

## 1. Qué se encontró

- **No había backend propio:** la web (React + Vite, exportada de Figma Make) hablaba directo con **Supabase** (Auth, PostgreSQL, Storage, Realtime). Esa es la plataforma compartida; Android se conecta al mismo proyecto. Los MySQL/PostgreSQL locales del equipo no forman parte del sistema.
- **El esquema, las RLS y los triggers no estaban versionados:** existían solo en Supabase.
- **Problemas de seguridad graves**, detallados en [01-DIAGNOSTICO.md](01-DIAGNOSTICO.md):
  - 2FA de colaboradores evitable: código generado en el navegador.
  - Una segunda pantalla 2FA **simulada** que aceptaba cualquier código.
  - Autorización solo en la interfaz.
  - Posible auto-asignación de rol admin.
  - Evidencias públicas.
  - `user_id` expuesto en alertas anónimas.
  - Contraseña guardada en el estado de la app.
- **Deuda técnica:**
  - 3 vulnerabilidades altas en producción y ~30 dependencias sin versión fija.
  - Sin comprobación de tipos ni pruebas.
  - Unos 40 archivos muertos, y `build/` versionado.
  - El SOS mostraba “enviado” aunque fallara el guardado.

## 2. Problemas corregidos

| Problema | Corrección | Archivos |
|---|---|---|
| 2FA con código local | Solo OTP de Supabase; la sesión nace al verificar | `verificationCode.ts`, `CollaboratorLoginScreen.tsx`, `EmailVerificationScreen.tsx` |
| Pantalla 2FA simulada | Eliminada; los colaboradores van al acceso con OTP real | `TwoFactorVerificationScreen.tsx` (borrado), `LoginScreen.tsx`, `App.tsx` |
| Escalada de rol | Trigger `proteger_campos_perfil` (probado) | `supabase/migrations/…0001` |
| Autorización en cliente | RLS completas por rol + RPC con validación (probadas) | `…0001`, `…0002` |
| Anonimato | `alertas_activas_publicas()` sin `user_id`; el cliente la usa | `…0001`, `alertService.ts` |
| Evidencias públicas | Bucket privado + URLs firmadas en todas las vistas | `…0003`, `mediaService.tsx`, `useSignedMediaUrls.ts`, 5 pantallas |
| Contraseña en memoria | Ya no se guarda | `App.tsx` |
| SOS confirmado sin guardar | Solo confirma con respuesta del servidor; GPS fresco; reintento | `App.tsx`, `AlarmSheet.tsx` |
| Activación accidental del SOS | “Mantén para enviar” 1,5 s + vibración | `HoldToConfirmButton.tsx` |
| Dependencias | Versiones fijadas, 26 paquetes sin uso quitados, Vite 6.4.3; 0 vulnerabilidades en producción | `package.json` |
| Sin tipos | `tsconfig.json`, `npm run typecheck` = 0 errores | `tsconfig.json`, `src/vite-env.d.ts` |
| Código muerto | Eliminados mock de auth, config sin uso, 31 componentes UI, tipos duplicados, funciones sin llamadas, `build/` | varios |
| Campo deshabilitado ignorado | `AuthInput` respeta `disabled` | `AuthInput.tsx` |
| “Saltar” del onboarding | Salta el recorrido completo | `OnboardingScreen.tsx`, `App.tsx` |
| Leaflet por CDN | Empaquetado con npm (funciona en el APK) | `MapView.tsx`, `OperatorMap.tsx`, `main.tsx` |

## 3. Arquitectura implementada

Una plataforma y dos clientes (ver [02-INSTALACION-Y-EJECUCION.md](02-INSTALACION-Y-EJECUCION.md) §1):
- **Web:** React + Vite.
- **Android:** el mismo código empaquetado con Capacitor.
- **Backend y BD compartidos:** Supabase.
- **Lógica de negocio centralizada** en funciones PostgreSQL y RLS.
- **Capa `src/platform`** para lo que difiere entre web y Android: GPS, push, vibración y botón atrás.

## 4. Tecnología Android: Capacitor 8.5

Se eligió porque:
- Reutiliza cerca del 90 % del código existente: servicios, tipos, pantallas, mapa y Realtime.
- La interfaz ya estaba diseñada como app móvil.
- Genera un proyecto Gradle nativo que se abre y ejecuta en **Android Studio**.
- Tiene plugins oficiales para GPS, permisos, cámara, push y vibración.
- El mismo código servirá para iOS (`@capacitor/ios`, requiere Mac con Xcode).

Kotlin/Compose obligaba a reescribir unas 50 pantallas. Flutter y React Native reescribían la interfaz sin ganar reutilización.

Configuración: `minSdk 24`, `target/compileSdk 36`, Gradle 8.14.3, AGP 8.13, JDK 21. Paquete: `co.alertaciudadana.app`.

## 5. Funcionalidades migradas a Android

Todas las de la web funcionan en Android, porque es el mismo código:
- Onboarding, registro con verificación por correo, login y recuperación de contraseña.
- Consentimiento, ubicación con GPS nativo, mapa en tiempo real y SOS con evidencias.
- Historial, detalle, cancelación, perfil y contactos de emergencia.
- Paneles de operador y administrador.

Añadidas específicamente para móvil:
- Permisos nativos en tiempo de ejecución.
- Manejo de GPS apagado y de permiso bloqueado.
- Botón atrás del sistema.
- Vibración.
- Copias de seguridad desactivadas, para no exportar la sesión.

## 6. Pendiente

| Pendiente | Motivo | Cómo completarlo |
|---|---|---|
| **Aplicar las 3 migraciones en Supabase** | Requiere acceso a tu proyecto Supabase (inicio de sesión tuyo). La consulta directa a producción fue bloqueada por la política de permisos del asistente | [02 §6](02-INSTALACION-Y-EJECUCION.md) |
| Auditar el esquema real (FK, índices, triggers, políticas actuales) | Mismo motivo | `supabase/audit/00_inspeccion.sql` |
| Activar push | Requiere crear un proyecto Firebase con tu cuenta | [03-NOTIFICACIONES.md](03-NOTIFICACIONES.md) |
| Pruebas con inicio de sesión y prueba de integración Web ⇄ Android | Requieren credenciales reales, que el asistente no introduce | [04-PRUEBAS.md](04-PRUEBAS.md) |
| Aplicar MFA TOTP (`aal2`) a colaboradores | Mejora sobre el OTP por correo; requiere activarlo en el panel de Supabase | Recomendación §8 |
| Mover el alta de usuarios del admin a una Edge Function (`auth.admin.createUser`) | Hoy usa `signUp` desde el navegador | Recomendación §8 |
| Ruta del SDK en la configuración global de Android Studio | Android Studio estaba abierto; el proyecto ya apunta a `D:\Android\Sdk` por `local.properties` | [02 §4.4](02-INSTALACION-Y-EJECUCION.md) |

## 7. Problemas que todavía existen

- El **bloqueo por intentos fallidos** sigue sin ser efectivo (contadores en el cliente). Los límites reales los aplica Supabase Auth (*rate limits*); el campo `intentos_fallidos` queda protegido pero sin uso.
- **Unidades de despacho simuladas** (`getAvailableUnits`): no existe tabla de unidades.
- **Integración con cámaras de vigilancia (CCTV): no existe** en el sistema. Solo se usa la cámara del dispositivo para evidencias.
- **Contactos de emergencia:** se guardan, pero no se les avisa en un SOS (propuesta en 03).
- `alerts.media_urls` y la tabla `alert_media` duplican el mismo concepto (se usa solo `media_urls`).
- Cancelar una alerta la deja como `resolved`: no existe un estado “cancelada”.
- JS de 1,17 MB en un solo bloque. Se puede dividir cargando los paneles admin/operador bajo demanda.
- Las teselas de OpenStreetMap tienen política de uso justo. En producción conviene un proveedor de mapas con clave.
- Aviso inofensivo de Capacitor en el log (“Error injecting safe area CSS”) al iniciar.
- Vulnerabilidad moderada solo de desarrollo (`uuid` vía `@capacitor/cli` → `xcode`, usada para iOS). No afecta a la app.
- Mientras las migraciones no se apliquen, **la seguridad sigue dependiendo de las políticas actuales de Supabase**, que no se han podido revisar.

## 8. Recomendaciones

1. Aplicar las migraciones (primero en un proyecto Supabase de pruebas si es posible) y borrar después los caminos de respaldo de `src/services/rpc.ts`.
2. MFA TOTP para colaboradores y política RLS que exija `aal2` en los paneles.
3. Edge Function para la administración de usuarios con la *service role* solo en el servidor.
4. Estado `cancelled` y tabla de unidades reales.
5. CI (GitHub Actions) con `typecheck`, `build`, `test:db` y `assembleDebug`.
6. Firma de *release* de Android (keystore fuera de Git) y publicación en Play Store.
7. Para SOS en segundo plano o botón físico: plugin nativo Kotlin con *foreground service*, dentro del mismo proyecto Capacitor.
8. iOS: `npm i @capacitor/ios && npx cap add ios` en una Mac.

## 9. Cambios en el equipo (todo en D:)

| Qué | Dónde |
|---|---|
| Android SDK (copiado desde C:, el original sigue en `%LOCALAPPDATA%\Android\Sdk`) | `D:\Android\Sdk` |
| cmdline-tools (SHA-256 verificado), imagen del emulador API 36, platform 36 | `D:\Android\Sdk` |
| Emulador `AlertaPixel8` | `D:\Android\avd` |
| JDK Temurin 21 (SHA-256 verificado) | `D:\Dev\jdk-21` |
| Caché de Gradle / npm | `D:\Android\gradle-home`, `D:\Dev\npm-cache` |
| Descargas | `D:\Dev\downloads` |
| Variables de usuario | `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `ANDROID_AVD_HOME`, `GRADLE_USER_HOME`, `JAVA_HOME`, `Path` |

Cuando confirmes que Android Studio funciona con `D:\Android\Sdk`, puedes borrar el SDK antiguo de C: (`%LOCALAPPDATA%\Android\Sdk`, 1,5 GB) para liberar espacio. No se borró automáticamente.
