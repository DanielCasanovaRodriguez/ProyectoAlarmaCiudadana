import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
import { sendPasswordResetOTP } from '../../services/authService';
import { toast } from 'sonner';
import { validarNumeroCedula, soloDigitosCedula } from '../../utils/cedula';
import { checkRateLimit, clearRateLimit } from '../../utils/rateLimitManager';

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onCodeSent: (email: string) => void;
}

export function ForgotPasswordScreen({ onBack, onCodeSent }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [showRateLimitHelp, setShowRateLimitHelp] = useState(false);
  
  const COOLDOWN_SECONDS = 60; // 60 segundos entre intentos

  // Verificar rate limit al montar
  useEffect(() => {
    const status = checkRateLimit();
    if (status.isBlocked) {
      setIsRateLimited(true);
      setRateLimitMessage(status.message);
      setShowRateLimitHelp(true);
    }
  }, []);

  useEffect(() => {
    // Cooldown timer
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => setCooldownRemaining(cooldownRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);

  // Actualizar mensaje de rate limit cada segundo
  useEffect(() => {
    if (isRateLimited) {
      const interval = setInterval(() => {
        const status = checkRateLimit();
        if (!status.isBlocked) {
          setIsRateLimited(false);
          setShowRateLimitHelp(false);
          setRateLimitMessage('');
        } else {
          setRateLimitMessage(status.message);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRateLimited]);

  const isEmailValid = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const canSubmit = email.length > 0 && cooldownRemaining === 0 && !isLoading && !isRateLimited;

  const handleClearRateLimit = () => {
    clearRateLimit();
    setIsRateLimited(false);
    setShowRateLimitHelp(false);
    setRateLimitMessage('');
    setError('');
    
    toast.success('Bloqueo eliminado', {
      description: 'Ahora puedes intentar enviar el código nuevamente. Por favor espera al menos 1 minuto entre intentos.'
    });
  };

  const handleSubmit = async () => {
    setError('');
    
    const valor = email.trim();
    if (!valor) {
      setError('Ingresa tu número de cédula o tu correo');
      return;
    }
    const conCorreo = valor.includes('@');
    if (conCorreo && !isEmailValid(valor)) {
      setError('Ingresa un correo válido');
      return;
    }
    if (!conCorreo) {
      const errCedula = /[a-z]/i.test(valor) ? 'Escribe tu número de cédula (solo números) o tu correo completo.' : validarNumeroCedula(valor);
      if (errCedula) { setError(errCedula); return; }
    }
    const identificador = conCorreo ? valor.toLowerCase() : soloDigitosCedula(valor);
    
    if (cooldownRemaining > 0) {
      setError(`Por favor espera ${cooldownRemaining} segundos antes de intentar de nuevo`);
      return;
    }

    if (isRateLimited) {
      setError('Límite de intentos alcanzado. Usa el botón "Eliminar bloqueo" para reintentar.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await sendPasswordResetOTP(identificador);
      
      if (result.success) {
        toast.success(conCorreo ? 'Código enviado' : 'Solicitud recibida', {
          description: conCorreo
            ? 'Revisa tu correo electrónico (incluye carpeta de spam)'
            : 'Si la cédula está registrada, enviamos un código al correo de la cuenta.'
        });
        
        setCooldownRemaining(COOLDOWN_SECONDS);
        onCodeSent(identificador);
      } else {
        console.error('❌ Error al enviar código:', result.error);
        
        // Mejorar mensajes de error específicos
        if (result.error?.includes('no existe') || 
            result.error?.includes('not found') || 
            result.error?.includes('No existe una cuenta')) {
          setError('Este correo no está registrado. Por favor regístrate primero o verifica el correo.');
          toast.error('Correo no registrado', {
            description: 'No existe una cuenta con este correo. ¿Quieres registrarte?'
          });
        } else if (result.error?.includes('rate limit') || result.error?.includes('demasiados códigos')) {
          setError('Has enviado demasiados códigos. Espera 15 minutos o usa el botón "Eliminar bloqueo".');
          setIsRateLimited(true);
          setRateLimitMessage('Límite de intentos alcanzado de Supabase (espera 15 minutos)');
          setShowRateLimitHelp(true);
        } else {
          setError(result.error || 'Error al enviar código');
        }
      }
    } catch (err: any) {
      console.error('❌ Error inesperado:', err);
      setError('Error al enviar código. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">Recuperar contraseña</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Mail className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center mb-8">
            <h2 className="text-gray-900 mb-2">¿Olvidaste tu contraseña?</h2>
            <p className="text-gray-600">
              Ingresa tu número de cédula o tu correo y te enviaremos un código al correo de tu cuenta para restablecer tu contraseña
            </p>
          </div>

          {/* Rate Limit Help - NUEVO */}
          {showRateLimitHelp && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 mb-2">
                    ⚠️ Límite de intentos alcanzado
                  </p>
                  <p className="text-sm text-red-800 mb-3">
                    {rateLimitMessage}
                  </p>
                  <div className="text-sm text-red-800 space-y-1">
                    <p className="font-medium">¿Qué puedes hacer?</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Espera 15-20 minutos antes de intentar de nuevo</li>
                      <li>Revisa tu correo - puede que ya tengas un código válido</li>
                      <li>Verifica tu carpeta de SPAM</li>
                      <li>Si ya pasaron varios minutos, usa el botón de abajo</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Clear Rate Limit Button */}
              <Button
                onClick={handleClearRateLimit}
                variant="outline"
                className="w-full border-red-300 text-red-700 hover:bg-red-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Eliminar bloqueo y reintentar
              </Button>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>Nota:</strong> Este bloqueo es por seguridad. Si eliminas el bloqueo, asegúrate de esperar al menos 1 minuto entre intentos para evitar que Supabase bloquee tu cuenta temporalmente.
                </p>
              </div>
            </div>
          )}

          {/* Info box */}
          {!showRateLimitHelp && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">📧 Importante:</p>
                <ul className="space-y-1">
                  <li>• Revisa tu bandeja de entrada y <strong>spam</strong></li>
                  <li>• El código es válido por tiempo limitado</li>
                  <li>• Solo puedes solicitar 1 código por minuto</li>
                  <li>• Máximo 3-4 intentos por hora</li>
                </ul>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            <AuthInput
              label="Cédula o correo electrónico"
              value={email}
              onChange={setEmail}
              placeholder="1012345678 o tu@correo.com"
              error={error}
              required
              disabled={isRateLimited}
            />

            {/* Cooldown warning */}
            {cooldownRemaining > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Por seguridad, espera <strong>{cooldownRemaining} segundos</strong> antes de solicitar otro código.
                </p>
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
              size="lg"
            >
              {isLoading 
                ? 'Enviando código...' 
                : isRateLimited
                  ? 'Bloqueado - Usa el botón de arriba'
                  : cooldownRemaining > 0 
                    ? `Espera ${cooldownRemaining}s...` 
                    : 'Enviar código'}
            </Button>
          </div>

          {/* Back to login */}
          <div className="text-center pt-4">
            <button
              onClick={onBack}
              className="text-blue-600 hover:text-blue-700"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}