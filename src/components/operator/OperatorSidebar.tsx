import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button }    from '../ui/button';
import { Label }     from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch }    from '../ui/switch';
import { Separator } from '../ui/separator';
import type { Filters } from './types';

interface OperatorSidebarProps {
  filters:         Filters;
  onFiltersChange: (filters: Filters) => void;
  onClearFilters:  () => void;
  /** Ancho y bordes (en el celular se muestra a pantalla completa). */
  className?:      string;
  /** Botón para cerrar (versión celular). */
  onClose?:        () => void;
}

export function OperatorSidebar({
  filters,
  onFiltersChange,
  onClearFilters,
  className = 'w-64 flex-shrink-0 border-r border-gray-200',
  onClose,
}: OperatorSidebarProps) {
  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== false);

  return (
    <aside className={`${className} bg-white flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Filtros</h2>
        </div>
        <div className="flex items-center gap-1">
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-blue-600 hover:text-blue-700 h-7 px-2 text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Limpiar
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-3 text-sm" aria-label="Cerrar filtros">
            Listo
          </Button>
        )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Tiempo */}
        <div>
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Período
          </Label>
          <Select
            value={filters.rangoMinutos?.toString() ?? 'all'}
            onValueChange={v => onFiltersChange({
              ...filters,
              rangoMinutos: v === 'all' ? undefined : parseInt(v),
            })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="15">Últimos 15 min</SelectItem>
              <SelectItem value="60">Última hora</SelectItem>
              <SelectItem value="360">Últimas 6 horas</SelectItem>
              <SelectItem value="1440">Últimas 24 h</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Estado — usa valores reales del enum de BD */}
        <div>
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Estado
          </Label>
          <Select
            value={filters.estado ?? 'all'}
            onValueChange={v => onFiltersChange({
              ...filters,
              estado: v === 'all' ? undefined : v as any,
            })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Recibida</SelectItem>
              <SelectItem value="ack">En atención</SelectItem>
              <SelectItem value="resolved">Resuelta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Severidad */}
        <div>
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Severidad
          </Label>
          <Select
            value={filters.severidad ?? 'all'}
            onValueChange={v => onFiltersChange({
              ...filters,
              severidad: v === 'all' ? undefined : v as any,
            })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="MEDIA">Media</SelectItem>
              <SelectItem value="BAJA">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Tipo */}
        <div>
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Tipo de incidente
          </Label>
          <Select
            value={filters.tipo ?? 'all'}
            onValueChange={v => onFiltersChange({
              ...filters,
              tipo: v === 'all' ? undefined : v as any,
            })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ROBO">Robo / Asalto</SelectItem>
              <SelectItem value="EMERGENCIA_MEDICA">Emergencia Médica</SelectItem>
              <SelectItem value="ACCIDENTE">Accidente</SelectItem>
              <SelectItem value="INCENDIO">Incendio</SelectItem>
              <SelectItem value="RIÑA">Riña</SelectItem>
              <SelectItem value="VIOLENCIA">Violencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Solo anónimas</p>
              <p className="text-xs text-gray-400 mt-0.5">Reportadas sin identificación</p>
            </div>
            <Switch
              checked={filters.anonimas ?? false}
              onCheckedChange={checked =>
                onFiltersChange({ ...filters, anonimas: checked || undefined })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Con evidencia</p>
              <p className="text-xs text-gray-400 mt-0.5">Incluyen fotos/video</p>
            </div>
            <Switch
              checked={filters.conEvidencia ?? false}
              onCheckedChange={checked =>
                onFiltersChange({ ...filters, conEvidencia: checked || undefined })
              }
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
