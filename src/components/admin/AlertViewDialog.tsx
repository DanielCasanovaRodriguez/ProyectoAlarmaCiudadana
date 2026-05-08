import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { MapPin, Clock, AlertTriangle, User } from 'lucide-react';
import { getAlertTypeLabel } from '../../services/alertService';

interface AlertViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: any | null;
}

export function AlertViewDialog({ open, onOpenChange, alert }: AlertViewDialogProps) {
  if (!alert) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline', label: string }> = {
      'active': { variant: 'destructive', label: 'Abierta' },
      'open': { variant: 'destructive', label: 'Abierta' },
      'in-progress': { variant: 'default', label: 'En Progreso' },
      'resolved': { variant: 'secondary', label: 'Resuelta' },
    };
    
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Detalles de la Alerta
          </DialogTitle>
          <DialogDescription>
            ID: {alert.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Type and Status */}
          <div className="flex gap-4">
            <div className="flex-1">
              <h4 className="text-sm text-gray-600 mb-2">Tipo de Emergencia</h4>
              <p className="text-base">{getAlertTypeLabel(alert.type)}</p>
            </div>
            <div className="flex-1">
              <h4 className="text-sm text-gray-600 mb-2">Estado</h4>
              {getStatusBadge(alert.status)}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm text-gray-600 mb-2">Descripción</h4>
            <p className="text-base bg-gray-50 p-3 rounded-md">
              {alert.description || 'Sin descripción'}
            </p>
          </div>

          {/* Location */}
          <div>
            <h4 className="text-sm text-gray-600 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Ubicación
            </h4>
            <div className="bg-gray-50 p-3 rounded-md space-y-1">
              <p className="text-sm">
                <span className="text-gray-600">Latitud:</span> {alert.latitude?.toFixed(6)}
              </p>
              <p className="text-sm">
                <span className="text-gray-600">Longitud:</span> {alert.longitude?.toFixed(6)}
              </p>
              <a
                href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline inline-block mt-1"
              >
                Ver en Google Maps →
              </a>
            </div>
          </div>

          {/* User Info */}
          {alert.userId && (
            <div>
              <h4 className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Usuario Reportante
              </h4>
              <p className="text-sm bg-gray-50 p-3 rounded-md">
                ID: {alert.userId}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Fecha de Creación
              </h4>
              <p className="text-sm bg-gray-50 p-3 rounded-md">
                {formatDate(alert.createdAt)}
              </p>
            </div>
            {alert.updatedAt && alert.updatedAt !== alert.createdAt && (
              <div>
                <h4 className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Última Actualización
                </h4>
                <p className="text-sm bg-gray-50 p-3 rounded-md">
                  {formatDate(alert.updatedAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
