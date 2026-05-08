import { User, Mail, Shield, Calendar, AlertTriangle, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';

interface AdminProfileDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  user:         any;
  profile:      any;
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  admin:    { label: 'Administrador', className: 'bg-purple-100 text-purple-800' },
  operator: { label: 'Operador',      className: 'bg-blue-100 text-blue-800'     },
  auditor:  { label: 'Auditor',       className: 'bg-orange-100 text-orange-800' },
  citizen:  { label: 'Ciudadano',     className: 'bg-gray-100 text-gray-800'     },
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  active:    { label: 'Activo',     variant: 'default'      },
  inactive:  { label: 'Inactivo',  variant: 'secondary'    },
  suspended: { label: 'Suspendido',variant: 'destructive'  },
};

function formatDate(dateString?: string) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AdminProfileDialog({ open, onOpenChange, user, profile }: AdminProfileDialogProps) {
  // El servicio normaliza full_name → name, pero por seguridad leemos ambos
  const displayName = profile?.name ?? profile?.full_name ?? user?.email ?? 'Sin nombre';
  const displayEmail = profile?.email ?? user?.email ?? '—';

  const initials = displayName
    .split(' ')
    .map((n: string) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const role       = profile?.role   ?? 'citizen';
  const status     = profile?.status ?? 'active';
  // Soportar both created_at y createdAt (el servicio puede devolver ambos)
  const createdAt  = profile?.created_at ?? profile?.createdAt;

  const roleConfig   = ROLE_CONFIG[role]   ?? { label: role,   className: 'bg-gray-100 text-gray-800' };
  const statusConfig = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' as const };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mi Perfil</DialogTitle>
          <DialogDescription>
            Información de tu cuenta en el panel de administrador
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Avatar + nombre */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-red-100 text-red-700">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{displayName}</h3>
              <p className="text-sm text-gray-500 truncate">{displayEmail}</p>
            </div>
          </div>

          {/* Rol administrador principal */}
          {role === 'admin' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-900">Administrador del Sistema</p>
                <p className="text-xs text-purple-700">
                  Tienes acceso completo al panel de administración
                </p>
              </div>
            </div>
          )}

          {/* Datos del perfil */}
          <div className="space-y-3 divide-y divide-gray-100">

            <div className="flex items-start gap-3 pt-3">
              <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Correo</p>
                <p className="text-sm font-medium text-gray-900">{displayEmail}</p>
              </div>
            </div>

            {profile?.phone && (
              <div className="flex items-start gap-3 pt-3">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Teléfono</p>
                  <p className="text-sm font-medium text-gray-900">{profile.phone}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 pt-3">
              <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-1.5">Rol</p>
                <Badge className={roleConfig.className} variant="outline">
                  {roleConfig.label}
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3">
              <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-1.5">Estado</p>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Fecha de alta</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(createdAt)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3">
              <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">ID de Usuario</p>
                <p className="text-xs font-mono text-gray-600 break-all">{user?.id ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">
              Para cambiar tu contraseña, usa la opción "Olvidé mi contraseña" en la pantalla de login.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
