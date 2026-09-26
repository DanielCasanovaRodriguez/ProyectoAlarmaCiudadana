import { createClient } from '../utils/supabase/client';

/**
 * Después del registro, reenvía el código de confirmación de email de Supabase (8 dígitos)
 * @param email - Email del destinatario
 * @returns Promise con el resultado del envío
 */
export async function sendVerificationEmail(email: string): Promise<{ 
  success: boolean; 
  error?: string;
}> {
  try {
    const supabase = createClient();
    
    console.log('📧 Reenviando código de confirmación de Supabase a:', email);
    
    // Usar resend para reenviar el email de confirmación de Supabase (8 dígitos)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });
    
    if (error) {
      console.error('❌ Error al reenviar confirmación:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Código de confirmación de 8 dígitos reenviado exitosamente por email');
    console.log('📧 Revisa tu correo electrónico para obtener el código');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error al enviar código:', error);
    return { success: false, error: 'Error al enviar código de verificación' };
  }
}

/**
 * Envía un código OTP por correo para el segundo factor de colaboradores.
 * El código lo genera y valida exclusivamente Supabase Auth: nunca se
 * genera ni se compara en el cliente.
 */
export async function sendLoginOTP(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      if (error.message.toLowerCase().includes('rate limit')) {
        return { success: false, error: 'Se alcanzó el límite de envíos de correo. Espera unos minutos e intenta de nuevo.' };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'No se pudo enviar el código de verificación' };
  }
}

/**
 * Verifica un código OTP de Supabase
 * @param email - Email del usuario
 * @param token - Código de 8 dígitos (signup) o 6 dígitos (login)
 * @param type - Tipo de verificación: 'signup' para registro, 'email' para login OTP
 * @returns Promise con el resultado de la verificación
 */
export async function verifyEmailCode(
  email: string, 
  token: string, 
  type: 'signup' | 'email' = 'signup'
): Promise<{ 
  success: boolean; 
  error?: string; 
  session?: any;
}> {
  try {
    const supabase = createClient();
    
    console.log(`🔐 Verificando código con Supabase (${type}) para:`, email);
    
    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: type // 'signup' para confirmación de registro, 'email' para login OTP
    });
    
    if (error) {
      console.error('❌ Error de Supabase:', error.message);
      
      // Mensajes de error más amigables
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        return { 
          success: false, 
          error: 'El código ha expirado o es incorrecto. Por favor solicita un nuevo código.' 
        };
      }
      
      return { success: false, error: 'Código incorrecto o expirado' };
    }
    
    if (!data.session) {
      console.error('❌ No se recibió sesión de Supabase');
      return { success: false, error: 'Error al verificar el código' };
    }
    
    console.log('✅ Código verificado correctamente por Supabase');
    console.log('✅ Usuario autenticado:', data.user?.email);
    
    return { 
      success: true, 
      session: data.session,
    };
  } catch (error: any) {
    console.error('❌ Error al verificar código:', error);
    return { 
      success: false, 
      error: 'Error al verificar el código. Por favor intenta de nuevo.' 
    };
  }
}
