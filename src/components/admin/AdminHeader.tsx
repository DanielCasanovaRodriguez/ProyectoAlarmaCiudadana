import { Search, LogOut, User, Settings , Menu } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface AdminHeaderProps {
  title: string;
  userName: string;
  userEmail: string;
  onLogout: () => void;
  onSearch?: (query: string) => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  /** Abre el menú lateral en el celular. */
  onMenuClick?: () => void;
}

export function AdminHeader({ title, userName, userEmail, onLogout, onSearch, onProfileClick, onSettingsClick, onMenuClick }: AdminHeaderProps) {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('es-CO', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = now.toLocaleTimeString('es-CO', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex-shrink-0 min-h-14 sm:h-16 bg-white border-b border-gray-200 flex items-center justify-between gap-2 px-2 sm:px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Izquierda: menú (celular), título y fecha */}
      <div className="flex items-center gap-1 min-w-0">
        {onMenuClick && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden h-10 w-10 flex-shrink-0" aria-label="Abrir menú">
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">{title}</h1>
          <p className="hidden sm:block text-xs text-gray-500 mt-0.5">
            {formattedDate} • {formattedTime}
          </p>
        </div>
      </div>

      {/* Right: Search, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {/* Search */}
        {onSearch && (
          <div className="relative w-80 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar..."
              className="pl-9 h-9"
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 pl-2 pr-3">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-red-100 text-red-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden lg:block">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfileClick}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSettingsClick}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}