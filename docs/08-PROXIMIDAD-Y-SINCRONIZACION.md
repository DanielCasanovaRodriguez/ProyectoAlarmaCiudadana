# Proximidad real (5 km) y sincronización web ⇄ móvil — v1.5.0

## 1. Por qué la web no mostraba los cambios
| Hecho verificado (2026-10-08) | Consecuencia |
|---|---|
| Vercel despliega **`main`**. Los PR #1–#4 sí se fusionaron. | La web quedó en **v1.2.0**. |
| Todo lo posterior (v1.3.0 → v1.5.0) está en `feature/cedula-formulario-push-seguridad` (**PR #5, abierto, nunca fusionado**). | La web no tiene cédula en el registro, ni acceso con cédula, ni CSP, y aún muestra 911. |
| La BD (migraciones 8–13) y las Edge Functions ya están en producción; el APK publicado es la versión nueva. | **Dos clientes de versiones distintas sobre la misma BD**: la web antigua llama funciones que ya no existen (escaneo) y su registro falla. |

**Corrección:** fusionar el PR #5 en `main`. Web y Android se construyen del **mismo código** (`src/`), así que después del merge ambos clientes son idénticos. No hay ramas pendientes además de esta.

## 2. Arquitectura (una sola fuente de verdad)
```
                ┌──────────────────────────────┐
                │ Supabase Postgres + PostGIS  │  ← única BD
                │ RLS · funciones · triggers   │
                └──────────────┬───────────────┘
            PostgREST / RPC · Auth · Storage · Edge Functions
                ┌──────────────┴───────────────┐
          ┌─────▼──────┐                 ┌─────▼──────┐
          │  WEB       │   mismo src/    │  ANDROID   │
          │  (Vercel)  │ ◄─────────────► │ (Capacitor)│
          └────────────┘                 └────────────┘
```
Ningún cliente guarda datos propios: alertas, perfiles, cédulas, solicitudes y ubicaciones viven solo en la BD.

## 3. Proximidad
**Causa del error "24 alertas cerca de mí" estando en otra ciudad:** `alertas_activas_publicas()` devolvía todas las alertas activas del país y la app mostraba ese total como "en el área". Además, sin GPS la app ofrecía "zonas de Kennedy" (Bogotá) como ubicación ficticia.

**Regla nueva (servidor, migración 13):**
```
ubicación real (GPS) → alertas_cercanas(lat, lng) → ST_DWithin(geography, 5000 m) → ordenadas por distancia
```
- Distancia geodésica exacta con PostGIS sobre `geography` e índice GiST (`alerts_geom_idx`); sin PostGIS (pruebas) bounding box + Haversine.
- El radio nunca supera 5 km aunque el cliente pida más. 4,95 km → sí; 5,05 km → no (pruebas automáticas).
- La ciudad no se compara como texto: el radio real ya garantiza que solo aparezca lo de la zona (desde Medellín: 0 alertas de Bogotá, verificado en producción).
- Aplica a: mapa inicial, contador, lista y avisos dentro de la app. Las notificaciones push siguen a ≤ 1 km.
- La función anterior `alertas_activas_publicas()` (la usa la web vieja hasta el merge) ahora también filtra a 5 km de la última ubicación del ciudadano.

**Exploración manual:** si la persona arrastra o acerca el mapa lejos de su zona aparece **"Buscar alertas en esta zona"** → `alertas_en_area(recuadro visible)` (máx. ≈ 55 km por lado, 300 resultados). "Volver a mi ubicación" regresa al modo 5 km.

**Sin ubicación:** no se inventa una. El mapa muestra Colombia completa, se puede explorar y la app explica cómo activar el GPS. Para reportar se pide la ubicación real.

## 4. Experiencia de uso
- Estado siempre visible: "Alertas a 5 km de ti" / "Explorando otra zona" / "Ubicación desactivada"; "Sin conexión" real (antes "En línea" fijo).
- Círculo de 5 km en el mapa; lista de alertas por distancia ("a 300 m · hace 10 min") con acceso al detalle.
- Distancias truncadas (4 950 m → 4,9 km) para que nunca parezca fuera del radio.
- Permiso de ubicación sin ventanas emergentes: pasos para activarlo en la misma pantalla.
