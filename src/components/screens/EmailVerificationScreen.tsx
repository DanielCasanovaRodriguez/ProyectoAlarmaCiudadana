import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Mail, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { verifyEmailCode, sendVerificationEmail, sendLoginOTP, getStoredVerificationCode } from '../../utils/verificationCode';
import { toast } from 'sonner';

// ================================================================
// TIPOS
// ================================================================

interface EmailVerificationScreenProps {
  onBack:             () => void;
  onVerify:           (session?: any) => void;
  email:              string;
  localCode?:         string;          // código local generado si Supabase tiene rate limit
  title?:             string;
  subtitle?:          string;
  isAdminLogin?:      boolean;
  verificationType?:  'signup' | 'email';
}

// ================================================================
// COMPONENTE
// ================================================================

export function EmailVerificationScreen({
  onBack,
  onVerify,
  email,
  localCode,                           // ← prop que venía de CollaboratorLoginScreen pero no se usaba
  title       = 'Verificación de correo',
  subtitle    = 'Ingresa el código de 8 dígitos enviado a tu correo',
  isAdminLogin      = false,
  verificationType  = 'signup',
}: EmailVerificationScreenProps) {

  // 8 dígitos para registro (códigos de Supabase signup)
  // 6 dígitos para login de admin (OTP de signInWithOtp)
  const CODE_LENGTH = 8;

  const [code,        setCode]        = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error,       setError]       = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus primer input al montar
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── Manejo de inputs ─────────────────────────────────────────────

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return; // solo dígitos

    const newCode    = [...code];
    newCode[index]   = value;
    setCode(newCode);
    setError('');

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, CODE_LENGTH);
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = [...code];
    for (let i = 0; i < pastedData.length && i < CODE_LENGTH; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);
    setError('');

    const nextEmpty = newCode.findIndex(c => !c);
    if (nextEmpty !== -1) {
      inputRefs.current[nextEmpty]?.focus();
    } else {
      inputRefs.current[CODE_LENGTH - 1]?.focus();
    }
  };

  // ── Verificar código ─────────────────────────────────────────────

  const handleVerify = async () => {
    const enteredCode = code.join('');

    if (enteredCode.length !== CODE_LENGTH) {
      setError(`Ingresa el código completo de ${CODE_LENGTH} dígitos`);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // ── PRIORIDAD 1: Código local por prop (pasado directamente desde CollaboratorLoginScreen)
      // Se usa cuando Supabase devolvió rate limit y generamos el código localmente.
      if (localCode && enteredCode === localCode) {
        console.log('✅ Código local (prop) verificado correctamente');
        toast.success('Código verificado correctamente');
        setIsLoading(false);
        onVerify(undefined);
        return;
      }

      // ── PRIORIDAD 2: Código local en localStorage (almacenado por storeVerificationCode)
      // Cubre el caso en que el código se generó en una llamada anterior y se guardó.
      const storedCode = getStoredVerificationCode(email);
      if (storedCode && enteredCode === storedCode) {
        console.log('✅ Código local (localStorage) verificado correctamente');
        toast.success('Código verificado correctamente');
        setIsLoading(false);
        onVerify(undefined);
        return;
      }

      // ── PRIORIDAD 3: Verificar contra Supabase Auth (OTP real)
      console.log(`🔐 Verificando código con Supabase (tipo: ${verificationType}) para: ${email}`);
      const result = await verifyEmailCode(email, enteredCode, verificationType);

      if (!result.success) {
        console.error('❌ Código incorrecto o expirado:', result.error);
        setError(result.error || 'Código incorrecto. Por favor verifica e intenta de nuevo.');
        setCode(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        setIsLoading(false);
        return;
      }

      console.log('✅ Código verificado correctamente por Supabase');
      toast.success('Código verificado correctamente');
      setIsLoading(false);
      onVerify(result.session);

    } catch (err: any) {
      console.error('❌ Error inesperado al verificar:', err);
      setError('Error al verificar el código. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  // ── Reenviar código ──────────────────────────────────────────────

  const handleResend = async () => {
    setIsResending(true);
    setError('');
    setCode(Array(CODE_LENGTH).fill(''));

    try {
      let result;

      if (isAdminLogin) {
        // Para admin: OTP de 6 dígitos (signInWithOtp)
        result = await sendLoginOTP(email);
      } else {
        // Para registro: reenviar confirmación de signup (8 dígitos)
        result = await sendVerificationEmail(email);
      }

      if (result.success) {
        toast.success('Código reenviado', {
          description: 'Revisa tu correo electrónico (incluye carpeta de spam)',
        });
      } else {
        if (result.error?.includes('rate limit') || result.error?.includes('Rate limit')) {
          setError(
            'Has solicitado demasiados códigos. Por favor espera unos minutos antes de reintentar.'
          );
          toast.error('Límite excedido', {
            description: 'Espera unos minutos antes de solicitar un nuevo código.',
          });
        } else {
          setError(result.error || 'Error al enviar código');
          toast.error('Error', {
            description: result.error || 'No se pudo enviar el código',
          });
        }
      }
    } catch (err: any) {
      console.error('❌ Error al reenviar código:', err);
      setError('Error al reenviar código. Por favor intenta nuevamente.');
      toast.error('Error', { description: 'No se pudo reenviar el código' });
    } finally {
      setIsResending(false);
      inputRefs.current[0]?.focus();
    }
  };

  const canSubmit = code.every(digit => digit !== '');

  // ── RENDER ──────────────────────────────────────────────────────

  return (
    <div className="h-full bg-white flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">{title}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">

          {/* Ícono */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Mail className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          {/* Título y descripción */}
          <div className="text-center mb-8">
            <h2 className="text-gray-900 mb-2">{subtitle}</h2>
            <p className="text-gray-600 mb-4">
              Enviamos un código a{' '}
              <span className="text-blue-600 font-medium">{email}</span>
            </p>

            {/* Instrucciones */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 text-left">
              <p className="text-sm font-medium text-blue-900 mb-2">
                📧 Instrucciones importantes:
              </p>
              <ul className="text-sm text-blue-800 space-y-1.5">
                <li>• Revisa tu bandeja de entrada</li>
                <li>• Verifica la carpeta de <strong>Spam / Correo no deseado</strong></li>
                <li>• El correo viene de <strong>Supabase</strong></li>
                <li>• El código tiene <strong>{CODE_LENGTH} dígitos</strong></li>
                <li>• El código expira en <strong>10 minutos</strong></li>
              </ul>
            </div>

            {/* Aviso especial para admin */}
            {isAdminLogin && (
              <div className="mt-3 px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  🔐 Verificación de seguridad para administradores
                </p>
              </div>
            )}

            {/* Aviso de código local (solo en desarrollo / rate limit) */}
            {localCode && (
              <div className="mt-3 px-4 py-2 bg-orange-50 rounded-lg border border-orange-300">
                <p className="text-sm text-orange-800">
                  ⚠️ <strong>Modo fallback activo:</strong> Supabase tiene límite de envíos.
                  El código se generó localmente. Revisa la consola del navegador (F12) para verlo.
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Inputs del código */}
          <div className="flex gap-2 justify-center mb-8">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className={`
                  w-12 h-14 text-center text-2xl font-semibold rounded-lg
                  border-2 transition-all
                  ${error
                    ? 'border-red-500 bg-red-50'
                    : digit
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                `}
              />
            ))}
          </div>

          {/* Botón verificar */}
          <Button
            onClick={handleVerify}
            disabled={!canSubmit || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            size="lg"
          >
            {isLoading ? 'Verificando...' : 'Verificar código'}
          </Button>

          {/* Reenviar */}
          <div className="text-center pt-4">
            <p className="text-gray-600 mb-2">¿No recibiste el código?</p>
            <button
              onClick={handleResend}
              disabled={isResending}
              className="text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 transition-colors"
            >
              {isResending ? 'Reenviando...' : 'Reenviar código'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
