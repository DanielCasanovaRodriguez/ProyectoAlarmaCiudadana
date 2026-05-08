import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, RefreshCw, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState } from '../../admin/EmptyState';
import { getAdminAlerts } from '../../../services/adminService';
import type { AdminAlert } from '../../../services/adminService';
import { getAlertTypeLabel } from '../../../services/alertService';
import { AlertViewDialog } from '../../admin/AlertViewDialog';

interface AdminAlertsScreenProps {
  accessToken: string;
}

// Status badge con los valores reales del enum
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  open:     { label: 'Abierta',     variant: 'destructive' },
  ack:      { label: 'Reconocida',  variant: 'default'     },
  resolved: { label: 'Resuelta',    variant: 'secondary'   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AdminAlertsScreen({ accessToken }: AdminAlertsScreenProps) {
  const [loading,         setLoading]         = useState(true);
  const [alerts,          setAlerts]          = useState<AdminAlert[]>([]);
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [typeFilter,      setTypeFilter]      = useState('all');
  const [viewingAlert,    setViewingAlert]    = useState<AdminAlert | null>(null);
  const [copiedId,        setCopiedId]        = useState<string | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    const { data, error } = await getAdminAlerts(accessToken, {
      status: statusFilter !== 'all' ? statusFilter : undefined,
      type:   typeFilter   !== 'all' ? typeFilter   : undefined,
    });

    if (data) setAlerts(data);
    else console.error('Error cargando alertas:', error);
    setLoading(false);
  };

  useEffect(() => { loadAlerts(); }, [accessToken, statusFilter, typeFilter]);

  // Polling cada 15 s
  useEffect(() => {
    const id = setInterval(loadAlerts, 15_000);
    return () => clearInterval(id);
  }, [accessToken, statusFilter, typeFilter]);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Gestión de Alertas
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="outline">{alerts.length} alertas</Badge>
              <Button variant="outline" size="sm" onClick={loadAlerts} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filtros — valores reales del enum */}
          <div className="flex flex-wrap gap-4 mb-6">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="open">Abierta</SelectItem>
                <SelectItem value="ack">Reconocida</SelectItem>
                <SelectItem value="resolved">Resuelta</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="medical">Médica</SelectItem>
                <SelectItem value="robbery">Robo</SelectItem>
                <SelectItem value="accident">Accidente</SelectItem>
                <SelectItem value="fire">Incendio</SelectItem>
                <SelectItem value="violence">Violencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : alerts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Creada</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map(alert => (
                    <TableRow key={alert.id}>
                      {/* ID con botón de copiar */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 group">
                          <span className="font-mono text-xs text-gray-500">
                            {alert.id.slice(0, 8)}…
                          </span>
                          <button
                            onClick={() => copyId(alert.id)}
                            title="Copiar ID completo"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100"
                          >
                            {copiedId === alert.id
                              ? <Check className="w-3 h-3 text-green-600" />
                              : <Copy className="w-3 h-3 text-gray-400" />}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>{getAlertTypeLabel(alert.type)}</TableCell>
                      <TableCell><StatusBadge status={alert.status} /></TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-gray-600">
                        {alert.description || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-mono">
                        {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(alert.createdAt)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setViewingAlert(alert)} title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title="Sin alertas"
              description="No hay alertas que coincidan con los filtros seleccionados"
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AlertViewDialog
        open={viewingAlert !== null}
        onOpenChange={open => !open && setViewingAlert(null)}
        alert={viewingAlert}
      />
    </div>
  );
}
