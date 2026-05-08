import React, { useState } from 'react';
import { MapView } from '../MapView';
import { AlarmButton } from '../AlarmButton';
import { AlarmSheet } from '../AlarmSheet';
import { Alert } from '../../App';
import { Menu, History, User, HelpCircle, AlertTriangle } from 'lucide-react';

// ================================================================
// TIPOS
// ================================================================

interface MainMapScreenProps {
  alerts:              Alert[];       // alertas propias (para contador personal)
  areaAlerts:          Alert[];       // alertas activas del área (para el mapa)
  ownActiveAlertIds:   string[];      // IDs propios activos (para distinción visual)
  userLocation:        { lat: number; lng: number } | null;
  onCreateAlert:       (type: Alert['type'], description: string, files: File[]) => Promise<void>;
  onNavigateToHistory: () => void;
  onNavigateToProfile: () => void;
  onNavigateToTutorial:() => void;
}

// ================================================================
// COMPONENTE
// ================================================================

export function MainMapScreen({
  alerts,
  areaAlerts,
  ownActiveAlertIds,
  userLocation,
  onCreateAlert,
  onNavigateToHistory,
  onNavigateToProfile,
  onNavigateToTutorial,
}: MainMapScreenProps) {
  const [isAlarmSheetOpen, setIsAlarmSheetOpen] = useState(false);
  const [isMenuOpen,       setIsMenuOpen]       = useState(false);

  // Alertas propias del usuario activas (open o ack)
  const ownActiveAlerts = alerts.filter(
    a => a.status === 'open' || a.status === 'ack'
  );

  const handleCreateAlert = async (
    type:        Alert['type'],
    description: string,
    files:       File[]
  ) => {
    setIsAlarmSheetOpen(false);
    await onCreateAlert(type, description, files);
  };

  return (
    <div className="h-full w-full relative bg-gray-100">

      {/* ── Mapa — ocupa toda la pantalla ───────────────────────── */}
      <MapView
        alerts={areaAlerts}
        ownActiveAlertIds={ownActiveAlertIds}
        userLocation={userLocation}
      />

      {/* ── Botón de menú (arriba derecha) ──────────────────────── */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="absolute top-4 right-4 z-20 w-11 h-11 bg-white/95 backdrop-blur-sm hover:bg-white text-gray-700 shadow-lg rounded-full flex items-center justify-center border border-gray-200 transition-all hover:shadow-xl group"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
      </button>

      {/* ── Menú desplegable ────────────────────────────────────── */}
      {isMenuOpen && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/10 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute top-16 right-4 z-40 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 w-64 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">Opciones</p>
            </div>

            <button
              onClick={() => { onNavigateToHistory(); setIsMenuOpen(false); }}
              className="w-full px-4 py-3.5 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <History className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">Mis Alertas</p>
                <p className="text-xs text-gray-500 truncate">
                  {ownActiveAlerts.length > 0
                    ? `${ownActiveAlerts.length} alerta${ownActiveAlerts.length > 1 ? 's' : ''} activa${ownActiveAlerts.length > 1 ? 's' : ''}`
                    : 'Ver tu historial'}
                </p>
              </div>
              {ownActiveAlerts.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                  {ownActiveAlerts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { onNavigateToTutorial(); setIsMenuOpen(false); }}
              className="w-full px-4 py-3.5 text-left hover:bg-purple-50 flex items-center gap-3 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <HelpCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-900">Tutorial</p>
                <p className="text-xs text-gray-500">Aprende a usar la app</p>
              </div>
            </button>

            <div className="border-t border-gray-100 my-1" />

            <button
              onClick={() => { onNavigateToProfile(); setIsMenuOpen(false); }}
              className="w-full px-4 py-3.5 text-left hover:bg-green-50 flex items-center gap-3 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-900">Perfil</p>
                <p className="text-xs text-gray-500">Configuración y ajustes</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* ── Panel inferior compacto ──────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-white/98 backdrop-blur-md border-t border-gray-200 shadow-2xl">

        {/* Fila superior: contador de alertas del área */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 leading-none mb-0.5">Alertas activas en el área</p>
              <p className="text-xl font-bold text-gray-900 leading-none">{areaAlerts.length}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-700 font-medium">En línea</span>
          </div>
        </div>

        {/* Botón SOS centrado — sin leyendas laterales */}
        <div className="flex items-center justify-center pb-8 pt-1">
          <AlarmButton
            onClick={() => setIsAlarmSheetOpen(true)}
          />
        </div>
      </div>

      {/* ── Modal de alarma ─────────────────────────────────────── */}
      <AlarmSheet
        isOpen={isAlarmSheetOpen}
        onClose={() => setIsAlarmSheetOpen(false)}
        onCreateAlert={handleCreateAlert}
      />
    </div>
  );
}
