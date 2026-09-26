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
