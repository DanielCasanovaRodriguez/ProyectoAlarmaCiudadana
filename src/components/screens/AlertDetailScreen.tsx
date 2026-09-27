import React, { useState, useEffect, useCallback } from 'react';
import { toUserMessage } from '../../utils/errors';
import {
  ArrowLeft, AlertTriangle, Car, Shield, Flame, Users,
  Clock, MapPin, Image as ImageIcon, Video, Mic,
  Truck, CheckCircle2, XCircle, Loader2, RefreshCw,
  Phone, ChevronRight, AlertCircle, Info,
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import {
  getAlertById,
  getAlertStatusHistory,
  getAlertAssignedUnit,
  cancelAlert,
  Alert as DBAlert,
  AlertStatusHistoryEntry,
  AsignacionUnidad,
} from '../../services/alertService';
import { EvidenceImage } from '../EvidenceImage';
import { useSignedMediaUrls } from '../../hooks/useSignedMediaUrls';
import { Alert as AppAlert } from '../../App';

// ================================================================
// CONFIGURACIÓN DE TIPOS DE ALERTA
// ================================================================

const alertConfig: Record<string, {
  icon:    React.ElementType;
  color:   string;
  bgColor: string;
  label:   string;
}> = {
  medical:  { icon: AlertTriangle, color: 'text-red-500',    bgColor: 'bg-red-50',    label: 'Emergencia Médica' },
  robbery:  { icon: Shield,        color: 'text-orange-500', bgColor: 'bg-orange-50', label: 'Robo / Asalto'     },
  accident: { icon: Car,           color: 'text-yellow-600', bgColor: 'bg-yellow-50', label: 'Accidente'         },
  fire:     { icon: Flame,         color: 'text-red-600',    bgColor: 'bg-red-50',    label: 'Incendio'          },
  violence: { icon: Users,         color: 'text-purple-500', bgColor: 'bg-purple-50', label: 'Violencia'         },
};
const defaultConfig = { icon: AlertTriangle, color: 'text-gray-500', bgColor: 'bg-gray-50', label: 'Alerta' };

// ================================================================
// CONFIGURACIÓN DE ESTADOS
// ================================================================

const statusConfig: Record<string, {
  label:      string;
  color:      string;
  bgColor:    string;
  dotColor:   string;
  timelineColor: string;
}> = {
  'open':      { label: 'Activa',      color: 'text-red-700',    bgColor: 'bg-red-100',    dotColor: 'bg-red-500',    timelineColor: 'bg-red-500'    },
  'ack':{ label: 'En atención', color: 'text-yellow-700', bgColor: 'bg-yellow-100', dotColor: 'bg-yellow-500', timelineColor: 'bg-yellow-500' },
  'resolved':  { label: 'Resuelta',    color: 'text-green-700',  bgColor: 'bg-green-100',  dotColor: 'bg-green-500',  timelineColor: 'bg-green-500'  },
  'discarded': { label: 'Cancelada',   color: 'text-gray-600',   bgColor: 'bg-gray-100',   dotColor: 'bg-gray-400',   timelineColor: 'bg-gray-400'   },
};
const defaultStatus = { label: 'Desconocido', color: 'text-gray-600', bgColor: 'bg-gray-100', dotColor: 'bg-gray-400', timelineColor: 'bg-gray-400' };

// ================================================================
// HELPERS
// ================================================================

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|heic)/i.test(url);
}

function getMediaIcon(url: string): React.ElementType {
  if (isImage(url))                      return ImageIcon;
  if (/\.(mp4|webm|mov|avi)/i.test(url)) return Video;
  return Mic;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString('es-CO', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function formatTimeAgo(isoString: string): string {
  const minutes = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (minutes < 1)  return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

function getStatusHistoryLabel(newStatus: string, note: string | null): string {
  const labels: Record<string, string> = {
    'open':       'Alerta registrada en el sistema',
    'ack':'Un operador tomó el caso',
    'resolved':   'Caso resuelto por el equipo de atención',
    'discarded':  note ?? 'Alerta cancelada',
  };
  return labels[newStatus] ?? `Estado actualizado a: ${newStatus}`;
}

function getUnitTypeIcon(tipo: string | null): string {
  const tipo_lower = (tipo ?? '').toLowerCase();
  if (tipo_lower.includes('ambul'))  return '🚑';
  if (tipo_lower.includes('bomber')) return '🚒';
  if (tipo_lower.includes('polic'))  return '🚔';
  return '🚨';
}

// ================================================================
// PROPS
// ================================================================

interface AlertDetailScreenProps {
  alertId:       string;
  localAlert:    AppAlert | null; // copia local del estado de App para mostrar rápido
  onBack:        () => void;
  onCancelAlert: (alertId: string) => Promise<void>;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export function AlertDetailScreen({
  alertId,
  localAlert,
  onBack,
  onCancelAlert,
}: AlertDetailScreenProps) {
  const [alert,       setAlert]       = useState<DBAlert | null>(null);
  const [history,     setHistory]     = useState<AlertStatusHistoryEntry[]>([]);
  const [unit,        setUnit]        = useState<AsignacionUnidad | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [cancelling,  setCancelling]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // ── Carga de datos desde Supabase ─────────────────────────────
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);

    try {
      const [alertData, historyData, unitData] = await Promise.all([
        getAlertById(alertId),
        getAlertStatusHistory(alertId),
        getAlertAssignedUnit(alertId),
      ]);

      if (!alertData) {
        setError('No se pudo cargar la alerta. Puede que haya sido eliminada.');
        return;
      }

      setAlert(alertData);
      setHistory(historyData);
      setUnit(unitData);
    } catch (err: any) {
      setError(toUserMessage(err, 'Error al cargar los datos.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [alertId]);

  // Carga inicial
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Polling cada 20s para actualizar estado en tiempo real
  useEffect(() => {
    const interval = setInterval(() => fetchAll(true), 20_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Cancelar alerta ──────────────────────────────────────────
  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await onCancelAlert(alertId);
      setShowConfirm(false);
      // La pantalla se cierra desde App.tsx después de cancelar
    } catch (err: any) {
      toast.error('No se pudo cancelar', { description: toUserMessage(err) });
      setCancelling(false);
      setShowConfirm(false);
    }
  };

  // ── Estado derivado ──────────────────────────────────────────
  // Usa los datos frescos de BD; si aún no cargaron, usa la copia local
  const displayStatus  = alert?.status ?? localAlert?.status ?? 'open';
  const displayType    = alert?.type_code ?? localAlert?.type ?? 'medical';
  const displayDesc    = alert?.description ?? localAlert?.description ?? null;
  const displayMedia   = alert?.media_urls ?? localAlert?.mediaUrls ?? [];
  const signedMedia    = useSignedMediaUrls(displayMedia);
  const displayLat     = alert?.lat ?? localAlert?.location?.lat;
  const displayLng     = alert?.lng ?? localAlert?.location?.lng;
  const displayCreated = alert?.created_at ?? localAlert?.timestamp?.toISOString() ?? '';

  const config    = alertConfig[displayType] ?? defaultConfig;
  const StatusCfg = statusConfig[displayStatus] ?? defaultStatus;
  const Icon      = config.icon;

  const canCancel = displayStatus === 'open' && !cancelling;

  // ================================================================
  // PANTALLA DE ERROR
  // ================================================================
  if (!loading && error && !alert) {
    return (
      <div className="h-full bg-white flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">Detalle de alerta</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-center text-gray-600 text-sm">{error}</p>
          <Button variant="outline" onClick={() => fetchAll()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // ================================================================
  // PANTALLA DE CARGA INICIAL
  // ================================================================
  if (loading && !localAlert) {
    return (
      <div className="h-full bg-white flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">Detalle de alerta</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Cargando información...</p>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // MODAL DE CONFIRMACIÓN DE CANCELACIÓN
  // ================================================================
  if (showConfirm) {
    return (
      <div className="h-full bg-white flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
          ¿Cancelar esta alerta?
        </h2>
        <p className="text-sm text-gray-500 text-center mb-2 leading-relaxed">
          Esta acción es irreversible. La alerta quedará marcada como cancelada y
          los operadores serán notificados.
        </p>
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-8 w-full max-w-sm">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            Si la emergencia sigue activa, <strong>no canceles</strong> la alerta.
            Solo cancela si fue un error o la situación se resolvió por cuenta propia.
          </p>
        </div>
        <div className="space-y-3 w-full max-w-sm">
          <Button
            onClick={handleConfirmCancel}
            disabled={cancelling}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            size="lg"
          >
            {cancelling ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelando...</>
            ) : (
              'Sí, cancelar alerta'
            )}
          </Button>
          <Button
            onClick={() => setShowConfirm(false)}
            variant="outline"
            className="w-full"
            size="lg"
            disabled={cancelling}
          >
            Volver al detalle
          </Button>
        </div>
      </div>
    );
  }

  // ================================================================
  // PANTALLA PRINCIPAL DE DETALLE
  // ================================================================
  return (
    <div className="h-full bg-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">Detalle de alerta</h1>
          </div>
          {/* Botón de recarga manual */}
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Contenido desplazable ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Bloque 1: Tipo + Estado ─────────────────────────── */}
        <div className={`${config.bgColor} px-4 py-5`}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Icon className={`w-7 h-7 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900">{config.label}</h2>
              {displayDesc && (
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{displayDesc}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <div className={`w-2 h-2 rounded-full ${StatusCfg.dotColor} ${displayStatus === 'open' ? 'animate-pulse' : ''}`} />
                <span className={`text-sm font-semibold ${StatusCfg.color}`}>
                  {StatusCfg.label}
                </span>
                {refreshing && (
                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin ml-1" />
                )}
              </div>
            </div>
          </div>

          {/* Datos de tiempo y ubicación */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">Enviada</span>
              </div>
              <p className="text-xs font-medium text-gray-800">
                {displayCreated ? formatTimeAgo(displayCreated) : '—'}
              </p>
              {displayCreated && (
                <p className="text-xs text-gray-500">{formatTime(displayCreated)}</p>
              )}
            </div>
            <div className="bg-white/70 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">Coordenadas</span>
              </div>
              {displayLat && displayLng ? (
                <>
                  <p className="text-xs font-medium text-gray-800">
                    {displayLat.toFixed(5)}
                  </p>
                  <p className="text-xs text-gray-500">{displayLng.toFixed(5)}</p>
                </>
              ) : (
                <p className="text-xs text-gray-500">No disponible</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Bloque 2: Unidad asignada ────────────────────────── */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Unidad de atención
          </h3>

          {unit ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getUnitTypeIcon(unit.tipo_unidad)}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{unit.nombre_unidad}</p>
                  {unit.tipo_unidad && (
                    <p className="text-xs text-gray-500">{unit.tipo_unidad}</p>
                  )}
                  {unit.eta_minutos != null && unit.eta_minutos > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span className="text-xs text-blue-600 font-medium">
                        ETA: {unit.eta_minutos} min
                      </span>
                    </div>
                  )}
                </div>
                {displayStatus === 'ack' && (
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Truck className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Sin asignación por el momento</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {displayStatus === 'open'
                    ? 'Los operadores han sido notificados y asignarán una unidad pronto.'
                    : displayStatus === 'resolved'
                      ? 'El caso fue resuelto.'
                      : 'No se asignó unidad para esta alerta.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Bloque 3: Línea de tiempo de estados ─────────────── */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Historial de seguimiento
          </h3>

          {history.length === 0 ? (
            /* Si no hay historial en BD, mostramos al menos el estado inicial */
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
              </div>
              <div className="flex-1 pb-2">
                <p className="text-sm font-medium text-gray-800">Alerta registrada en el sistema</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {displayCreated ? formatTime(displayCreated) : '—'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {history.map((entry, idx) => {
                const sCfg = statusConfig[entry.new_status] ?? defaultStatus;
                const isLast = idx === history.length - 1;
                return (
                  <div key={entry.id} className="flex items-start gap-3">
                    {/* Dot + línea vertical */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full ${sCfg.timelineColor} z-10`} />
                      {!isLast && (
                        <div className="w-0.5 bg-gray-200 flex-1 mt-1 mb-1" style={{ minHeight: '24px' }} />
                      )}
                    </div>
                    {/* Contenido */}
                    <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
                      <p className="text-sm font-medium text-gray-800">
                        {getStatusHistoryLabel(entry.new_status, entry.note)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sCfg.bgColor} ${sCfg.color} font-medium`}>
                          {sCfg.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(entry.changed_at)}
                        </span>
                      </div>
                      {entry.note && entry.new_status !== 'discarded' && (
                        <p className="text-xs text-gray-500 mt-1 italic">"{entry.note}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bloque 4: Evidencia adjunta ─────────────────────── */}
        {displayMedia.length > 0 && (
          <div className="px-4 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Evidencia adjunta ({displayMedia.length} archivo{displayMedia.length > 1 ? 's' : ''})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {displayMedia.map((url, idx) => {
                const MediaIcon = getMediaIcon(url);
                return (
                  <div
                    key={idx}
                    className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200"
                  >
                    {isImage(url) ? (
                      <EvidenceImage src={signedMedia[idx]} alt={`Evidencia ${idx + 1}`} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <MediaIcon className="w-6 h-6 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {MediaIcon === Video ? 'Video' : 'Audio'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Bloque 5: ID de la alerta ────────────────────────── */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">ID de la alerta</span>
            <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded">
              {alertId.slice(0, 8).toUpperCase()}…
            </span>
          </div>
        </div>

        {/* ── Spacer para los botones fijos ───────────────────── */}
        <div className="h-48" />
      </div>

      {/* ── Barra de acciones fija en la parte inferior ─────────── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 pt-4 pb-8 space-y-3">

        {/* Cancelar alerta — solo si está activa */}
        {canCancel && (
          <Button
            onClick={() => setShowConfirm(true)}
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50"
            size="lg"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar esta alerta
          </Button>
        )}

        {/* Alerta ya cerrada */}
        {displayStatus === 'resolved' && (
          <div className="flex items-center justify-center gap-2 py-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-green-700">Caso resuelto correctamente</span>
          </div>
        )}

        {/* Llamar al 123 */}
        <a href="tel:123">
          <Button
            variant="outline"
            className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
            size="lg"
          >
            <Phone className="w-4 h-4 mr-2" />
            Llamar al 123 (Policía)
          </Button>
        </a>

        {/* Volver */}
        <Button
          onClick={onBack}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white"
          size="lg"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al historial
        </Button>
      </div>
    </div>
  );
}
