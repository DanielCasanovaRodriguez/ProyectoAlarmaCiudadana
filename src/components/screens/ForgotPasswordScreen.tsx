import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
import { sendPasswordResetOTP } from '../../services/authService';
import { toast } from 'sonner';
import { validarNumeroCedula, soloDigitosCedula } from '../../utils/cedula';
import { esperaRestante, tiempoDesdeEnvio, VIGENCIA_REUTILIZABLE_MS } from '../../utils/envioCodigos';

interface ForgotPasswordScreenProps {
  onBack: () => void;
  /** Correo o cédula con que se pidió el código (pasa a la pantalla del código). */
  onCodeSent: (identificador: string) => void;
}

const esCorreoValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * Recuperar la contraseña con cédula o correo. La espera entre envíos la
 * marca Supabase (la app muestra el tiempo exacto); si ya se envió un código
 * hace poco, se puede ir directo a escribirlo.
 */
export function ForgotPasswordScreen({ onBack, onCodeSent }: ForgotPasswordScreenProps) {
  const [valor, setValor]       = useState('');
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera]     = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  /** Valida y devuelve el identificador normalizado (correo en minúsculas o cédula en dígitos). */
  const identificador = (): string | null => {
    const v = valor.trim();
    if (!v) { setError('Ingresa tu número de cédula o tu correo'); return null; }
    if (v.includes('@')) {
      if (!esCorreoValido(v)) { setError('Ingresa un correo válido'); return null; }
      return v.toLowerCase();
    }
    const e = /[a-z]/i.test(v) ? 'Escribe tu número de cédula (solo números) o tu correo completo.' : validarNumeroCedula(v);
    if (e) { setError(e); return null; }
    return soloDigitosCedula(v);
  };

  const enviar = async () => {
    setError('');
    setInfo('');
    const id = identificador();
    if (!id) return;

    const restante = esperaRestante(id);
    if (restante > 0) { setEspera(restante); setInfo('Ya te enviamos un código hace un momento. Puedes escribirlo o esperar para pedir otro.'); return; }

    setEnviando(true);
    try {
      const r = await sendPasswordResetOTP(id);
      if (r.success) {
        toast.success('Código enviado', {
          description: id.includes('@')
            ? 'Revisa tu correo (también la carpeta de spam).'
            : 'Si la cédula está registrada, lo enviamos al correo de la cuenta.',
        });
        onCodeSent(id);
      } else if (r.esperaS) {
        setEspera(r.esperaS);
        setInfo(r.error ?? '');
      } else {
        setError(r.error || 'No se pudo enviar el código. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const idActual = valor.trim().includes('@') ? valor.trim().toLowerCase() : soloDigitosCedula(valor.trim());
  const hace = idActual ? tiempoDesdeEnvio(idActual) : null;
  const yaTieneCodigo = hace != null && hace < VIGENCIA_REUTILIZABLE_MS;

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
              <h2 className="text-gray-900 font-semibold">¿Olvidaste tu contraseña?</h2>
              <p className="text-sm text-gray-600 mt-1">
                Escribe tu número de cédula o tu correo y te enviaremos un código al correo de tu cuenta.
              </p>
            </div>
          </div>

          <AuthInput
            label="Cédula o correo electrónico"
            value={valor}
            onChange={(v) => { setValor(v); setError(''); setInfo(''); }}
            placeholder="1012345678 o tu@correo.com"
            error={error}
            required
            autoComplete="username"
          />

          {info && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900" role="status">{info}</div>
          )}
          {error && !valor && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <Button
            onClick={enviar}
            disabled={enviando || espera > 0 || !valor.trim()}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
          >
            {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</>
              : espera > 0 ? <>Puedes pedir otro en <span className="tabular-nums ml-1">{espera} s</span></>
              : 'Enviar código'}
          </Button>

          {yaTieneCodigo && (
            <button onClick={() => onCodeSent(idActual)} className="w-full text-sm text-blue-600 font-medium py-1">
              Ya tengo un código: escribirlo
            </button>
          )}

          <ul className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
            <li>• Revisa también <strong>Spam / Correo no deseado</strong>.</li>
            <li>• Puedes pedir un código nuevo cada 30 segundos; usa siempre el más reciente.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
