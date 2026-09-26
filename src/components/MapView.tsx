import L from 'leaflet';
import React, { useEffect, useRef, useMemo } from 'react';
import { Alert } from '../App';

// ================================================================
// PROPS
// ================================================================

interface MapViewProps {
  alerts:            Alert[];          // todas las alertas activas del área
  ownActiveAlertIds: string[];         // IDs de las alertas propias del usuario
  userLocation:      { lat: number; lng: number } | null;
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

// Bogotá como centro de referencia neutral
const BOGOTA_CENTER: [number, number] = [4.7110, -74.0721];

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
      <strong style="color:${color};font-size:13px;">${label}</strong>
      ${description
        ? `<p style="margin:6px 0 0;font-size:12px;color:#555;">${description}</p>`
        : ''}
      <p style="margin:4px 0 0;font-size:11px;color:#888;">${timeText}</p>
    </div>`;
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

export function MapView({ alerts, ownActiveAlertIds, userLocation }: MapViewProps) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef     = useRef<any[]>([]);
  const userMarkerRef  = useRef<any>(null);

  // Clave estable para el dep array: se recalcula solo cuando cambia la lista de IDs propios
  const ownIdsKey = useMemo(() => ownActiveAlertIds.join(','), [ownActiveAlertIds]);

  // ── Inicializar mapa una sola vez ────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('map-marker-styles')) {
      const style = document.createElement('style');
      style.id = 'map-marker-styles';
      style.innerHTML = `
        @keyframes pulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          50%  { transform: scale(1.5); opacity: 0.3; }
          100% { transform: scale(1);   opacity: 0.6; }
        }
        .leaflet-container { font-family: inherit; }
      `;
      document.head.appendChild(style);
    }

    function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;

      const center = userLocation
        ? [userLocation.lat, userLocation.lng] as [number, number]
        : BOGOTA_CENTER;

      const map = L.map(mapRef.current, {
        center,
        zoom:               15,
        zoomControl:        true,
        attributionControl: true,
      });

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

    map.setView([userLocation.lat, userLocation.lng], 15);
  }, [userLocation]);

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
          buildPopupHtml(label, color, alert.description, timeAgo, isOwn)
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

      {/* Chip de estado superior — centrado */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-gray-200">
        <div className="px-4 py-2 flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${
            userLocation ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <p className="text-sm text-gray-800 whitespace-nowrap">
            {userLocation ? 'Tu ubicación actual' : 'Ubicación no disponible'}
          </p>
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex-shrink-0">
              {alerts.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
