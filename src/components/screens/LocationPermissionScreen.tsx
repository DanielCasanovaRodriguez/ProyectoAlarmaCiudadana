import React, { useState } from 'react';
import { Button } from '../ui/button';
import { MapPin, Shield, AlertTriangle, Navigation, Settings, X } from 'lucide-react';

interface LocationPermissionScreenProps {
  onLocationGranted: (coords: { lat: number; lng: number }) => void;
  onLocationDenied:  (fallbackCoords?: { lat: number; lng: number }) => void;
}

type Step = 'request' | 'denied' | 'manual';

// Zonas de Kennedy para selección manual
const ZONAS_KENNEDY = [
  { label: 'Kennedy Central',    lat: 4.6280, lng: -74.1477 },
  { label: 'Patio Bonito',       lat: 4.6089, lng: -74.1650 },
  { label: 'Castilla',           lat: 4.6450, lng: -74.1200 },
  { label: 'Américas',           lat: 4.6380, lng: -74.1050 },
  { label: 'Tintal',             lat: 4.6150, lng: -74.1750 },
  { label: 'Corabastos',         lat: 4.6320, lng: -74.1380 },
];

export function LocationPermissionScreen({
  onLocationGranted,
  onLocationDenied,
}: LocationPermissionScreenProps) {
  const [step, setStep]         = useState<Step>('request');
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  // Pedir ubicación real al navegador
  const handleRequestPermission = () => {
    setLoading(true);

    if (!navigator.geolocation) {
      setLoading(false);
      setStep('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onLocationGranted({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setLoading(false);
        console.warn('Permiso denegado o error:', err.message);
        setStep('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Ir a configuración del dispositivo
  const handleOpenSettings = () => {
    alert(
      'Para activar la ubicación:\n\n' +
      '• Chrome: haz clic en el candado 🔒 en la barra de direcciones → Ubicación → Permitir\n' +
      '• Firefox: haz clic en el candado 🔒 → Más información → Permisos → Ubicación\n' +
      '• Edge: haz clic en el candado 🔒 → Permisos para este sitio → Ubicación\n\n' +
      'Luego recarga la página e intenta de nuevo.'
    );
  };

  // Confirmar zona seleccionada manualmente
  const handleConfirmManual = () => {
    if (selected === null) return;
    const zona = ZONAS_KENNEDY[selected];
    onLocationDenied({ lat: zona.lat, lng: zona.lng });
  };

  // Continuar sin ubicación
  const handleSkip = () => {
    onLocationDenied(undefined);
  };

  // ─── PANTALLA 1: Solicitar permiso ───────────────────────────────
  if (step === 'request') {
    return (
      <div className="h-full bg-white flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-8">
          <MapPin className="w-12 h-12 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-center mb-3 text-gray-900">
          Acceso a Ubicación
        </h1>

        <p className="text-gray-500 text-center max-w-sm mb-2 leading-relaxed text-sm">
          Esta app necesita tu ubicación para enviar alertas con coordenadas precisas.
          <strong className="text-gray-700"> Sin ubicación, la respuesta puede tardar más.</strong>
        </p>

        {/* Beneficios */}
        <div className="space-y-3 mb-10 w-full max-w-sm mt-6">
          {[
            { icon: Navigation,     color: 'text-blue-500',   title: 'Coordenadas exactas',   desc: 'Las autoridades llegan directo al lugar' },
            { icon: Shield,         color: 'text-green-500',  title: 'Alertas en tu área',    desc: 'Ves incidentes cercanos a tu posición' },
            { icon: AlertTriangle,  color: 'text-orange-500', title: 'Respuesta más rápida',  desc: 'Reduce el tiempo de atención a emergencias' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
              <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} />
              <div>
                <p className="text-sm font-medium text-gray-800">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 w-full max-w-sm">
          <Button
            onClick={handleRequestPermission}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Solicitando permiso...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Permitir Ubicación
              </span>
            )}
          </Button>

          <button
            onClick={handleSkip}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
          >
            Continuar sin ubicación
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center max-w-xs">
          Tu ubicación solo se usa al crear una alerta y no se comparte con terceros (Ley 1581/2012).
        </p>
      </div>
    );
  }

  // ─── PANTALLA 2: Permiso denegado — opciones alternativas ────────
  if (step === 'denied') {
    return (
      <div className="h-full bg-white flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-orange-500" />
        </div>

        <h1 className="text-xl font-bold text-center mb-2 text-gray-900">
          Ubicación no disponible
        </h1>
        <p className="text-gray-500 text-center text-sm max-w-sm mb-8 leading-relaxed">
          Sin ubicación precisa, las alertas serán más difíciles de atender.
          Elige una opción para continuar:
        </p>

        {/* Opción 1: Activar en configuración */}
        <button
          onClick={handleOpenSettings}
          className="w-full max-w-sm bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3 text-left hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Activar en configuración</p>
              <p className="text-xs text-gray-500">Te mostramos cómo habilitarla en tu navegador</p>
            </div>
          </div>
        </button>

        {/* Opción 2: Seleccionar zona de Kennedy */}
        <button
          onClick={() => setStep('manual')}
          className="w-full max-w-sm bg-green-50 border border-green-200 rounded-2xl p-4 mb-3 text-left hover:bg-green-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Seleccionar mi zona</p>
              <p className="text-xs text-gray-500">Indica en qué sector de Kennedy estás</p>
            </div>
          </div>
        </button>

        {/* Opción 3: Continuar sin ubicación */}
        <button
          onClick={handleSkip}
          className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <X className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Continuar sin ubicación</p>
              <p className="text-xs text-gray-400">Las alertas no tendrán coordenadas precisas</p>
            </div>
          </div>
        </button>
      </div>
    );
  }

  // ─── PANTALLA 3: Selección manual de zona ────────────────────────
  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <button
          onClick={() => setStep('denied')}
          className="text-blue-600 text-sm mb-4 flex items-center gap-1"
        >
          ← Volver
        </button>
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          ¿En qué zona estás?
        </h1>
        <p className="text-sm text-gray-500">
          Selecciona el sector de Kennedy más cercano a tu ubicación actual.
        </p>
      </div>

      {/* Lista de zonas */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <div className="space-y-2">
          {ZONAS_KENNEDY.map((zona, i) => (
            <button
              key={zona.label}
              onClick={() => setSelected(i)}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${
                selected === i
                  ? 'bg-blue-50 border-blue-400 shadow-sm'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selected === i ? 'bg-blue-500' : 'bg-gray-200'
                }`}>
                  <MapPin className={`w-4 h-4 ${selected === i ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <span className={`text-sm font-medium ${
                  selected === i ? 'text-blue-700' : 'text-gray-700'
                }`}>
                  {zona.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Botón confirmar */}
      <div className="px-6 pb-8 pt-2 border-t border-gray-100">
        <Button
          onClick={handleConfirmManual}
          disabled={selected === null}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 disabled:opacity-40"
        >
          Confirmar zona seleccionada
        </Button>
        <button
          onClick={handleSkip}
          className="w-full text-sm text-gray-400 hover:text-gray-600 mt-3 py-1 transition-colors"
        >
          Continuar sin zona
        </button>
      </div>
    </div>
  );
}