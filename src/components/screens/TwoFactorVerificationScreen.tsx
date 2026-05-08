import { useState, useRef, useEffect } from 'react';
import { Shield, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface TwoFactorVerificationScreenProps {
  email: string;
  onBack: () => void;
  onVerificationComplete: () => void;
}

export function TwoFactorVerificationScreen({
  email,
  onBack,
  onVerificationComplete,
}: TwoFactorVerificationScreenProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = () => {
    const codeString = code.join('');
    
    if (codeString.length !== 6) {
      toast.error('Por favor, ingresa el código de 6 dígitos');
      return;
    }

    setIsVerifying(true);

    // Simulate verification (not functional, just visual)
    setTimeout(() => {
      setIsVerifying(false);
      toast.success('Código verificado correctamente');
      onVerificationComplete();
    }, 1500);
  };

  const handleResend = () => {
    toast.success('Código reenviado a tu correo');
    setCode(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  const isCodeComplete = code.every(digit => digit !== '');

  return (
    <div className="h-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white hover:text-white/90 transition-colors"
          disabled={isVerifying}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Volver</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Verificación de Seguridad
            </h1>
            <p className="text-sm text-gray-600">
              Ingresa el código de 6 dígitos enviado a
            </p>
            <p className="text-sm text-blue-600 mt-1">
              {email}
            </p>
          </div>

          {/* Code Input */}
          <div className="mb-8">
            <label className="block text-sm text-gray-700 mb-3 text-center">
              Código de Verificación
            </label>
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isVerifying}
                  className="w-12 h-14 text-center text-2xl font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-500"
                />
              ))}
            </div>
          </div>

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={!isCodeComplete || isVerifying}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 mb-4"
          >
            {isVerifying ? 'Verificando...' : 'Verificar Código'}
          </Button>

          {/* Resend Code */}
          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={isVerifying}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 transition-colors"
            >
              ¿No recibiste el código? Reenviar
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-blue-900 leading-relaxed">
                  <strong>Protección de doble factor:</strong> Este paso adicional garantiza 
                  la seguridad de tu cuenta y protege el acceso al panel de administración.
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  El código tiene una validez de 10 minutos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 text-center p-6 text-white/70 text-xs">
        <p>AlertaCiudadana v1.0.0</p>
        <p className="mt-1">Sistema de gestión de alertas ciudadanas</p>
      </div>
    </div>
  );
}
