import { useEffect, useState } from 'react';
import { Settings, Database, Globe, Clock, AlertTriangle, Users, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Skeleton } from '../../ui/skeleton';
import { getSystemConfig } from '../../../services/adminService';
import { toast } from 'sonner';

interface AdminConfigScreenProps {
  accessToken: string;
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function AdminConfigScreen({ accessToken }: AdminConfigScreenProps) {
  const [loading, setLoading] = useState(true);
  const [config,  setConfig]  = useState<any>(null);

  const loadConfig = async () => {
    setLoading(true);
    const { data, error } = await getSystemConfig(accessToken);
    if (data) setConfig(data);
    else toast.error('Error al cargar configuración', { description: error ?? '' });
    setLoading(false);
  };

  useEffect(() => { loadConfig(); }, [accessToken]);

  if (loading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">

      {/* Información del sistema */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Información del Sistema
              </CardTitle>
              <CardDescription className="mt-1">
                Estado actual de la aplicación en producción
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadConfig} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* App */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-700">Aplicación</h3>
              </div>
              <InfoRow label="Nombre"       value={config?.appName    ?? '—'} />
              <InfoRow label="Versión"      value={config?.version    ?? '—'} />
              <InfoRow label="Entorno"      value={config?.environment ?? '—'} />
              <InfoRow label="Idioma"       value={config?.language   ?? '—'} />
              <InfoRow label="Zona Horaria" value={config?.timezone   ?? '—'} />
            </div>

            {/* Estadísticas reales */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-700">Estadísticas Actuales</h3>
              </div>
              <InfoRow label="Total de Alertas"  value={config?.totalAlertas  ?? 0} />
              <InfoRow label="Total de Usuarios" value={config?.totalUsuarios ?? 0} />
              <InfoRow label="Tipos de Alerta"   value={config?.tiposAlerta   ?? 0} />
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm text-gray-600">Última actualización</span>
                <span className="text-xs text-gray-400 font-mono">
                  {config?.updatedAt ? new Date(config.updatedAt).toLocaleTimeString('es-CO') : '—'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración avanzada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Configuración Avanzada
          </CardTitle>
          <CardDescription>
            Ajustes de seguridad, RLS, políticas y variables de entorno
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900 leading-relaxed">
              <strong>La configuración avanzada del sistema</strong> — incluyendo políticas RLS, roles de Supabase,
              variables de entorno, reglas de autenticación y parámetros del servidor — se gestiona directamente
              desde el <strong>Panel de Supabase</strong> para garantizar seguridad y trazabilidad de los cambios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'Políticas RLS',        desc: 'Configurar permisos de tablas',   section: 'Authentication > Policies'     },
              { label: 'Roles de Usuario',     desc: 'Gestionar roles y permisos',      section: 'Authentication > Roles'        },
              { label: 'Variables de Entorno', desc: 'API keys y configuración',        section: 'Settings > API'                },
              { label: 'Realtime',             desc: 'Canales y publicaciones',         section: 'Database > Replication'        },
            ].map(item => (
              <div key={item.label} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  <p className="text-xs text-gray-400 font-mono mt-1">{item.section}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Abrir Panel de Supabase</p>
              <p className="text-xs text-gray-500">Requiere acceso con permisos de proyecto</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ir a Supabase
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roles del sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Roles del Sistema
          </CardTitle>
          <CardDescription>Roles definidos y sus permisos en la aplicación</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { role: 'admin',    color: 'bg-purple-100 text-purple-800', desc: 'Acceso completo: dashboard, usuarios, alertas, auditoría, reportes, salud y configuración.' },
              { role: 'operator', color: 'bg-blue-100 text-blue-800',     desc: 'Acceso a dashboard y gestión de alertas. No gestiona usuarios ni configuración.' },
              { role: 'auditor',  color: 'bg-orange-100 text-orange-800', desc: 'Acceso de solo lectura a alertas, auditoría y reportes.' },
              { role: 'citizen',  color: 'bg-gray-100 text-gray-800',     desc: 'Usuario ciudadano de la app móvil. No tiene acceso al panel de administración.' },
            ].map(item => (
              <div key={item.role} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Badge className={`${item.color} flex-shrink-0 mt-0.5`} variant="outline">
                  {item.role}
                </Badge>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
