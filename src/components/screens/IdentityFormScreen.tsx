import { useState } from 'react';
import { ArrowLeft, IdCard, Lock, UserCheck, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
import { AuthCheckbox } from '../auth/AuthCheckbox';
import { registrarMiCedula, type MiIdentidad } from '../../services/identityService';
import { validarNumeroCedula, validarFechaExpedicion, soloDigitosCedula, hoyISO, FECHA_EXPEDICION_MINIMA } from '../../utils/cedula';
import { toUserMessage } from '../../utils/errors';

interface IdentityFormScreenProps {
  nombre?: string;
  /** Cédula ya registrada sin fecha (cuentas del sistema anterior). */
  actual?: MiIdentidad | null;
  onListo: (ultimosDigitos: string) => void;
  onVolver: () => void;
  /** Cuenta anterior sin cédula completa: no se puede omitir (solo salir). */
  obligatoria?: boolean;
  onCerrarSesion?: () => void;
}

/**
 * Cuentas existentes: registran su cédula (número + fecha de expedición)
 * para poder reportar alertas. Una cédula = una cuenta.
 */
export function IdentityFormScreen({ nombre, actual, onListo, onVolver, obligatoria, onCerrarSesion }: IdentityFormScreenProps) {
  const [cedula, setCedula] = useState('');
  const [fecha, setFecha] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const [errores, setErrores] = useState<{ cedula?: string; fecha?: string; autoriza?: string; general?: string }>({});
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const e: typeof errores = {};
    const eC = validarNumeroCedula(cedula); if (eC) e.cedula = eC;
    const eF = validarFechaExpedicion(fecha); if (eF) e.fecha = eF;
    if (!autoriza) e.autoriza = 'Necesitamos tu autorización para continuar';
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      const ultimos = await registrarMiCedula(soloDigitosCedula(cedula), fecha);
      onListo(ultimos);
    } catch (err) {
      setErrores({ general: toUserMessage(err, 'No se pudo registrar tu cédula. Intenta de nuevo.') });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        {!obligatoria && (
          <button onClick={onVolver} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
        )}
        <h1 className="text-gray-900">Registra tu cédula</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <IdCard className="w-10 h-10 text-blue-600" aria-hidden />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-gray-900">{nombre ? `${nombre.split(' ')[0]}, un` : 'Un'} último dato</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              {actual && !actual.completa
                ? `Ya tenemos tu cédula terminada en ${actual.ultimos_digitos}. Confírmala con su fecha de expedición para poder reportar alertas.`
                : 'Para reportar alertas, cada cuenta debe estar vinculada a una cédula. Desde ahora también será tu usuario para ingresar.'}
            </p>
          </div>

          <ul className="bg-gray-50 rounded-lg p-5 space-y-4">
            <li className="flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-gray-700"><strong>Una cédula, una cuenta.</strong> Así evitamos cuentas falsas y reportes de broma.</p>
            </li>
            <li className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-gray-700"><strong>Protegida.</strong> Se guarda cifrada y nadie más puede verla.</p>
            </li>
          </ul>

          {errores.general && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-red-800">{errores.general}</p>
            </div>
          )}

          <div className="space-y-4">
            <AuthInput label="Número de cédula" value={cedula} onChange={setCedula} placeholder="1012345678"
              error={errores.cedula} required inputMode="numeric" maxLength={14} autoComplete="off" />
            <AuthInput type="date" label="Fecha de expedición" value={fecha} onChange={setFecha}
              error={errores.fecha} required min={FECHA_EXPEDICION_MINIMA} max={hoyISO()}
              hint="Aparece en el reverso de tu cédula." />
            <AuthCheckbox
              checked={autoriza}
              onChange={(v) => { setAutoriza(v); setErrores(x => ({ ...x, autoriza: undefined })); }}
              error={errores.autoriza}
              label="Autorizo el tratamiento de mis datos de identificación para verificar mi identidad y prevenir alertas falsas, conforme a la Ley 1581 de 2012."
            />
          </div>

          <div className="space-y-3">
            <Button onClick={enviar} disabled={enviando} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {enviando ? 'Guardando…' : 'Guardar mi cédula'}
            </Button>
            {obligatoria && onCerrarSesion && (
              <Button onClick={onCerrarSesion} variant="outline" size="lg" className="w-full" disabled={enviando}>Cerrar sesión</Button>
            )}
          </div>
          {obligatoria && (
            <p className="text-xs text-gray-500 text-center">
              Tu cuenta se creó antes de este requisito: completa estos datos una sola vez para seguir usando la app.
              En una emergencia llama ya a la <a href="tel:123" className="text-blue-600 font-medium underline">Línea 123</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
