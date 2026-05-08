import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Shield, AlertCircle, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { verifyPasswordResetOTP, sendPasswordResetOTP } from '../../services/authService';
import { toast } from 'sonner';

interface OTPVerificationScreenProps {
  email: string;
  verificationType?: 'registration' | 'password-reset';
  onVerified: (code?: string) => void;
  onBack: () => void;
  onResendCode: () => void;
}

export function OTPVerificationScreen({
  email,
  verificationType = 'registration',
  onVerified,
  onBack,
  onResendCode
}: OTPVerificationScreenProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']); // 8 dígitos (igual que registro)
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus en el primer input
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    // Countdown para reenviar código
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value[0];
    }
    
    if (!/^\d*$/.test(value)) {
      return;
    }
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');
    
    // Auto focus next input
    if (value && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, otp.length);
    if (/^\d+$/.test(pastedData)) {
      const newOtp = pastedData.split('').concat(Array(otp.length).fill('')).slice(0, otp.length);
      setOtp(newOtp);
      inputRefs.current[Math.min(pastedData.length, otp.length - 1)]?.focus();
    }
  };

  const canSubmit = otp.every(digit => digit !== '');

  const handleVerify = async () => {
    const code = otp.join('');
    setError('');
    setIsVerifying(true);
    
    try {
      console.log('🔐 Verificando código de recuperación...');
      
      // Verificar código OTP de recuperación
      const result = await verifyPasswordResetOTP(email, code);
      
      if (!result.success) {
        setError(result.error || 'Código incorrecto. Inténtalo de nuevo.');
        setOtp(Array(otp.length).fill(''));
        inputRefs.current[0]?.focus();
        
        toast.error('Código incorrecto', {
          description: result.error || 'Por favor verifica e intenta de nuevo'
        });
        
        setIsVerifying(false);
        return;
      }
      
      // Código verificado correctamente
      console.log('✅ Código verificado exitosamente');
      
      toast.success('Código verificado', {
        description: 'Ahora puedes cambiar tu contraseña'
      });
      
      setIsVerifying(false);
      onVerified(code);
    } catch (err: any) {
      console.error('Error al verificar código:', err);
      setError('Error al verificar código. Inténtalo de nuevo.');
      setOtp(Array(otp.length).fill(''));
      inputRefs.current[0]?.focus();
      
      toast.error('Error', {
        description: 'No se pudo verificar el código'
      });
      
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    
    setIsResending(true);
    setCountdown(60);
    setOtp(Array(otp.length).fill(''));
    setError('');
    inputRefs.current[0]?.focus();
    
    try {
      console.log('📧 Reenviando código de recuperación...');
      
      const result = await sendPasswordResetOTP(email);
      
      if (result.success) {
        toast.success('Código reenviado', {
          description: 'Revisa tu correo electrónico (también en spam)',
          duration: 5000
        });
      } else {
        toast.error('Error al reenviar', {
          description: result.error || 'No se pudo reenviar el código. Espera unos minutos e intenta de nuevo.'
        });
      }
    } catch (err: any) {
      console.error('Error al reenviar código:', err);
      toast.error('Error', {
        description: 'No se pudo reenviar el código'
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">Verificación</h1>
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

          {/* Instructions */}
          <div className="text-center mb-8">
            <h2 className="text-gray-900 mb-2">Ingresa el código</h2>
            <p className="text-gray-600 mb-4">
              Hemos enviado un código de verificación a<br />
              <span className="text-gray-900 font-medium">{email}</span>
            </p>
            
            {/* Instrucciones importantes */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 text-left">
              <p className="text-sm font-medium text-blue-900 mb-2">
                📧 Instrucciones importantes:
              </p>
              <ul className="text-sm text-blue-800 space-y-1.5">
                <li>• Revisa tu bandeja de entrada</li>
                <li>• Verifica la carpeta de <strong>Spam/Correo no deseado</strong></li>
                <li>• El correo viene de <strong>Supabase</strong></li>
                <li>• El código tiene <strong>8 dígitos</strong></li>
                <li>• El código expira en 10 minutos</li>
              </ul>
            </div>
          </div>

          {/* OTP Input */}
          <div className="space-y-6">
            <div className="flex gap-2 justify-center">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className={`w-12 h-14 text-center text-lg font-semibold border-2 rounded-lg transition-all outline-none ${
                    error
                      ? 'border-red-500 bg-red-50'
                      : digit
                      ? 'border-blue-600 bg-white'
                      : 'border-gray-300 bg-gray-50 focus:border-blue-500'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Resend code */}
            <div className="text-center">
              {countdown === 0 ? (
                <button
                  onClick={handleResend}
                  disabled={isResending}
                  className="text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  {isResending ? 'Reenviando...' : 'Reenviar código'}
                </button>
              ) : (
                <p className="text-gray-500 text-sm">
                  Reenviar código en <strong>{countdown}s</strong>
                </p>
              )}
            </div>

            {/* Submit button */}
            <Button
              onClick={handleVerify}
              disabled={!canSubmit || isVerifying}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
              size="lg"
            >
              {isVerifying ? 'Verificando...' : 'Verificar código'}
            </Button>
          </div>

          {/* Help text */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-500">
              ¿No recibiste el código? Revisa tu carpeta de spam o espera {countdown > 0 ? countdown + 's' : ''} para reenviar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}