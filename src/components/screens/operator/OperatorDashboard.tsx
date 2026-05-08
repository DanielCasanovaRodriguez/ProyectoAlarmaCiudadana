import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OperatorHeader }       from '../../operator/OperatorHeader';
import { OperatorSidebar }      from '../../operator/OperatorSidebar';
import { IncidentTable }        from '../../operator/IncidentTable';
import { OperatorMap }          from '../../operator/OperatorMap';
import { IncidentDetailDrawer } from '../../operator/IncidentDetailDrawer';
import type { Incident, Filters, Unit } from '../../operator/types';
import { Button }  from '../../ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast }   from 'sonner';
import { supabase } from '../../../utils/supabase/client';
import {
  getAllIncidents,
  filterIncidents,
  getAvailableUnits,
} from '../../../services/incidentService';

interface OperatorDashboardProps {
  onNavigateToSettings: () => void;
  onLogout:             () => void;
  accessToken?:         string;
}

export function OperatorDashboard({
  onNavigateToSettings,
  onLogout,
}: OperatorDashboardProps) {

  // ── Estado principal ──────────────────────────────────────────
  const [incidents,        setIncidents]        = useState<Incident[]>([]);
  const [units]                                  = useState<Unit[]>(getAvailableUnits());
  const [filters,          setFilters]          = useState<Filters>({});
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [newCount,         setNewCount]         = useState(0);
  const [lastUpdate,       setLastUpdate]       = useState<Date>(new Date());

  // ── Perfil del operador ───────────────────────────────────────
  const [operatorName, setOperatorName] = useState('Operador');
  const [operatorRole, setOperatorRole] = useState('operator');

  // ── Búsqueda ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // Ref estable para el snapshot de IDs actuales (para detectar nuevos)
  const knownIdsRef = useRef<Set<string>>(new Set());

  // ── Cargar perfil del operador desde Supabase ─────────────────
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Leer desde localStorage primero (ya lo guardó CollaboratorLoginScreen)
      const savedProfile = localStorage.getItem('admin_profile');
      if (savedProfile) {
        try {
          const p = JSON.parse(savedProfile);
          setOperatorName(p.name ?? p.full_name ?? user.email ?? 'Operador');
          setOperatorRole(p.role ?? 'operator');
          return;
        } catch { /* fallthrough a consulta directa */ }
      }

      // Fallback: consultar BD directamente
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();

      if (data) {
        setOperatorName((data as any).full_name ?? user.email ?? 'Operador');
        setOperatorRole((data as any).role ?? 'operator');
      }
    };

    loadProfile();
  }, []);

  // ── Cargar incidentes — NO aplica conversión adicional ─────────
  // getAllIncidents() ya devuelve Incident[] correctamente mapeados
  const loadIncidents = useCallback(async (showToast = false) => {
    const { data, error } = await getAllIncidents();

    if (error) {
      console.error('Error cargando incidentes:', error);
      if (showToast) toast.error('Error al actualizar incidentes');
      setLoading(false);
      return;
    }

    if (data) {
      // Detectar nuevos incidentes (IDs que no teníamos antes)
      const incoming = data;
      const newOnes  = incoming.filter(i => !knownIdsRef.current.has(i.id));

      if (newOnes.length > 0 && knownIdsRef.current.size > 0) {
        setNewCount(prev => prev + newOnes.length);
        toast.info(`${newOnes.length} nueva${newOnes.length > 1 ? 's' : ''} alerta${newOnes.length > 1 ? 's' : ''}`);
      }

      // Actualizar snapshot de IDs conocidos
      knownIdsRef.current = new Set(incoming.map(i => i.id));

      setIncidents(incoming);
      setLastUpdate(new Date());
      if (showToast) toast.success('Incidentes actualizados');

      // Sincronizar el incidente seleccionado si cambió en BD
      setSelectedIncident(prev => {
        if (!prev) return null;
        return incoming.find(i => i.id === prev.id) ?? null;
      });
    }

    setLoading(false);
  }, []);

  // Carga inicial
  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  // ── Polling estable — sin incidents en dependencias ───────────
  useEffect(() => {
    const id = setInterval(() => loadIncidents(), 15_000);
    return () => clearInterval(id);
  }, [loadIncidents]);

  // ── Supabase Realtime — actualizaciones instantáneas ──────────
  useEffect(() => {
    const channel = supabase
      .channel('operator-alerts-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => { loadIncidents(); }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Operador: Realtime conectado');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [loadIncidents]);

  // ── Aplicar filtros + búsqueda ────────────────────────────────
  const filteredIncidents = (() => {
    let result = filterIncidents(incidents, filters);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.id.toLowerCase().includes(q)           ||
        i.typeLabel.toLowerCase().includes(q)    ||
        i.description.toLowerCase().includes(q)  ||
        i.location.toLowerCase().includes(q)
      );
    }

    return result;
  })();

  // ── Actualizar un incidente en el estado local ────────────────
  // Llamado por IncidentDetailDrawer después de acciones exitosas
  const handleIncidentUpdate = (incidentId: string, patch: Partial<Incident>) => {
    setIncidents(prev =>
      prev.map(i => i.id === incidentId ? { ...i, ...patch } : i)
    );
    setSelectedIncident(prev =>
      prev?.id === incidentId ? { ...prev, ...patch } : prev
    );
  };

  // ── Seleccionar incidente ─────────────────────────────────────
  const handleSelectIncident = (incident: Incident) => {
    setSelectedIncident(incident);
    if (incident.status === 'open') {
      setNewCount(prev => Math.max(0, prev - 1));
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      <OperatorHeader
        newIncidentCount={newCount}
        operatorName={operatorName}
        operatorRole={operatorRole}
        onNavigateToSettings={onNavigateToSettings}
        onLogout={onLogout}
        onSearch={setSearchQuery}
        searchValue={searchQuery}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">

        <OperatorSidebar
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={() => setFilters({})}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* Barra de acciones */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Incidentes Activos</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {loading ? 'Cargando...' : (
                  <>
                    <span className="font-medium text-gray-700">{filteredIncidents.length}</span>
                    {' '}incidente{filteredIncidents.length !== 1 ? 's' : ''}
                    {Object.keys(filters).length > 0 || searchQuery ? ' (filtrados)' : ''}
                    {' · '}Actualizado {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </>
                )}
              </p>
            </div>
            <Button
              onClick={() => loadIncidents(true)}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          {/* Estado vacío */}
          {!loading && incidents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
              <AlertTriangle className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-base font-medium text-gray-500">Sin incidentes activos</p>
              <p className="text-sm mt-1">No hay alertas abiertas en este momento</p>
            </div>
          )}

          {/* Tabla */}
          {(loading || incidents.length > 0) && (
            <IncidentTable
              incidents={filteredIncidents}
              selectedId={selectedIncident?.id}
              onSelectIncident={handleSelectIncident}
              loading={loading}
            />
          )}

          {/* Mapa */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              Mapa de Incidentes
            </h3>
            <OperatorMap
              incidents={filteredIncidents}
              selectedId={selectedIncident?.id}
              onSelectIncident={handleSelectIncident}
            />
          </div>

        </main>
      </div>

      {/* Drawer de detalle */}
      {selectedIncident && (
        <IncidentDetailDrawer
          incident={selectedIncident}
          units={units}
          onClose={() => setSelectedIncident(null)}
          onIncidentUpdate={handleIncidentUpdate}
        />
      )}
    </div>
  );
}
