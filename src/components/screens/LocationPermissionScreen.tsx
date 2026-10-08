import { useState } from 'react';
import { Button } from '../ui/button';
import { MapPin, Shield, AlertTriangle, Navigation, Settings, RefreshCw } from 'lucide-react';
import { getCurrentLocation, LocationError, isNative } from '../../platform';

interface LocationPermissionScreenProps {
  onLocationGranted: (coords: { lat: number; lng: number }) => void;
  /** Continuar sin ubicación: se puede explorar el mapa, no hay "cerca de ti". */
  onLocationDenied:  () => void;
}

/**
 * Permiso de ubicación. Solo se usa la ubicación REAL del dispositivo:
 * no hay zonas "elegidas a mano", porque una alerta con una ubicación
 * inventada manda a la ayuda al lugar equivocado.
 */
export function LocationPermissionScreen({ onLocationGranted, onLocationDenied }: LocationPermissionScreenProps) {
  const [step, setStep]       = useState<'request' | 'denied'>('request');
  const [loading, setLoading] = useState(false);
  const [reason, setReason]   = useState('');

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      const coords = await getCurrentLocation({ highAccuracy: true, timeoutMs: 15_000 });
      onLocationGranted({ lat: coords.lat, lng: coords.lng });
    } catch (err) {
      console.warn('Ubicación no disponible:', err);
      setReason(err instanceof LocationError ? err.message : '');
      setStep('denied');
    } finally {
      setLoading(false);
    }
  };

  const pasos = isNative
    ? ['Abre Ajustes del teléfono → Apps → Alerta Ciudadana → Permisos → Ubicación.',
       'Elige "Permitir solo con la app en uso" y activa "Usar ubicación precisa".',
       'Verifica que la ubicación del teléfono esté encendida (panel de ajustes rápidos).']
    : ['Toca el candado 🔒 junto a la dirección de la página.',
       'En "Ubicación", elige "Permitir".',
       'Vuelve aquí y toca "Intentar de nuevo".'];

  if (step === 'request') {
    return (
      <div className="h-full bg-white flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <MapPin className="w-12 h-12 text-blue-600" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-center mb-3 text-gray-900">Activa tu ubicación</h1>
        <p className="text-gray-600 text-center max-w-sm leading-relaxed text-sm">
          La usamos para mostrarte las alertas a 5 km de ti y para que tus reportes lleguen con el lugar exacto.
        </p>

        <div className="space-y-3 my-8 w-full max-w-sm">
          {[
            { icon: Navigation,    color: 'text-blue-500',   title: 'Lugar exacto',      desc: 'Quien atiende llega directo a donde estás' },
            { icon: Shield,        color: 'text-green-500',  title: 'Alertas a 5 km',    desc: 'Solo lo que pasa cerca de ti, en tu ciudad' },
            { icon: AlertTriangle, color: 'text-orange-500', title: 'Avisos cercanos',   desc: 'Te avisamos si ocurre algo a 1 km o menos' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
              <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} aria-hidden />
              <div>
                <p className="text-sm font-medium text-gray-800">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 w-full max-w-sm">
          <Button onClick={handleRequestPermission} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Buscando tu ubicación…
              </span>
            ) : (
              <span className="flex items-center gap-2"><MapPin className="w-4 h-4" aria-hidden /> Permitir ubicación</span>
            )}
          </Button>
          <button onClick={onLocationDenied} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
            Ahora no
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center max-w-xs">
          Solo guardamos tu última ubicación, no tu recorrido. Puedes desactivar los avisos cercanos en tu perfil (Ley 1581 de 2012).
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-5">
        <AlertTriangle className="w-10 h-10 text-orange-500" aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-center mb-2 text-gray-900">No pudimos obtener tu ubicación</h1>
      <p className="text-gray-600 text-center text-sm max-w-sm mb-6 leading-relaxed">
        {reason || 'El permiso está desactivado o el GPS no respondió.'}
      </p>

      <div className="w-full max-w-sm bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
        <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-600" aria-hidden /> Cómo activarla
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
          {pasos.map(p => <li key={p}>{p}</li>)}
        </ol>
      </div>

      <div className="space-y-2 w-full max-w-sm">
        <Button onClick={handleRequestPermission} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {loading ? 'Buscando tu ubicación…' : 'Intentar de nuevo'}
        </Button>
        <button onClick={onLocationDenied} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
          Continuar sin ubicación
        </button>
        <p className="text-xs text-gray-400 text-center">
          Sin ubicación puedes explorar el mapa, pero no verás alertas "cerca de ti" ni podrás reportar.
          En una emergencia llama a la <a href="tel:123" className="text-blue-600 underline">Línea 123</a>.
        </p>
      </div>
    </div>
  );
}
