import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { CodigoInput } from '../auth/CodigoInput';
import { verifyPasswordResetOTP, sendPasswordResetOTP } from '../../services/authService';
import { toast } from 'sonner';
import { ESPERA_REENVIO_S, esperaRestante } from '../../utils/envioCodigos';

interface OTPVerificationScreenProps {
  /** Correo o número de cédula con el que se pidió la recuperación. */
  email: string;
  verificationType?: 'registration' | 'password-reset';
  onVerified: (code?: string) => void;
  onBack: () => void;
  onResendCode: () => void;
}

const CODE_LENGTH = 8;

/** Código para recuperar la contraseña (llega al correo de la cuenta). */
export function OTPVerificationScreen({ email, onVerified, onBack }: OTPVerificationScreenProps) {
  const [code, setCode]               = useState('');
  const [error, setError]             = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown]     = useState(() => esperaRestante(email) || ESPERA_REENVIO_S);
  const [info, setInfo]               = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const verificar = async (valor = code) => {
    if (valor.length !== CODE_LENGTH || isVerifying) return;
    setError('');
    setIsVerifying(true);
    try {
      const result = await verifyPasswordResetOTP(email, valor);
      if (!result.success) {
        setError(result.error || 'Código incorrecto o vencido. Inténtalo de nuevo.');
        setCode('');
        return;
      }
      toast.success('Código verificado', { description: 'Ahora crea tu nueva contraseña.' });
      onVerified(valor);
    } catch {
      setError('No se pudo verificar el código. Inténtalo de nuevo.');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const reenviar = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    setInfo('');
    try {
      const result = await sendPasswordResetOTP(email);
      if (result.success) {
        setCode('');
        toast.success('Código enviado', { description: 'Revisa tu correo (también la carpeta de spam).' });
        setCountdown(ESPERA_REENVIO_S);
      } else if (result.esperaS) {
        setInfo(result.error ?? '');
        setCountdown(result.esperaS);
      } else {
        setError(result.error || 'No se pudo enviar el código. Intenta de nuevo.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
        <button onClick={onBack} className="p-2 -ml-1 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">Recuperar contraseña</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-md mx-auto space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-blue-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold">Ingresa el código de {CODE_LENGTH} dígitos</h2>
              <p className="text-sm text-gray-600 mt-1 break-words">
                {email.includes('@')
                  ? <>Lo enviamos a <span className="text-blue-700 font-medium">{email}</span></>
                  : <>Si la cédula terminada en <strong>{email.slice(-4)}</strong> está registrada, lo enviamos al correo de esa cuenta.</>}
              </p>
            </div>
          </div>

          <CodigoInput
            length={CODE_LENGTH}
            value={code}
            onChange={v => { setCode(v); setError(''); }}
            onComplete={v => verificar(v)}
            error={!!error}
            disabled={isVerifying}
          />

          {info && !error && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900" role="status">{info}</div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <Button
            onClick={() => verificar()}
            disabled={code.length !== CODE_LENGTH || isVerifying}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isVerifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando…</> : 'Verificar código'}
          </Button>

          <div className="text-center text-sm">
            <span className="text-gray-600">¿No te llegó? </span>
            {countdown > 0 ? (
              <span className="text-gray-500">Puedes pedir otro en <strong className="tabular-nums">{countdown} s</strong></span>
            ) : (
              <button onClick={reenviar} disabled={isResending} className="text-blue-600 font-medium disabled:text-gray-400">
                {isResending ? 'Reenviando…' : 'Reenviar código'}
              </button>
            )}
          </div>

          <ul className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
            <li>• Revisa también <strong>Spam / Correo no deseado</strong>.</li>
            <li>• Si pides otro, usa siempre el más reciente. Puedes pegarlo completo.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
