import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { enviarVerificacion, type CapturaIdentidad } from '../../services/identityService';
import { classifyError } from '../../utils/errors';
import { enmascararCedula } from '../../utils/cedula';

interface IdentitySubmitScreenProps {
  captura: CapturaIdentidad;
  /** Verificación registrada (queda pendiente de revisión). */
  onListo: () => void;
  /** Continuar sin verificación (p. ej. cédula ya usada en otra cuenta); podrá reintentar desde su perfil. */
  onContinuarSinVerificar: () => void;
}

/**
 * Último paso del registro, tras confirmar el correo: sube las fotos de la
 * cédula y registra la verificación (ya existe la sesión del usuario).
 */
export function IdentitySubmitScreen({ captura, onListo, onContinuarSinVerificar }: IdentitySubmitScreenProps) {
  const [estado, setEstado] = useState<'enviando' | 'listo' | 'error'>('enviando');
  const [mensaje, setMensaje] = useState('');
  const [definitivo, setDefinitivo] = useState(false); // error que no se arregla reintentando
  const iniciado = useRef(false);

  const enviar = async () => {
    setEstado('enviando');
    try {
      await enviarVerificacion(captura);
      setEstado('listo');
    } catch (err) {
      const { kind, message } = classifyError(err);
      setMensaje(message || 'No se pudo enviar la verificación.');
      setDefinitivo(kind === 'validation' || kind === 'duplicate' || /ya está registrada|intentos/i.test(message));
      setEstado('error');
    }
  };

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    enviar();
  }, []);

  return (
    <div className="h-full bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full space-y-6 text-center">
        {estado === 'enviando' && (
          <div aria-live="polite" className="space-y-3">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" aria-hidden />
            <h2 className="text-gray-900">Protegiendo y enviando tu cédula…</h2>
            <p className="text-sm text-gray-600">No cierres la aplicación.</p>
          </div>
        )}

        {estado === 'listo' && (
          <div className="space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10 text-green-600" aria-hidden />
            </div>
            <h2 className="text-gray-900">¡Cédula recibida!</h2>
            <p className="text-sm text-gray-600">
              Vinculamos la cédula {enmascararCedula(captura.numero)} a tu cuenta. Ya puedes usar la aplicación;
              nuestro equipo la revisará en breve.
            </p>
            <Button onClick={onListo} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">Continuar</Button>
          </div>
        )}

        {estado === 'error' && (
          <div className="space-y-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-gray-900">No pudimos verificar tu cédula</h2>
            <p className="text-sm text-gray-700" role="alert">{mensaje}</p>
            {!definitivo && (
              <Button onClick={enviar} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">Intentar de nuevo</Button>
            )}
            <Button onClick={onContinuarSinVerificar} variant="outline" size="lg" className="w-full">
              Continuar y verificar después
            </Button>
            <p className="text-xs text-gray-500">
              Tu cuenta ya está creada. Hasta completar la verificación podrás ver el mapa, pero no reportar alertas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
