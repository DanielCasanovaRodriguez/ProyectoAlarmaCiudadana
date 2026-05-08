import type { AlertStatus } from '../../types/database.types';

// ================================================================
// RE-EXPORT del enum real de la BD para uso en todo el módulo
// ================================================================
export type { AlertStatus };

// ================================================================
// SEVERIDAD — valor interno de la UI (se mapea desde severity numérico)
// ================================================================
export type Severity = 'BAJA' | 'MEDIA' | 'ALTA';

// ================================================================
// TIPO DE INCIDENTE — código interno mapeado desde type_code de la BD
// ================================================================
export type IncidentType =
  | 'ROBO'
  | 'EMERGENCIA_MEDICA'
  | 'ACCIDENTE'
  | 'INCENDIO'
  | 'RIÑA'
  | 'VIOLENCIA';

// ================================================================
// INCIDENTE — estructura principal usada en toda la UI del operador
// El campo `status` usa los valores reales del enum de la BD.
// ================================================================
export interface Incident {
  id:             string;
  createdAt:      string;        // ISO completo para cálculos de tiempo
  time:           string;        // HH:MM formateado para mostrar
  type:           IncidentType;  // código interno para filtros/mapas
  typeLabel:      string;        // etiqueta en español para mostrar
  severity:       Severity;
  location:       string;        // "lat, lng" formateado
  lat:            number;
  lng:            number;
  source:         'Ciudadano' | 'Anónimo';
  status:         AlertStatus;   // 'open' | 'ack' | 'resolved' — igual que la BD
  slaMinutesLeft: number;
  description:    string;
  mediaUrls:      string[];
  userId:         string;
  unitName?:      string;        // nombre de unidad asignada (si existe)
  unitType?:      string;        // tipo de unidad asignada (si existe)
}

// ================================================================
// ENTRADA DE LÍNEA DE TIEMPO — mapeada desde alert_status_history
// ================================================================
export interface TimelineEntry {
  id:        number;
  oldStatus: AlertStatus | null;
  newStatus: AlertStatus;
  note:      string | null;
  changedAt: string;
  changedBy: string | null;
}

// ================================================================
// UNIDAD DE EMERGENCIA (datos mock — no hay tabla en BD)
// ================================================================
export interface Unit {
  id:       string;
  name:     string;
  type:     'Policía' | 'Ambulancia' | 'Bomberos';
  status:   'Disponible' | 'En ruta' | 'Ocupada';
  eta?:     number;  // minutos estimados de llegada
}

// ================================================================
// FILTROS del sidebar
// El campo `estado` usa los valores reales del enum de la BD.
// ================================================================
export interface Filters {
  estado?:       AlertStatus;    // 'open' | 'ack' | 'resolved'
  severidad?:    Severity;
  tipo?:         IncidentType;
  rangoMinutos?: number;         // últimos N minutos
  anonimas?:     boolean;
  conEvidencia?: boolean;
}

// ================================================================
// LABELS EN ESPAÑOL — para mostrar en UI
// ================================================================
export const STATUS_LABELS: Record<AlertStatus, string> = {
  open:     'Recibida',
  ack:      'En atención',
  resolved: 'Resuelta',
};

export const TYPE_LABELS: Record<IncidentType, string> = {
  ROBO:             'Robo / Asalto',
  EMERGENCIA_MEDICA:'Emergencia Médica',
  ACCIDENTE:        'Accidente',
  INCENDIO:         'Incendio',
  RIÑA:             'Riña',
  VIOLENCIA:        'Violencia',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  ALTA:  '#dc2626',
  MEDIA: '#ea580c',
  BAJA:  '#16a34a',
};
