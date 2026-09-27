import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Clock, Loader2, AlertTriangle, Phone, Navigation } from 'lucide-react';
import { Button } from '../ui/button';
import { MapView } from '../MapView';
import type { Alert } from '../../App';
import { obtenerAlertaPublica, formatearDistancia, type AlertaPublica } from '../../services/proximityService';
import { getAlertTypeLabel, getAlertTypeColor } from '../../services/alertService';
import { toUserMessage } from '../../utils/errors';

interface NearbyAlertScreenProps {
  alertId: string;
  userLocation: { lat: number; lng: number } | null;
  onVolver: () => void;
  onVerMapa: () => void;
}

const ESTADO: Record<string, { texto: string; clase: string }> = {
  open:     { texto: 'Activa',       clase: 'bg-red-100 text-red-700' },
  ack:      { texto: 'En atención',  clase: 'bg-amber-100 text-amber-800' },
  resolved: { texto: 'Resuelta',     clase: 'bg-green-100 text-green-700' },
};

function haceCuanto(fecha: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : new Date(fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Detalle de una alerta cercana (se abre desde la notificación). */
export function NearbyAlertScreen({ alertId, userLocation, onVolver, onVerMapa }: NearbyAlertScreenProps) {
  const [alerta, setAlerta] = useState<AlertaPublica | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const a = await obtenerAlertaPublica(alertId);
      if (!a) setError('Esta alerta ya no está disponible (fue resuelta hace más de 48 horas o no existe).');
      setAlerta(a);
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo cargar la alerta.'));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, [alertId]);

  const paraMapa: Alert[] = alerta ? [{
    id: alerta.id, type: alerta.type_code as Alert['type'], location: { lat: alerta.lat, lng: alerta.lng },
    timestamp: new Date(alerta.created_at), description: alerta.description ?? undefined, mediaUrls: [], status: alerta.status,
  }] : [];
  const estado = alerta ? ESTADO[alerta.status] ?? ESTADO.open : null;
  const distancia = formatearDistancia(alerta?.distancia_m);

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onVolver} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">Alerta cerca de ti</h1>
      </div>

      {cargando && (
        <div className="flex-1 flex items-center justify-center" aria-live="polite">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" aria-hidden />
        </div>
      )}

      {!cargando && error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500" aria-hidden />
          <p className="text-gray-700" role="alert">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={cargar}>Reintentar</Button>
            <Button onClick={onVerMapa} className="bg-blue-600 hover:bg-blue-700 text-white">Ir al mapa</Button>
          </div>
        </div>
      )}

      {!cargando && alerta && (
        <div className="flex-1 overflow-y-auto">
          <div className="h-64 border-b">
            <MapView alerts={paraMapa} ownActiveAlertIds={alerta.es_propia ? [alerta.id] : []}
              userLocation={userLocation} center={{ lat: alerta.lat, lng: alerta.lng }} />
          </div>

          <div className="px-6 py-5 space-y-5 max-w-md mx-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: getAlertTypeColor(alerta.type_code) }} aria-hidden />
                <h2 className="text-gray-900 text-lg font-semibold">{getAlertTypeLabel(alerta.type_code)}</h2>
              </div>
              {estado && <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${estado.clase}`}>{estado.texto}</span>}
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center gap-3 text-gray-700">
                <Clock className="w-4 h-4 text-gray-400" aria-hidden />
                <dt className="sr-only">Cuándo</dt>
                <dd>Reportada {haceCuanto(alerta.created_at)}</dd>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400" aria-hidden />
                <dt className="sr-only">Dónde</dt>
                <dd>
                  {distancia ? `${distancia.replace(/^a /, 'A ')} de tu última ubicación · ` : ''}
                  <span className="font-mono text-xs">{alerta.lat.toFixed(4)}, {alerta.lng.toFixed(4)}</span>
                </dd>
              </div>
            </dl>

            {alerta.description && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Descripción</p>
                <p className="text-sm text-gray-800">{alerta.description}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              Mantente alejado de la zona y sigue las indicaciones de las autoridades. Si ves algo o necesitas ayuda, llama a la Línea 123.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a href={`https://www.google.com/maps/search/?api=1&query=${alerta.lat},${alerta.lng}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-800">
                <Navigation className="w-4 h-4" aria-hidden /> Abrir en mapas
              </a>
              <a href="tel:123" className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 py-2.5 text-sm font-semibold text-white">
                <Phone className="w-4 h-4" aria-hidden /> Llamar al 123
              </a>
            </div>
            <Button onClick={onVerMapa} variant="outline" className="w-full">Ver todas las alertas en el mapa</Button>
          </div>
        </div>
      )}
    </div>
  );
}
