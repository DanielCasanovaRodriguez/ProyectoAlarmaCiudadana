import { createClient } from '../utils/supabase/client';
import { toUserMessage } from './errors';
import { interpretarErrorEnvio, registrarEnvio, type ResultadoEnvio } from './envioCodigos';

/** Reenvía el código de confirmación del registro (8 dígitos). */
export async function sendVerificationEmail(email: string): Promise<ResultadoEnvio> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return interpretarErrorEnvio(error);
    registrarEnvio(email);
    return { success: true };
  } catch (error) {
    return interpretarErrorEnvio(error);
  }
}

/**
 * Código por correo para el segundo factor de colaboradores. Lo genera y
 * valida exclusivamente Supabase Auth.
 */
export async function sendLoginOTP(email: string): Promise<ResultadoEnvio> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) return interpretarErrorEnvio(error);
    registrarEnvio(email);
    return { success: true };
  } catch (error) {
    return interpretarErrorEnvio(error);
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
