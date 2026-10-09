import L from 'leaflet';
import { escapeHtml } from '../utils/html';
import React, { useEffect, useRef, useMemo } from 'react';
import { Alert } from '../App';

// ================================================================
// PROPS
// ================================================================

export interface AreaVisible { sur: number; oeste: number; norte: number; este: number }

interface MapViewProps {
  alerts:            Alert[];          // alertas a mostrar (cercanas o de la zona explorada)
  ownActiveAlertIds: string[];         // IDs de las alertas propias del usuario
  userLocation:      { lat: number; lng: number } | null;
  /** Centra el mapa en este punto (p. ej. una alerta) en lugar de en el usuario. */
  center?:           { lat: number; lng: number } | null;
  /** Radio de cercanía a dibujar alrededor del usuario (m). */
  radioM?:           number;
  /** El área visible cambió (porUsuario = la persona arrastró o hizo zoom). */
  onAreaCambiada?: (area: AreaVisible, centro: { lat: number; lng: number }, porUsuario: boolean) => void;
  /** Cambiar este número vuelve a centrar el mapa en el usuario y su radio. */
  recentrar?:        number;
}


// ================================================================
// CONFIGURACIÓN DE TIPOS
// ================================================================

const alertLabels: Record<string, string> = {
  medical:  'Emergencia Médica',
  robbery:  'Robo / Asalto',
  accident: 'Accidente',
  fire:     'Incendio',
  violence: 'Violencia',
};

const alertColors: Record<string, string> = {
  medical:  '#EF4444',
  robbery:  '#F97316',
  accident: '#EAB308',
  fire:     '#DC2626',
  violence: '#A855F7',
};

// Sin ubicación: vista de Colombia completa (no una ciudad en particular)
const COLOMBIA_CENTER: [number, number] = [4.5709, -74.2973];
const COLOMBIA_ZOOM = 5;

// ================================================================
// HELPERS
// ================================================================

function buildUserMarkerHtml(): string {
  return `
    <div style="position:relative;">
      <div style="
        width:16px;height:16px;
        background:#3B82F6;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        position:relative;z-index:2;
      "></div>
      <div style="
        position:absolute;top:-8px;left:-8px;
        width:32px;height:32px;
        background:rgba(59,130,246,0.25);
        border-radius:50%;
        animation:pulse 2s infinite;
      "></div>
    </div>`;
}

function buildAlertMarkerHtml(color: string, isOwn: boolean): string {
  // Las alertas propias del usuario tienen un anillo dorado exterior
  const ring = isOwn
    ? `<div style="
        position:absolute;top:-5px;left:-5px;
        width:36px;height:36px;
        border:2px solid #F59E0B;
        border-radius:50%;
        z-index:1;
      "></div>`
    : '';

  return `
    <div style="position:relative;">
      ${ring}
      <div style="
        width:26px;height:26px;
        background:${color};
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 10px rgba(0,0,0,0.4);
        cursor:pointer;
        position:relative;z-index:2;
      "></div>
      <div style="
        position:absolute;top:-6px;left:-6px;
        width:38px;height:38px;
        background:${color}40;
        border-radius:50%;
        animation:pulse 2s infinite;
      "></div>
    </div>`;
}

function buildPopupHtml(
  label:       string,
  color:       string,
  description: string | undefined,
  timeText:    string,
  isOwn:       boolean
): string {
  const badge = isOwn
    ? `<span style="
        display:inline-block;
        background:#FEF3C7;color:#92400E;
        font-size:10px;font-weight:600;
        padding:2px 6px;border-radius:4px;margin-bottom:4px;
      ">Tu alerta</span><br/>`
    : '';

  return `
    <div style="padding:8px;min-width:160px;">
      ${badge}
      <strong style="color:${color};font-size:13px;">${escapeHtml(label)}</strong>
      ${description
        ? `<p style="margin:6px 0 0;font-size:12px;color:#555;">${escapeHtml(description)}</p>`
        : ''}
      <p style="margin:4px 0 0;font-size:11px;color:#888;">${escapeHtml(timeText)}</p>
    </div>`;
}

function formatDistance(m: number | null | undefined): string {
  if (m == null) return '';
  return m < 1000 ? ` · a ${Math.max(10, Math.round(m / 10) * 10)} m` : ` · a ${(Math.floor(m / 100) / 10).toFixed(1).replace('.', ',')} km`;
}

function formatTimeAgo(timestamp: Date): string {
  const minutes = Math.floor((Date.now() - timestamp.getTime()) / 60000);
  if (minutes < 1)  return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  return `Hace ${Math.floor(minutes / 60)}h`;
}

// ================================================================
// COMPONENTE
// ================================================================

export function MapView({
  alerts, ownActiveAlertIds, userLocation, center: centroFijo, radioM, onAreaCambiada, recentrar,
}: MapViewProps) {
  const centradoEnUsuarioRef = useRef(false);
  const circuloRef     = useRef<any>(null);
  // Los movimientos que hace el código (centrar, encuadrar) no cuentan como exploración
  const automaticoRef  = useRef(false);
  const onAreaRef      = useRef(onAreaCambiada);
  onAreaRef.current    = onAreaCambiada;
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef     = useRef<any[]>([]);
  const userMarkerRef  = useRef<any>(null);

  // Clave estable para el dep array: se recalcula solo cuando cambia la lista de IDs propios
  const ownIdsKey = useMemo(() => ownActiveAlertIds.join(','), [ownActiveAlertIds]);

  // ── Inicializar mapa una sola vez ────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('map-marker-styles-v2')) {
      const style = document.createElement('style');
      style.id = 'map-marker-styles-v2';
      style.innerHTML = `
        @keyframes pulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          50%  { transform: scale(1.5); opacity: 0.3; }
          100% { transform: scale(1);   opacity: 0.6; }
        }
        .leaflet-container { font-family: inherit; }
        /* Zoom debajo del botón de menú de la pantalla del mapa */
        .leaflet-top.leaflet-right { margin-top: 64px; }
      `;
      document.head.appendChild(style);
    }

    function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;

      const center = centroFijo
        ? [centroFijo.lat, centroFijo.lng] as [number, number]
        : userLocation
        ? [userLocation.lat, userLocation.lng] as [number, number]
        : COLOMBIA_CENTER;

      const map = L.map(mapRef.current, {
        center,
        zoom:               centroFijo || userLocation ? 15 : COLOMBIA_ZOOM,
        zoomControl:        false,
        attributionControl: true,
      });
      L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);

      const informarArea = () => {
        const porUsuario = !automaticoRef.current;
        automaticoRef.current = false;
        const b = map.getBounds();
        const c = map.getCenter();
        onAreaRef.current?.(
          { sur: b.getSouth(), oeste: b.getWest(), norte: b.getNorth(), este: b.getEast() },
          { lat: c.lat, lng: c.lng },
          porUsuario,
        );
      };
      map.on('moveend', informarArea);
      // Área inicial (las alertas de lo que se ve, aunque no estén "cerca")
      setTimeout(informarArea, 0);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      if (userLocation) {
        placeUserMarker(map, L, userLocation);
      }
    }

    function placeUserMarker(map: any, L: any, coords: { lat: number; lng: number }) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      const icon = L.divIcon({
        className: 'custom-user-marker',
        html:      buildUserMarkerHtml(),
        iconSize:   [16, 16],
        iconAnchor: [8, 8],
      });

      userMarkerRef.current = L.marker([coords.lat, coords.lng], { icon })
        .addTo(map)
        .bindPopup('<strong>Tu ubicación</strong>');
    }

    initMap();

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, []);

  // ── Mover/crear marcador del usuario cuando cambia su ubicación ──
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return;

    const map = mapInstanceRef.current;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const icon = L.divIcon({
      className: 'custom-user-marker',
      html:      buildUserMarkerHtml(),
      iconSize:   [16, 16],
      iconAnchor: [8, 8],
    });

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon })
      .addTo(map)
      .bindPopup('<strong>Tu ubicación</strong>');

    // Círculo del radio de cercanía (lo que se considera "cerca de ti")
    if (radioM) {
      if (circuloRef.current) {
        circuloRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        circuloRef.current = L.circle([userLocation.lat, userLocation.lng], {
          radius: radioM, color: '#2563EB', weight: 1.5, opacity: 0.6,
          fillColor: '#3B82F6', fillOpacity: 0.06, interactive: false,
        }).addTo(map);
      }
    }

    // Centrar en el usuario solo la primera vez: con la ubicación en vivo no se
    // debe mover el mapa mientras la persona lo recorre.
    if (!centroFijo && !centradoEnUsuarioRef.current) {
      encuadrarUsuario();
    }
    centradoEnUsuarioRef.current = true;
  }, [userLocation]);

  function encuadrarUsuario() {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;
    automaticoRef.current = true;
    // Si el mapa ya estaba ahí no hay 'moveend': se libera la marca igual
    setTimeout(() => { automaticoRef.current = false; }, 1200);
    if (circuloRef.current) {
      map.fitBounds(circuloRef.current.getBounds(), { paddingTopLeft: [16, 64], paddingBottomRight: [16, 24], animate: true });
    } else {
      map.setView([userLocation.lat, userLocation.lng], 15);
    }
  }

  // ── Volver a "mi ubicación" a pedido ─────────────────────────────
  useEffect(() => {
    if (recentrar) encuadrarUsuario();
  }, [recentrar]);

  // ── Actualizar marcadores de alertas del área ────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Set para búsqueda O(1) — creado dentro del efecto para capturar el valor actual
    const ownIdsSet = new Set(ownActiveAlertIds);

    // Limpiar marcadores anteriores
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    alerts.forEach(alert => {
      const lat = alert.location?.lat;
      const lng = alert.location?.lng;

      // ✅ Fix: usar != null en lugar de !lat/!lng para no filtrar
      // coordenadas válidas como lat=0 o lng=0
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

      const color   = alertColors[alert.type] ?? '#6B7280';
      const label   = alertLabels[alert.type]  ?? alert.type;
      const isOwn   = ownIdsSet.has(alert.id);
      const timeAgo = formatTimeAgo(alert.timestamp);

      const alertIcon = L.divIcon({
        className: 'custom-alert-marker',
        html:      buildAlertMarkerHtml(color, isOwn),
        iconSize:   [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([lat, lng], { icon: alertIcon })
        .addTo(map)
        .bindPopup(
          buildPopupHtml(label, color, alert.description, timeAgo + formatDistance(alert.distanciaM), isOwn)
        );

      markersRef.current.push(marker);
    });
  }, [alerts, ownIdsKey]);

  // ── Renderizado ──────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative">

      {/* Contenedor Leaflet */}
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ zIndex: 0 }}
      />

    </div>
  );
}
