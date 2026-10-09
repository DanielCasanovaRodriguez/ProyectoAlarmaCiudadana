import { useState } from 'react';
import { Shield, Check, AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthCheckbox } from '../auth/AuthCheckbox';
import { LegalDialog, EnlaceLegal, type TipoDocumentoLegal } from '../legal/LegalDocument';
import { aceptarPolitica } from '../../services/legalService';
import { POLITICA_VERSION } from '../../config/legal';
import { toUserMessage } from '../../utils/errors';

interface DataConsentScreenProps {
  userName: string;
  /** La política cambió desde la última aceptación (cuentas existentes). */
  actualizacion?: boolean;
  onAccept: () => void;
  onCerrarSesion?: () => void;
}

/**
 * Autorización previa, expresa e informada (Ley 1581 de 2012, art. 9;
 * Decreto 1377 de 2013, arts. 5-8). La aceptación se guarda en la BD con
 * la versión y la fecha (prueba de la autorización).
 */
export function DataConsentScreen({ userName, actualizacion, onAccept, onCerrarSesion }: DataConsentScreenProps) {
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [docLegal, setDocLegal] = useState<TipoDocumentoLegal | null>(null);

  const handleAccept = async () => {
    if (!acepta) { setError('Marca la casilla para autorizar el tratamiento de tus datos.'); return; }
    setGuardando(true);
    setError(null);
    try {
      await aceptarPolitica(POLITICA_VERSION);
      onAccept();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo guardar tu autorización. Intenta de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  const usos = [
    ['Identificación', 'Tu nombre y tu cédula (cifrada) para que cada cuenta sea de una persona real y evitar alertas falsas.'],
    ['Ubicación', 'El lugar de tus alertas y, si lo activas, tu última ubicación para avisarte de alertas a 1 km o menos.'],
    ['Alertas y evidencias', 'Lo que reportas lo ve el personal que atiende. Las personas cercanas ven el tipo y el lugar, nunca tu nombre.'],
    ['Notificaciones', 'Para avisarte de alertas cercanas y de los cambios en tus reportes.'],
  ];

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="px-6 py-4 border-b">
        <h1 className="text-gray-900 text-center">Autorización de datos personales</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" aria-hidden />
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-gray-900 mb-1">{userName ? `Hola, ${userName.split(' ')[0]}` : 'Antes de continuar'}</h2>
            <p className="text-gray-600 text-sm">
              {actualizacion
                ? 'Actualizamos nuestra Política de Tratamiento de Datos. Revísala y confirma tu autorización para seguir usando la app.'
                : 'Necesitamos tu autorización para tratar tus datos, como lo exige la Ley 1581 de 2012.'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            {usos.map(([titulo, texto]) => (
              <div key={titulo} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden />
                <p className="text-sm text-gray-700"><strong>{titulo}:</strong> {texto}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p><strong>Tus derechos:</strong> conocer, actualizar, rectificar y suprimir tus datos y revocar esta autorización
              en cualquier momento desde <strong>Perfil → Mis datos y derechos</strong>.</p>
            <p>Las fotos, videos o audios pueden contener datos sensibles: adjuntarlos es opcional.</p>
            <p>No vendemos tus datos ni los usamos con fines publicitarios.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <AuthCheckbox
            checked={acepta}
            onChange={(v) => { setAcepta(v); setError(null); }}
            label={
              <span>
                Autorizo de forma previa, expresa e informada el tratamiento de mis datos personales según la{' '}
                <EnlaceLegal tipo="privacidad" onAbrir={setDocLegal}>Política de Tratamiento de Datos</EnlaceLegal>{' '}
                y acepto los <EnlaceLegal tipo="terminos" onAbrir={setDocLegal}>Términos y Condiciones</EnlaceLegal>.
              </span>
            }
          />

          <Button
            onClick={handleAccept}
            disabled={guardando}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            size="lg"
          >
            {guardando ? 'Guardando…' : 'Autorizo y continúo'}
          </Button>

          {onCerrarSesion && (
            <Button onClick={onCerrarSesion} variant="outline" size="lg" className="w-full" disabled={guardando}>
              <LogOut className="w-4 h-4 mr-2" aria-hidden /> No autorizo (cerrar sesión)
            </Button>
          )}
          <p className="text-xs text-gray-500 text-center">
            Sin esta autorización no podemos prestarte el servicio. En una emergencia llama siempre a la{' '}
            <a href="tel:123" className="text-blue-600 font-medium underline">Línea 123</a>.
          </p>
        </div>
      </div>
      <LegalDialog tipo={docLegal} onClose={() => setDocLegal(null)} />
    </div>
  );
}
