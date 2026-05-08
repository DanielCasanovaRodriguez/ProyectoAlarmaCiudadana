import React from 'react';
import { Bell, Search, User, LogOut, Settings, Shield } from 'lucide-react';
import { Badge }  from '../ui/badge';
import { Button } from '../ui/button';
import { Input }  from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface OperatorHeaderProps {
  newIncidentCount:     number;
  operatorName:         string;
  operatorRole?:        string;   // 'operator' | 'auditor'
  onNavigateToSettings: () => void;
  onLogout:             () => void;
  onSearch?:            (query: string) => void;
  searchValue?:         string;
}

export function OperatorHeader({
  newIncidentCount,
  operatorName,
  operatorRole = 'operator',
  onNavigateToSettings,
  onLogout,
  onSearch,
  searchValue = '',
}: OperatorHeaderProps) {
  const initials = operatorName
    .split(' ')
    .map(n => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'OP';

  const roleLabel = operatorRole === 'auditor' ? 'Auditor' : 'Operador';

  return (
    <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3.5">
      <div className="flex items-center justify-between gap-4">

        {/* Logo + título */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold text-gray-900 leading-none">
                Panel de Control
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">AlertaCiudadana</p>
            </div>
          </div>
        </div>

        {/* Buscador */}
        {onSearch && (
          <div className="flex-1 max-w-sm hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por ID, tipo, descripción..."
                value={searchValue}
                onChange={e => onSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        )}

        {/* Acciones derechas */}
        <div className="flex items-center gap-3 flex-shrink-0">

          {/* Notificación de nuevos incidentes */}
          <div className="relative">
            <div className="p-2 rounded-lg hover:bg-gray-100 cursor-default">
              <Bell className="w-5 h-5 text-gray-600" />
            </div>
            {newIncidentCount > 0 && (
              <Badge className="absolute -top-1 -right-1 bg-red-600 text-white border-none px-1.5 min-w-[20px] h-5 flex items-center justify-center text-xs">
                {newIncidentCount > 99 ? '99+' : newIncidentCount}
              </Badge>
            )}
          </div>

          {/* Menú de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-10 px-2 hover:bg-gray-100">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-blue-100 text-blue-700 font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900 leading-none">{operatorName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{roleLabel}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{operatorName}</p>
                <p className="text-xs text-gray-500 font-normal">{roleLabel}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onNavigateToSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
