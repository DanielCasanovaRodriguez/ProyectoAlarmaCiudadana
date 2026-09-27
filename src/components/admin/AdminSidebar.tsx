import { 
  LayoutDashboard, 
  Users, 
  AlertTriangle, 
  FileText, 
  Activity, 
  Settings,
  ScrollText,
  IdCard,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';

interface AdminSidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  userRole: 'admin' | 'operator' | 'auditor';
}

export function AdminSidebar({ currentSection, onSectionChange, userRole }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { 
      id: 'overview', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      roles: ['admin', 'operator', 'auditor']
    },
    { 
      id: 'users', 
      label: 'Usuarios y Roles',
      icon: Users,
      roles: ['admin']
    },
    {
      id: 'identidad',
      label: 'Verificación de identidad',
      icon: IdCard,
      roles: ['admin', 'auditor']
    },
    { 
      id: 'alerts', 
      label: 'Alertas', 
      icon: AlertTriangle,
      roles: ['admin', 'operator', 'auditor']
    },
    { 
      id: 'audit', 
      label: 'Auditoría', 
      icon: ScrollText,
      roles: ['admin', 'auditor']
    },
    { 
      id: 'reports', 
      label: 'Reportes', 
      icon: FileText,
      roles: ['admin', 'auditor']
    },
    { 
      id: 'health', 
      label: 'Salud del Sistema', 
      icon: Activity,
      roles: ['admin']
    },
    { 
      id: 'config', 
      label: 'Configuración', 
      icon: Settings,
      roles: ['admin']
    },
  ];

  // Filter menu items by user role
  const visibleItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className={`h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">AlertaCiudadana</h1>
              <p className="text-xs text-gray-500">Panel Admin</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                isActive 
                  ? 'bg-red-50 text-red-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-red-600' : 'text-gray-500'}`} />
              {!collapsed && (
                <span className={`text-sm ${isActive ? 'font-medium' : ''}`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Role Badge */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Rol actual</p>
            <p className="text-sm font-medium capitalize">{userRole}</p>
          </div>
        </div>
      )}
    </div>
  );
}
