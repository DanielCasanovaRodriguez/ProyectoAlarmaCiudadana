import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { CodigoInput } from '../auth/CodigoInput';
import { verifyEmailCode, sendVerificationEmail, sendLoginOTP } from '../../utils/verificationCode';
import { toast } from 'sonner';
import { ESPERA_REENVIO_S, esperaRestante } from '../../utils/envioCodigos';

interface EmailVerificationScreenProps {
  onBack:             () => void;
  onVerify:           (session?: any) => void;
  email:              string;
  title?:             string;
  subtitle?:          string;
  isAdminLogin?:      boolean;
  verificationType?:  'signup' | 'email';
  /** Aviso al abrir (p. ej. "usa el código que te enviamos hace 3 min"). */
  aviso?:             string;
  /** Segundos que el servidor pidió esperar antes de otro envío. */
  esperaInicialS?:    number;
}

/** Supabase envía códigos de 8 dígitos (registro y acceso de colaboradores). */
const CODE_LENGTH = 8;

export function EmailVerificationScreen({
  onBack,
  onVerify,
  email,
  title            = 'Verificación de correo',
  subtitle         = 'Ingresa el código de 8 dígitos enviado a tu correo',
  isAdminLogin     = false,
  verificationType = 'signup',
  aviso,
  esperaInicialS,
}: EmailVerificationScreenProps) {
  const [code,        setCode]        = useState('');
  const [error,       setError]       = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [isResending, setIsResending] = useState(false);
  // Cuenta desde el último envío real a este correo (no se reinicia al volver)
  const [espera,      setEspera]      = useState(() => esperaInicialS ?? (esperaRestante(email) || (aviso ? 0 : ESPERA_REENVIO_S)));
  const [info,        setInfo]        = useState(aviso ?? '');

  // Cuenta regresiva para reenviar (evita el bloqueo por exceso de correos)
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const verificar = async (valor = code) => {
    if (valor.length !== CODE_LENGTH || isLoading) {
      if (valor.length !== CODE_LENGTH) setError(`Ingresa los ${CODE_LENGTH} dígitos del código`);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await verifyEmailCode(email, valor, verificationType);
      if (!result.success) {
        setError(result.error || 'Código incorrecto o vencido. Revisa e intenta de nuevo.');
        setCode('');
        return;
      }
      toast.success('Código verificado');
      onVerify(result.session);
    } catch {
      setError('No se pudo verificar el código. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const reenviar = async () => {
    setIsResending(true);
    setError('');
    setInfo('');
    try {
      const result = isAdminLogin ? await sendLoginOTP(email) : await sendVerificationEmail(email);
      if (result.success) {
        setCode('');
        toast.success('Código enviado', { description: 'Revisa tu correo (también la carpeta de spam).' });
        setEspera(ESPERA_REENVIO_S);
      } else if (result.esperaS) {
        // El servidor pide esperar: no es un error, se muestra el tiempo exacto
        setInfo(result.error ?? '');
        setEspera(result.esperaS);
      } else {
        setError(result.error || 'No se pudo enviar el código.');
      }
    } catch {
      setError('No se pudo enviar el código. Intenta de nuevo.');
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
        <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-md mx-auto space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isAdminLogin ? 'bg-amber-100' : 'bg-blue-100'}`}>
              {isAdminLogin
                ? <ShieldCheck className="w-7 h-7 text-amber-700" aria-hidden />
                : <Mail className="w-7 h-7 text-blue-600" aria-hidden />}
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold leading-snug">{subtitle}</h2>
              <p className="text-sm text-gray-600 mt-1 break-words">
                Lo enviamos a <span className="text-blue-700 font-medium">{email}</span>
              </p>
            </div>
          </div>

          <CodigoInput
            length={CODE_LENGTH}
            value={code}
            onChange={v => { setCode(v); setError(''); }}
            onComplete={v => verificar(v)}
            error={!!error}
            disabled={isLoading}
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
            disabled={code.length !== CODE_LENGTH || isLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando…</> : 'Verificar código'}
          </Button>

          <div className="text-center text-sm">
            <span className="text-gray-600">¿No te llegó? </span>
            {espera > 0 ? (
              <span className="text-gray-500">Puedes pedir otro en <strong className="tabular-nums">{espera} s</strong></span>
            ) : (
              <button onClick={reenviar} disabled={isResending} className="text-blue-600 font-medium disabled:text-gray-400">
                {isResending ? 'Reenviando…' : 'Reenviar código'}
              </button>
            )}
          </div>

          <ul className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
            <li>• Revisa también <strong>Spam / Correo no deseado</strong>.</li>
            <li>• El código tiene <strong>{CODE_LENGTH} dígitos</strong>. Si pides otro, usa siempre el más reciente.</li>
            <li>• Puedes pegarlo completo: se reparte solo en las casillas.</li>
            {isAdminLogin && <li>• Es el segundo paso de seguridad del acceso de colaboradores.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
