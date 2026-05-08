import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '../ui/button';

interface AuthWelcomeScreenProps {
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToCollaboratorLogin?: () => void;
}

export function AuthWelcomeScreen({ 
  onNavigateToLogin, 
  onNavigateToRegister, 
  onNavigateToCollaboratorLogin
}: AuthWelcomeScreenProps) {
  return (
    <div className="h-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex flex-col items-center justify-between text-white p-6 overflow-y-auto">
      {/* Spacer top */}
      <div className="flex-shrink-0 h-8" />
      
      {/* Main content container - centered */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Logo - perfectly centered */}
        <div className="mb-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-5 shadow-2xl mx-auto">
            <Shield className="w-12 h-12 text-blue-600" strokeWidth={2} />
          </div>
          <h1 className="text-center mb-2" style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.02em' }}>
            AlertaCiudadana
          </h1>
          <p className="text-blue-100 text-center" style={{ fontSize: '15px' }}>
            Tu seguridad, nuestra prioridad
          </p>
        </div>

        {/* Welcome message */}
        <div className="text-center mb-8 px-4">
          <h2 className="mb-3" style={{ fontSize: '20px', fontWeight: '600' }}>
            ¡Estás listo para comenzar!
          </h2>
          <p className="text-blue-100" style={{ fontSize: '15px', lineHeight: '1.5' }}>
            Crea una cuenta o inicia sesión para conectarte con tu comunidad
          </p>
        </div>

        {/* Action buttons */}
        <div className="w-full space-y-3">
          <Button 
            onClick={onNavigateToRegister}
            className="w-full bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
            size="lg"
            style={{ 
              color: '#2563eb',
              fontSize: '16px',
              fontWeight: '600',
              height: '52px'
            }}
          >
            Crear cuenta
          </Button>
          
          <Button 
            onClick={onNavigateToLogin}
            variant="outline"
            className="w-full border-2 border-white/90 bg-transparent text-white hover:bg-white/10 hover:border-white"
            size="lg"
            style={{ 
              fontSize: '16px',
              fontWeight: '600',
              height: '52px'
            }}
          >
            Iniciar sesión
          </Button>
        </div>

        {/* Collaborator access link */}
        <button
          onClick={onNavigateToCollaboratorLogin}
          className="mt-5 text-white/90 hover:text-white hover:underline focus:underline focus:outline-none transition-all"
          style={{ 
            fontSize: '14px',
            fontWeight: 500,
            minHeight: '44px',
            padding: '12px 16px'
          }}
          title="Acceso para colaboradores (operadores y administradores)"
        >
          Soy colaborador
        </button>
      </div>

      {/* Footer - at bottom */}
      <div className="flex-shrink-0 text-center pt-6 pb-2" style={{ fontSize: '12px' }}>
        <p className="text-blue-200">
          Al continuar, aceptas nuestros Términos y Condiciones
        </p>
        <p className="text-blue-200 mt-1">
          y la Política de Privacidad
        </p>
      </div>
    </div>
  );
}