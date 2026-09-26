import { supabase } from '../utils/supabase/client';
import type { Database } from '../types/database.types';
import { isMissingRpc } from './rpc';

// ================================================================
// TIPOS
// ================================================================

export interface CreateAlertData {
  type_code:    string;
  lat:          number;
  lng:          number;
  description?: string;
  severity?:    number;
  anonimo?:     boolean;
  media_urls?:  string[];
}

export interface Alert {
  id:          string;
  user_id:     string;
  type_code:   string;
  description: string | null;
  severity:    number;
  lat:         number;
  lng:         number;
  status:      'open' | 'ack' | 'resolved';
  anonimo:     boolean;
  media_urls:  string[];
  created_at:  string;
  updated_at:  string;
  resolved_at: string | null;
}

export interface AlertType {
  id:          number;
  code:        string;
  label:       string;
  descripcion: string | null;
  icono:       string | null;
  color:       string | null;
  activo:      boolean;
  orden:       number;
}

// ── CU-004 — Tipos para seguimiento ─────────────────────────────

export interface AlertStatusHistoryEntry {
  id:         number;
  alert_id:   string | null;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  note:       string | null;
  changed_at: string;
}

export interface AsignacionUnidad {
  id:            string;
  alerta_id:     string;
  operador_id:   string | null;
  nombre_unidad: string;
  tipo_unidad:   string | null;
  eta_minutos:   number | null;
  created_at:    string;
}

// ================================================================
// CU-005 — Crear alerta SOS
// ================================================================

export async function createAlert(data: CreateAlertData): Promise<Alert> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión para reportar una alerta.');

  const insertData: Database['public']['Tables']['alerts']['Insert'] = {
    user_id:     user.id,
    type_code:   data.type_code,
    lat:         data.lat,
    lng:         data.lng,
    description: data.description ?? null,
    severity:    data.severity ?? 3,
    anonimo:     data.anonimo ?? false,
    media_urls:  data.media_urls ?? [],
    status:      'open',
  };

  const { data: alert, error } = await supabase
    .from('alerts')
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return alert as Alert;
}

// ================================================================
// Actualizar media_urls de una alerta
// ================================================================

export async function updateAlertMediaUrls(
  alertId:   string,
  mediaUrls: string[]
): Promise<void> {
  const updateData: Database['public']['Tables']['alerts']['Update'] = {
    media_urls:  mediaUrls,
    updated_at:  new Date().toISOString(),
  };

  const { error } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('id', alertId);

  if (error) throw new Error(`Error actualizando media_urls: ${error.message}`);
}

// ================================================================
// CU-010 — Alertas activas para el mapa (todas, no solo las propias)
// ================================================================

export async function getActiveAlerts(): Promise<Alert[]> {
  // Función del servidor: no expone user_id (protege a quien reporta).
  const { data: rpcData, error: rpcError } = await supabase.rpc('alertas_activas_publicas');
  if (!rpcError) {
    return (rpcData ?? []).map(r => ({ ...r, user_id: '', anonimo: true } as Alert));
  }
  if (!isMissingRpc(rpcError)) throw new Error(rpcError.message);

  // Respaldo mientras la migración no esté aplicada
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .in('status', ['open', 'ack'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Alert[];
}

// ================================================================
// CU-008 — Historial del usuario actual
// ================================================================

export async function getUserAlertHistory(): Promise<Alert[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Alert[];
}

// ================================================================
// Obtener alerta por ID (incluye datos frescos de BD)
// ================================================================

export async function getAlertById(alertId: string): Promise<Alert | null> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', alertId)
    .single();

  if (error) return null;
  return data as Alert;
}

// ================================================================
// CU-006 — Catálogo de tipos de incidente
// ================================================================

export async function getAlertTypes(): Promise<AlertType[]> {
  const { data, error } = await supabase
    .from('alert_types')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AlertType[];
}

// ================================================================
// Actualizar estado — usado por operadores
// ================================================================

export async function updateAlertStatus(
  alertId:   string,
  newStatus: Alert['status'],
  note?:     string,
) {
  // Función del servidor: valida permisos y transición, registra historial y auditoría.
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('cambiar_estado_alerta', { p_alert_id: alertId, p_nuevo: newStatus, p_nota: note ?? null });
  if (!rpcError) return rpcData;
  if (!isMissingRpc(rpcError)) throw new Error(rpcError.message);

  // Respaldo mientras la migración no esté aplicada
  const updateData: Database['public']['Tables']['alerts']['Update'] = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
    ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
  };

  const { data, error } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('id', alertId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ================================================================
// CU-004 — Historial de cambios de estado de una alerta
// ================================================================

export async function getAlertStatusHistory(
  alertId: string
): Promise<AlertStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('alert_status_history')
    .select('*')
    .eq('alert_id', alertId)
    .order('changed_at', { ascending: true });

  if (error) {
    console.warn('No se pudo cargar el historial de estados:', error.message);
    return [];
  }
  return (data ?? []) as AlertStatusHistoryEntry[];
}

// ================================================================
// CU-004 — Unidad asignada a una alerta
// ================================================================

export async function getAlertAssignedUnit(
  alertId: string
): Promise<AsignacionUnidad | null> {
  const { data, error } = await supabase
    .from('asignaciones_unidad')
    .select('*')
    .eq('alerta_id', alertId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as AsignacionUnidad | null;
}

// ================================================================
// CU-004 — Cancelar alerta propia (solo si status === 'open')
// ================================================================

export async function cancelAlert(alertId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión.');

  // Función del servidor: valida titularidad y estado y registra el historial.
  const { error: rpcError } = await supabase.rpc('cancelar_alerta', { p_alert_id: alertId });
  if (!rpcError) return;
  if (!isMissingRpc(rpcError)) throw new Error(rpcError.message);

  // Respaldo mientras la migración no esté aplicada
  // Verificar titularidad y estado antes de cancelar
  const { data: alerta, error: fetchError } = await supabase
    .from('alerts')
    .select('id, user_id, status')
    .eq('id', alertId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !alerta) {
    throw new Error('No se encontró la alerta o no tienes permiso para cancelarla.');
  }

  if (alerta.status !== 'open') {
    throw new Error(
      alerta.status === 'resolved'
        ? 'Esta alerta ya fue cancelada o resuelta.'
        : 'Solo puedes cancelar alertas en estado Activa.'
    );
  }

  // Actualizar estado
  const { error: updateError } = await supabase
    .from('alerts')
    .update({
      status:     'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .eq('user_id', user.id);

  if (updateError) throw new Error(updateError.message);

  // Registrar en historial — silencioso si el trigger de BD ya lo hace
  try {
    await supabase
      .from('alert_status_history')
      .insert({
        alert_id:   alertId,
        old_status: 'open',
        new_status: 'resolved',
        changed_by: user.id,
        note:       'Cancelada por el ciudadano desde la aplicación',
      });
  } catch {
    // Silencioso: si hay un trigger en BD que ya lo registra, este insert
    // puede fallar por duplicado y eso es aceptable.
  }
}

// ================================================================
// Helpers de UI
// ================================================================

export function getAlertTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    medical:  'Emergencia Médica',
    robbery:  'Robo / Asalto',
    accident: 'Accidente',
    fire:     'Incendio',
    violence: 'Violencia',
  };
  return labels[type] ?? type;
}

export function getAlertTypeColor(type: string): string {
  const colors: Record<string, string> = {
    medical:  '#EF4444',
    robbery:  '#F97316',
    accident: '#EAB308',
    fire:     '#DC2626',
    violence: '#9333EA',
  };
  return colors[type] ?? '#6B7280';
}
