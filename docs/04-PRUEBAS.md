# Plan y registro de pruebas

## Pruebas automáticas / ejecutadas (2026-09-25)

| Prueba | Resultado |
|---|---|
| `npm run typecheck` (primera vez en la historia del proyecto) | ✅ 0 errores |
| `npm run build` | ✅ |
| `npm audit` | ✅ 0 vulnerabilidades (antes: 3 altas en producción + 1 en Vite) |
| `npm run test:db` — 29 escenarios de seguridad y negocio sobre PostgreSQL local | ✅ 29/29 (detectó y se corrigió 1 error en `cancelar_alerta`) |
| Compilación Android `assembleDebug` (Gradle 8.14.3, JDK 21, SDK 36) | ✅ APK ~11 MB |
| Instalación y arranque en emulador Pixel 8 / Android 16 | ✅ |
| Botón atrás del sistema (vuelve de pantalla; minimiza en raíz) | ✅ |
| Web en navegador: bienvenida, onboarding, acceso, login colaborador, sin errores de consola | ✅ |
| Onboarding "Saltar" | ❌→✅ error encontrado y corregido |

## Pruebas que requieren una cuenta real (las ejecuta el responsable)

Las pruebas con inicio de sesión en el Supabase real necesitan credenciales, que el asistente no introduce. Checklist:

### Web
- [ ] Registro ciudadano → llega el código de 8 dígitos → verificación → consentimiento → ubicación.
- [ ] Login ciudadano; cuenta suspendida muestra el mensaje correcto.
- [ ] Colaborador en login ciudadano → se le redirige a “Soy colaborador”.
- [ ] Login colaborador → llega OTP por correo → **un código incorrecto es rechazado** → el correcto abre el panel.
- [ ] Reportar alerta: mantener presionado 1,5 s; soltar antes **no** envía.
- [ ] Con la red desconectada, el SOS muestra error y el formulario sigue abierto para reintentar.
- [ ] Evidencia (foto) se ve en confirmación, historial y detalle.
- [ ] Cancelar alerta propia abierta.
- [ ] Operador: cambiar estado, asignar unidad, ver línea de tiempo.

### Android (emulador o teléfono)
- [ ] Instalación y arranque.
- [ ] Permiso de ubicación: *Permitir* → mapa centrado; *No permitir* → mensaje y zonas manuales; negar dos veces → mensaje de ajustes (permiso bloqueado).
- [ ] GPS apagado → mensaje “La ubicación del dispositivo está desactivada”.
- [ ] Cambiar la ubicación en *Extended controls* y enviar un SOS → la alerta queda con la coordenada nueva.
- [ ] Cámara y grabación de audio para evidencias (piden permiso).
- [ ] Botón atrás en cada pantalla.
- [ ] Push (tras activar Firebase, ver 03-NOTIFICACIONES.md).

## Prueba de integración (Fase 13)

**Android → API → BD → Web**
1. Android: inicia sesión como ciudadano y envía un SOS (tipo Robo, con descripción “Prueba integración A→W”).
2. Supabase Dashboard > Table Editor > `alerts`: aparece la fila con `status = open`.
3. Web: inicia sesión como operador → el incidente aparece en el panel **sin recargar** (Realtime).
4. Web: cámbialo a “En atención”.
5. Android: el detalle de la alerta muestra el nuevo estado y la línea de tiempo.

**Web → API → BD → Android**
1. Web: inicia sesión como otro ciudadano y envía un SOS (“Prueba integración W→A”).
2. Verifica la fila en `alerts`.
3. Android: en el mapa aparece el nuevo marcador (Realtime, o como máximo 15 s por el sondeo de respaldo).
4. Verifica que el ciudadano de Android **no** puede ver quién la creó (tras aplicar la migración 1).

## Versión 1.2.0 (2026-09-26): cédula, alertas cercanas y errores

| Prueba | Resultado |
|---|---|
| `npm run test:db` (réplica de producción, incluye migraciones 5–7) | ✅ 61/61 |
| `npm run test:unit` — traducción de errores (20 casos reales) | ✅ 20/20 |
| `npm run test:unit` — cédula: PDF417 por posiciones, imagen real leída con zxing-wasm, MRZ con dígitos de control, texto real del OCR, comparación de nombres, validaciones | ✅ 31/31 |
| Navegador: lectura PDF417 sintética (0,7 s) y MRZ por OCR (1,7 s), WebAssembly empaquetado | ✅ |
| Navegador: registro → validaciones, autorización Ley 1581, datos conservados al volver, pantalla de escaneo | ✅ |
| Android (emulador): cámara nativa frente/reverso, validación de resolución, lectura sin cédula real → revisión manual | ✅ |
| Producción: migraciones aplicadas; secretos en Vault; BD → pg_net → Edge Function (HTTP 200) | ✅ |
| Cédula real (amarilla y digital) fotografiada con un celular | ⏳ Responsable |
| Push con la app cerrada | ⏳ Requiere Firebase (03-NOTIFICACIONES.md) |

### Checklist manual con cuentas reales
- [ ] Registro nuevo: datos → cédula (ambos lados) → código del correo → “¡Cédula recibida!” → consentimiento → ubicación → mapa.
- [ ] Registrar otra cuenta con la **misma cédula** → “Esta cédula ya está registrada en otra cuenta”.
- [ ] Cuenta antigua sin cédula: al entrar se ofrece verificar; con “Ahora no” el botón de alerta muestra “Verificar ahora / Llamar al 123”.
- [ ] Admin → *Verificación de identidad*: ver fotos y número, aprobar/rechazar (el rechazo exige motivo).
- [ ] Modo avión: aviso “Sin conexión”, SOS deshabilitado con botón “Llamar al 123”; al volver la red, “Conexión restablecida”.
- [ ] Dos celulares a < 1 km: reportar en uno → aviso en el otro (con la app abierta; con Firebase, también cerrada).

## Versión 1.3.0 (2026-10-08): cédula por formulario, acceso con cédula, antiabuso y seguridad

| Prueba | Resultado |
|---|---|
| `npm run test:db` (réplica de producción, migraciones 1–9) | ✅ 70/70 |
| `npm run test:unit` (errores 20/20, validaciones de cédula y fecha 21/21) | ✅ |
| Producción, transacción revertida: registro con cédula → guardada cifrada, eliminada de metadatos, perfil `citizen`; duplicado (con cero a la izquierda) rechazado | ✅ |
| Producción, `acceso-cedula`: sin token 401; cédula inválida 400; inexistente 401 genérico; 6.º intento 429 (bloqueo 15 min); CORS no autoriza orígenes ajenos | ✅ |
| Producción: BD → pg_net (ya en `extensions`) → notificar-alerta | ✅ 200 |
| CSP de `vercel.json` servida localmente: la app carga, Supabase permitido, dominio ajeno bloqueado | ✅ |
| APK 1.3.0 con R8 (3,7 MB) en emulador: arranca, plugins funcionan, selector de fecha nativo sin fechas futuras | ✅ |
| Registro y acceso con una cédula y correo reales | ⏳ Responsable |
| Push con la app cerrada | ⏳ Requiere Firebase |


## Versión 1.4.0 (2026-10-08): interventoría

| Prueba | Resultado |
|---|---|
| `npm run test:db` (migraciones 1–12) | ✅ 81/81 |
| `npm run test:unit` (errores, cédula, interventoría: XSS, teléfonos, líneas de Colombia, contraseña) | ✅ 59/59 |
| Datos de producción compatibles con las nuevas validaciones (23 alertas) | ✅ |
| `acceso-cedula` recuperar y verificar con cédula inexistente: respuesta genérica | ✅ |
| Navegador (375 px): bienvenida con 123 y documentos legales, ventana de la política, inicio de sesión con un campo y su validación | ✅ |
