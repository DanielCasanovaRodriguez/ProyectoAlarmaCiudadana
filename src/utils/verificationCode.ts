import { createClient } from '../utils/supabase/client';

/**
 * Genera un código de verificación
 * @param length - Longitud del código (por defecto 6 dígitos)
 */
export function generateVerificationCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

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
 * Envía un código OTP para login de administradores (usuarios ya confirmados)
 * @param email - Email del destinatario
 * @returns Promise con el resultado del envío
 */
export async function sendLoginOTP(email: string): Promise<{ 
  success: boolean; 
  error?: string; 
  isLocalCode?: boolean; 
  code?: string;
}> {
  try {
    const supabase = createClient();
    
    console.log('📧 Enviando código OTP de login a:', email);
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false, // No crear usuario automáticamente
      }
    });
    
    if (error) {
      console.warn('⚠️ Error al enviar OTP por Supabase:', error.message);
      
      // Si es rate limit u otro error, usar código local
      if (error.message.includes('rate limit') || error.message.includes('Email rate limit exceeded')) {
        console.log('⚠️ Rate limit excedido, usando código local de desarrollo');
        const localCode = generateVerificationCode(6); // 6 dígitos para OTP de login
        storeVerificationCode(email, localCode);
        
        console.log('📧 ========================================');
        console.log('📧 CÓDIGO OTP LOCAL (Login Admin)');
        console.log('📧 ========================================');
        console.log(`📧 Para: ${email}`);
        console.log(`📧 Código: ${localCode}`);
        console.log('📧 ========================================');
        
        return { 
          success: true, 
          isLocalCode: true, 
          code: localCode 
        };
      }
      
      return { success: false, error: error.message };
    }
    
    console.log('✅ Código OTP enviado exitosamente por email');
    return { success: true, isLocalCode: false };
  } catch (error: any) {
    console.error('❌ Error al enviar OTP:', error);
    
    // Fallback a código local
    const localCode = generateVerificationCode(6); // 6 dígitos para OTP de login
    storeVerificationCode(email, localCode);
    
    console.log('📧 ========================================');
    console.log('📧 CÓDIGO OTP LOCAL (Fallback)');
    console.log('📧 ========================================');
    console.log(`📧 Para: ${email}`);
    console.log(`📧 Código: ${localCode}`);
    console.log('📧 ========================================');
    
    return { 
      success: true, 
      isLocalCode: true, 
      code: localCode 
    };
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
  isLocalVerification?: boolean;
}> {
  try {
    const supabase = createClient();
    
    console.log(`🔐 Verificando código con Supabase (${type}) para:`, email);
    console.log(`🔐 Código recibido:`, token);
    
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
      isLocalVerification: false
    };
  } catch (error: any) {
    console.error('❌ Error al verificar código:', error);
    return { 
      success: false, 
      error: 'Error al verificar el código. Por favor intenta de nuevo.' 
    };
  }
}

/**
 * Almacena un código de verificación temporal en localStorage
 */
export function storeVerificationCode(email: string, code: string): void {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos
  localStorage.setItem(`verification_code_${email}`, JSON.stringify({
    code,
    expiresAt
  }));
  console.log('💾 Código almacenado en localStorage para:', email);
}

/**
 * Obtiene y valida un código de verificación almacenado
 */
export function getStoredVerificationCode(email: string): string | null {
  const stored = localStorage.getItem(`verification_code_${email}`);
  if (!stored) return null;
  
  try {
    const { code, expiresAt } = JSON.parse(stored);
    if (Date.now() > expiresAt) {
      // Código expirado
      console.log('⏰ Código expirado para:', email);
      localStorage.removeItem(`verification_code_${email}`);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

/**
 * Limpia un código de verificación usado
 */
export function clearVerificationCode(email: string): void {
  localStorage.removeItem(`verification_code_${email}`);
  console.log('🗑️ Código limpiado para:', email);
}