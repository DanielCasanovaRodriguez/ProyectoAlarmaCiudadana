// ================================================================
// TIPOS DE BASE DE DATOS — Alarma Ciudadana Kennedy
// Compatible con @supabase/supabase-js 2.103+
// GenericSchema requiere: Tables, Views, Functions
// ================================================================

export type AlertStatus = 'open' | 'in-progress' | 'resolved' | 'discarded';
export type UserRole    = 'citizen' | 'operator' | 'admin' | 'auditor';
export type UserStatus  = 'active' | 'inactive' | 'suspended';
export type MediaKind   = 'foto' | 'video' | 'audio';
export type SyncStatus  = 'pendiente' | 'procesando' | 'sincronizado' | 'fallido';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:                     string;
          full_name:              string | null;
          role:                   UserRole;
          status:                 UserStatus;
          phone:                  string | null;
          intentos_fallidos:      number;
          bloqueado_hasta:        string | null;
          consentimiento_fecha:   string | null;
          consentimiento_version: string | null;
          created_at:             string;
          updated_at:             string;
        };
        Insert: {
          id:                      string;
          full_name?:              string | null;
          role?:                   UserRole;
          status?:                 UserStatus;
          phone?:                  string | null;
          intentos_fallidos?:      number;
          bloqueado_hasta?:        string | null;
          consentimiento_fecha?:   string | null;
          consentimiento_version?: string | null;
        };
        Update: {
          full_name?:              string | null;
          role?:                   UserRole;
          status?:                 UserStatus;
          phone?:                  string | null;
          intentos_fallidos?:      number;
          bloqueado_hasta?:        string | null;
          consentimiento_fecha?:   string | null;
          consentimiento_version?: string | null;
          updated_at?:             string;
        };
        Relationships: [];
      };

      alerts: {
        Row: {
          id:                   string;
          user_id:              string;
          type_code:            string;
          description:          string | null;
          severity:             number;
          lat:                  number;
          lng:                  number;
          status:               AlertStatus;
          anonimo:              boolean;
          operador_asignado_id: string | null;
          ack_at:               string | null;
          resolved_at:          string | null;
          media_urls:           string[];
          created_at:           string;
          updated_at:           string;
        };
        Insert: {
          id?:                   string;
          user_id:               string;
          type_code:             string;
          description?:          string | null;
          severity?:             number;
          lat:                   number;
          lng:                   number;
          status?:               AlertStatus;
          anonimo?:              boolean;
          operador_asignado_id?: string | null;
          media_urls?:           string[];
        };
        Update: {
          type_code?:            string;
          description?:          string | null;
          severity?:             number;
          status?:               AlertStatus;
          anonimo?:              boolean;
          operador_asignado_id?: string | null;
          ack_at?:               string | null;
          resolved_at?:          string | null;
          media_urls?:           string[];
          updated_at?:           string;
        };
        Relationships: [];
      };

      alert_types: {
        Row: {
          id:          number;
          code:        string;
          label:       string;
          descripcion: string | null;
          icono:       string | null;
          color:       string | null;
          activo:      boolean;
          orden:       number;
        };
        Insert: {
          code:         string;
          label:        string;
          descripcion?: string | null;
          icono?:       string | null;
          color?:       string | null;
          activo?:      boolean;
          orden?:       number;
        };
        Update: {
          label?:       string;
          descripcion?: string | null;
          icono?:       string | null;
          color?:       string | null;
          activo?:      boolean;
          orden?:       number;
        };
        Relationships: [];
      };

      alert_media: {
        Row: {
          id:           number;
          alert_id:     string;
          user_id:      string | null;
          kind:         string;
          storage_path: string;
          tamano_bytes: number | null;
          duracion_seg: number | null;
          created_at:   string;
        };
        Insert: {
          alert_id:      string;
          user_id?:      string | null;
          kind:          string;
          storage_path:  string;
          tamano_bytes?: number | null;
          duracion_seg?: number | null;
        };
        Update: {
          kind?:         string;
          storage_path?: string;
          tamano_bytes?: number | null;
          duracion_seg?: number | null;
        };
        Relationships: [];
      };

      alert_status_history: {
        Row: {
          id:         number;
          alert_id:   string | null;
          old_status: AlertStatus | null;
          new_status: AlertStatus;
          changed_by: string | null;
          note:       string | null;
          changed_at: string;
        };
        Insert: {
          alert_id?:   string | null;
          old_status?: AlertStatus | null;
          new_status:  AlertStatus;
          changed_by?: string | null;
          note?:       string | null;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [];
      };

      emergency_contacts: {
        Row: {
          id:            number;
          user_id:       string;
          name:          string;
          phone:         string;
          relation:      string | null;
          notificar_sos: boolean;
          created_at:    string;
        };
        Insert: {
          user_id:        string;
          name:           string;
          phone:          string;
          relation?:      string | null;
          notificar_sos?: boolean;
        };
        Update: {
          name?:          string;
          phone?:         string;
          relation?:      string | null;
          notificar_sos?: boolean;
        };
        Relationships: [];
      };

      device_tokens: {
        Row: {
          id:         number;
          user_id:    string | null;
          platform:   string;
          token:      string;
          created_at: string;
        };
        Insert: {
          user_id?:  string | null;
          platform:  string;
          token:     string;
        };
        Update: {
          platform?: string;
          token?:    string;
        };
        Relationships: [];
      };

      notificaciones: {
        Row: {
          id:         string;
          usuario_id: string;
          alerta_id:  string | null;
          titulo:     string;
          mensaje:    string;
          leida:      boolean;
          created_at: string;
        };
        Insert: {
          usuario_id: string;
          alerta_id?: string | null;
          titulo:     string;
          mensaje:    string;
          leida?:     boolean;
        };
        Update: {
          leida?: boolean;
        };
        Relationships: [];
      };

      auditoria: {
        Row: {
          id:            string;
          usuario_id:    string | null;
          usuario_email: string | null;
          accion:        string;
          entidad:       string;
          entidad_id:    string | null;
          detalle:       Record<string, unknown> | null;
          ip_origen:     string | null;
          created_at:    string;
        };
        Insert: {
          usuario_id?:    string | null;
          usuario_email?: string | null;
          accion:         string;
          entidad:        string;
          entidad_id?:    string | null;
          detalle?:       Record<string, unknown> | null;
          ip_origen?:     string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      asignaciones_unidad: {
        Row: {
          id:            string;
          alerta_id:     string;
          operador_id:   string | null;
          nombre_unidad: string;
          tipo_unidad:   string | null;
          eta_minutos:   number | null;
          created_at:    string;
        };
        Insert: {
          alerta_id:      string;
          operador_id?:   string | null;
          nombre_unidad:  string;
          tipo_unidad?:   string | null;
          eta_minutos?:   number | null;
        };
        Update: {
          nombre_unidad?: string;
          tipo_unidad?:   string | null;
          eta_minutos?:   number | null;
        };
        Relationships: [];
      };

      cola_sincronizacion: {
        Row: {
          id:          string;
          alerta_id:   string | null;
          payload:     Record<string, unknown>;
          estado:      SyncStatus;
          intentos:    number;
          hash_evento: string | null;
          created_at:  string;
          synced_at:   string | null;
        };
        Insert: {
          alerta_id?:   string | null;
          payload:      Record<string, unknown>;
          estado?:      SyncStatus;
          intentos?:    number;
          hash_evento?: string | null;
        };
        Update: {
          estado?:    SyncStatus;
          intentos?:  number;
          synced_at?: string | null;
        };
        Relationships: [];
      };
    };

    // Requerido por GenericSchema en supabase-js 2.103+
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}