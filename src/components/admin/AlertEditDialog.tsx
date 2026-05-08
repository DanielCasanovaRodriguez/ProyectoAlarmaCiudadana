import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createAdminAlert, updateAdminAlert } from '../../services/adminService';
import type { AlertStatus } from '../../types/database.types';

interface AlertEditDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  alert:         any | null;
  accessToken:   string;
  onSuccess:     () => void;
}

export function AlertEditDialog({ open, onOpenChange, alert, onSuccess }: AlertEditDialogProps) {
  const [typeCode,     setTypeCode]     = useState('medical');
  const [status,       setStatus]       = useState<AlertStatus>('open');
  const [description,  setDescription]  = useState('');
  const [latitude,     setLatitude]     = useState('');
  const [longitude,    setLongitude]    = useState('');
  const [severity,     setSeverity]     = useState('3');
  const [saving,       setSaving]       = useState(false);

  // Cargar datos de la alerta al abrir
  useEffect(() => {
    if (alert) {
      setTypeCode(alert.type     ?? 'medical');
      setStatus(  alert.status   ?? 'open');
      setDescription(alert.description ?? '');
      setLatitude(String(alert.latitude  ?? '4.6097'));
      setLongitude(String(alert.longitude ?? '-74.0817'));
      setSeverity(String(alert.severity  ?? 3));
    } else {
      setTypeCode('medical');
      setStatus('open');
      setDescription('');
      setLatitude('4.6097');
      setLongitude('-74.0817');
      setSeverity('3');
    }
  }, [alert, open]);

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error('La descripción es requerida');
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const sev = parseInt(severity);

    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Las coordenadas deben ser números válidos');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Las coordenadas están fuera de rango');
      return;
    }
    if (isNaN(sev) || sev < 1 || sev > 5) {
      toast.error('La severidad debe ser un número entre 1 y 5');
      return;
    }

    setSaving(true);

    if (alert) {
      // EDITAR alerta existente
      const { data, error } = await updateAdminAlert(alert.id, {
        type_code:   typeCode,
        status:      status,
        description: description.trim(),
        lat,
        lng,
        severity:    sev,
      });

      if (error) {
        toast.error('Error al actualizar alerta', { description: error });
      } else {
        toast.success('Alerta actualizada correctamente');
        onSuccess();
        onOpenChange(false);
      }
    } else {
      // CREAR nueva alerta
      const { data, error } = await createAdminAlert({
        type_code:   typeCode,
        status:      status,
        description: description.trim(),
        lat,
        lng,
        severity:    sev,
      });

      if (error) {
        toast.error('Error al crear alerta', { description: error });
      } else {
        toast.success('Alerta creada correctamente');
        onSuccess();
        onOpenChange(false);
      }
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{alert ? 'Editar Alerta' : 'Crear Nueva Alerta'}</DialogTitle>
          <DialogDescription>
            {alert
              ? `Modificar alerta ID: ${alert.id?.slice(0, 8)}...`
              : 'Completa los datos para registrar una nueva alerta'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo de Emergencia</Label>
            <Select value={typeCode} onValueChange={setTypeCode}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medical">Emergencia Médica</SelectItem>
                <SelectItem value="robbery">Robo / Asalto</SelectItem>
                <SelectItem value="accident">Accidente</SelectItem>
                <SelectItem value="fire">Incendio</SelectItem>
                <SelectItem value="violence">Violencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estado — valores del enum real: open, ack, resolved */}
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AlertStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Abierta</SelectItem>
                <SelectItem value="ack">Reconocida</SelectItem>
                <SelectItem value="resolved">Resuelta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe la emergencia..."
              rows={3}
            />
          </div>

          {/* Coordenadas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="latitude">Latitud</Label>
              <Input
                id="latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="4.6097"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="longitude">Longitud</Label>
              <Input
                id="longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="-74.0817"
              />
            </div>
          </div>

          {/* Severidad */}
          <div className="space-y-1.5">
            <Label htmlFor="severity">Severidad (1–5)</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Muy baja</SelectItem>
                <SelectItem value="2">2 — Baja</SelectItem>
                <SelectItem value="3">3 — Media</SelectItem>
                <SelectItem value="4">4 — Alta</SelectItem>
                <SelectItem value="5">5 — Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              : alert ? 'Guardar Cambios' : 'Crear Alerta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
