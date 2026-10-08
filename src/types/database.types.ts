// ================================================================
// TIPOS DE BASE DE DATOS — Alarma Ciudadana Kennedy
// Compatible con @supabase/supabase-js 2.103+
//
// IMPORTANTE: GenericSchema en postgrest-js requiere obligatoriamente:
//   Tables, Views, Functions
// Cada tabla requiere además: Relationships
// Sin estos campos, todas las operaciones (.insert, .update, .select)
// resuelven las tablas como tipo 'never'.
// ================================================================

export type AlertStatus = 'open' | 'ack' | 'resolved';
export type UserRole    = 'citizen' | 'operator' | 'admin' | 'auditor';
export type UserStatus  = 'active' | 'inactive' | 'suspended';
export type MediaKind   = 'foto' | 'video' | 'audio';
export type EstadoIdentidad = 'pendiente' | 'verificada' | 'rechazada';
export type SyncStatus  = 'pendiente' | 'procesando' | 'sincronizado' | 'fallido';

export interface Database {
  public: {
    Tables: {

      // ----------------------------------------------------------
      // profiles
      // ----------------------------------------------------------
      profiles: {
        Row: {
          id:                     string;
          full_name:              string | null;
          nombres:                string | null;
          apellidos:              string | null;
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
          nombres?:                string | null;
          apellidos?:              string | null;
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
          nombres?:                string | null;
          apellidos?:              string | null;
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

      // ----------------------------------------------------------
      // alerts
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // alert_types
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // alert_media
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // alert_status_history
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // solicitudes_titular (habeas data; solo lectura desde la app)
      // ----------------------------------------------------------
      solicitudes_titular: {
        Row: {
          id: string; user_id: string | null; tipo: string; mensaje: string; estado: string;
          respuesta: string | null; creada_en: string; fecha_limite: string;
          respondida_en: string | null; respondida_por: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      // ----------------------------------------------------------
      // emergency_contacts
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // device_tokens
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // notificaciones
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // auditoria
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // asignaciones_unidad
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // cola_sincronizacion
      // ----------------------------------------------------------
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

      // ----------------------------------------------------------
      // verificaciones_identidad (solo lectura desde la app; escritura por RPC)
      // ----------------------------------------------------------
      verificaciones_identidad: {
        Row: {
          user_id:          string;
          tipo_documento:   'CC';
          ultimos_digitos:  string;
          modelo_documento: 'amarilla' | 'digital' | 'desconocido';
          metodo_lectura:   'pdf417' | 'mrz' | 'manual';
          coincide_numero:  boolean;
          coincide_nombre:  boolean;
          frente_path:      string;
          reverso_path:     string;
          estado:           EstadoIdentidad;
          motivo_rechazo:   string | null;
          revisado_por:     string | null;
          revisado_at:      string | null;
          intentos:         number;
          created_at:       string;
          updated_at:       string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };

      // ----------------------------------------------------------
      // ubicaciones_usuario (última ubicación para alertas cercanas)
      // ----------------------------------------------------------
      ubicaciones_usuario: {
        Row: {
          user_id:            string;
          lat:                number | null;
          lng:                number | null;
          precision_m:        number | null;
          actualizado_at:     string | null;
          notificar_cercanas: boolean;
          radio_m:            number;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };

    };

    // ----------------------------------------------------------------
    // Views, Functions, Enums, CompositeTypes
    // Requeridos por GenericSchema en @supabase/postgrest-js
    // Sin estos, todas las tablas resuelven como tipo 'never'
    // ----------------------------------------------------------------
    Views:          Record<string, never>;
    // RPC definidas en supabase/migrations/20260925000001_funciones_negocio.sql
    Functions: {
      alertas_activas_publicas: {
        Args: Record<string, never>;
        Returns: {
          id: string; type_code: string; description: string | null; severity: number;
          lat: number; lng: number; status: AlertStatus; media_urls: string[];
          created_at: string; updated_at: string; resolved_at: string | null; es_propia: boolean;
        }[];
      };
      cambiar_estado_alerta: {
        Args: { p_alert_id: string; p_nuevo: AlertStatus; p_nota?: string | null };
        Returns: Database['public']['Tables']['alerts']['Row'];
      };
      cancelar_alerta: {
        Args: { p_alert_id: string };
        Returns: Database['public']['Tables']['alerts']['Row'];
      };
      puede_reportar: { Args: Record<string, never>; Returns: boolean };
      actualizar_mi_ubicacion: {
        Args: { p_lat: number; p_lng: number; p_precision_m?: number | null };
        Returns: undefined;
      };
      configurar_alertas_cercanas: { Args: { p_activar: boolean }; Returns: undefined };
      detalle_alerta_publica: {
        Args: { p_alert_id: string };
        Returns: {
          id: string; type_code: string; description: string | null; severity: number;
          lat: number; lng: number; status: AlertStatus; created_at: string; updated_at: string;
          es_propia: boolean; distancia_m: number | null;
        }[];
      };
      mi_cedula: { Args: Record<string, never>; Returns: { ultimos_digitos: string; completa: boolean }[] };
      mi_estado_reporte: {
        Args: Record<string, never>;
        Returns: { puede_reportar: boolean; bloqueado_hasta: string | null; reportes_falsos: number }[];
      };
      registrar_mi_cedula: { Args: { p_numero: string; p_fecha: string }; Returns: { ultimos_digitos: string }[] };
      admin_listar_cedulas: {
        Args: Record<string, never>;
        Returns: {
          user_id: string; nombres: string | null; apellidos: string | null; email: string | null;
          ultimos_digitos: string; completa: boolean; estado_cuenta: string; reportes_falsos: number; created_at: string;
        }[];
      };
      admin_ver_cedula: { Args: { p_user_id: string }; Returns: { numero: string; fecha_expedicion: string | null }[] };
      admin_liberar_cedula: { Args: { p_user_id: string; p_motivo: string }; Returns: undefined };
      marcar_alerta_falsa: { Args: { p_alert_id: string; p_nota?: string | null }; Returns: undefined };
      registrar_dispositivo: { Args: { p_token: string; p_plataforma?: string }; Returns: undefined };
      eliminar_dispositivo:  { Args: { p_token: string }; Returns: undefined };
      rol_actual:     { Args: Record<string, never>; Returns: string | null };
      es_admin:       { Args: Record<string, never>; Returns: boolean };
      es_staff:       { Args: Record<string, never>; Returns: boolean };
      es_colaborador: { Args: Record<string, never>; Returns: boolean };
      // Paso 10-11: autorización de datos y solicitudes del titular
      aceptar_politica: { Args: { p_version: string }; Returns: undefined };
      crear_solicitud_titular: { Args: { p_tipo: string; p_mensaje: string }; Returns: { id: string; fecha_limite: string }[] };
      admin_responder_solicitud: { Args: { p_id: string; p_estado: string; p_respuesta: string }; Returns: undefined };
      admin_listar_solicitudes: {
        Args: Record<string, never>;
        Returns: {
          id: string; user_id: string | null; nombre: string | null; email: string | null; tipo: string; mensaje: string;
          estado: string; respuesta: string | null; creada_en: string; fecha_limite: string; respondida_en: string | null;
        }[];
      };
      admin_evidencias_titular: { Args: { p_user_id: string }; Returns: { ruta: string }[] };
      admin_suprimir_titular: { Args: { p_user_id: string; p_solicitud_id: string | null; p_respuesta: string }; Returns: undefined };
    };
    Enums:          Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}