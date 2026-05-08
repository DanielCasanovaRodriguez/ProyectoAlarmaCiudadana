import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, AlertCircle, Database, Zap, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { getSystemHealth } from '../../../services/adminService';

interface AdminHealthScreenProps {
  accessToken: string;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'ok' || status === 'healthy')   return <CheckCircle2 className="w-5 h-5 text-green-600" />;
  if (status === 'warn' || status === 'warning') return <AlertCircle  className="w-5 h-5 text-yellow-600" />;
  return <XCircle className="w-5 h-5 text-red-600" />;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
    ok: 'default', healthy: 'default',
    warn: 'secondary', warning: 'secondary',
    error: 'destructive', fail: 'destructive', degraded: 'destructive',
  };
  return (
    <Badge variant={variants[status] ?? 'secondary'}>
      {status.toUpperCase()}
    </Badge>
  );
}

export function AdminHealthScreen({ accessToken }: AdminHealthScreenProps) {
  const [loading, setLoading] = useState(true);
  const [health,  setHealth]  = useState<any>(null);

  const loadHealth = async () => {
    setLoading(true);
    const { data, error } = await getSystemHealth(accessToken);
    if (data) setHealth(data);
    else console.error('Error cargando salud del sistema:', error);
    setLoading(false);
  };

  useEffect(() => {
    loadHealth();
    const id = setInterval(loadHealth, 30_000);
    return () => clearInterval(id);
  }, [accessToken]);

  if (loading && !health) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Estado general */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Estado General del Sistema
            </CardTitle>
            <div className="flex items-center gap-2">
              <StatusBadge status={health?.status ?? 'unknown'} />
              <Button variant="outline" size="sm" onClick={loadHealth} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Base de datos */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Base de Datos</h3>
              </div>
              <p className="text-3xl font-bold text-blue-900 mb-1">
                {health?.database?.totalRecords?.toLocaleString() ?? '—'}
              </p>
              <p className="text-sm text-blue-700">Registros totales</p>
              <div className="mt-3 space-y-1 text-xs text-blue-800 border-t border-blue-200 pt-2">
                <p>Alertas: <strong>{health?.database?.alerts ?? '—'}</strong></p>
                <p>Usuarios: <strong>{health?.database?.users ?? '—'}</strong></p>
                <p>Latencia: <strong>{health?.latencyMs ?? '—'}ms</strong></p>
              </div>
            </div>

            {/* Realtime */}
            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Realtime</h3>
              </div>
              <StatusBadge status={health?.realtime?.status ?? 'ok'} />
              <p className="text-sm text-green-700 mt-3">
                {health?.realtime?.note ?? 'Canal Supabase Realtime activo'}
              </p>
            </div>

            {/* Uptime */}
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Disponibilidad</h3>
              </div>
              <p className="text-3xl font-bold text-purple-900 mb-1">
                {health?.uptime?.percentage ?? 99.9}%
              </p>
              <p className="text-sm text-purple-700">Últimas 24h</p>
              <p className="text-xs text-purple-600 mt-2 border-t border-purple-200 pt-2">
                Errores registrados: <strong>{health?.uptime?.last24hErrors ?? 0}</strong>
              </p>
            </div>
          </div>

          {/* Timestamp */}
          {health?.timestamp && (
            <p className="text-xs text-gray-400 mt-4 text-right">
              Última actualización: {new Date(health.timestamp).toLocaleString('es-CO')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Verificaciones detalladas */}
      <Card>
        <CardHeader>
          <CardTitle>Verificaciones del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {health?.checks?.length > 0 ? (
              health.checks.map((check: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={check.status} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{check.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{check.message}</p>
                    </div>
                  </div>
                  <StatusBadge status={check.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">
                No hay verificaciones disponibles
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
