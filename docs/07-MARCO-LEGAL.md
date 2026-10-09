# Marco legal (Colombia)

Verificado el 2026-10-08. El texto que ve el usuario está en `src/legal/documentos.tsx` (Política de Tratamiento de Datos y Términos y Condiciones) y los números de emergencia en `src/config/colombia.ts`.

| Norma | Qué exige | Cómo se cumple en la app |
|---|---|---|
| Constitución, arts. 15 y 20 | Intimidad y habeas data | Datos mínimos, cifrado de la cédula, RLS por titular |
| Ley 1581 de 2012, art. 9 | Autorización previa, expresa e informada | Casilla en el registro + pantalla de autorización; el silencio no autoriza |
| Decreto 1377 de 2013 (Decreto 1074 de 2015), art. 8 | Prueba de la autorización | `profiles.consentimiento_version/fecha` + auditoría `acepta_politica` |
| Decreto 1377, art. 13 | Contenido mínimo de la política | `POLITICA_DATOS` (datos del Responsable en `src/config/legal.ts`) |
| Ley 1581, art. 8 | Derechos del titular | Perfil → Mis datos y derechos |
| Ley 1581, arts. 14 y 15 | Consultas 10 días hábiles; reclamos 15 días hábiles | `sumar_dias_habiles` y fecha límite por solicitud; aviso de vencidas al admin |
| Ley 1581, art. 16 | Requisito de procedibilidad ante la SIC | Informado en la política |
| Ley 1581, arts. 5-6; Decreto 1377, art. 6 | Datos sensibles: facultativos | Evidencias opcionales; aviso en la política y en la autorización |
| Ley 1581, art. 7; Decreto 1377, art. 12 | Menores | Servicio para titulares de cédula de ciudadanía (mayores de edad) |
| Ley 1581, art. 26; Circular Externa 005 de 2017 SIC | Transferencia internacional a país adecuado | Supabase (EE. UU., us-east-2), Google/Firebase y Vercel (EE. UU.) declarados |
| Ley 1581, art. 4 lit. b (finalidad) | No conservar datos sin finalidad | Fotos de cédulas del escaneo eliminadas |
| Ley 1801 de 2016, art. 35 num. 7 | Uso inadecuado de la línea 123 | Advertencia al reportar y en los Términos |
| Ley 599 de 2000, art. 296 | Falsedad personal | Advertencia en los Términos (suplantación) |
| Ley 1273 de 2009 | Delitos informáticos | Términos: prohibición de acceso no autorizado |
| Ley 527 de 1999 | Validez de mensajes de datos | La aceptación electrónica es válida |

## Líneas de atención
123 (Línea Única de Emergencias), 155 (mujeres víctimas de violencia), 141 (ICBF), 165 (GAULA), 119 (Bomberos), 132 (Cruz Roja), 144 (Defensa Civil). No se usan 911 ni 112 (el 112 de la Policía se unificó en el 123).

## Pendiente del Responsable
El art. 13 del Decreto 1377 exige publicar **dirección, correo y teléfono** del Responsable. Están en `src/config/legal.ts` como pendientes: completarlos y publicar una nueva versión (no requiere nueva autorización si solo se agregan datos de contacto).
