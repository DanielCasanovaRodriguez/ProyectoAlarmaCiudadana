import React from 'react';
import { Button } from '../ui/button';
import { MapPin, Bell, Users, ArrowLeft, ArrowRight } from 'lucide-react';

interface OnboardingScreenProps {
  step: number;
  onNext: () => void;
  onBack: () => void;
}

const onboardingSteps = [
  {
    icon: MapPin,
    title: 'Mapa Interactivo',
    description: 'Visualiza alertas en tiempo real en tu área y mantente informado sobre lo que sucede a tu alrededor.',
    image: '🗺️'
  },
  {
    icon: Bell,
    title: 'Alertas Rápidas',
    description: 'Reporta emergencias con un solo toque. Tu alerta llegará inmediatamente a otros usuarios cercanos.',
    image: '🚨'
  },
  {
    icon: Users,
    title: 'Comunidad Unida',
    description: 'Trabaja junto a tu comunidad para crear un entorno más seguro para todos.',
    image: '👥'
  }
];

export function OnboardingScreen({ step, onNext, onBack }: OnboardingScreenProps) {
  const currentStep = onboardingSteps[step];
  const Icon = currentStep.icon;

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          className="p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex gap-2">
          {onboardingSteps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === step ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            // Skip to the end
            for (let i = step; i < 2; i++) {
              onNext();
            }
          }}
          className="text-gray-500"
        >
          Saltar
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {/* Illustration */}
        <div className="w-64 h-64 bg-blue-50 rounded-full flex items-center justify-center mb-8">
          <div className="text-8xl">{currentStep.image}</div>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-white" />
        </div>

        {/* Text content */}
        <h2 className="text-2xl mb-4 text-gray-900">
          {currentStep.title}
        </h2>
        
        <p className="text-gray-600 max-w-sm leading-relaxed">
          {currentStep.description}
        </p>
      </div>

      {/* Footer */}
      <div className="p-6">
        <Button 
          onClick={onNext}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          {step < 2 ? (
            <>
              Siguiente
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          ) : (
            'Comenzar'
          )}
        </Button>
      </div>
    </div>
  );
}