import React, { useState } from 'react';
import { Clock, Copy, Check } from 'lucide-react';
import { StatusBadge }  from './StatusBadge';
import { SeverityChip } from './SeverityChip';
import { Skeleton }     from '../ui/skeleton';
import type { Incident } from './types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';

interface IncidentTableProps {
  incidents:        Incident[];
  selectedId?:      string;
  onSelectIncident: (incident: Incident) => void;
  loading?:         boolean;
}

export function IncidentTable({
  incidents,
  selectedId,
  onSelectIncident,
  loading = false,
}: IncidentTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hora</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Severidad</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ubicación</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fuente</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidad</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SLA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-gray-400 text-sm py-10">
                No hay incidentes que coincidan con los filtros aplicados
              </TableCell>
            </TableRow>
          ) : (
            incidents.map(incident => {
              const isSelected = selectedId === incident.id;
              const isOverdue  = incident.slaMinutesLeft < 5 && incident.status !== 'resolved';

              return (
                <TableRow
                  key={incident.id}
                  onClick={() => onSelectIncident(incident)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : isOverdue
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* ID con botón de copiar */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 group">
                      <span className={`font-mono text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {incident.id.slice(0, 8)}…
                      </span>
                      <button
                        onClick={e => copyId(e, incident.id)}
                        title="Copiar ID completo"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200"
                      >
                        {copiedId === incident.id
                          ? <Check className="w-3 h-3 text-green-600" />
                          : <Copy  className="w-3 h-3 text-gray-400" />}
                      </button>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm text-gray-700">{incident.time}</TableCell>

                  <TableCell className="text-sm text-gray-900 font-medium">
                    {incident.typeLabel}
                  </TableCell>

                  <TableCell>
                    <SeverityChip severity={incident.severity} />
                  </TableCell>

                  <TableCell className="text-xs text-gray-500 font-mono max-w-[140px]">
                    {incident.location}
                  </TableCell>

                  <TableCell className="text-sm text-gray-700">
                    {incident.source}
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={incident.status} />
                  </TableCell>

                  <TableCell className="text-sm text-gray-600">
                    {incident.unitName ?? '—'}
                  </TableCell>

                  <TableCell>
                    {incident.status !== 'resolved' && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${
                        isOverdue ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {incident.slaMinutesLeft}'
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Versión para celular: tarjetas en lugar de la tabla de 9 columnas.
 * Lo urgente primero a la vista: tipo, estado, severidad, hora y tiempo restante.
 */
export function IncidentCardList({ incidents, selectedId, onSelectIncident, loading = false }: IncidentTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }
  if (incidents.length === 0) {
    return (
      <p className="text-center text-gray-500 text-sm py-10 bg-white rounded-xl border border-gray-200">
        No hay incidentes que coincidan con los filtros
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {incidents.map(incident => {
        const isSelected = selectedId === incident.id;
        const isOverdue  = incident.slaMinutesLeft < 5 && incident.status !== 'resolved';
        return (
          <li key={incident.id}>
            <button
              onClick={() => onSelectIncident(incident)}
              className={`w-full text-left rounded-xl border p-3 shadow-sm active:scale-[0.99] transition ${
                isSelected ? 'border-blue-400 bg-blue-50' : isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{incident.typeLabel}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden /> {incident.time} · {incident.source}
                    {incident.unitName ? ` · ${incident.unitName}` : ''}
                  </p>
                </div>
                <StatusBadge status={incident.status} />
              </div>
              {incident.description && incident.description !== 'Sin descripción' && (
                <p className="text-xs text-gray-600 mt-2 line-clamp-2 break-words">{incident.description}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <SeverityChip severity={incident.severity} />
                {incident.status !== 'resolved' && (
                  <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                    {incident.slaMinutesLeft > 0 ? `Quedan ${incident.slaMinutesLeft} min` : 'Tiempo vencido'}
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
