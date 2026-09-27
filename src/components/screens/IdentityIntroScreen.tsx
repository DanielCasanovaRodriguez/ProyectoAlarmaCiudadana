import { useState } from 'react';
import { ArrowLeft, IdCard, Lock, EyeOff, UserCheck, Sun } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthCheckbox } from '../auth/AuthCheckbox';

interface IdentityIntroScreenProps {
  /** registro: último paso del registro · completar: cuenta existente sin verificar */
  modo: 'registro' | 'completar';
  nombre?: string;
  onContinuar: () => void;
  onVolver: () => void;
  /** Solo en "completar": seguir usando la app sin verificar (no podrá reportar). */
  onAhoraNo?: () => void;
}

export function IdentityIntroScreen({ modo, nombre, onContinuar, onVolver, onAhoraNo }: IdentityIntroScreenProps) {
  const [autoriza, setAutoriza] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const continuar = () => {
    if (!autoriza) { setError('Necesitamos tu autorización para continuar'); return; }
    onContinuar();
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onVolver} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">{modo === 'registro' ? 'Paso 2 de 2' : 'Verifica tu identidad'}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <IdCard className="w-10 h-10 text-blue-600" aria-hidden />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-gray-900">
              {nombre ? `${nombre.split(' ')[0]}, ahora` : 'Ahora'} vamos a escanear tu cédula
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              {modo === 'registro'
                ? 'Es el último paso. Cada cuenta de Alerta Ciudadana está vinculada a una cédula: así las alertas que recibe tu comunidad son más confiables.'
                : 'Para reportar alertas, cada cuenta debe estar vinculada a una cédula. Así las alertas que recibe tu comunidad son más confiables.'}
            </p>
          </div>

          <ul className="bg-gray-50 rounded-lg p-5 space-y-4">
            <li className="flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-gray-700"><strong>Una cédula, una cuenta.</strong> Evita cuentas falsas y reportes malintencionados.</p>
            </li>
            <li className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-gray-700"><strong>Tus datos están protegidos.</strong> Viajan y se guardan cifrados; tu número de cédula nunca se almacena en texto plano.</p>
            </li>
            <li className="flex items-start gap-3">
              <EyeOff className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-gray-700"><strong>Nadie más la ve.</strong> Otros usuarios nunca verán tu cédula; solo el equipo de verificación puede revisarla.</p>
            </li>
          </ul>

          <div className="border border-gray-200 rounded-lg p-4 flex items-start gap-3">
            <Sun className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" aria-hidden />
            <p className="text-sm text-gray-700">
              Te pediremos una foto de <strong>cada lado</strong>. Busca buena luz, apóyala sobre una superficie oscura y evita reflejos. Toma menos de un minuto.
            </p>
          </div>

          <AuthCheckbox
            checked={autoriza}
            onChange={(v) => { setAutoriza(v); setError(undefined); }}
            error={error}
            label={
              <span>
                Autorizo el tratamiento de mis datos de identificación para verificar mi identidad y prevenir
                alertas falsas, conforme a la Ley 1581 de 2012 y la <span className="text-blue-600">Política de Privacidad</span>.
              </span>
            }
          />

          <div className="space-y-3">
            <Button onClick={continuar} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Escanear mi cédula
            </Button>
            {onAhoraNo && (
              <Button onClick={onAhoraNo} variant="outline" size="lg" className="w-full">
                Ahora no
              </Button>
            )}
          </div>
          {onAhoraNo && (
            <p className="text-xs text-gray-500 text-center">
              Sin verificar podrás ver el mapa, pero no reportar alertas. En una emergencia llama siempre a la Línea 123.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
