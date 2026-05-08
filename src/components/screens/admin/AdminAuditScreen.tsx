import { useEffect, useState } from 'react';
import { ScrollText, Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState } from '../../admin/EmptyState';
import { getAuditLog, downloadCSV } from '../../../services/adminService';
import type { AuditEntry } from '../../../services/adminService';

interface AdminAuditScreenProps {
  accessToken: string;
}

const ACTION_COLORS: Record<string, string> = {
  create:             'bg-green-100 text-green-800',
  insert:             'bg-green-100 text-green-800',
  update:             'bg-blue-100 text-blue-800',
  update_user:        'bg-blue-100 text-blue-800',
  update_alert_status:'bg-blue-100 text-blue-800',
  delete:             'bg-red-100 text-red-800',
  login:              'bg-gray-100 text-gray-800',
  logout:             'bg-gray-100 text-gray-800',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  try {
    return Object.entries(details)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(' | ');
  } catch {
    return JSON.stringify(details);
  }
}

export function AdminAuditScreen({ accessToken }: AdminAuditScreenProps) {
  const [loading,       setLoading]       = useState(true);
  const [auditLogs,     setAuditLogs]     = useState<AuditEntry[]>([]);
  const [actionFilter,  setActionFilter]  = useState('all');
  const [entityFilter,  setEntityFilter]  = useState('all');

  const loadAuditLog = async () => {
    setLoading(true);
    const { data, error } = await getAuditLog(accessToken, {
      action: actionFilter !== 'all' ? actionFilter : undefined,
      entity: entityFilter !== 'all' ? entityFilter : undefined,
    });

    if (data) setAuditLogs(data);
    else console.error('Error cargando auditoría:', error);
    setLoading(false);
  };

  useEffect(() => { loadAuditLog(); }, [accessToken, actionFilter, entityFilter]);

  const handleDownloadCSV = () => {
    const csvData = auditLogs.map(log => ({
      Fecha:    formatDate(log.timestamp),
      Usuario:  log.userEmail ?? log.userId ?? 'Sistema',
      Accion:   log.action,
      Entidad:  log.entity,
      EntidadID:log.entityId ?? '',
      Detalles: formatDetails(log.details),
      IP:       log.ipOrigen ?? '',
    }));
    downloadCSV(csvData, 'auditoria-alertaciudadana');
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              Bitácora de Auditoría
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{auditLogs.length} registros</Badge>
              <Button variant="outline" size="sm" onClick={loadAuditLog} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadCSV} disabled={auditLogs.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros — usan los valores reales de la BD */}
          <div className="flex flex-wrap gap-4 mb-6">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="create">Crear</SelectItem>
                <SelectItem value="update">Actualizar</SelectItem>
                <SelectItem value="delete">Eliminar</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                <SelectItem value="alerts">Alertas</SelectItem>
                <SelectItem value="profiles">Perfiles</SelectItem>
                <SelectItem value="alert_types">Tipos de alerta</SelectItem>
                <SelectItem value="emergency_contacts">Contactos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : auditLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log, idx) => (
                    <TableRow key={`${log.id}-${idx}`}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">
                        {log.userEmail ?? log.userId ?? 'Sistema'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-800'}
                          variant="outline"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.entity}</TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-xs truncate">
                        {formatDetails(log.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={ScrollText}
              title="Sin registros"
              description="No hay registros de auditoría con los filtros aplicados"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
