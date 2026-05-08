import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Users, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { KPICard } from '../../admin/KPICard';
import { EmptyState } from '../../admin/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Skeleton } from '../../ui/skeleton';
import { getDashboardKPIs } from '../../../services/adminService';
import type { DashboardKPIs, TimeSeriesPoint, AdminAlert } from '../../../services/adminService';
import { getAlertTypeLabel } from '../../../services/alertService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AdminOverviewScreenProps {
  accessToken: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  open:     { label: 'Abierta',    variant: 'destructive' },
  ack:      { label: 'Reconocida', variant: 'default'     },
  resolved: { label: 'Resuelta',   variant: 'secondary'   },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AdminOverviewScreen({ accessToken }: AdminOverviewScreenProps) {
  const [loading,       setLoading]       = useState(true);
  const [kpis,          setKpis]          = useState<DashboardKPIs | null>(null);
  const [timeSeries,    setTimeSeries]    = useState<TimeSeriesPoint[]>([]);
  const [recentAlerts,  setRecentAlerts]  = useState<AdminAlert[]>([]);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await getDashboardKPIs(accessToken);
    if (data) {
      setKpis(data.kpis);
      setTimeSeries(data.timeSeries);
      setRecentAlerts(data.recentAlerts);
    } else {
      console.error('Error cargando dashboard:', error);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [accessToken]);

  // Polling cada 15 s
  useEffect(() => {
    const id = setInterval(loadData, 15_000);
    return () => clearInterval(id);
  }, [accessToken]);

  return (
    <div className="p-6 space-y-6">

      {/* KPI Cards — row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Alertas Hoy"         value={kpis?.alertsToday     ?? 0} icon={AlertTriangle}  iconColor="text-red-600"    loading={loading} />
        <KPICard title="Abiertas (7 días)"   value={kpis?.openAlerts      ?? 0} icon={XCircle}        iconColor="text-orange-600" loading={loading} />
        <KPICard title="Resueltas (7 días)"  value={kpis?.resolvedAlerts  ?? 0} icon={CheckCircle2}   iconColor="text-green-600"  loading={loading} />
        <KPICard title="Operadores Activos"  value={kpis?.activeOperators ?? 0} icon={Users}          iconColor="text-blue-600"   loading={loading} />
      </div>

      {/* KPI Cards — row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          title="Tiempo Medio Resolución"
          value={kpis?.avgResolutionTime ? `${kpis.avgResolutionTime} min` : '—'}
          icon={Clock}
          iconColor="text-purple-600"
          loading={loading}
        />
        <KPICard
          title="Tipos de alerta hoy"
          value={kpis?.alertsByType
            ? Object.values(kpis.alertsByType).reduce((s, v) => s + v, 0)
            : 0}
          icon={Activity}
          iconColor="text-indigo-600"
          loading={loading}
        />
      </div>

      {/* Gráfico de tendencia */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Alertas (Últimos 30 Días)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={v => new Date(v).toLocaleDateString('es-CO')}
                />
                <Legend />
                <Line type="monotone" dataKey="total"    stroke="#dc2626" strokeWidth={2} name="Total"     dot={false} />
                <Line type="monotone" dataKey="open"     stroke="#ea580c" strokeWidth={2} name="Abiertas"  dot={false} />
                <Line type="monotone" dataKey="resolved" stroke="#16a34a" strokeWidth={2} name="Resueltas" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Activity} title="Sin datos" description="No hay alertas en los últimos 30 días" />
          )}
        </CardContent>
      </Card>

      {/* Alertas por tipo hoy */}
      {!loading && kpis?.alertsByType && Object.keys(kpis.alertsByType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas por Tipo (Hoy)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(kpis.alertsByType).map(([type, count]) => (
                <div key={type} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <p className="text-3xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 mt-1">{getAlertTypeLabel(type)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimas 10 alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas 10 Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : recentAlerts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Fecha/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAlerts.map(alert => {
                    const sc = STATUS_CONFIG[alert.status] ?? { label: alert.status, variant: 'outline' as const };
                    return (
                      <TableRow key={alert.id}>
                        <TableCell className="font-mono text-xs text-gray-500">
                          {alert.id.slice(0, 8)}…
                        </TableCell>
                        <TableCell>{getAlertTypeLabel(alert.type)}</TableCell>
                        <TableCell>
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 font-mono">
                          {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(alert.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState icon={AlertTriangle} title="Sin alertas" description="No hay alertas recientes" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
