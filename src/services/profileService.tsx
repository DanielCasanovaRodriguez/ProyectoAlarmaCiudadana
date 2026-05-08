import { supabase } from '../utils/supabase/client';
import type { Database } from '../types/database.types';

// ================================================================
// TIPOS
// ================================================================
export type UserProfile      = Database['public']['Tables']['profiles']['Row'];
export type EmergencyContact = Database['public']['Tables']['emergency_contacts']['Row'];

// Tipo de entrada para guardar contactos (incluye notificar_sos)
export interface EmergencyContactInput {
  name:          string;
  phone:         string;
  relation?:     string;
  notificar_sos: boolean;
}

// ================================================================
// Obtener perfil del usuario actual
// ================================================================
export async function getUserProfile(
  _userId?: string
): Promise<{ data: UserProfile | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'No hay sesión activa.' };

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// ================================================================
// Actualizar perfil del usuario
// ================================================================
export async function updateUserProfile(
  _userId: string,
  updates: Database['public']['Tables']['profiles']['Update']
): Promise<{ data: UserProfile | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'No hay sesión activa.' };

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// ================================================================
// Obtener contactos de emergencia
// ================================================================
export async function getEmergencyContacts(
  _userId?: string
): Promise<{ data: EmergencyContact[] | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: null };

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// ================================================================
// Guardar contactos de emergencia (reemplaza todos)
// Incluye soporte para notificar_sos
// ================================================================
export async function saveEmergencyContacts(
  _userId: string,
  contacts: EmergencyContactInput[]
): Promise<{ data: EmergencyContact[] | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'No hay sesión activa.' };

    // Borrar contactos anteriores
    const { error: deleteError } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) return { data: null, error: deleteError.message };

    if (contacts.length === 0) return { data: [], error: null };

    const toInsert: Database['public']['Tables']['emergency_contacts']['Insert'][] =
      contacts.map(c => ({
        user_id:       user.id,
        name:          c.name,
        phone:         c.phone,
        relation:      c.relation ?? null,
        notificar_sos: c.notificar_sos,
      }));

    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert(toInsert)
      .select();

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// ================================================================
// Obtener notificaciones del usuario actual
// ================================================================
export async function getUserNotifications(): Promise<{
  data: Database['public']['Tables']['notificaciones']['Row'][] | null;
  error: string | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: null };

    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

// ================================================================
// Marcar notificación como leída
// ================================================================
export async function markNotificationRead(
  notifId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', notifId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}
