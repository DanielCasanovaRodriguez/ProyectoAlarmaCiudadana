import React, { useState } from 'react';
import { Alert } from '../../App';
import { Button } from '../ui/button';
import { EvidenceImage } from '../EvidenceImage';
import { useSignedMediaUrls } from '../../hooks/useSignedMediaUrls';
import {
  ArrowLeft, AlertTriangle, Car, Shield, Flame, Users,
  Clock, MapPin, Image as ImageIcon, Video, Mic,
  ChevronRight,
} from 'lucide-react';

// ================================================================
// TIPOS
// ================================================================

interface AlertHistoryScreenProps {
  alerts:        Alert[];
  onBack:        () => void;
  onSelectAlert: (alertId: string) => void; // ← NUEVO: navegar al detalle
}

// ================================================================
// CONFIGURACIÓN
// ================================================================

const alertConfig: Record<string, {
  icon:  React.ElementType;
  color: string;
  label: string;
}> = {
  medical:  { icon: AlertTriangle, color: 'text-red-500',    label: 'Emergencia Médica' },
  robbery:  { icon: Shield,        color: 'text-orange-500', label: 'Robo / Asalto'     },
  accident: { icon: Car,           color: 'text-yellow-500', label: 'Accidente'          },
  fire:     { icon: Flame,         color: 'text-red-600',    label: 'Incendio'           },
  violence: { icon: Users,         color: 'text-purple-500', label: 'Violencia'          },
};
const defaultConfig = { icon: AlertTriangle, color: 'text-gray-500', label: 'Alerta' };

type FilterType = 'all' | 'open' | 'ack' | 'resolved';

// ================================================================
// HELPERS
// ================================================================

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|heic)/i.test(url);
}

function getMediaIcon(url: string): React.ElementType {
  if (isImage(url))                            return ImageIcon;
  if (/\.(mp4|webm|mov|avi)/i.test(url))       return Video;
  return Mic;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'open':        'Activa',
    'ack': 'En atención',
    'resolved':    'Resuelta',
    'discarded':   'Cancelada',
  };
  return labels[status] ?? 'Desconocido';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'open':        'bg-red-100 text-red-700',
    'ack': 'bg-yellow-100 text-yellow-700',
    'resolved':    'bg-green-100 text-green-700',
    'discarded':   'bg-gray-100 text-gray-500',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-700';
}

function formatTimeAgo(timestamp: Date): string {
  const minutes = Math.floor((Date.now() - timestamp.getTime()) / 60000);
  if (minutes < 1)  return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

// ================================================================
// COMPONENTE
// ================================================================

export function AlertHistoryScreen({ alerts, onBack, onSelectAlert }: AlertHistoryScreenProps) {
  // Miniaturas: se firman en un solo lote las 3 primeras evidencias de cada alerta
  const thumbUrls   = alerts.flatMap(a => (a.mediaUrls ?? []).slice(0, 3));
  const signedThumbs = useSignedMediaUrls(thumbUrls);
  const signedOf = (url: string) => signedThumbs[thumbUrls.indexOf(url)] ?? '';
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return (alert.status ?? 'open') === filter;
  });

  const tabs: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all',          label: 'Todas',       count: alerts.length },
    { key: 'open',         label: 'Activas',     count: alerts.filter(a => (a.status ?? 'open') === 'open').length },
    { key: 'ack', label: 'En atención', count: alerts.filter(a => a.status === 'ack').length },
    { key: 'resolved',     label: 'Resueltas',   count: alerts.filter(a => a.status === 'resolved').length },
  ];

  return (
    <div className="h-full bg-white flex flex-col">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">Mis Alertas</h1>
        </div>
      </div>

      {/* ── Tabs de filtro ───────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-blue-100 text-blue-600 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  filter === tab.key
                    ? 'bg-blue-200 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Estadísticas resumidas ───────────────────────────────── */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-gray-800">{alerts.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-500">
              {alerts.filter(a => (a.status ?? 'open') === 'open').length}
            </p>
            <p className="text-xs text-gray-500">Activas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-yellow-500">
              {alerts.filter(a => a.status === 'ack').length}
            </p>
            <p className="text-xs text-gray-500">En curso</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-500">
              {alerts.filter(a => a.status === 'resolved').length}
            </p>
            <p className="text-xs text-gray-500">Resueltas</p>
          </div>
        </div>
      </div>

      {/* ── Lista de alertas ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 p-8">
            <AlertTriangle className="w-12 h-12 text-gray-300" />
            <p className="text-sm text-center">
              {filter === 'all'
                ? 'Aún no has enviado ninguna alerta'
                : `No tienes alertas en estado "${getStatusLabel(filter)}"`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAlerts.map(alert => {
              const config   = alertConfig[alert.type] ?? defaultConfig;
              const Icon     = config.icon;
              const status   = alert.status ?? 'open';
              const hasMedia = alert.mediaUrls && alert.mediaUrls.length > 0;

              return (
                /* Tarjeta completa es el botón de navegación */
                <button
                  key={alert.id}
                  onClick={() => onSelectAlert(alert.id)}
                  className="w-full p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex gap-3 items-start">

                    {/* Ícono del tipo */}
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>

                    {/* Contenido central */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {config.label}
                          </h3>
                          {alert.description && (
                            <p className="text-sm text-gray-500 mt-0.5 truncate">
                              {alert.description}
                            </p>
                          )}
                        </div>

                        {/* Badge de estado */}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(status)}`}>
                          {getStatusLabel(status)}
                        </span>
                      </div>

                      {/* Miniaturas de evidencia */}
                      {hasMedia && (
                        <div className="flex gap-1.5 mt-2">
                          {alert.mediaUrls!.slice(0, 3).map((url, i) => {
                            const MediaIcon = getMediaIcon(url);
                            return (
                              <div
                                key={i}
                                className="w-9 h-9 rounded-md overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0"
                              >
                                {isImage(url) ? (
                                  <EvidenceImage src={signedOf(url)} alt={`Evidencia ${i + 1}`} compact />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <MediaIcon className="w-3.5 h-3.5 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {alert.mediaUrls!.length > 3 && (
                            <div className="w-9 h-9 rounded-md bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-gray-600">
                                +{alert.mediaUrls!.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tiempo y coordenadas */}
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(alert.timestamp)}</span>
                        </div>
                        {alert.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {`${alert.location.lat.toFixed(4)}, ${alert.location.lng.toFixed(4)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ícono de flecha — indica que es navegable */}
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-2" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
