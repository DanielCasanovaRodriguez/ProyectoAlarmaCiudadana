import { useEffect, useState } from 'react';
import { ArrowLeft, Scale, Send, Clock, CheckCircle2, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  crearSolicitud, misSolicitudes, TIPOS_SOLICITUD, ESTADOS_SOLICITUD,
  type SolicitudTitular, type TipoSolicitud,
} from '../../services/legalService';
import { toUserMessage } from '../../utils/errors';
import { toast } from 'sonner';

const fecha = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  .toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Habeas data: el titular consulta, corrige, suprime o revoca, y ve el
 * estado y la respuesta de sus solicitudes (Ley 1581 de 2012, arts. 8, 14 y 15).
 */
export function MisDerechosScreen({ onBack, onVerPolitica }: { onBack: () => void; onVerPolitica: () => void }) {
  const [tipo, setTipo] = useState<TipoSolicitud>('consulta');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [lista, setLista] = useState<SolicitudTitular[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const cargar = async () => {
    setErrorLista(null);
    try { setLista(await misSolicitudes()); }
    catch (e) { setErrorLista(toUserMessage(e, 'No se pudieron cargar tus solicitudes.')); setLista([]); }
  };
  useEffect(() => { cargar(); }, []);

  const enviar = async () => {
    const texto = mensaje.trim();
    if (texto.length < 10) { setError('Describe tu solicitud (mínimo 10 caracteres).'); return; }
    setEnviando(true); setError(null);
    try {
      const r = await crearSolicitud(tipo, texto);
      toast.success('Solicitud enviada', { description: `Te responderemos a más tardar el ${fecha(r.fecha_limite)}.` });
      setMensaje('');
      await cargar();
    } catch (e) {
      setError(toUserMessage(e, 'No se pudo enviar tu solicitud.'));
    } finally {
      setEnviando(false);
    }
  };

  const ayuda = TIPOS_SOLICITUD.find(t => t.valor === tipo)?.ayuda;

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">Mis datos y derechos</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-3">
            <Scale className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden />
            <div className="text-sm text-gray-700 space-y-1">
              <p>Como titular puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar tu autorización
                (Ley 1581 de 2012). Las consultas se responden en máximo <strong>10 días hábiles</strong> y los reclamos
                en máximo <strong>15 días hábiles</strong>.</p>
              <button onClick={onVerPolitica} className="text-blue-600 underline underline-offset-2">
                Ver la Política de Tratamiento de Datos
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Nueva solicitud</h2>
            <label className="block text-sm text-gray-700" htmlFor="tipo-solicitud">¿Qué necesitas?</label>
            <select
              id="tipo-solicitud"
              value={tipo}
              onChange={e => setTipo(e.target.value as TipoSolicitud)}
              className="w-full p-2.5 border border-gray-300 rounded-md text-sm bg-white"
            >
              {TIPOS_SOLICITUD.map(t => <option key={t.valor} value={t.valor}>{t.titulo}</option>)}
            </select>
            {ayuda && <p className="text-xs text-gray-500">{ayuda}</p>}
            <Textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value.slice(0, 2000))}
              placeholder="Cuéntanos tu solicitud. No escribas contraseñas."
              rows={4}
              aria-label="Detalle de la solicitud"
            />
            <p className="text-xs text-gray-400 text-right">{mensaje.length}/2000</p>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" aria-hidden />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            <Button onClick={enviar} disabled={enviando} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </Button>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Mis solicitudes</h2>
            {lista === null && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>}
            {errorLista && <p className="text-sm text-red-700">{errorLista}</p>}
            {lista?.length === 0 && !errorLista && <p className="text-sm text-gray-500">Aún no has enviado solicitudes.</p>}
            {lista?.map(s => {
              const abierta = s.estado === 'recibida' || s.estado === 'en_tramite';
              return (
                <div key={s.id} className="border border-gray-200 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-gray-400" aria-hidden />
                      {TIPOS_SOLICITUD.find(t => t.valor === s.tipo)?.titulo ?? s.tipo}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${abierta ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                      {ESTADOS_SOLICITUD[s.estado]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">{s.mensaje}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {abierta ? <Clock className="w-3.5 h-3.5" aria-hidden /> : <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />}
                    Enviada el {fecha(s.creada_en)}{abierta ? ` · respuesta a más tardar el ${fecha(s.fecha_limite)}` : ''}
                  </p>
                  {s.respuesta && (
                    <div className="bg-blue-50 rounded-md p-2 text-xs text-blue-900 whitespace-pre-wrap break-words">
                      <strong>Respuesta:</strong> {s.respuesta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 text-center px-2">
            Si no recibes respuesta en los plazos legales, puedes acudir a la Superintendencia de Industria y Comercio (SIC).
          </p>
        </div>
      </div>
    </div>
  );
}
