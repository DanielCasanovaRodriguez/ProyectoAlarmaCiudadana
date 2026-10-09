import { useEffect, useRef, useState } from 'react';
import { MapView, type AreaVisible } from '../MapView';
import { AlarmButton } from '../AlarmButton';
import { AlarmSheet } from '../AlarmSheet';
import { Alert } from '../../App';
import {
  Menu, History, User, HelpCircle, AlertTriangle, LocateFixed, Search, Loader2, X,
  ChevronUp, MapPinOff, WifiOff, Navigation,
} from 'lucide-react';
import { getAlertasEnArea, getAlertTypeLabel, getAlertTypeColor, RADIO_CERCANIA_M } from '../../services/alertService';
import { formatearDistancia, distanciaM } from '../../services/proximityService';
import { useOnlineStatus } from '../../platform/network';
import { toUserMessage } from '../../utils/errors';

// ================================================================
// TIPOS
// ================================================================

interface MainMapScreenProps {
  alerts:              Alert[];       // alertas propias (para el contador personal)
  areaAlerts:          Alert[];       // alertas activas a ≤ 1 km de la ubicación real
  ownActiveAlertIds:   string[];      // IDs propios activos (para distinción visual)
  userLocation:        { lat: number; lng: number } | null;
  onCreateAlert:       (type: Alert['type'], description: string, files: File[]) => Promise<void>;
  onNavigateToHistory: () => void;
  onNavigateToProfile: () => void;
  onNavigateToTutorial:() => void;
  /** Abre el detalle de una alerta (pantalla de alerta cercana). */
  onVerAlerta?:        (alertId: string) => void;
  /** Pide de nuevo el permiso de ubicación. */
  onActivarUbicacion?: () => void;
  bloqueoReporte?:     { mensaje: string; onVerificar?: () => void } | null;
}

const KM = RADIO_CERCANIA_M / 1000;

function haceCuanto(fecha: Date): string {
  const min = Math.floor((Date.now() - fecha.getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
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
  onVerAlerta,
  onActivarUbicacion,
  bloqueoReporte,
}: MainMapScreenProps) {
  const [isAlarmSheetOpen, setIsAlarmSheetOpen] = useState(false);
  const [isMenuOpen,       setIsMenuOpen]       = useState(false);
  const [listaAbierta,     setListaAbierta]     = useState(false);
  // El mapa muestra TODAS las alertas vigentes del área visible (cualquier
  // ciudad a la que la persona se desplace). El contador y la lista solo
  // cuentan las que están a ≤ 1 km de su ubicación real.
  const [areaVisible, setAreaVisible] = useState<AreaVisible | null>(null);
  const [centroMapa,  setCentroMapa]  = useState<{ lat: number; lng: number } | null>(null);
  const [delArea,     setDelArea]     = useState<Alert[]>([]);
  const [cargandoArea, setCargandoArea] = useState(false);
  const [areaMuyGrande, setAreaMuyGrande] = useState(false);
  const [recentrar,   setRecentrar]   = useState(0);
  const online = useOnlineStatus();

  const ownActiveAlerts = alerts.filter(a => a.status === 'open' || a.status === 'ack');
  const explorando = !!centroMapa && (!userLocation || distanciaM(userLocation, centroMapa) > RADIO_CERCANIA_M * 1.5);

  const handleCreateAlert = async (type: Alert['type'], description: string, files: File[]) => {
    setIsAlarmSheetOpen(false);
    await onCreateAlert(type, description, files);
  };

  const alCambiarArea = (area: AreaVisible, centro: { lat: number; lng: number }) => {
    setAreaVisible(area);
    setCentroMapa(centro);
  };

  // Carga del área visible: al moverse (con espera breve) y cada 20 s
  const ubicacionRef = useRef(userLocation);
  ubicacionRef.current = userLocation;
  useEffect(() => {
    if (!areaVisible) return;
    if (areaVisible.norte - areaVisible.sur > 2 || areaVisible.este - areaVisible.oeste > 2) {
      setAreaMuyGrande(true);
      setDelArea([]);
      return;
    }
    setAreaMuyGrande(false);
    let cancelado = false;
    const cargar = async () => {
      setCargandoArea(true);
      try {
        const filas = await getAlertasEnArea(areaVisible);
        if (cancelado) return;
        const yo = ubicacionRef.current;
        setDelArea(filas.map(f => ({
          id: f.id, type: f.type_code as Alert['type'], location: { lat: f.lat, lng: f.lng },
          timestamp: new Date(f.created_at), description: f.description ?? undefined,
          mediaUrls: f.media_urls, status: f.status,
          distanciaM: yo ? distanciaM(yo, { lat: f.lat, lng: f.lng }) : null,
        })));
      } catch (err) {
        if (!cancelado) console.warn('Alertas del área:', toUserMessage(err));
      } finally {
        if (!cancelado) setCargandoArea(false);
      }
    };
    const espera = setTimeout(cargar, 350);
    const intervalo = setInterval(cargar, 20_000);
    return () => { cancelado = true; clearTimeout(espera); clearInterval(intervalo); };
  }, [areaVisible]);

  // En el mapa: las cercanas (con distancia exacta del servidor) + las del área
  const enMapa = (() => {
    const porId = new Map<string, Alert>();
    for (const a of delArea) porId.set(a.id, a);
    for (const a of areaAlerts) porId.set(a.id, a);
    return [...porId.values()];
  })();

  const volverAMiUbicacion = () => setRecentrar(n => n + 1);

  // Lista ordenada por distancia (lo más cercano primero)
  const lista = [...areaAlerts].sort((a, b) => (a.distanciaM ?? Infinity) - (b.distanciaM ?? Infinity));

  return (
    <div className="h-full w-full relative bg-gray-100">

      {/* ── Mapa ─────────────────────────────────────────────────── */}
      <MapView
        alerts={enMapa}
        ownActiveAlertIds={ownActiveAlertIds}
        userLocation={userLocation}
        radioM={RADIO_CERCANIA_M}
        onAreaCambiada={alCambiarArea}
        recentrar={recentrar}
      />

      {/* ── Estado (arriba a la izquierda) ───────────────────────── */}
      <div className="absolute top-4 left-4 right-20 z-20 flex flex-col items-start gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-gray-200 px-3.5 py-2 flex items-center gap-2 max-w-full">
          {!userLocation ? (
            <><MapPinOff className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden />
              <span className="text-sm text-gray-800 truncate">Ubicación desactivada</span></>
          ) : explorando ? (
            <><Search className="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden />
              <span className="text-sm text-gray-800 truncate">
                Explorando otra zona{!areaMuyGrande ? ` · ${delArea.length} alerta${delArea.length === 1 ? '' : 's'}` : ''}
              </span>
              {cargandoArea && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin flex-shrink-0" aria-hidden />}</>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" aria-hidden />
              <span className="text-sm text-gray-800 truncate">Alertas a {KM} km de ti</span></>
          )}
        </div>
        {!online && (
          <div className="pointer-events-auto bg-red-600 text-white rounded-full shadow-lg px-3.5 py-1.5 flex items-center gap-2 text-xs font-medium">
            <WifiOff className="w-3.5 h-3.5" aria-hidden /> Sin conexión
          </div>
        )}
      </div>

      {/* ── Mapa muy alejado: se pide acercar ────────────────────── */}
      {areaMuyGrande && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-white text-gray-800 text-sm rounded-full shadow-lg border border-gray-200 px-4 py-2 flex items-center gap-2 whitespace-nowrap">
          <Search className="w-4 h-4 text-blue-600" aria-hidden /> Acerca el mapa para ver las alertas
        </div>
      )}

      {/* ── Menú (arriba a la derecha) ───────────────────────────── */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="absolute top-4 right-4 z-20 w-11 h-11 bg-white/95 backdrop-blur-sm hover:bg-white text-gray-700 shadow-lg rounded-full flex items-center justify-center border border-gray-200"
        aria-label="Abrir menú"
        aria-expanded={isMenuOpen}
      >
        <Menu className="w-5 h-5" />
      </button>

      {isMenuOpen && (
        <>
          <div className="absolute inset-0 z-30 bg-black/10 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute top-16 right-4 z-40 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 w-64 overflow-hidden" role="menu">
            {[
              { icon: History, bg: 'bg-blue-100 text-blue-600', titulo: 'Mis alertas',
                sub: ownActiveAlerts.length > 0 ? `${ownActiveAlerts.length} activa${ownActiveAlerts.length > 1 ? 's' : ''}` : 'Ver tu historial',
                accion: onNavigateToHistory },
              { icon: HelpCircle, bg: 'bg-purple-100 text-purple-600', titulo: 'Tutorial', sub: 'Aprende a usar la app', accion: onNavigateToTutorial },
              { icon: User, bg: 'bg-green-100 text-green-600', titulo: 'Perfil', sub: 'Tus datos, contactos y ajustes', accion: onNavigateToProfile },
            ].map(op => (
              <button
                key={op.titulo}
                role="menuitem"
                onClick={() => { op.accion(); setIsMenuOpen(false); }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${op.bg}`}>
                  <op.icon className="w-5 h-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">{op.titulo}</p>
                  <p className="text-xs text-gray-500 truncate">{op.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Panel inferior ───────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* ── Volver a mi ubicación ────────────────────────────────── */}
        {userLocation && (
          <button
            onClick={volverAMiUbicacion}
            className="absolute -top-14 right-4 w-11 h-11 bg-white text-blue-600 shadow-lg rounded-full flex items-center justify-center border border-gray-200 hover:bg-blue-50"
            aria-label="Volver a mi ubicación"
            title="Volver a mi ubicación"
          >
            <LocateFixed className="w-5 h-5" />
          </button>
        )}


        {!userLocation ? (
          <div className="px-5 pt-4 pb-2 flex items-start gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Navigation className="w-4 h-4 text-amber-700" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 font-medium">Activa tu ubicación</p>
              <p className="text-xs text-gray-500">Así te mostramos las alertas a {KM} km de ti y puedes reportar con tu ubicación real.</p>
            </div>
            {onActivarUbicacion && (
              <button onClick={onActivarUbicacion} className="text-sm font-semibold text-blue-600 px-2 py-1 flex-shrink-0">Activar</button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setListaAbierta(true)}
            className="w-full flex items-center justify-between px-5 pt-4 pb-2 text-left"
            aria-label="Ver lista de alertas"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 leading-none mb-0.5">
                  Alertas activas a {KM} km de ti
                </p>
                <p className="text-xl font-bold text-gray-900 leading-none">{areaAlerts.length}</p>
              </div>
            </div>
            {areaAlerts.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">Ver lista <ChevronUp className="w-4 h-4" aria-hidden /></span>
            )}
          </button>
        )}

        {explorando && (
          <div className="px-5 pb-1">
            <button onClick={volverAMiUbicacion} className="text-xs text-blue-600 font-medium underline underline-offset-2">
              Volver a las alertas cerca de mí
            </button>
          </div>
        )}

        <div className="flex items-center justify-center pb-6 pt-2">
          <AlarmButton onClick={() => setIsAlarmSheetOpen(true)} />
        </div>
      </div>

      {/* ── Lista de alertas (hoja inferior) ─────────────────────── */}
      {listaAbierta && (
        <>
          <div className="absolute inset-0 z-40 bg-black/30" onClick={() => setListaAbierta(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[70%] flex flex-col"
            role="dialog" aria-label="Alertas" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b">
              <div>
                <p className="text-base font-semibold text-gray-900">
                  Alertas a {KM} km de ti
                </p>
                <p className="text-xs text-gray-500">{lista.length} activa{lista.length === 1 ? '' : 's'} · las más cercanas primero</p>
              </div>
              <button onClick={() => setListaAbierta(false)} className="p-2 rounded-full hover:bg-gray-100" aria-label="Cerrar lista">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-100">
              {lista.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8 px-6">
                  No hay alertas activas a {KM} km de ti. Si algo pasa, usa el botón rojo.
                </p>
              )}
              {lista.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setListaAbierta(false); onVerAlerta?.(a.id); }}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getAlertTypeColor(a.type) }} aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-900 font-medium truncate">
                      {getAlertTypeLabel(a.type)}{ownActiveAlertIds.includes(a.id) ? ' · tu alerta' : ''}
                    </span>
                    <span className="block text-xs text-gray-500 truncate">
                      {[formatearDistancia(a.distanciaM), haceCuanto(a.timestamp), a.status === 'ack' ? 'en atención' : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Modal de alarma ─────────────────────────────────────── */}
      <AlarmSheet
        isOpen={isAlarmSheetOpen}
        onClose={() => setIsAlarmSheetOpen(false)}
        onCreateAlert={handleCreateAlert}
        bloqueo={bloqueoReporte}
      />
    </div>
  );
}
