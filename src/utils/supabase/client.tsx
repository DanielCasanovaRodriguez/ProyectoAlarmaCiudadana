import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './info';
import type { Database } from '../../types/database.types';

// ================================================================
// TIPO del cliente con la BD tipada
// ================================================================
export type TypedSupabaseClient = SupabaseClient<Database>;

// ================================================================
// SINGLETON — una sola instancia tipada
// ================================================================
let instance: TypedSupabaseClient | null = null;

export function createClient(): TypedSupabaseClient {
  if (!instance) {
    instance = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken:   true,
        persistSession:     true,
        detectSessionInUrl: false,
      },
    });

    instance.auth.onAuthStateChange((event) => {
      const msgs: Record<string, string> = {
        SIGNED_IN:       '✅ Sesión iniciada',
        SIGNED_OUT:      '👋 Sesión cerrada',
        TOKEN_REFRESHED: '🔄 Token renovado',
        USER_UPDATED:    '✏️ Usuario actualizado',
      };
      if (msgs[event]) console.log(msgs[event]);
    });
  }
  return instance;
}

// Export directo tipado
export const supabase: TypedSupabaseClient = createClient();

// ================================================================
// HELPERS
// ================================================================
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getUsuarioActual() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export type { UserRole, UserStatus, AlertStatus } from '../../types/database.types';