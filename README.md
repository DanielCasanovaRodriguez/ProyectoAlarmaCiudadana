# Alerta Ciudadana

Sistema de alertas ciudadanas con **dos clientes sobre una misma plataforma**:

- **Web** — React + Vite
- **Android** — el mismo código empaquetado con Capacitor (proyecto en `android/`, se abre con Android Studio)
- **Backend y base de datos compartidos** — Supabase (Auth, PostgreSQL con RLS, Storage, Realtime, Edge Functions)

## Inicio rápido

```bash
npm install
```
```bash
npm run dev
```
Web en `http://localhost:3000`. Requiere un `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

Android:
```bash
npm run android:sync
```
```bash
npm run android:open
```

## Documentación

| Documento | Contenido |
|---|---|
| [docs/01-DIAGNOSTICO.md](docs/01-DIAGNOSTICO.md) | Auditoría inicial y hallazgos |
| [docs/02-INSTALACION-Y-EJECUCION.md](docs/02-INSTALACION-Y-EJECUCION.md) | Arquitectura, instalación, ejecución web/Android, emulador, teléfono, API |
| [docs/03-NOTIFICACIONES.md](docs/03-NOTIFICACIONES.md) | Activar push con Firebase |
| [docs/04-PRUEBAS.md](docs/04-PRUEBAS.md) | Pruebas realizadas y checklist de integración |
| [docs/05-INFORME-FINAL.md](docs/05-INFORME-FINAL.md) | Informe final, pendientes y recomendaciones |

Diseño original en Figma: https://www.figma.com/design/Ibena6hNkfXGb9PNZ2jUqE/Alarma-Ciudadana-M%C3%B3vil
