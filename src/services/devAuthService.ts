/**
 * Servicio de Autenticación para Desarrollo
 * Simula el comportamiento de Supabase sin rate limits
 */

import { 
  IS_DEVELOPMENT, 
  AUTH_MODE, 
  DEV_OTP_CODE, 
  isTestEmail,
  devLog 
} from '../config/environment';

// ==========================================
// STORAGE SIMULADO
// ==========================================

interface MockOTP {
  email: string;
  code: string;
  type: 'signup' | 'recovery';
  createdAt: number;
  expiresAt: number;
}

const MOCK_OTP_STORAGE: MockOTP[] = [];

// ==========================================
// FUNCIONES DE DESARROLLO
// ==========================================

/**
 * Genera código OTP para desarrollo
 * En modo hybrid: siempre retorna DEV_OTP_CODE
 * En modo mock: genera código aleatorio pero predecible
 */
function generateDevOTP(): string {
  if (AUTH_MODE === 'hybrid') {
    return DEV_OTP_CODE;
  }
  
  // Código aleatorio de 8 dígitos
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/**
 * Simula envío de OTP (sin llamar a Supabase)
 */
export async function mockSendOTP(
  email: string,
  type: 'signup' | 'recovery'
): Promise<{ success: boolean; error?: string; code?: string }> {
  
  devLog(`📧 [MOCK] Enviando OTP a ${email} (tipo: ${type})`);
  
  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const code = generateDevOTP();
  
  // Guardar en storage simulado
  const otp: MockOTP = {
    email: email.toLowerCase().trim(),
    code,
    type,
    createdAt: Date.now(),
    expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutos
  };
  
  // Limpiar códigos antiguos del mismo email
  const index = MOCK_OTP_STORAGE.findIndex(o => o.email === otp.email && o.type === type);
  if (index !== -1) {
    MOCK_OTP_STORAGE.splice(index, 1);
  }
  
  MOCK_OTP_STORAGE.push(otp);
  
  devLog(`✅ [MOCK] Código generado: ${code}`);
  devLog(`📋 [MOCK] Códigos activos:`, MOCK_OTP_STORAGE.length);
  
  // En consola, mostrar el código claramente
  console.log('━'.repeat(60));
  console.log(`📧 EMAIL: ${email}`);
  console.log(`🔑 CÓDIGO: ${code}`);
  console.log(`⏱️  EXPIRA: ${new Date(otp.expiresAt).toLocaleTimeString()}`);
  console.log('━'.repeat(60));
  
  return { 
    success: true, 
    code // Retornar código para poder mostrarlo en UI de desarrollo
  };
}

/**
 * Simula verificación de OTP (sin llamar a Supabase)
 */
export async function mockVerifyOTP(
  email: string,
  code: string,
  type: 'signup' | 'recovery' | 'email'
): Promise<{ success: boolean; error?: string; session?: any }> {
  
  devLog(`🔐 [MOCK] Verificando OTP para ${email}`);
  devLog(`🔐 [MOCK] Código recibido: ${code}`);
  
  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = code.trim();
  
  // Buscar OTP en storage
  const otpType = type === 'email' ? 'recovery' : type;
  const storedOTP = MOCK_OTP_STORAGE.find(
    o => o.email === normalizedEmail && o.type === otpType
  );
  
  if (!storedOTP) {
    devLog(`❌ [MOCK] No se encontró código para ${email}`);
    return {
      success: false,
      error: 'Código no encontrado. Por favor solicita un nuevo código.'
    };
  }
  
  // Verificar expiración
  if (Date.now() > storedOTP.expiresAt) {
    devLog(`❌ [MOCK] Código expirado`);
    return {
      success: false,
      error: 'El código ha expirado. Por favor solicita un nuevo código.'
    };
  }
  
  // Verificar código
  if (storedOTP.code !== normalizedCode) {
    devLog(`❌ [MOCK] Código incorrecto`);
    devLog(`   Esperado: ${storedOTP.code}, Recibido: ${normalizedCode}`);
    return {
      success: false,
      error: 'Código incorrecto. Por favor verifica e intenta de nuevo.'
    };
  }
  
  // Código correcto - eliminar de storage
  const index = MOCK_OTP_STORAGE.indexOf(storedOTP);
  if (index !== -1) {
    MOCK_OTP_STORAGE.splice(index, 1);
  }
  
  devLog(`✅ [MOCK] Código verificado correctamente`);
  
  // Simular sesión
  const mockSession = {
    user: {
      id: `mock-user-${Date.now()}`,
      email: normalizedEmail,
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    },
    access_token: `mock-token-${Date.now()}`,
    refresh_token: `mock-refresh-${Date.now()}`
  };
  
  return {
    success: true,
    session: mockSession
  };
}

/**
 * Simula actualización de contraseña
 */
export async function mockUpdatePassword(
  password: string
): Promise<{ success: boolean; error?: string }> {
  
  devLog(`🔐 [MOCK] Actualizando contraseña`);
  
  // Simular delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Validar contraseña básica
  if (password.length < 8) {
    return {
      success: false,
      error: 'La contraseña debe tener al menos 8 caracteres'
    };
  }
  
  devLog(`✅ [MOCK] Contraseña actualizada`);
  
  return { success: true };
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

/**
 * Limpia códigos expirados del storage
 */
export function cleanExpiredOTPs() {
  const now = Date.now();
  const before = MOCK_OTP_STORAGE.length;
  
  for (let i = MOCK_OTP_STORAGE.length - 1; i >= 0; i--) {
    if (MOCK_OTP_STORAGE[i].expiresAt < now) {
      MOCK_OTP_STORAGE.splice(i, 1);
    }
  }
  
  const removed = before - MOCK_OTP_STORAGE.length;
  if (removed > 0) {
    devLog(`🧹 [MOCK] Códigos expirados eliminados: ${removed}`);
  }
}

/**
 * Obtiene todos los códigos activos (solo para debugging)
 */
export function getActiveOTPs(): MockOTP[] {
  cleanExpiredOTPs();
  return [...MOCK_OTP_STORAGE];
}

/**
 * Limpia todos los códigos
 */
export function clearAllOTPs() {
  MOCK_OTP_STORAGE.length = 0;
  devLog(`🧹 [MOCK] Todos los códigos limpiados`);
}

// Limpiar códigos expirados cada minuto
if (IS_DEVELOPMENT) {
  setInterval(cleanExpiredOTPs, 60000);
}
