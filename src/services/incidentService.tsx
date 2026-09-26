import { supabase } from '../utils/supabase/client';
import type { AlertStatus } from '../types/database.types';
import { isMissingRpc } from './rpc';
import type { Incident, TimelineEntry, Filters, Severity, IncidentType, Unit } from '../components/operator/types';

// ================================================================
// MAPEO — type_code BD → código interno UI
// ================================================================
const TYPE_MAP: Record<string, IncidentType> = {
  medical:  'EMERGENCIA_MEDICA',
  robbery:  'ROBO',
  accident: 'ACCIDENTE',
  fire:     'INCENDIO',
  violence: 'RIÑA',
};

const TYPE_LABELS: Record<string, string> = {
  medical:  'Emergencia Médica',
  robbery:  'Robo / Asalto',
  accident: 'Accidente',
  fire:     'Incendio',
  violence: 'Riña',
};

const SEVERITY_MAP: Record<number, Severity> = {
  1: 'BAJA', 2: 'BAJA',
  3: 'MEDIA',
  4: 'ALTA', 5: 'ALTA',
};

// ================================================================
// CONVERSIÓN — fila de la BD → Incident de la UI
// ================================================================
function rowToIncident(row: any): Incident {
  const created   = new Date(row.created_at);
  const elapsedMs = Date.now() - created.getTime();

  // Unidad más reciente asignada (si el SELECT hizo join con asignaciones_unidad)
  const asignaciones: any[] = row.asignaciones_unidad ?? [];
  const latestAssignment    = asignaciones.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  return {
    id:             row.id,
    createdAt:      row.created_at,
    time:           created.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    type:           TYPE_MAP[row.type_code]  ?? ('ROBO' as IncidentType),
    typeLabel:      TYPE_LABELS[row.type_code] ?? row.type_code,
    severity:       SEVERITY_MAP[row.severity] ?? 'MEDIA',
    location:       `${Number(row.lat).toFixed(4)}, ${Number(row.lng).toFixed(4)}`,
    lat:            row.lat,
    lng:            row.lng,
    source:         row.anonimo ? 'Anónimo' : 'Ciudadano',
    status:         row.status as AlertStatus,
    slaMinutesLeft: Math.max(0, 30 - Math.floor(elapsedMs / 60000)),
    description:    row.description ?? 'Sin descripción',
    mediaUrls:      row.media_urls ?? [],
    userId:         row.user_id,
    unitName:       latestAssignment?.nombre_unidad,
    unitType:       latestAssignment?.tipo_unidad,
  };
}

// ================================================================
// LEER INCIDENTES ACTIVOS (open + ack)
// ================================================================
export async function getAllIncidents(): Promise<{
  data: Incident[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        *,
        asignaciones_unidad (
          nombre_unidad,
          tipo_unidad,
          eta_minutos,
          created_at
        )
      `)
      .in('status', ['open', 'ack'])
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };

    return { data: (data ?? []).map(rowToIncident), error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

// ================================================================
// ACTUALIZAR ESTADO — escribe en alerts + registra en alert_status_history
// ================================================================
export async function updateIncidentStatus(
  incidentId: string,
  newStatus:  AlertStatus,
  oldStatus?: AlertStatus,
  note?:      string,
): Promise<{ error: string | null }> {
  try {
    // Función del servidor: valida permisos y transición, registra historial y auditoría.
    const { error: rpcError } = await supabase
      .rpc('cambiar_estado_alerta', { p_alert_id: incidentId, p_nuevo: newStatus, p_nota: note?.trim() || null });
    if (!rpcError) return { error: null };
    if (!isMissingRpc(rpcError)) return { error: rpcError.message };

    // Respaldo mientras la migración no esté aplicada
    const updates: any = {
      status:     newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('alerts')
      .update(updates)
      .eq('id', incidentId);

    if (updateError) return { error: updateError.message };

    // Registrar cambio en historial
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('alert_status_history').insert({
      alert_id:   incidentId,
      old_status: oldStatus ?? null,
      new_status: newStatus,
      changed_by: user?.id ?? null,
      note:       note?.trim() || null,
    });

    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ================================================================
// ASIGNAR UNIDAD — escribe en asignaciones_unidad
// ================================================================
export async function assignUnitToIncident(
  incidentId: string,
  unitName:   string,
  unitType:   string,
  etaMinutos?: number,
): Promise<{ error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('asignaciones_unidad')
      .insert({
        alerta_id:     incidentId,
        operador_id:   user?.id ?? null,
        nombre_unidad: unitName,
        tipo_unidad:   unitType,
        eta_minutos:   etaMinutos ?? null,
      });

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ================================================================
// LEER LÍNEA DE TIEMPO — desde alert_status_history
// ================================================================
export async function getIncidentTimeline(incidentId: string): Promise<{
  data: TimelineEntry[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('alert_status_history')
      .select('*')
      .eq('alert_id', incidentId)
      .order('changed_at', { ascending: true });

    if (error) return { data: null, error: error.message };

    const entries: TimelineEntry[] = (data ?? []).map(e => ({
      id:        e.id,
      oldStatus: e.old_status,
      newStatus: e.new_status,
      note:      e.note,
      changedAt: e.changed_at,
      changedBy: e.changed_by,
    }));

    return { data: entries, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

// ================================================================
// FILTRAR INCIDENTES (lógica local, sin nueva query)
// ================================================================
export function filterIncidents(incidents: Incident[], filters: Filters): Incident[] {
  return incidents.filter(inc => {
    // Estado
    if (filters.estado && inc.status !== filters.estado)   return false;
    // Severidad
    if (filters.severidad && inc.severity !== filters.severidad) return false;
    // Tipo
    if (filters.tipo && inc.type !== filters.tipo)         return false;
    // Solo anónimas
    if (filters.anonimas && inc.source !== 'Anónimo')      return false;
    // Con evidencia (media_urls)
    if (filters.conEvidencia && inc.mediaUrls.length === 0) return false;
    // Rango de tiempo
    if (filters.rangoMinutos) {
      const cutoff = Date.now() - filters.rangoMinutos * 60000;
      if (new Date(inc.createdAt).getTime() < cutoff) return false;
    }
    return true;
  });
}

// ================================================================
// UNIDADES MOCK (no hay tabla de unidades en BD)
// ================================================================
export function getAvailableUnits(): Unit[] {
  return [
    { id: 'P-12', name: 'Patrulla 12',   type: 'Policía',    status: 'Disponible' },
    { id: 'P-07', name: 'Patrulla 07',   type: 'Policía',    status: 'Disponible' },
    { id: 'P-15', name: 'Patrulla 15',   type: 'Policía',    status: 'En ruta',   eta: 8 },
    { id: 'A-01', name: 'Ambulancia 01', type: 'Ambulancia', status: 'Disponible' },
    { id: 'A-02', name: 'Ambulancia 02', type: 'Ambulancia', status: 'Ocupada'    },
    { id: 'B-03', name: 'Bomberos 03',   type: 'Bomberos',   status: 'Disponible' },
  ];
}
