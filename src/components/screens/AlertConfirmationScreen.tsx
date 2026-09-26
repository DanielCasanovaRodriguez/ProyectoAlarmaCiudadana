import React from 'react';
import { Alert } from '../../App';
import { Button } from '../ui/button';
import { EvidenceImage } from '../EvidenceImage';
import { useSignedMediaUrls } from '../../hooks/useSignedMediaUrls';
import {
  CheckCircle, MapPin, Clock,
  AlertTriangle, Car, Shield, Flame, Users,
  Image as ImageIcon, Video, Mic, Paperclip,
} from 'lucide-react';

interface AlertConfirmationScreenProps {
  alert:         Alert;
  onBackToMap:   () => void;
  onViewHistory: () => void;
}

const alertConfig: Record<string, {
  icon:    React.ElementType;
  color:   string;
  label:   string;
  bgColor: string;
}> = {
  medical:  { icon: AlertTriangle, color: 'text-red-500',    label: 'Emergencia Médica', bgColor: 'bg-red-50'    },
  robbery:  { icon: Shield,        color: 'text-orange-500', label: 'Robo / Asalto',     bgColor: 'bg-orange-50' },
  accident: { icon: Car,           color: 'text-yellow-600', label: 'Accidente',          bgColor: 'bg-yellow-50' },
  fire:     { icon: Flame,         color: 'text-red-600',    label: 'Incendio',           bgColor: 'bg-red-50'    },
  violence: { icon: Users,         color: 'text-purple-500', label: 'Violencia',          bgColor: 'bg-purple-50' },
};

const defaultConfig = { icon: AlertTriangle, color: 'text-gray-500', label: 'Alerta', bgColor: 'bg-gray-50' };

// Determina si una URL es imagen, video o audio
function getMediaIconComponent(url: string): React.ElementType {
  if (/\.(jpg|jpeg|png|webp|heic)/i.test(url)) return ImageIcon;
  if (/\.(mp4|webm|mov|avi)/i.test(url))        return Video;
  return Mic;
}

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|heic)/i.test(url);
}

export function AlertConfirmationScreen({
  alert,
  onBackToMap,
  onViewHistory,
}: AlertConfirmationScreenProps) {
  const config = alertConfig[alert.type] ?? defaultConfig;
  const Icon   = config.icon;
  const hasMedia = alert.mediaUrls && alert.mediaUrls.length > 0;
  const signedMedia = useSignedMediaUrls(alert.mediaUrls);

  return (
    <div className="h-full bg-white flex flex-col items-center justify-center p-6 overflow-y-auto">

      {/* Animación de éxito */}
      <div className="relative mb-6 flex-shrink-0">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <div className="absolute -inset-4 bg-green-100 rounded-full opacity-30 animate-ping" />
      </div>

      {/* Título */}
      <h1 className="text-2xl font-bold text-center mb-2 text-gray-900">
        ¡Alerta Enviada!
      </h1>
      <p className="text-gray-500 text-center mb-6 max-w-sm text-sm leading-relaxed">
        Tu reporte fue enviado exitosamente a la comunidad y autoridades locales.
      </p>

      {/* Detalle de la alerta */}
      <div className={`w-full max-w-sm ${config.bgColor} rounded-xl p-4 mb-4`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{config.label}</h3>
            {alert.description && (
              <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Ahora mismo</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>
                  {alert.location
                    ? `${alert.location.lat.toFixed(4)}, ${alert.location.lng.toFixed(4)}`
                    : 'Tu ubicación'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Evidencia adjunta — se muestra solo si hay archivos */}
      {hasMedia && (
        <div className="w-full max-w-sm mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Paperclip className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-medium text-gray-700">
              Evidencia adjunta ({alert.mediaUrls!.length} archivo{alert.mediaUrls!.length > 1 ? 's' : ''})
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {alert.mediaUrls!.map((url, index) => {
              const MediaIcon = getMediaIconComponent(url);
              return (
                <div
                  key={index}
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200"
                >
                  {isImage(url) ? (
                    <EvidenceImage src={signedMedia[index]} alt={`Evidencia ${index + 1}`} />
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

      {/* Estado */}
      <div className="bg-blue-50 rounded-xl p-4 mb-6 w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-blue-700">Estado: Activa</span>
        </div>
        <p className="text-xs text-blue-600 text-center">
          Las autoridades y usuarios cercanos han sido notificados
        </p>
      </div>

      {/* Próximos pasos */}
      <div className="w-full max-w-sm mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Próximos pasos:</h3>
        <div className="space-y-1.5 text-sm text-gray-500">
          {[
            'Mantente en un lugar seguro',
            'Sigue las instrucciones de las autoridades',
            'Puedes actualizar el estado cuando sea seguro',
          ].map(step => (
            <div key={step} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Botones */}
      <div className="space-y-3 w-full max-w-sm">
        <Button
          onClick={onBackToMap}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          Volver al Mapa
        </Button>
        <Button
          onClick={onViewHistory}
          variant="outline"
          className="w-full"
          size="lg"
        >
          Ver Historial
        </Button>
      </div>

      {/* Llamar al 911 */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400 mb-2">¿Necesitas ayuda inmediata?</p>
        <a href="tel:911">
          <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
            Llamar 911
          </Button>
        </a>
      </div>
    </div>
  );
}
