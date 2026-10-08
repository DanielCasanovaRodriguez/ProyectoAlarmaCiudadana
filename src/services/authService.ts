import { supabase } from '../utils/supabase/client';
import { toUserMessage, toAppError } from '../utils/errors';
import type { Database } from '../types/database.types';

// ================================================================
// TIPOS
// ================================================================
export type UserRole    = Database['public']['Tables']['profiles']['Row']['role'];
export type UserStatus  = Database['public']['Tables']['profiles']['Row']['status'];
export type UserProfile = Database['public']['Tables']['profiles']['Row'];

// ================================================================
// CU-001 — Registrar ciudadano
// ================================================================
export async function registrarUsuario(
  email: string,
  password: string,
  datos: { nombres: string; apellidos: string; phone?: string; cedula: string; fechaExpedicion: string },
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El perfil lo crea el trigger de la BD con estos datos (rol siempre 'citizen')
      data: {
        nombres:   datos.nombres,
        apellidos: datos.apellidos,
        full_name: `${datos.nombres} ${datos.apellidos}`.trim(),
        phone:     datos.phone ?? null,
        // La BD valida la cédula, garantiza que sea única, la guarda cifrada
        // y la elimina de estos metadatos (no queda en texto plano).
        cedula:           datos.cedula,
        fecha_expedicion: datos.fechaExpedicion,
      },
    },
  });

  if (error) throw error;
  // Con confirmación de correo activa, Supabase NO devuelve error si el correo
  // ya existe (para no revelar cuentas): lo indica con identities vacío.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.');
  }
  return data;
}

// ================================================================
// CU-002 — Iniciar sesión ciudadano
// ================================================================
export async function iniciarSesion(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  if (data.user) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('status, bloqueado_hasta, intentos_fallidos')
      .eq('id', data.user.id)
      .single();

    if (perfil?.status === 'suspended') {
      await supabase.auth.signOut();
      throw new Error('Tu cuenta ha sido suspendida. Contacta con soporte.');
    }

    if (perfil?.bloqueado_hasta && new Date(perfil.bloqueado_hasta) > new Date()) {
      const minutos = Math.ceil(
        (new Date(perfil.bloqueado_hasta).getTime() - Date.now()) / 60000
      );
      await supabase.auth.signOut();
      throw new Error(`Cuenta bloqueada temporalmente. Intenta en ${minutos} minuto(s).`);
    }

    // Resetear intentos fallidos al iniciar sesión correctamente
    const updateData: Database['public']['Tables']['profiles']['Update'] = {
      intentos_fallidos: 0,
      bloqueado_hasta:   null,
    };
    await supabase.from('profiles').update(updateData).eq('id', data.user.id);
  }

  return data;
}

// ================================================================
// Login colaboradores (Operador / Admin / Auditor)
// ================================================================
export async function iniciarSesionColaborador(email: string, password: string) {
  // ── Paso 1: Autenticar con Supabase ──────────────────────────
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // ── Paso 2: Leer perfil (requiere RLS correcta en profiles) ──
  const { data: perfil, error: perfilError } = await supabase
    .from('profiles')
    .select('role, status, full_name')
    .eq('id', data.user.id)
    .single();

  if (perfilError || !perfil) {
    await supabase.auth.signOut();

    // Diagnóstico claro según el código de error de Postgres/Supabase
    const code = (perfilError as any)?.code ?? '';
    const msg  = perfilError?.message ?? '';

    if (msg.includes('infinite recursion') || msg.includes('recursion')) {
      throw new Error(
        'Error de configuración RLS en la base de datos (recursión infinita). ' +
        'Ejecuta el SQL de corrección en el panel de Supabase.'
      );
    }
    if (code === 'PGRST116' || msg.includes('rows returned')) {
      throw new Error(
        'No existe un perfil para este usuario. ' +
        'Ejecuta en Supabase SQL Editor: UPDATE profiles SET role=\'admin\', status=\'active\' WHERE id=(SELECT id FROM auth.users WHERE email=\'' + email + '\');'
      );
    }
    if (code === '42501' || msg.includes('permission denied') || msg.includes('policy')) {
      throw new Error(
        'Sin permiso para leer el perfil (RLS). ' +
        'Ejecuta el SQL de corrección de políticas en el panel de Supabase.'
      );
    }

    throw new Error(`Error al obtener perfil: ${msg || 'Error desconocido (código: ' + code + ')'}`);
  }

  // ── Paso 3: Verificar rol ─────────────────────────────────────
  if (!['operator', 'admin', 'auditor'].includes(perfil.role)) {
    await supabase.auth.signOut();
    throw new Error(
      `Tu rol actual es '${perfil.role}'. Solo pueden acceder operadores, administradores y auditores.`
    );
  }

  // ── Paso 4: Verificar estado ──────────────────────────────────
  if (perfil.status !== 'active') {
    await supabase.auth.signOut();
    const statusMsg: Record<string, string> = {
      inactive:  'Tu cuenta está inactiva.',
      suspended: 'Tu cuenta ha sido suspendida.',
    };
    throw new Error(
      (statusMsg[perfil.status] ?? `Estado de cuenta: ${perfil.status}.`) +
      ' Contacta con el administrador del sistema.'
    );
  }

  return { ...data, role: perfil.role };
}

// ================================================================
// Cerrar sesión
// ================================================================
export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ================================================================
// Obtener usuario y perfil actual
// ================================================================
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, perfil: null };

  const { data: perfil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, perfil };
}

// ================================================================
// CU-003 — Recuperación de contraseña
// ================================================================
export async function solicitarRecuperacion(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function actualizarPassword(nuevoPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: nuevoPassword });
  if (error) throw error;
}

// ================================================================
// Verificar sesión activa
// ================================================================
export async function verificarSesion() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ================================================================
// completeRegistration
// ================================================================
export async function completeRegistration(_email: string) {
  try {
    return { success: true };
  } catch (error: any) {
    return { success: false, error: toUserMessage(error) };
  }
}

// ================================================================
// sendPasswordResetOTP
// ================================================================
export async function sendPasswordResetOTP(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error?.message.includes('rate limit')) {
      return { success: false, error: 'Demasiados intentos. Espera unos minutos.' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: toUserMessage(error) };
  }
}

// ================================================================
// ALIASES
// ================================================================

export async function signIn(data: { email: string; password: string }) {
  try {
    const result = await iniciarSesion(data.email, data.password);
    return { data: result, error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error) };
  }
}

export async function signUp(data: {
  email:     string;
  password:  string;
  nombres:   string;
  apellidos: string;
  phone?:    string;
  cedula:    string;
  fechaExpedicion: string;
}) {
  try {
    const result = await registrarUsuario(data.email, data.password, {
      nombres: data.nombres, apellidos: data.apellidos, phone: data.phone,
      cedula: data.cedula, fechaExpedicion: data.fechaExpedicion,
    });
    return { data: result, error: null };
  } catch (error: any) {
    return { data: null, error: toUserMessage(error, 'No se pudo crear la cuenta. Intenta de nuevo.') };
  }
}

export async function signOut() {
  return cerrarSesion();
}

export async function updatePassword(password: string) {
  try {
    await actualizarPassword(password);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function verifyPasswordResetOTP(email: string, code: string) {
  try {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type:  'recovery',
    });

    if (error) return { success: false, error: toUserMessage(error) };
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: toUserMessage(error) };
  }
}

// ================================================================
// Acceso de ciudadanos con CÉDULA + contraseña
// (Edge Function acceso-cedula: limita intentos, no revela el correo)
// ================================================================
export class AccesoCedulaError extends Error {
  codigo?: string;
  emailEnmascarado?: string;
  constructor(mensaje: string, codigo?: string, emailEnmascarado?: string) {
    super(mensaje);
    this.name = 'AccesoCedulaError';
    this.codigo = codigo;
    this.emailEnmascarado = emailEnmascarado;
  }
}

async function llamarAccesoCedula(body: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('acceso-cedula', { body });
  if (error) {
    // Errores HTTP de la función: traen un mensaje ya preparado para el usuario
    const ctx = (error as { context?: Response }).context;
    let cuerpo: { error?: string; codigo?: string; email_enmascarado?: string } | null = null;
    if (ctx && typeof ctx.json === 'function') {
      try { cuerpo = await ctx.json(); } catch { cuerpo = null; }
    }
    if (cuerpo?.error) throw new AccesoCedulaError(cuerpo.error, cuerpo.codigo, cuerpo.email_enmascarado);
    throw toAppError(error, 'No se pudo iniciar sesión. Intenta de nuevo.');
  }
  const s = data as { access_token?: string; refresh_token?: string };
  if (!s?.access_token || !s?.refresh_token) throw new Error('No se pudo iniciar sesión. Intenta de nuevo.');
  const { data: sesion, error: errSesion } = await supabase.auth.setSession({
    access_token: s.access_token, refresh_token: s.refresh_token,
  });
  if (errSesion || !sesion.session) throw toAppError(errSesion, 'No se pudo iniciar sesión. Intenta de nuevo.');
  return sesion;
}

export function iniciarSesionConCedula(cedula: string, password: string) {
  return llamarAccesoCedula({ accion: 'ingresar', cedula, password });
}

export function confirmarCorreoConCedula(cedula: string, codigo: string) {
  return llamarAccesoCedula({ accion: 'confirmar', cedula, codigo });
}
