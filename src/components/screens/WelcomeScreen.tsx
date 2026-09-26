import React from 'react';
import { Button } from '../ui/button';
import { Shield, MapPin, Users, Download } from 'lucide-react';
import { isNative } from '../../platform';
import { ANDROID_APK_URL, APP_VERSION } from '../../config/app';

interface WelcomeScreenProps {
  onNext: () => void;
}

export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  return (
    <div className="h-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex flex-col items-center justify-center text-white p-6">
      {/* Logo - perfectly centered */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 mx-auto">
          <Shield className="w-12 h-12 text-blue-600" />
        </div>
        <h1 className="text-center" style={{ fontSize: '28px', fontWeight: '700' }}>
          AlertaCiudadana
        </h1>
      </div>

      {/* Welcome text */}
      <div className="text-center mb-12 space-y-4 px-4">
        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>¡Bienvenido!</h2>
        <p className="text-blue-100 max-w-sm mx-auto" style={{ fontSize: '15px', lineHeight: '1.5' }}>
          Tu aplicación de seguridad ciudadana que te conecta con tu comunidad en tiempo real
        </p>
      </div>

      {/* Features preview */}
      <div className="space-y-4 mb-12 w-full max-w-sm">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6 text-blue-200" />
          <span className="text-blue-100" style={{ fontSize: '15px' }}>Mapa en tiempo real</span>
        </div>
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-200" />
          <span className="text-blue-100" style={{ fontSize: '15px' }}>Alertas instantáneas</span>
        </div>
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-200" />
          <span className="text-blue-100" style={{ fontSize: '15px' }}>Comunidad segura</span>
        </div>
      </div>

      {/* Action button */}
      <Button 
        onClick={onNext}
        className="w-full max-w-sm bg-white hover:bg-blue-50 shadow-lg"
        style={{ 
          color: '#2563eb',
          fontSize: '16px',
          fontWeight: '600',
          height: '52px'
        }}
        size="lg"
      >
        Comenzar
      </Button>

      {/* Descarga de la app Android (solo en el navegador) */}
      {!isNative && (
        <a
          href={ANDROID_APK_URL}
          className="mt-4 w-full max-w-sm flex items-center justify-center gap-2 rounded-md border border-white/60 text-white hover:bg-white/10"
          style={{ fontSize: '15px', fontWeight: 600, height: '48px' }}
        >
          <Download className="w-5 h-5" />
          Descargar app para Android
        </a>
      )}

      {/* Footer */}
      <div className="mt-8 text-center" style={{ fontSize: '12px' }}>
        <p className="text-blue-200">Versión {APP_VERSION}</p>
        <p className="text-blue-200 mt-1">Tu seguridad es nuestra prioridad</p>
      </div>
    </div>
  );
}