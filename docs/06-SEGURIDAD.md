# Auditoría de seguridad y antiabuso (v1.3.0 · 2026-10-08)

## 1. Identificación y autenticación

| Aspecto | Implementación |
|---|---|
| Identificador del ciudadano | **Número de cédula** (único). |
| Secreto | **Contraseña** (mín. 8 caracteres con letras y números en el formulario). La fecha de expedición **no** es contraseña: es un dato que aparece en documentos y fotocopias. |
| Unicidad de la cédula | `UNIQUE (numero_hash)` en `public.cedulas`, comprobada **dentro de la misma transacción** en que Supabase Auth crea el usuario (triggers `trg_a_registro_validar_cedula` / `trg_b_registro_guardar_cedula`). Dos registros simultáneos: el segundo falla y su usuario no se crea. |
| Almacenamiento | Número: huella HMAC-SHA256 (unicidad y búsqueda) + cifrado `pgp_sym_encrypt`. Fecha de expedición: cifrada. Claves en **Supabase Vault**. La cédula se elimina de los metadatos del registro (no queda en `auth.users`). |
| Validación | Cliente (respuesta inmediata) y **base de datos** (autoridad): 5–10 dígitos, no repetidos; fecha real, no futura, desde 1940. |
| Inicio de sesión | Edge Function `acceso-cedula`: cédula → cuenta sin revelar el correo; mismo mensaje y demora aleatoria para cédula inexistente o contraseña incorrecta (evita enumerar cédulas). |
| Fuerza bruta | 5 fallos por cédula **o** 20 por IP en 15 min → bloqueo de 15 min (`private.intentos_acceso`; IP guardada como huella). Además, los límites propios de Supabase Auth. |
| Sesiones | JWT de Supabase Auth con renovación (refresh token rotativo); cierre de sesión real (revoca el refresh token y desvincula el dispositivo de notificaciones). |
| Colaboradores | Correo + contraseña + código por correo (segundo factor real). |
| Cuentas anteriores sin cédula | Pueden entrar con su correo; la app les pide registrar la cédula (sin ella no pueden reportar). |
| Suplantación | Cédula reservada por una cuenta que no confirmó su correo en 24 h se libera sola. Ante denuncia del titular, un admin libera la cédula y suspende la cuenta (auditado). |

## 2. Antiabuso (reportes de broma)

- **Una cédula = una cuenta** (unicidad real).
- **Límite de envío** por ciudadano: 1 alerta por minuto, 3 en 10 minutos, 10 al día (trigger `trg_a1_limitar_alertas`). Se registra en el log de Postgres (`limite_alertas`).
- **Alertas falsas**: el operador las marca (con confirmación). 3 en 30 días → reportes suspendidos 7 días automáticamente. El ciudadano ve el motivo y la fecha.
- **Auditoría**: registros, accesos exitosos y fallidos, consultas del número de cédula por un admin, liberaciones y alertas falsas (`public.auditoria`).
- **Creación masiva de cuentas**: confirmación obligatoria por correo, cédula única, límites de Supabase Auth.
- No se puede garantizar que una identificación única elimine todas las bromas: por eso se combina con límites, marcado de falsas y bloqueo.

## 3. Endurecimiento aplicado

| Hallazgo | Corrección |
|---|---|
| Escaneo de cédula: 2 de 2 lecturas reales fallidas | Reemplazado por formulario; función de escaneo revocada (datos anteriores conservados como histórico) |
| Web sin cabeceras de seguridad | `vercel.json`: CSP estricta (solo la app, Supabase y teselas OSM), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP |
| `console.log` con datos (correos) en producción | Eliminados del build de producción |
| APK sin ofuscar | R8 (minify + shrink): 8,8 MB → 3,7 MB; probado en emulador |
| Tráfico sin cifrar | `usesCleartextTraffic=false` explícito |
| `pg_net` en esquema público | Movido a `extensions` |
| `distancia_m` sin `search_path` | Fijado |
| `get_my_role` ejecutable sin uso | Revocado |
| Protección de perfiles bloqueaba al admin en el SQL Editor | Permitido solo a conexiones directas de confianza; el registro sigue forzando `citizen` |

## 4. Pendientes que requieren al responsable

| Pendiente | Por qué | Dónde |
|---|---|---|
| Función heredada `make-server-1c8cef82` (Figma Make) **activa** | Sin código fuente para auditar, no la usa la app, responde a rutas `/admin/*` y se puede llamar con la clave pública | Dashboard → Edge Functions (borrarla es irreversible: requiere confirmación) |
| Fotos de cédulas del sistema anterior (2 cuentas) | Ya no hay finalidad para conservarlas (Ley 1581, principio de finalidad) | Bucket `documentos-identidad` (requiere confirmación) |
| Protección contra contraseñas filtradas y longitud mínima en el servidor | Configuración de Supabase Auth | Authentication → Settings (Password) |
| CAPTCHA en registro (opcional) | Frena bots de registro | Supabase Auth → Bot protection (Cloudflare Turnstile) |
| PostGIS en esquema público / `spatial_ref_sys` | Mover PostGIS rompe la columna `geom`; sin datos de usuarios | Aceptado |
| Validar cédula contra la Registraduría | No existe API pública gratuita; proveedores de pago (KYC) | Evaluar a futuro |


---

# Interventoría v1.4.0 (2026-10-08)

## Hallazgos y correcciones

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | **Crítica** | **XSS almacenado en los mapas**: la descripción de una alerta (escrita por cualquier ciudadano) se insertaba como HTML en los popups de Leaflet del mapa ciudadano y del mapa del operador. Permitía ejecutar código en el celular de los usuarios cercanos y en la sesión del personal (en Android no hay CSP que lo frene). | `src/utils/html.ts` (`escapeHtml`) en todo dato dinámico de los popups. Pruebas unitarias. |
| 2 | **Crítica** | **XSS en el reporte imprimible del administrador** (`printAlertPDF`): la descripción iba sin escapar a una ventana del mismo origen (acceso a la sesión del admin). | Todo texto escapado; sin script en línea; `window.opener` anulado. |
| 3 | Alta | **Inyección de fórmulas en CSV** (auditoría y reportes). | Celdas entre comillas y neutralización de `= + - @`. |
| 4 | Alta | Al crear una alerta, el ciudadano podía fijar campos internos (fecha, operador, marca de falsa, fechas de atención). | Trigger `validar_alerta` (paso 10): los fija el servidor. |
| 5 | Alta | El autor podía quitar la marca de alerta falsa de su alerta abierta. | `proteger_campos_alerta` protege `marcada_falsa`. |
| 6 | Alta | `media_urls` aceptaba cualquier URL externa. | Solo `alertas/<id de la alerta>/…` del bucket propio; máximo 10. |
| 7 | Media | Sin límite de descripción ni validación de coordenadas. | Máx. 1000 caracteres; coordenadas válidas dentro de Colombia. |
| 8 | Alta | **Afirmaciones falsas** en "Acerca de": alianza con la Policía Nacional, ISO 27001, reconocimiento MinTIC, "partner" de la Cruz Roja, línea 01-8000, correo y web inexistentes, "respuesta < 2 min". | Pantalla reescrita solo con hechos verificables. |
| 9 | Alta | **911** en la confirmación de alerta. | Línea 123 y líneas oficiales de Colombia con enlace para llamar. |
| 10 | Alta | La app prometía notificar automáticamente a los contactos de emergencia: **ese envío no existía**. | Texto veraz y función real: avisar por SMS, WhatsApp o llamada con un toque (mensaje + ubicación). |
| 11 | Alta | **La autorización de datos no se guardaba** (sin prueba, Decreto 1377 art. 8). | `aceptar_politica` con versión, fecha y auditoría; se pide a quien no la tenga o tenga una versión anterior. |
| 12 | Alta | Sin canal para los derechos del titular (Ley 1581, arts. 14-15). | "Mis datos y derechos" con plazo legal calculado; panel del admin con vencimientos y supresión completa con constancia. |
| 13 | Media | Política incompleta, correo inventado, citas legales incorrectas y Términos sin documento. | Política y Términos completos (`src/legal/documentos.tsx`). |
| 14 | Media | Fotos de cédulas del escaneo anterior guardadas sin finalidad. | Eliminadas (4 fotos, 2 registros) y funciones retiradas (paso 12). |
| 15 | Media | Función heredada `make-server-1c8cef82` activa, sin código fuente, con rutas `/admin/*`. | Eliminada. |
| 16 | Media | La verificación del código de recuperación respondía 400/401 según existiera la cédula. | Respuesta idéntica. |
| 17 | Baja | La contraseña podía contener la cédula o la fecha de expedición. | Rechazado en el registro. |
| 18 | Baja | Casilla de aceptación no accesible. | `role="checkbox"` y `aria-checked`. |

## Acceso
- Un solo campo: **cédula o correo** + contraseña. Con cédula → `acceso-cedula` (límite de intentos, no revela el correo); con correo → Supabase Auth.
- Recuperación con cédula o correo: con cédula el código llega al correo de la cuenta y la respuesta es igual exista o no.

## Migraciones nuevas (aplicadas en producción)
`20261008000010_interventoria_legal_alertas.sql` · `20261008000011_supresion_titular.sql` · `20261008000012_retiro_escaneo_identidad.sql`


---

# v1.7.0: funciones simuladas reemplazadas por reales
| Antes | Ahora |
|---|---|
| "Enviar mensaje al ciudadano" solo mostraba "Mensaje enviado" | `enviar_mensaje_ciudadano` (paso 16): bandeja del ciudadano + push; lo ve en el detalle de su alerta. Auditado; máx. 10 por alerta |
| Unidades inventadas en el código ("Patrulla 12", "Ambulancia 01"…) | El operador registra la unidad real (tipo + identificación + minutos); si la alerta estaba "Recibida" pasa a "En atención" en la BD (antes solo en pantalla) |
| Preferencias del operador (sonido, SLA, intervalo) que no se guardaban ni se usaban | Eliminadas; "Probar notificaciones" real |
| Campana del administrador con punto rojo fijo | Eliminada |
| Listas y diálogos del detalle del incidente ocultos detrás del panel (z-index 9999) | Panel en z-40: listas y confirmaciones visibles |
