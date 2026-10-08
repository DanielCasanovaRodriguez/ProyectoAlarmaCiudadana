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
