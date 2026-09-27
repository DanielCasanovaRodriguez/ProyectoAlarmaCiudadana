import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, AlertTriangle, RotateCcw, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { capturarFotoDocumento } from '../../platform/camera';
import {
  leerReversoCedula, compararLectura, validarFotoDocumento,
  type CapturaIdentidad, type LecturaReverso,
} from '../../services/identityService';
import { enmascararCedula, validarNumeroCedula, soloDigitosCedula } from '../../utils/cedula';
import type { ResultadoComparacion } from '../../utils/cedula';
import { toUserMessage } from '../../utils/errors';

interface IdentityScanScreenProps {
  modo: 'registro' | 'completar';
  registro: { numero?: string; nombres: string; apellidos: string };
  onVolver: () => void;
  /** Solo en registro: volver al formulario para corregir nombre o número. */
  onCorregirDatos?: () => void;
  /** Envía la captura (registro: crea la cuenta; completar: registra la verificación). */
  onEnviar: (captura: CapturaIdentidad) => Promise<void>;
}

type Paso = 'frente' | 'reverso' | 'leyendo' | 'resultado';

function useUrlObjeto(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function MarcoCedula({ lado, url }: { lado: 'frente' | 'reverso'; url: string | null }) {
  return (
    <div className="relative w-full rounded-xl overflow-hidden border-2 border-dashed border-blue-300 bg-blue-50" style={{ aspectRatio: '85.6 / 54' }}>
      {url ? (
        <img src={url} alt={lado === 'frente' ? 'Frente de la cédula' : 'Reverso de la cédula'} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-blue-700 p-4 text-center">
          <Camera className="w-8 h-8" aria-hidden />
          <span className="text-sm font-medium">
            {lado === 'frente' ? 'Lado frontal (con tu foto)' : 'Lado de atrás (código de barras o texto inferior)'}
          </span>
          <span className="text-xs text-blue-600">Que se vean las 4 esquinas</span>
        </div>
      )}
    </div>
  );
}

export function IdentityScanScreen({ modo, registro, onVolver, onCorregirDatos, onEnviar }: IdentityScanScreenProps) {
  const [paso, setPaso] = useState<Paso>('frente');
  const [frente, setFrente] = useState<File | null>(null);
  const [reverso, setReverso] = useState<File | null>(null);
  const [lectura, setLectura] = useState<LecturaReverso | null>(null);
  const [comparacion, setComparacion] = useState<ResultadoComparacion | undefined>();
  const [numero, setNumero] = useState(registro.numero ?? '');
  const [progreso, setProgreso] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tomando, setTomando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const urlFrente = useUrlObjeto(frente);
  const urlReverso = useUrlObjeto(reverso);

  const tomar = async (lado: 'frente' | 'reverso') => {
    setError(null);
    setTomando(true);
    try {
      const foto = await capturarFotoDocumento(`cedula-${lado}`);
      if (!foto) return; // cancelado
      if (lado === 'frente') {
        await validarFotoDocumento(foto);
        setFrente(foto);
        return;
      }
      setReverso(foto);
      setPaso('leyendo');
      const l = await leerReversoCedula(foto, setProgreso);
      setLectura(l);
      if (l.datos && !numero) setNumero(l.datos.numero); // modo completar: se propone el leído
      setComparacion(compararLectura(l, { numero: numero || l.datos?.numero || '', ...registro }));
      setPaso('resultado');
    } catch (err) {
      setError(toUserMessage(err, 'No pudimos procesar la foto. Intenta de nuevo.'));
      if (lado === 'reverso') { setReverso(null); setPaso('reverso'); }
    } finally {
      setTomando(false);
      setProgreso('');
    }
  };

  const recalcular = (n: string) => {
    setNumero(n);
    if (lectura) setComparacion(compararLectura(lectura, { numero: n, ...registro }));
  };

  const enviar = async () => {
    const errNum = validarNumeroCedula(numero);
    if (errNum) { setError(errNum); return; }
    if (!frente || !reverso || !lectura) return;
    setError(null);
    setEnviando(true);
    try {
      await onEnviar({ numero: soloDigitosCedula(numero), frente, reverso, lectura, comparacion });
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo enviar la verificación. Intenta de nuevo.'));
    } finally {
      setEnviando(false);
    }
  };

  const todoCoincide = !!lectura?.datos && !!comparacion?.coincideNumero && !!comparacion?.coincideNombre;
  const numeroDocumento = lectura?.datos?.numero;

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onVolver} disabled={enviando} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">Escanear cédula</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-5">
          {/* Progreso */}
          <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Progreso">
            {(['Frente', 'Reverso', 'Confirmar'] as const).map((t, i) => {
              const actual = paso === 'frente' ? 0 : paso === 'reverso' || paso === 'leyendo' ? 1 : 2;
              return (
                <li key={t} className={`flex-1 text-center py-1.5 rounded-full ${i <= actual ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {i + 1}. {t}
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* PASO 1: FRENTE */}
          {paso === 'frente' && (
            <section className="space-y-4">
              <h2 className="text-gray-900">Foto del frente de tu cédula</h2>
              <MarcoCedula lado="frente" url={urlFrente} />
              {!frente ? (
                <Button onClick={() => tomar('frente')} disabled={tomando} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  {tomando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Tomar foto del frente
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => { setFrente(null); tomar('frente'); }} disabled={tomando}>
                    <RotateCcw className="w-4 h-4" /> Repetir
                  </Button>
                  <Button onClick={() => setPaso('reverso')} className="bg-blue-600 hover:bg-blue-700 text-white">Se ve bien</Button>
                </div>
              )}
              <p className="text-xs text-gray-500">Verifica que la foto esté nítida y que se lean tu nombre y número.</p>
            </section>
          )}

          {/* PASO 2: REVERSO */}
          {paso === 'reverso' && (
            <section className="space-y-4">
              <h2 className="text-gray-900">Ahora el lado de atrás</h2>
              <MarcoCedula lado="reverso" url={urlReverso} />
              <Button onClick={() => tomar('reverso')} disabled={tomando} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {tomando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Tomar foto del reverso
              </Button>
              <p className="text-xs text-gray-500">
                En la cédula amarilla, que se vea completo el código de barras. En la cédula digital, las tres líneas de texto de la parte inferior.
              </p>
              <button onClick={() => setPaso('frente')} className="text-sm text-blue-600">Volver a la foto del frente</button>
            </section>
          )}

          {/* LEYENDO */}
          {paso === 'leyendo' && (
            <section className="space-y-4 text-center" aria-live="polite">
              <MarcoCedula lado="reverso" url={urlReverso} />
              <div className="flex flex-col items-center gap-2 py-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" aria-hidden />
                <p className="text-gray-700">{progreso || 'Leyendo tu cédula…'}</p>
                <p className="text-xs text-gray-500">Esto se hace en tu dispositivo y puede tardar unos segundos.</p>
              </div>
            </section>
          )}

          {/* PASO 3: RESULTADO */}
          {paso === 'resultado' && lectura && (
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MarcoCedula lado="frente" url={urlFrente} />
                <MarcoCedula lado="reverso" url={urlReverso} />
              </div>

              {todoCoincide ? (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" aria-hidden />
                  <div className="text-sm text-green-900">
                    <p className="font-semibold">Leímos tu cédula correctamente</p>
                    <p>
                      {enmascararCedula(numeroDocumento!)} · {lectura.datos!.primerNombre} {lectura.datos!.primerApellido}
                    </p>
                  </div>
                </div>
              ) : lectura.datos ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden />
                    <div className="text-sm text-amber-900 space-y-1">
                      <p className="font-semibold">Algunos datos no coinciden</p>
                      {comparacion?.avisos.map(a => <p key={a}>{a}</p>)}
                      <p>
                        En el documento: {enmascararCedula(numeroDocumento!)} · {lectura.datos.primerNombre} {lectura.datos.primerApellido}
                      </p>
                    </div>
                  </div>
                  {!comparacion?.coincideNumero && numeroDocumento && (
                    <Button variant="outline" className="w-full" onClick={() => recalcular(numeroDocumento)}>
                      Usar el número del documento ({enmascararCedula(numeroDocumento)})
                    </Button>
                  )}
                  {modo === 'registro' && onCorregirDatos && (
                    <Button variant="outline" className="w-full" onClick={onCorregirDatos}>Corregir mis datos</Button>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden />
                  <div className="text-sm text-amber-900 space-y-1">
                    <p className="font-semibold">No pudimos leer tu cédula automáticamente</p>
                    <p>Puedes tomar otra foto con mejor luz y sin reflejos, o enviarla así: una persona del equipo de verificación la revisará.</p>
                  </div>
                </div>
              )}

              {/* Número: visible en "completar" o si hay que confirmarlo */}
              {(modo === 'completar' || !todoCoincide) && (
                <div>
                  <label htmlFor="numero-cedula" className="block text-sm font-medium text-gray-700 mb-1">Número de cédula</label>
                  <input
                    id="numero-cedula"
                    inputMode="numeric"
                    value={numero}
                    onChange={e => recalcular(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 outline-none focus:border-blue-500"
                    placeholder="1012345678"
                    maxLength={14}
                  />
                </div>
              )}

              <Button variant="outline" className="w-full" disabled={enviando || tomando}
                onClick={() => { setLectura(null); setReverso(null); setPaso('reverso'); }}>
                <RotateCcw className="w-4 h-4" /> Tomar otra foto del reverso
              </Button>

              <Button onClick={enviar} disabled={enviando} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {enviando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {modo === 'registro' ? 'Creando tu cuenta…' : 'Enviando…'}</>
                  : <><ShieldCheck className="w-4 h-4" /> {todoCoincide ? (modo === 'registro' ? 'Crear mi cuenta' : 'Enviar verificación') : 'Enviar para revisión'}</>}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Tus fotos se envían cifradas. Solo el equipo de verificación puede verlas.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
