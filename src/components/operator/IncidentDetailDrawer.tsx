import React, { useState, useEffect } from 'react';
import {
  X, Clock, MapPin, User, Send, CheckCircle2,
  AlertTriangle, Loader2, Shield, Zap
} from 'lucide-react';
import { Button }   from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { StatusBadge } from './StatusBadge';
import { SeverityChip } from './SeverityChip';
import { Separator }    from '../ui/separator';
import { Label }        from '../ui/label';
import { Badge }        from '../ui/badge';
import type { Incident, Unit, TimelineEntry } from './types';
import { STATUS_LABELS } from './types';
import {
  updateIncidentStatus,
  assignUnitToIncident,
  getIncidentTimeline,
} from '../../services/incidentService';
import { useSignedMediaUrls } from '../../hooks/useSignedMediaUrls';
import { marcarAlertaFalsa, enviarMensajeCiudadano } from '../../services/incidentService';
import { Input } from '../ui/input';
import { toast } from 'sonner';

interface IncidentDetailDrawerProps {
  incident:        Incident;
  /** (Ya no se usa: las unidades se registran a mano.) */
  units?:          Unit[];
  onClose:         () => void;
  onIncidentUpdate:(incidentId: string, patch: Partial<Incident>) => void;
}

const STATUS_ORDER: Record<string, number> = { open: 0, ack: 1, resolved: 2 };

export function IncidentDetailDrawer({
  incident,
  units,
  onClose,
  onIncidentUpdate,
}: IncidentDetailDrawerProps) {
  const signedMedia = useSignedMediaUrls(incident?.mediaUrls);
  const [tipoUnidad,    setTipoUnidad]    = useState(incident.unitType ?? 'Policía');
  const [nombreUnidad,  setNombreUnidad]  = useState('');
  const [etaUnidad,     setEtaUnidad]     = useState('');
  const [note,          setNote]          = useState('');
  const [mensaje,       setMensaje]       = useState('');
  const [enviando,      setEnviando]      = useState(false);
  const [assigning,     setAssigning]     = useState(false);
  const [updating,      setUpdating]      = useState(false);
  const [timeline,      setTimeline]      = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  const TIPOS_UNIDAD = ['Policía', 'Ambulancia', 'Bomberos', 'Defensa Civil', 'Tránsito', 'Otra'];

  // Plantillas de mensaje (se pueden editar antes de enviar)
  const MSG_TEMPLATES = [
    'La unidad va en camino. Permanece a salvo.',
    'Ayuda en camino. Mantente en el lugar si es seguro.',
    'Personal de emergencia llegará en breve.',
    'Gracias por reportar. Estamos atendiendo tu alerta.',
  ];

  // ── Cargar línea de tiempo desde alert_status_history ─────────
  useEffect(() => {
    setTimelineLoading(true);
    getIncidentTimeline(incident.id).then(({ data, error }) => {
      if (error) {
        console.warn('Error cargando timeline:', error);
        // Fallback: mostrar al menos el estado inicial de la alerta
        setTimeline([{
          id:        0,
          oldStatus: null,
          newStatus: 'open',
          note:      'Alerta recibida desde la aplicación',
          changedAt: incident.createdAt,
          changedBy: null,
        }]);
      } else {
        // Si no hay entradas, mostrar el estado inicial
        if (!data || data.length === 0) {
          setTimeline([{
            id:        0,
            oldStatus: null,
            newStatus: 'open',
            note:      'Alerta recibida desde la aplicación',
            changedAt: incident.createdAt,
            changedBy: null,
          }]);
        } else {
          setTimeline(data);
        }
      }
      setTimelineLoading(false);
    });
  }, [incident.id]);

  // ── Asignar unidad ────────────────────────────────────────────
  const handleAssign = async () => {
    const nombre = nombreUnidad.trim();
    if (!nombre) { toast.error('Escribe qué unidad se envió (p. ej. "Patrulla CAI Kennedy 34")'); return; }
    const eta = etaUnidad ? Math.min(240, Math.max(1, parseInt(etaUnidad, 10) || 0)) : undefined;
    setAssigning(true);
    const { error } = await assignUnitToIncident(incident.id, nombre, tipoUnidad, eta);
    if (error) {
      toast.error('No se pudo registrar la unidad', { description: error });
      setAssigning(false);
      return;
    }
    // Si estaba "Recibida", pasa a "En atención" también en la BD
    let nuevoEstado = incident.status;
    if (incident.status === 'open') {
      const r = await updateIncidentStatus(incident.id, 'ack', 'open', `Unidad enviada: ${tipoUnidad} · ${nombre}`);
      if (!r.error) nuevoEstado = 'ack';
    }
    onIncidentUpdate(incident.id, { unitName: nombre, unitType: tipoUnidad, status: nuevoEstado });
    toast.success(`${tipoUnidad} · ${nombre} registrada${eta ? ` · llega en ~${eta} min` : ''}`);
    setNombreUnidad('');
    setEtaUnidad('');
    setAssigning(false);
  };

  // ── Actualizar estado ─────────────────────────────────────────
  const [confirmarFalsa, setConfirmarFalsa] = useState(false);

  const handleMarcarFalsa = async () => {
    if (updating) return;
    setUpdating(true);
    const { error } = await marcarAlertaFalsa(incident.id, note.trim() || 'Reporte falso');
    setUpdating(false);
    setConfirmarFalsa(false);
    if (error) { toast.error('No se pudo marcar como falsa', { description: error }); return; }
    toast.success('Alerta marcada como falsa', { description: 'Se cerró y quedó registrada en el historial del ciudadano.' });
    onIncidentUpdate(incident.id, { status: 'resolved' });
  };

  const handleUpdateStatus = async (newStatus: 'ack' | 'resolved') => {
    if (updating) return;
    setUpdating(true);

    const { error } = await updateIncidentStatus(
      incident.id,
      newStatus,
      incident.status,
      note.trim() || undefined,
    );

    if (error) {
      toast.error('Error al actualizar estado', { description: error });
      setUpdating(false);
      return;
    }

    // Actualizar timeline local
    setTimeline(prev => [...prev, {
      id:        Date.now(),
      oldStatus: incident.status,
      newStatus,
      note:      note.trim() || null,
      changedAt: new Date().toISOString(),
      changedBy: null,
    }]);

    onIncidentUpdate(incident.id, { status: newStatus });
    setNote('');
    toast.success(`Estado → ${STATUS_LABELS[newStatus]}`);
    setUpdating(false);
  };

  const handleSendMessage = async () => {
    const texto = mensaje.trim();
    if (texto.length < 3) return;
    setEnviando(true);
    const { error, push } = await enviarMensajeCiudadano(incident.id, texto);
    setEnviando(false);
    if (error) { toast.error('No se pudo enviar el mensaje', { description: error }); return; }
    toast.success('Mensaje enviado al ciudadano', {
      description: push ? 'Le llega como notificación y lo ve en el detalle de su alerta.' : 'Lo verá en el detalle de su alerta.',
    });
    setMensaje('');
  };


  const isClosed = incident.status === 'resolved';
  const mapsUrl  = `https://www.google.com/maps?q=${incident.lat},${incident.lng}`;

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
    {/* Fondo: toca fuera para cerrar (z-40: las listas y diálogos usan z-50 y quedan encima) */}
    <div className="fixed inset-0 bg-black/30 z-40 hidden md:block" onClick={onClose} aria-hidden />
    <div className="fixed inset-y-0 right-0 w-full md:w-[560px] bg-white shadow-2xl flex flex-col z-40" role="dialog" aria-label="Detalle del incidente"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Detalle del Incidente</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5 break-all">{incident.id}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-shrink-0 ml-2">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Contenido scroll */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">

        {/* Estado y severidad */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge  status={incident.status}   />
          <SeverityChip severity={incident.severity} />
          {incident.slaMinutesLeft < 10 && !isClosed && (
            <Badge className="bg-red-100 text-red-700 border-red-200 border animate-pulse">
              ⏱ {incident.slaMinutesLeft} min SLA
            </Badge>
          )}
        </div>

        {/* Información básica */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Tipo</p>
            <p className="text-gray-900 font-medium">{incident.typeLabel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Hora</p>
            <div className="flex items-center gap-1 text-gray-900">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {incident.time}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Fuente</p>
            <div className="flex items-center gap-1 text-gray-900">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {incident.source}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Unidad asignada</p>
            <p className="text-gray-900">{incident.unitName ?? '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Ubicación</p>
            <div className="flex items-start gap-1">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-gray-900 font-mono text-xs">{incident.location}</p>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-blue-600 hover:underline">
                  Ver en Google Maps →
                </a>
              </div>
            </div>
          </div>
          {incident.description && incident.description !== 'Sin descripción' && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Descripción</p>
              <p className="text-gray-700 text-sm leading-relaxed">{incident.description}</p>
            </div>
          )}
          {incident.mediaUrls.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Evidencias ({incident.mediaUrls.length})</p>
              <div className="flex gap-2 flex-wrap">
                {incident.mediaUrls.map((url, i) => (
                  <a key={i} href={signedMedia[i] ?? '#'} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-blue-600 underline truncate max-w-[200px]">
                    Archivo {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Línea de tiempo */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Línea de tiempo</h3>
          {timelineLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando historial...
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((entry, idx) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${
                      idx === timeline.length - 1 ? 'bg-blue-600' : 'bg-gray-300'
                    }`} />
                    {idx < timeline.length - 1 && (
                      <div className="w-px flex-1 bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <StatusBadge status={entry.newStatus} className="text-xs" />
                      <span className="text-xs text-gray-400">
                        {new Date(entry.changedAt).toLocaleString('es-CO', {
                          day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-xs text-gray-600 mt-0.5">{entry.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isClosed && (
          <>
            <Separator />

            {/* Unidad enviada */}
            <div>
              <Label className="mb-2 block text-sm font-semibold">
                <Shield className="w-4 h-4 inline mr-1.5 text-blue-600" />
                Registrar unidad enviada
              </Label>
              {incident.unitName && (
                <p className="text-xs text-gray-600 mb-2">Última registrada: <strong>{incident.unitType ? `${incident.unitType} · ` : ''}{incident.unitName}</strong></p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-2">
                <Select value={tipoUnidad} onValueChange={setTipoUnidad}>
                  <SelectTrigger aria-label="Tipo de unidad"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_UNIDAD.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={nombreUnidad} onChange={e => setNombreUnidad(e.target.value.slice(0, 60))}
                  placeholder="Ej.: Patrulla CAI Kennedy 34" aria-label="Unidad enviada" className="text-base sm:text-sm" />
              </div>
              <div className="flex gap-2 mt-2">
                <Input value={etaUnidad} onChange={e => setEtaUnidad(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric" placeholder="Llega en (min)" aria-label="Minutos estimados de llegada" className="w-36 text-base sm:text-sm" />
                <Button onClick={handleAssign} disabled={!nombreUnidad.trim() || assigning} className="flex-1">
                  {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
                </Button>
              </div>
            </div>

            {/* Mensaje al ciudadano */}
            <div>
              <Label className="mb-2 block text-sm font-semibold">
                <Send className="w-4 h-4 inline mr-1.5 text-green-600" />
                Mensaje al ciudadano
              </Label>
              <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
                {MSG_TEMPLATES.map(t => (
                  <button key={t} type="button" onClick={() => setMensaje(t)}
                    className="flex-shrink-0 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-3 py-1.5 whitespace-nowrap">
                    {t.length > 34 ? t.slice(0, 32) + '…' : t}
                  </button>
                ))}
              </div>
              <Textarea value={mensaje} onChange={e => setMensaje(e.target.value.slice(0, 300))} rows={2}
                placeholder="Escribe o elige un mensaje" aria-label="Mensaje al ciudadano" className="text-base sm:text-sm" />
              <div className="flex items-center justify-between mt-2 gap-2">
                <span className="text-xs text-gray-400">{mensaje.length}/300 · le llega como notificación</span>
                <Button onClick={handleSendMessage} disabled={mensaje.trim().length < 3 || enviando} variant="outline">
                  {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Enviar
                </Button>
              </div>
            </div>

            <Separator />

            {/* Actualizar estado */}
            <div>
              <Label className="mb-2 block text-sm font-semibold">
                <Zap className="w-4 h-4 inline mr-1.5 text-yellow-500" />
                Actualizar estado
              </Label>
              <Textarea
                placeholder="Nota adicional (opcional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                className="mb-3"
              />
              <div className="flex gap-2">
                {incident.status === 'open' && (
                  <Button
                    onClick={() => handleUpdateStatus('ack')}
                    disabled={updating}
                    variant="outline"
                    className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Atender
                  </Button>
                )}
                <Button
                  onClick={() => handleUpdateStatus('resolved')}
                  disabled={updating}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Resolver caso
                </Button>
              </div>

              {/* Reporte de broma: requiere confirmación */}
              {!confirmarFalsa ? (
                <button
                  type="button"
                  onClick={() => setConfirmarFalsa(true)}
                  disabled={updating}
                  className="mt-3 w-full text-sm text-red-700 hover:underline"
                >
                  Marcar como alerta falsa
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 space-y-2" role="alert">
                  <p className="text-xs text-red-800">
                    Se cerrará la alerta y contará en el historial del ciudadano. Con 3 alertas falsas en 30 días
                    sus reportes quedan suspendidos 7 días. Usa la nota para explicar el motivo.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmarFalsa(false)} disabled={updating}>Cancelar</Button>
                    <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleMarcarFalsa} disabled={updating}>
                      {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar: es falsa'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {isClosed && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-800">Incidente resuelto</p>
            <p className="text-xs text-green-600 mt-0.5">Este caso ha sido cerrado exitosamente</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
