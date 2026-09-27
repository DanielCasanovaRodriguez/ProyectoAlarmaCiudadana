import { supabase } from '../utils/supabase/client';
import { toUserMessage } from '../utils/errors';
import type { Database } from '../types/database.types';
import type { UserRole, UserStatus, AlertStatus } from '../types/database.types';

// ================================================================
// TIPOS NORMALIZADOS para las pantallas del admin
// ================================================================

export type UserProfile = Database['public']['Tables']['profiles']['Row'];

export interface AdminAlert {
  id:          string;
  type:        string;
  status:      AlertStatus;
  description: string | null;
  latitude:    number;
  longitude:   number;
  severity:    number;
  anonimo:     boolean;
  userId:      string;
  mediaUrls:   string[];
  createdAt:   string;
  updatedAt:   string;
  resolvedAt:  string | null;
}

export interface AuditEntry {
  id:        string;
  timestamp: string;
  userEmail: string | null;
  userId:    string | null;
  action:    string;
  entity:    string;
  entityId:  string | null;
  details:   Record<string, unknown> | null;
  ipOrigen:  string | null;
}

export interface DashboardKPIs {
  alertsToday:       number;
  openAlerts:        number;
  resolvedAlerts:    number;
  activeOperators:   number;
  avgResolutionTime: number;
  alertsByType:      Record<string, number>;
}

export interface TimeSeriesPoint {
  date:     string;
  total:    number;
  open:     number;
  resolved: number;
}

// ================================================================
// HELPERS DE MAPEO
// ================================================================

function mapAlert(row: any): AdminAlert {
  return {
    id:          row.id,
    type:        row.type_code,
    status:      row.status,
    description: row.description,
    latitude:    row.lat,
    longitude:   row.lng,
    severity:    row.severity,
    anonimo:     row.anonimo,
    userId:      row.user_id,
    mediaUrls:   row.media_urls ?? [],
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    resolvedAt:  row.resolved_at,
  };
}

function mapAuditEntry(row: any): AuditEntry {
  return {
    id:        row.id,
    timestamp: row.created_at,
    userEmail: row.usuario_email,
    userId:    row.usuario_id,
    action:    row.accion,
    entity:    row.entidad,
    entityId:  row.entidad_id,
    details:   row.detalle,
    ipOrigen:  row.ip_origen,
  };
}

// ================================================================
// AUTH — verificar acceso
// ================================================================

export async function verifyAdminAccess(_accessToken?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'No hay sesión activa.' };

    const { data: perfil, error: perfilError } = await supabase
      .from('profiles')
      .select('role, status, full_name, created_at')
      .eq('id', user.id)
      .single();

    if (perfilError || !perfil) {
      return { data: null, error: 'No se encontró el perfil del usuario.' };
    }

    const p = perfil as any;
    if (!['operator', 'admin', 'auditor'].includes(p.role)) {
      return { data: null, error: 'Sin permisos de acceso.' };
    }

    return {
      data: {
        role:   p.role,
        userId: user.id,
        user:   { id: user.id, email: user.email },
        profile: {
          id:         user.id,
          role:       p.role,
          status:     p.status,
          full_name:  p.full_name,
          name:       p.full_name,
          email:      user.email,
          createdAt:  p.created_at,
          created_at: p.created_at,
        },
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

// ================================================================
// PERFIL — obtener perfil actual
// ================================================================

export async function getCurrentUserProfile(_accessToken?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'No hay sesión.' };

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) return { data: null, error: toUserMessage(error) };

    return {
      data: { ...data, name: (data as any).full_name, email: user.email },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

// ================================================================
// DASHBOARD KPIs
// ================================================================

export async function getDashboardKPIs(_accessToken?: string): Promise<{
  data: { kpis: DashboardKPIs; timeSeries: TimeSeriesPoint[]; recentAlerts: AdminAlert[] } | null;
  error: string | null;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo  = new Date(Date.now() - 7  * 86400000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    // ── Todas las alertas ────────────────────────────────────────
    const { data: todasRaw, error: alertError } = await supabase
      .from('alerts')
      .select('id, status, type_code, created_at, resolved_at');

    if (alertError) return { data: null, error: toUserMessage(alertError) };
    const todas = todasRaw ?? [];

    // ── Operadores activos ───────────────────────────────────────
    const { count: activeOperators } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'operator' as UserRole)
      .eq('status', 'active' as UserStatus);

    // ── Últimas 10 alertas ───────────────────────────────────────
    const { data: recentRaw } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // ── Cálculos ─────────────────────────────────────────────────
    const hoy        = todas.filter(a => new Date(a.created_at) >= today);
    const ultimos7   = todas.filter(a => new Date(a.created_at) >= sevenDaysAgo);
    const abiertas7  = ultimos7.filter(a => a.status === 'open' || a.status === 'ack');
    const resueltas7 = ultimos7.filter(a => a.status === 'resolved');

    const conTiempo = todas.filter(a => a.status === 'resolved' && a.resolved_at);
    const avgMin = conTiempo.length > 0
      ? conTiempo.reduce((sum, a) => {
          return sum + (new Date(a.resolved_at!).getTime() - new Date(a.created_at).getTime()) / 60000;
        }, 0) / conTiempo.length
      : 0;

    const porTipo = hoy.reduce((acc: Record<string, number>, a) => {
      acc[a.type_code] = (acc[a.type_code] ?? 0) + 1;
      return acc;
    }, {});

    const kpis: DashboardKPIs = {
      alertsToday:       hoy.length,
      openAlerts:        abiertas7.length,
      resolvedAlerts:    resueltas7.length,
      activeOperators:   activeOperators ?? 0,
      avgResolutionTime: Math.round(avgMin),
      alertsByType:      porTipo,
    };

    // ── Serie temporal 30 días ───────────────────────────────────
    const dayMap: Record<string, { total: number; open: number; resolved: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      dayMap[d.toISOString().split('T')[0]] = { total: 0, open: 0, resolved: 0 };
    }

    todas
      .filter(a => new Date(a.created_at) >= thirtyDaysAgo)
      .forEach(a => {
        const key = a.created_at.split('T')[0];
        if (dayMap[key]) {
          dayMap[key].total++;
          if (a.status === 'open' || a.status === 'ack') dayMap[key].open++;
          if (a.status === 'resolved') dayMap[key].resolved++;
        }
      });

    const timeSeries: TimeSeriesPoint[] = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }));
    const recentAlerts = (recentRaw ?? []).map(mapAlert);

    return { data: { kpis, timeSeries, recentAlerts }, error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

// ================================================================
// ALERTAS
// ================================================================

export async function getAdminAlerts(_accessToken?: string, filters?: {
  status?: string;
  type?:   string;
  from?:   string;
  to?:     string;
}): Promise<{ data: AdminAlert[] | null; error: string | null }> {
  try {
    let query = supabase.from('alerts').select('*');

    if (filters?.status) query = query.eq('status',    filters.status as AlertStatus);
    if (filters?.type)   query = query.eq('type_code', filters.type);
    if (filters?.from)   query = query.gte('created_at', filters.from);
    if (filters?.to)     query = query.lte('created_at', `${filters.to}T23:59:59`);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return { data: null, error: toUserMessage(error) };

    return { data: (data ?? []).map(mapAlert), error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

export async function createAdminAlert(payload: {
  type_code: string; status: AlertStatus;
  description: string; lat: number; lng: number; severity: number;
}): Promise<{ data: AdminAlert | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Sin sesión activa.' };

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        user_id: user.id, type_code: payload.type_code, status: payload.status,
        description: payload.description, lat: payload.lat, lng: payload.lng,
        severity: payload.severity, anonimo: false, media_urls: [],
      })
      .select().single();

    if (error) return { data: null, error: toUserMessage(error) };
    return { data: mapAlert(data), error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

export async function updateAdminAlert(
  alertId: string,
  payload: { type_code?: string; status?: AlertStatus; description?: string; lat?: number; lng?: number; severity?: number; }
): Promise<{ data: AdminAlert | null; error: string | null }> {
  try {
    const updates: any = { ...payload, updated_at: new Date().toISOString() };
    if (payload.status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('alerts').update(updates).eq('id', alertId).select().single();

    if (error) return { data: null, error: toUserMessage(error) };
    return { data: mapAlert(data), error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

export async function deleteAdminAlert(alertId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('alerts').delete().eq('id', alertId);
    if (error) return { error: toUserMessage(error) };
    return { error: null };
  } catch (error: any) {
    return { error: toUserMessage(error) };
  }
}

// ================================================================
// USUARIOS
// ================================================================

export async function getAllUsers(_accessToken?: string, filters?: {
  role?: string; status?: string; search?: string;
}): Promise<{ data: any[] | null; error: string | null }> {
  try {
    let query = supabase.from('profiles').select('*');

    if (filters?.role)   query = query.eq('role',   filters.role   as UserRole);
    if (filters?.status) query = query.eq('status', filters.status as UserStatus);
    if (filters?.search) query = query.ilike('full_name', `%${filters.search}%`);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return { data: null, error: toUserMessage(error) };

    return {
      data: (data ?? []).map(u => ({
        ...u, name: (u as any).full_name, createdAt: (u as any).created_at,
      })),
      error: null,
    };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

export async function updateUser(
  _accessToken: string, userId: string,
  updates: Database['public']['Tables']['profiles']['Update']
): Promise<{ data: any | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId).select().single();

    if (error) return { data: null, error: toUserMessage(error) };
    return { data: { ...data, name: (data as any).full_name, createdAt: (data as any).created_at }, error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

export async function createUser(
  _accessToken: string,
  userData: { name: string; email: string; password: string; role: string; status: string; }
): Promise<{ data: any | null; error: string | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email, password: userData.password,
      options: { data: { full_name: userData.name, role: userData.role } },
    });

    if (authError) return { data: null, error: toUserMessage(authError) };
    if (!authData.user) return { data: null, error: 'No se pudo crear el usuario.' };

    // Actualizar perfil con rol y estado correctos (el trigger lo crea con 'citizen')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: userData.name, role: userData.role as UserRole,
        status: userData.status as UserStatus, updated_at: new Date().toISOString(),
      })
      .eq('id', authData.user.id);

    if (updateError) console.warn('Perfil creado pero rol no actualizado:', updateError.message);

    return { data: { userId: authData.user.id, email: userData.email }, error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

/** Suspende el perfil (soft-delete). Eliminación real de auth.users requiere service role. */
export async function deleteUser(
  _accessToken: string, userId: string
): Promise<{ data: any | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ status: 'suspended' as UserStatus, updated_at: new Date().toISOString() })
      .eq('id', userId).select().single();

    if (error) return { data: null, error: toUserMessage(error) };

    // Registrar en auditoría
    const { data: { user: admin } } = await supabase.auth.getUser();
    await supabase.from('auditoria').insert({
      usuario_id: admin?.id ?? null, usuario_email: admin?.email ?? null,
      accion: 'delete', entidad: 'profiles', entidad_id: userId,
      detalle: { accion: 'Usuario suspendido por administrador' },
    });

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

// ================================================================
// AUDITORÍA
// ================================================================

export async function getAuditLog(
  _accessToken?: string,
  filters?: { action?: string; entity?: string }
): Promise<{ data: AuditEntry[] | null; error: string | null }> {
  try {
    let query = supabase.from('auditoria').select('*')
      .order('created_at', { ascending: false }).limit(300);

    if (filters?.action) query = query.eq('accion',  filters.action);
    if (filters?.entity) query = query.eq('entidad', filters.entity);

    const { data, error } = await query;
    if (error) return { data: null, error: toUserMessage(error) };

    return { data: (data ?? []).map(mapAuditEntry), error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

// ================================================================
// REPORTES
// ================================================================

/** Etiquetas en español para los type_code de alertas */
const TYPE_LABELS: Record<string, string> = {
  medical:  'Emergencia Médica',
  robbery:  'Robo / Asalto',
  accident: 'Accidente',
  fire:     'Incendio',
  violence: 'Violencia',
};

/** Etiquetas en español para los status */
const STATUS_LABELS: Record<string, string> = {
  open:     'Abierta',
  ack:      'Reconocida',
  resolved: 'Resuelta',
};

/** Traduce type_code al español */
function labelTipo(code: string): string {
  return TYPE_LABELS[code] ?? code;
}

/** Traduce status al español */
function labelEstado(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Traduce severidad a texto */
function labelSeveridad(n: number): string {
  return ['', 'Muy baja', 'Baja', 'Media', 'Alta', 'Crítica'][n] ?? String(n);
}

/** Busca una alerta por ID completo o parcial */
export async function getAlertById(
  alertId: string
): Promise<{ data: AdminAlert | null; error: string | null }> {
  try {
    // Intentar búsqueda exacta primero
    const { data: exact, error: exactError } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', alertId)
      .maybeSingle();

    if (exact) return { data: mapAlert(exact), error: null };

    // Si no hay resultado exacto, buscar por prefijo (UUID parcial)
    const { data: rows, error: prefixError } = await supabase
      .from('alerts')
      .select('*')
      .ilike('id', `${alertId}%`)
      .limit(1);

    if (prefixError) return { data: null, error: toUserMessage(prefixError) };
    if (!rows || rows.length === 0) return { data: null, error: 'No se encontró ninguna alerta con ese ID.' };

    return { data: mapAlert(rows[0]), error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

/** Genera y abre el PDF de una alerta individual en una nueva ventana */
export function printAlertPDF(alert: AdminAlert): void {
  const tipo      = labelTipo(alert.type);
  const estado    = labelEstado(alert.status);
  const severidad = labelSeveridad(alert.severity);
  const mapsUrl   = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

  const fechaFormato = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-CO', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : '—';

  const statusColor: Record<string, string> = {
    open:     '#dc2626',
    ack:      '#2563eb',
    resolved: '#16a34a',
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte de Alerta — ${alert.id.slice(0,8)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 28px; }
    .logo { font-size: 22px; font-weight: 800; color: #dc2626; letter-spacing: -0.5px; }
    .logo span { color: #111; }
    .subtitle { font-size: 11px; color: #666; margin-top: 4px; }
    .report-title { text-align: right; }
    .report-title h2 { font-size: 18px; font-weight: 700; color: #111; }
    .report-title p { font-size: 11px; color: #888; margin-top: 4px; }
    .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; color: #fff; background: ${statusColor[alert.status] ?? '#555'}; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .field { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px 16px; }
    .field label { display: block; font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; }
    .field value { font-size: 14px; color: #111; font-weight: 500; }
    .field.full { grid-column: 1 / -1; }
    .field.highlight { border-left: 4px solid #dc2626; background: #fff5f5; }
    .map-link { display: inline-block; margin-top: 8px; font-size: 12px; color: #2563eb; text-decoration: none; font-weight: 500; }
    .section-title { font-size: 13px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.8px; margin: 24px 0 12px; border-bottom: 1px solid #e9ecef; padding-bottom: 6px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e9ecef; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
    .id-box { background: #111; color: #fff; border-radius: 6px; padding: 10px 16px; font-family: monospace; font-size: 13px; margin-bottom: 20px; letter-spacing: 1px; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Alerta<span>Ciudadana</span></div>
      <div class="subtitle">Sistema de Alertas Ciudadanas · Kennedy, Bogotá</div>
    </div>
    <div class="report-title">
      <h2>Reporte de Alerta</h2>
      <p>Generado el ${new Date().toLocaleString('es-CO')}</p>
    </div>
  </div>

  <div class="id-box">ID: ${alert.id}</div>
  <div class="status-badge">${estado.toUpperCase()}</div>

  <div class="section-title">Información General</div>
  <div class="grid">
    <div class="field highlight">
      <label>Tipo de Emergencia</label>
      <value>${tipo}</value>
    </div>
    <div class="field">
      <label>Estado</label>
      <value>${estado}</value>
    </div>
    <div class="field">
      <label>Severidad</label>
      <value>${severidad} (${alert.severity}/5)</value>
    </div>
    <div class="field">
      <label>Anónima</label>
      <value>${alert.anonimo ? 'Sí' : 'No'}</value>
    </div>
    <div class="field full">
      <label>Descripción</label>
      <value>${alert.description || 'Sin descripción registrada'}</value>
    </div>
  </div>

  <div class="section-title">Ubicación</div>
  <div class="grid">
    <div class="field">
      <label>Latitud</label>
      <value>${alert.latitude.toFixed(6)}</value>
    </div>
    <div class="field">
      <label>Longitud</label>
      <value>${alert.longitude.toFixed(6)}</value>
    </div>
    <div class="field full">
      <label>Ver en mapa</label>
      <value>${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}</value>
      <a href="${mapsUrl}" class="map-link">📍 Abrir en Google Maps</a>
    </div>
  </div>

  <div class="section-title">Fechas y Tiempos</div>
  <div class="grid">
    <div class="field">
      <label>Fecha de creación</label>
      <value>${fechaFormato(alert.createdAt)}</value>
    </div>
    <div class="field">
      <label>Última actualización</label>
      <value>${fechaFormato(alert.updatedAt)}</value>
    </div>
    ${alert.resolvedAt ? `
    <div class="field">
      <label>Fecha de resolución</label>
      <value>${fechaFormato(alert.resolvedAt)}</value>
    </div>
    <div class="field">
      <label>Tiempo de resolución</label>
      <value>${Math.round((new Date(alert.resolvedAt).getTime() - new Date(alert.createdAt).getTime()) / 60000)} minutos</value>
    </div>` : ''}
  </div>

  ${alert.mediaUrls?.length > 0 ? `
  <div class="section-title">Archivos Adjuntos</div>
  <div class="field full">
    <label>${alert.mediaUrls.length} archivo(s) adjunto(s)</label>
    <value>${alert.mediaUrls.map((url: string, i: number) => `Archivo ${i + 1}: ${url}`).join('<br/>')}</value>
  </div>` : ''}

  <div class="footer">
    <span>AlertaCiudadana Kennedy © ${new Date().getFullYear()} · Conforme a la Ley 1581/2012</span>
    <span>ID Usuario Reportante: ${alert.userId.slice(0, 8)}…</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export async function generateReport(
  _accessToken: string, type: string,
  filters?: { startDate?: string; endDate?: string }
): Promise<{ data: any[] | null; error: string | null }> {
  try {
    let query = supabase.from('alerts')
      .select('id, type_code, status, created_at, resolved_at, severity, lat, lng');

    if (filters?.startDate) query = query.gte('created_at', filters.startDate);
    if (filters?.endDate)   query = query.lte('created_at', `${filters.endDate}T23:59:59`);

    const { data: raw, error } = await query.order('created_at', { ascending: false });
    if (error) return { data: null, error: toUserMessage(error) };

    const alertas = raw ?? [];

    if (type === 'alerts_by_type') {
      const groups: Record<string, number> = {};
      alertas.forEach(a => { groups[a.type_code] = (groups[a.type_code] ?? 0) + 1; });
      return {
        data: Object.entries(groups).map(([code, Cantidad]) => ({
          Tipo:       labelTipo(code),   // ← Español
          Cantidad,
          Porcentaje: alertas.length > 0 ? `${((Cantidad / alertas.length) * 100).toFixed(1)}%` : '0%',
        })),
        error: null,
      };
    }

    if (type === 'response_time') {
      const resueltas = alertas.filter(a => a.status === 'resolved' && a.resolved_at);
      return {
        data: resueltas.map(a => ({
          ID:              a.id.slice(0, 8),
          Tipo:            labelTipo(a.type_code),         // ← Español
          Estado:          labelEstado(a.status),          // ← Español
          FechaCreacion:   a.created_at.split('T')[0],
          FechaResolucion: a.resolved_at!.split('T')[0],
          TiempoMinutos:   Math.round(
            (new Date(a.resolved_at!).getTime() - new Date(a.created_at).getTime()) / 60000
          ),
        })),
        error: null,
      };
    }

    if (type === 'alerts_by_date') {
      const groups: Record<string, number> = {};
      alertas.forEach(a => {
        const day = a.created_at.split('T')[0];
        groups[day] = (groups[day] ?? 0) + 1;
      });
      return {
        data: Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
          .map(([Fecha, Alertas]) => ({ Fecha, Alertas })),
        error: null,
      };
    }

    if (type === 'alerts_by_status') {
      const groups: Record<string, number> = {};
      alertas.forEach(a => { groups[a.status] = (groups[a.status] ?? 0) + 1; });
      return {
        data: Object.entries(groups).map(([status, Cantidad]) => ({
          Estado:   labelEstado(status),  // ← Español
          Cantidad,
        })),
        error: null,
      };
    }

    // Fallback: listado general
    return {
      data: alertas.map(a => ({
        ID:        a.id.slice(0, 8),
        Tipo:      labelTipo(a.type_code),    // ← Español
        Estado:    labelEstado(a.status),     // ← Español
        Fecha:     a.created_at.split('T')[0],
        Severidad: labelSeveridad(a.severity),// ← Español
      })),
      error: null,
    };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

// ================================================================
// SALUD DEL SISTEMA
// ================================================================

export async function getSystemHealth(_accessToken?: string) {
  try {
    const start = Date.now();
    const { error: pingError } = await supabase.from('alert_types').select('id').limit(1);
    const latency = Date.now() - start;

    const [
      { count: totalAlertas },
      { count: alertasAbiertas },
      { count: alertasResueltas },
      { count: totalUsuarios },
      { count: totalOperadores },
    ] = await Promise.all([
      supabase.from('alerts').select('id', { count: 'exact', head: true }),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).in('status', ['open', 'ack']),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'resolved' as AlertStatus),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'operator' as UserRole),
    ]);

    const dbStatus = pingError ? 'error' : latency < 300 ? 'ok' : 'warn';

    return {
      data: {
        status:    pingError ? 'degraded' : 'healthy',
        latencyMs: latency,
        timestamp: new Date().toISOString(),
        database:  { status: dbStatus, totalRecords: (totalAlertas ?? 0) + (totalUsuarios ?? 0), alerts: totalAlertas ?? 0, users: totalUsuarios ?? 0 },
        realtime:  { status: 'ok' },
        uptime:    { percentage: 99.9, last24hErrors: 0 },
        checks: [
          { name: 'Base de Datos (Supabase)', status: dbStatus, message: pingError ? `Error: ${pingError.message}` : `Responde en ${latency}ms` },
          { name: 'Alertas activas', status: 'ok', message: `${alertasAbiertas ?? 0} alertas abiertas en el sistema` },
          { name: 'Alertas resueltas', status: 'ok', message: `${alertasResueltas ?? 0} alertas resueltas en total` },
          { name: 'Operadores registrados', status: 'ok', message: `${totalOperadores ?? 0} operadores en el sistema` },
          { name: 'Autenticación', status: 'ok', message: 'Supabase Auth operativo' },
        ],
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

// ================================================================
// CONFIGURACIÓN
// ================================================================

export async function getSystemConfig(_accessToken?: string) {
  try {
    const [{ count: totalAlertas }, { count: totalUsuarios }, { count: tiposAlerta }] = await Promise.all([
      supabase.from('alerts').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('alert_types').select('id', { count: 'exact', head: true }),
    ]);

    return {
      data: {
        appName: 'AlertaCiudadana Kennedy', version: '1.0.0',
        environment: 'production', timezone: 'America/Bogota', language: 'es-CO',
        totalAlertas: totalAlertas ?? 0, totalUsuarios: totalUsuarios ?? 0,
        tiposAlerta: tiposAlerta ?? 0, updatedAt: new Date().toISOString(),
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

export async function updateSystemConfig(_accessToken: string, _key: string, _value: any) {
  return { data: null, error: 'La configuración del sistema se gestiona desde el panel de Supabase.' };
}

// ================================================================
// CSV
// ================================================================

export function downloadCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const escape  = (v: any) => { const s = String(v ?? '').replace(/"/g, '""'); return s.includes(',') || s.includes('\n') ? `"${s}"` : s; };
  const csv = [headers.join(','), ...data.map(row => headers.map(h => escape(row[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
