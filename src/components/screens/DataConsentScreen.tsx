import React, { useState } from 'react';
import { Shield, Check } from 'lucide-react';
import { Button } from '../ui/button';

interface DataConsentScreenProps {
  userName: string;
  onAccept: () => void;
}

export function DataConsentScreen({ userName, onAccept }: DataConsentScreenProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onAccept();
    }, 500);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <h1 className="text-gray-900 text-center">Consentimiento de datos</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          {/* Welcome */}
          <div className="text-center mb-8">
            <h2 className="text-gray-900 mb-2">¡Bienvenido, {userName}!</h2>
            <p className="text-gray-600">
              Antes de continuar, necesitamos tu consentimiento
            </p>
          </div>

          {/* Consent information */}
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h3 className="text-gray-900">¿Cómo usamos tus datos?</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  <strong>Ubicación:</strong> Para mostrar alertas cercanas y permitirte reportar incidentes en tiempo real
                </p>
              </div>

              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  <strong>Información de perfil:</strong> Para identificarte en tus reportes y personalizar tu experiencia
                </p>
              </div>

              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  <strong>Notificaciones:</strong> Para alertarte sobre incidentes en tu área
                </p>
              </div>
            </div>
          </div>

          {/* Privacy notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Tu privacidad es importante.</strong> Tus datos están protegidos conforme a la Ley 1581/2012 de Colombia. Nunca compartiremos tu información sin tu consentimiento.
            </p>
          </div>

          {/* Additional info */}
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Al continuar, aceptas que AlertaCiudadana:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Acceda a tu ubicación cuando uses la app</li>
              <li>Almacene tus reportes de incidentes</li>
              <li>Te envíe notificaciones de seguridad</li>
            </ul>
          </div>

          {/* Action button */}
          <Button
            onClick={handleAccept}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            size="lg"
          >
            {isLoading ? 'Procesando...' : 'Acepto y continuar'}
          </Button>

          {/* Footer text */}
          <p className="text-xs text-gray-500 text-center">
            Puedes cambiar estos permisos en cualquier momento desde tu perfil
          </p>
        </div>
      </div>
    </div>
  );
}
