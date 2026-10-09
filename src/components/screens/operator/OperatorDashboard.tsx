import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OperatorHeader }       from '../../operator/OperatorHeader';
import { OperatorSidebar }      from '../../operator/OperatorSidebar';
import { IncidentTable, IncidentCardList } from '../../operator/IncidentTable';
import { OperatorMap }          from '../../operator/OperatorMap';
import { IncidentDetailDrawer } from '../../operator/IncidentDetailDrawer';
import type { Incident, Filters } from '../../operator/types';
import { Button }  from '../../ui/button';
import { RefreshCw, AlertTriangle, SlidersHorizontal, List, Map as MapIcon } from 'lucide-react';
import { toast }   from 'sonner';
import { supabase } from '../../../utils/supabase/client';
import {
  getAllIncidents,
  filterIncidents,
} from '../../../services/incidentService';

interface OperatorDashboardProps {
  onNavigateToSettings: () => void;
  onLogout:             () => void;
  accessToken?:         string;
  /** Abrir este incidente (al tocar una notificación). */
  abrirIncidenteId?:    string | null;
  onIncidenteAbierto?:  () => void;
}

export function OperatorDashboard({
  onNavigateToSettings,
  onLogout,
  abrirIncidenteId,
  onIncidenteAbierto,
}: OperatorDashboardProps) {

  // ── Estado principal ──────────────────────────────────────────
  const [incidents,        setIncidents]        = useState<Incident[]>([]);
  const [filters,          setFilters]          = useState<Filters>({});
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [newCount,         setNewCount]         = useState(0);
  const [lastUpdate,       setLastUpdate]       = useState<Date>(new Date());

  // ── Perfil del operador ───────────────────────────────────────
  const [operatorName, setOperatorName] = useState('Operador');
  const [operatorRole, setOperatorRole] = useState('operator');

  // ── Búsqueda y vista en celular ───────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [vistaMovil, setVistaMovil] = useState<'lista' | 'mapa'>('lista');

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

  // ── Abrir el incidente de una notificación ────────────────────
  useEffect(() => {
    if (!abrirIncidenteId || incidents.length === 0) return;
    const inc = incidents.find(i => i.id === abrirIncidenteId);
    if (inc) setSelectedIncident(inc);
    else toast.info('Ese incidente ya no está activo');
    onIncidenteAbierto?.();
  }, [abrirIncidenteId, incidents]);

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

  const filtrosActivos = Object.values(filters).filter(v => v !== undefined && v !== false).length;
  const resumen = loading ? 'Cargando…' : `${filteredIncidents.length} incidente${filteredIncidents.length !== 1 ? 's' : ''}${
    filtrosActivos || searchQuery ? ' (filtrados)' : ''} · ${lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

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

        {/* Filtros: columna fija en pantallas grandes */}
        <div className="hidden lg:flex">
          <OperatorSidebar filters={filters} onFiltersChange={setFilters} onClearFilters={() => setFilters({})} />
        </div>

        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 min-w-0">

          {/* Encabezado + acciones */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Incidentes activos</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{resumen}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={() => setFiltrosAbiertos(true)}
                variant="outline" size="sm"
                className="lg:hidden h-9"
                aria-label="Filtros"
              >
                <SlidersHorizontal className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Filtros</span>
                {filtrosActivos > 0 && (
                  <span className="ml-1 bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{filtrosActivos}</span>
                )}
              </Button>
              <Button onClick={() => loadIncidents(true)} variant="outline" size="sm" disabled={loading} className="h-9" aria-label="Actualizar">
                <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
            </div>
          </div>

          {/* Celular: Lista | Mapa */}
          <div className="md:hidden grid grid-cols-2 bg-gray-200/70 rounded-xl p-1 text-sm font-medium" role="tablist">
            {([['lista', 'Lista', List], ['mapa', 'Mapa', MapIcon]] as const).map(([v, label, Icono]) => (
              <button
                key={v}
                role="tab"
                aria-selected={vistaMovil === v}
                onClick={() => setVistaMovil(v)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${vistaMovil === v ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
              >
                <Icono className="w-4 h-4" aria-hidden /> {label}
              </button>
            ))}
          </div>

          {/* Estado vacío */}
          {!loading && incidents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              <AlertTriangle className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-base font-medium text-gray-500">Sin incidentes activos</p>
              <p className="text-sm mt-1">No hay alertas abiertas en este momento</p>
            </div>
          )}

          {/* Lista (celular: tarjetas; tablet/escritorio: tabla) */}
          {(loading || incidents.length > 0) && (
            <div className={vistaMovil === 'lista' ? '' : 'hidden md:block'}>
              <div className="md:hidden">
                <IncidentCardList incidents={filteredIncidents} selectedId={selectedIncident?.id}
                  onSelectIncident={handleSelectIncident} loading={loading} />
              </div>
              <div className="hidden md:block overflow-x-auto">
                <IncidentTable incidents={filteredIncidents} selectedId={selectedIncident?.id}
                  onSelectIncident={handleSelectIncident} loading={loading} />
              </div>
            </div>
          )}

          {/* Mapa */}
          <div className={vistaMovil === 'mapa' ? '' : 'hidden md:block'}>
            <h3 className="hidden md:block text-base font-semibold text-gray-900 mb-3">Mapa de incidentes</h3>
            <OperatorMap incidents={filteredIncidents} selectedId={selectedIncident?.id} onSelectIncident={handleSelectIncident} />
          </div>
        </main>
      </div>

      {/* Filtros en celular/tablet: hoja inferior */}
      {filtrosAbiertos && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col bg-black/30" onClick={() => setFiltrosAbiertos(false)}>
          <div className="mt-auto max-h-[85%] flex flex-col rounded-t-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <OperatorSidebar
              className="w-full flex-1 min-h-0"
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={() => setFilters({})}
              onClose={() => setFiltrosAbiertos(false)}
            />
          </div>
        </div>
      )}

      {/* Detalle del incidente */}
      {selectedIncident && (
        <IncidentDetailDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onIncidentUpdate={handleIncidentUpdate}
        />
      )}
    </div>
  );
}
