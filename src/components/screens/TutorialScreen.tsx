import React, { useState } from 'react';
import { Button } from '../ui/button';
import { ArrowLeft, ArrowRight, MapPin, AlertCircle, History, Menu } from 'lucide-react';

interface TutorialScreenProps {
  onComplete: () => void;
}

const tutorialSteps = [
  {
    title: 'Navegando el Mapa',
    description: 'En la pantalla principal verás un mapa con tu ubicación y las alertas cercanas. Cada marcador representa una alerta activa en tu área.',
    icon: MapPin,
    highlight: 'map',
    image: '🗺️'
  },
  {
    title: 'Crear una Alerta',
    description: 'Presiona el botón rojo de ALARMA en la parte inferior para reportar una emergencia. Selecciona el tipo y agrega una descripción.',
    icon: AlertCircle,
    highlight: 'alarm-button',
    image: '🚨'
  },
  {
    title: 'Acceder al Menú',
    description: 'Toca el botón de menú en la esquina superior derecha para acceder a tu historial, perfil y configuraciones.',
    icon: Menu,
    highlight: 'menu',
    image: '⚙️'
  },
  {
    title: 'Ver tu Historial',
    description: 'Desde el menú puedes revisar todas las alertas que has reportado y su estado actual.',
    icon: History,
    highlight: 'history',
    image: '📋'
  }
];

export function TutorialScreen({ onComplete }: TutorialScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const step = tutorialSteps[currentStep];
  const Icon = step.icon;

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={prevStep}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-lg">Tutorial</h1>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onComplete}
            className="text-gray-500"
          >
            Saltar
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            Paso {currentStep + 1} de {tutorialSteps.length}
          </span>
          <span className="text-sm text-blue-600">
            {Math.round(((currentStep + 1) / tutorialSteps.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {/* Illustration */}
        <div className="w-48 h-48 bg-blue-50 rounded-2xl flex items-center justify-center mb-8">
          <div className="text-6xl">{step.image}</div>
        </div>

        {/* Icon */}
        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-6">
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Text content */}
        <h2 className="text-xl mb-4 text-gray-900">
          {step.title}
        </h2>
        
        <p className="text-gray-600 max-w-sm leading-relaxed mb-8">
          {step.description}
        </p>

        {/* Tips */}
        <div className="bg-blue-50 rounded-lg p-4 max-w-sm mb-8">
          <div className="text-sm text-blue-800">
            {currentStep === 0 && (
              <>
                <strong>Tip:</strong> Los marcadores de diferentes colores representan distintos tipos de alertas.
              </>
            )}
            {currentStep === 1 && (
              <>
                <strong>Importante:</strong> Solo reporta emergencias reales para mantener la confianza de la comunidad.
              </>
            )}
            {currentStep === 2 && (
              <>
                <strong>Tip:</strong> También puedes personalizar tus notificaciones desde el perfil.
              </>
            )}
            {currentStep === 3 && (
              <>
                <strong>Nota:</strong> Tu historial te ayuda a mantener un registro de tu actividad en la app.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6">
        <Button 
          onClick={nextStep}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          {currentStep < tutorialSteps.length - 1 ? (
            <>
              Siguiente
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          ) : (
            'Completar Tutorial'
          )}
        </Button>
        
        {currentStep === tutorialSteps.length - 1 && (
          <p className="text-xs text-gray-500 text-center mt-3">
            ¡Ya estás listo para usar AlertaCiudadana!
          </p>
        )}
      </div>
    </div>
  );
}