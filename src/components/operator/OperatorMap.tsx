import React, { useEffect, useRef } from 'react';
import type { Incident } from './types';
import { STATUS_LABELS, SEVERITY_COLORS } from './types';

declare global { interface Window { L: any; } }

interface OperatorMapProps {
  incidents:        Incident[];
  selectedId?:      string;
  onSelectIncident: (incident: Incident) => void;
}

// ================================================================
// HELPERS
// ================================================================

function buildPinHtml(color: string, isSelected: boolean): string {
  const size    = isSelected ? 34 : 26;
  const border  = isSelected ? '3px solid #1d4ed8' : '3px solid white';
  const shadow  = isSelected
    ? '0 0 0 3px rgba(29,78,216,0.4), 0 3px 12px rgba(0,0,0,0.4)'
    : '0 2px 10px rgba(0,0,0,0.35)';

  return `
    <div style="position:relative;">
      <div style="
        width:${size}px; height:${size}px;
        background:${color};
        border:${border};
        border-radius:50%;
        box-shadow:${shadow};
        cursor:pointer;
        position:relative; z-index:2;
        transition: all .15s;
      "></div>
      <div style="
        position:absolute; top:-6px; left:-6px;
        width:${size + 12}px; height:${size + 12}px;
        background:${color}35;
        border-radius:50%;
        animation:pulse 2.2s infinite;
        pointer-events:none;
      "></div>
    </div>`;
}

function buildPopupHtml(incident: Incident): string {
  const statusLabel = STATUS_LABELS[incident.status] ?? incident.status;
  const mapsUrl     = `https://www.google.com/maps?q=${incident.lat},${incident.lng}`;

  return `
    <div style="padding:8px 4px; min-width:180px; font-family:sans-serif;">
      <p style="font-weight:700; font-size:13px; color:#111; margin:0 0 4px;">
        ${incident.typeLabel}
      </p>
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
        <span style="
          background:${SEVERITY_COLORS[incident.severity]}22;
          color:${SEVERITY_COLORS[incident.severity]};
          border:1px solid ${SEVERITY_COLORS[incident.severity]}66;
          border-radius:4px; padding:1px 6px; font-size:11px; font-weight:600;
        ">${incident.severity}</span>
        <span style="font-size:11px; color:#555;">${statusLabel}</span>
      </div>
      <p style="font-size:11px; color:#888; margin:0 0 2px;">${incident.time}</p>
      <p style="font-size:11px; color:#888; margin:0 0 6px;">${incident.source}</p>
      ${incident.description && incident.description !== 'Sin descripción'
        ? `<p style="font-size:11px; color:#444; margin:0 0 6px; max-width:200px; word-break:break-word;">${incident.description}</p>`
        : ''}
      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
         style="font-size:11px; color:#2563eb; text-decoration:none;">
        📍 Ver en Google Maps
      </a>
    </div>`;
}

// ================================================================
// COMPONENTE
// ================================================================
const KENNEDY_CENTER: [number, number] = [4.6173, -74.0703];

export function OperatorMap({ incidents, selectedId, onSelectIncident }: OperatorMapProps) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef     = useRef<Map<string, any>>(new Map());

  // ── Inicializar mapa ──────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('leaflet-css-op')) {
      const link = document.createElement('link');
      link.id          = 'leaflet-css-op';
      link.rel         = 'stylesheet';
      link.href        = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity   = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    if (!document.getElementById('op-map-styles')) {
      const style = document.createElement('style');
      style.id = 'op-map-styles';
      style.innerHTML = `
        @keyframes pulse {
          0%   { transform: scale(1);   opacity:.6; }
          50%  { transform: scale(1.5); opacity:.25; }
          100% { transform: scale(1);   opacity:.6; }
        }
        .op-leaflet-container { font-family: inherit; }
      `;
      document.head.appendChild(style);
    }

    function init() {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = window.L;

      const map = L.map(mapRef.current, {
        center:             KENNEDY_CENTER,
        zoom:               14,
        zoomControl:        true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    if (!window.L) {
      const script = document.createElement('script');
      script.src         = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity   = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload      = init;
      document.head.appendChild(script);
    } else {
      init();
    }

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
    };
  }, []);

  // ── Sincronizar marcadores cuando cambian incidents o selectedId ─
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L   = window.L;
    const map = mapInstanceRef.current;

    // IDs de los incidentes actuales
    const currentIds = new Set(incidents.map(i => i.id));

    // Eliminar marcadores de incidentes que ya no existen
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    incidents.forEach(incident => {
      const { lat, lng } = incident;
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

      const color      = SEVERITY_COLORS[incident.severity] ?? '#6B7280';
      const isSelected = selectedId === incident.id;
      const existing   = markersRef.current.get(incident.id);

      if (existing) {
        // Actualizar ícono si cambió selección
        existing.setIcon(L.divIcon({
          className:  'op-incident-marker',
          html:       buildPinHtml(color, isSelected),
          iconSize:   [40, 40],
          iconAnchor: [20, 20],
        }));
        return;
      }

      // Crear marcador nuevo
      const icon = L.divIcon({
        className:  'op-incident-marker',
        html:       buildPinHtml(color, isSelected),
        iconSize:   [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(buildPopupHtml(incident), { maxWidth: 260 })
        .on('click', () => {
          onSelectIncident(incident);
          marker.openPopup();
        });

      markersRef.current.set(incident.id, marker);
    });

    // Si hay un incidente seleccionado, centrar el mapa en él
    if (selectedId) {
      const sel = incidents.find(i => i.id === selectedId);
      if (sel) {
        map.setView([sel.lat, sel.lng], Math.max(map.getZoom(), 15), { animate: true });
      }
    } else if (incidents.length > 0 && !mapInstanceRef.current._hasCentered) {
      // Primera carga con datos: ajustar bounds
      const bounds = L.latLngBounds(incidents.map(i => [i.lat, i.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      mapInstanceRef.current._hasCentered = true;
    }
  }, [incidents, selectedId]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm"
      style={{ height: 520, isolation: 'isolate', zIndex: 0 }}
    >
      <div ref={mapRef} className="w-full h-full" />

      {/* Leyenda */}
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-3 z-[1000]">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Severidad</p>
        {(['ALTA', 'MEDIA', 'BAJA'] as const).map(sev => (
          <div key={sev} className="flex items-center gap-2 mb-1 last:mb-0">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: SEVERITY_COLORS[sev] }}
            />
            <span className="text-xs text-gray-700">{sev === 'ALTA' ? 'Alta' : sev === 'MEDIA' ? 'Media' : 'Baja'}</span>
          </div>
        ))}
      </div>

      {/* Chip de conteo */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-full shadow-md border border-gray-200 px-3 py-1.5 z-[1000]">
        <p className="text-xs text-gray-700">
          <span className="font-bold text-gray-900">{incidents.length}</span>{' '}
          incidente{incidents.length !== 1 ? 's' : ''} activo{incidents.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
