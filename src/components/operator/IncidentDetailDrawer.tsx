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
import { toast } from 'sonner';

interface IncidentDetailDrawerProps {
  incident:        Incident;
  units:           Unit[];
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
  const [selectedUnit,  setSelectedUnit]  = useState(incident.unitName ?? '');
  const [note,          setNote]          = useState('');
  const [msgTemplate,   setMsgTemplate]   = useState('');
  const [assigning,     setAssigning]     = useState(false);
  const [updating,      setUpdating]      = useState(false);
  const [timeline,      setTimeline]      = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  // Plantillas de mensaje
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
    if (!selectedUnit) return;
    setAssigning(true);

    const unit = units.find(u => u.name === selectedUnit);

    const { error } = await assignUnitToIncident(
      incident.id,
      selectedUnit,
      unit?.type ?? 'Policía',
      unit?.eta,
    );

    if (error) {
      toast.error('Error al asignar unidad', { description: error });
    } else {
      onIncidentUpdate(incident.id, {
        unitName: selectedUnit,
        unitType: unit?.type,
        status:   incident.status === 'open' ? 'ack' : incident.status,
      });
      toast.success(`Unidad ${selectedUnit} asignada${unit?.eta ? ` · ETA ${unit.eta} min` : ''}`);
    }
    setAssigning(false);
  };

  // ── Actualizar estado ─────────────────────────────────────────
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

  const handleSendMessage = () => {
    if (!msgTemplate) return;
    toast.success('Mensaje enviado al ciudadano');
    setMsgTemplate('');
  };

  const isClosed = incident.status === 'resolved';
  const mapsUrl  = `https://www.google.com/maps?q=${incident.lat},${incident.lng}`;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl flex flex-col" style={{ zIndex: 9999 }}>

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

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
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
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

            {/* Asignar unidad */}
            <div>
              <Label className="mb-2 block text-sm font-semibold">
                <Shield className="w-4 h-4 inline mr-1.5 text-blue-600" />
                Asignar unidad
              </Label>
              <div className="flex gap-2">
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar unidad..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem
                        key={unit.id}
                        value={unit.name}
                        disabled={unit.status === 'Ocupada'}
                      >
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{unit.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {unit.status === 'Disponible' ? '✓' : unit.status}
                            {unit.eta ? ` · ETA ${unit.eta} min` : ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAssign} disabled={!selectedUnit || assigning}>
                  {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Asignar'}
                </Button>
              </div>
            </div>

            {/* Enviar mensaje */}
            <div>
              <Label className="mb-2 block text-sm font-semibold">
                <Send className="w-4 h-4 inline mr-1.5 text-green-600" />
                Enviar mensaje al ciudadano
              </Label>
              <div className="space-y-2">
                <Select value={msgTemplate} onValueChange={setMsgTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MSG_TEMPLATES.map((t, i) => (
                      <SelectItem key={i} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSendMessage}
                  disabled={!msgTemplate}
                  variant="outline"
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
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
  );
}
