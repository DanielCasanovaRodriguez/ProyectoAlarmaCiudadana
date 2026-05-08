/**
 * Configuración de Entorno
 * Controla el comportamiento de desarrollo vs producción
 */

// ==========================================
// CONFIGURACIÓN PRINCIPAL
// ==========================================

/**
 * Modo de desarrollo
 * 
 * TRUE = Modo desarrollo (testing rápido, sin rate limits)
 * FALSE = Modo producción (emails reales, con rate limits)
 */
export const IS_DEVELOPMENT = true; // 👈 Cambiar a false en producción

/**
 * Habilitar logs detallados en consola
 */
export const ENABLE_DEBUG_LOGS = true; // 👈 Cambiar a false en producción

// ==========================================
// CONFIGURACIÓN DE AUTENTICACIÓN
// ==========================================

/**
 * Modo de autenticación
 * 
 * 'real' = Usa Supabase real (emails reales, rate limits reales)
 * 'mock' = Simula autenticación (para testing rápido sin esperas)
 * 'hybrid' = Usa Supabase pero con códigos predecibles (mejor para desarrollo)
 */
export type AuthMode = 'real' | 'mock' | 'hybrid';

export const AUTH_MODE: AuthMode = IS_DEVELOPMENT ? 'hybrid' : 'real';

// ==========================================
// CÓDIGOS DE DESARROLLO
// ==========================================

/**
 * Código OTP fijo para modo desarrollo
 * Úsalo cuando AUTH_MODE = 'mock' o 'hybrid'
 */
export const DEV_OTP_CODE = '12345678';

/**
 * Emails de prueba que siempre funcionan en desarrollo
 * Estos emails NO necesitan existir en Supabase
 */
export const DEV_TEST_EMAILS = [
  'test@dev.com',
  'prueba@dev.com',
  'demo@dev.com',
  'testing@dev.com',
  'desarrollo@dev.com'
];

/**
 * Contraseña de prueba para desarrollo
 */
export const DEV_TEST_PASSWORD = 'Test123456!';

// ==========================================
// CONFIGURACIÓN DE RATE LIMITS
// ==========================================

/**
 * Tiempo de espera entre intentos en desarrollo (segundos)
 */
export const DEV_RATE_LIMIT_COOLDOWN = 3; // Solo 3 segundos en desarrollo

/**
 * Tiempo de espera en producción (segundos)
 */
export const PROD_RATE_LIMIT_COOLDOWN = 60; // 60 segundos en producción

/**
 * Obtener cooldown según modo
 */
export const getRateLimitCooldown = () => 
  IS_DEVELOPMENT ? DEV_RATE_LIMIT_COOLDOWN : PROD_RATE_LIMIT_COOLDOWN;

// ==========================================
// FUNCIONES ÚTILES
// ==========================================

/**
 * Verifica si un email es de prueba
 */
export function isTestEmail(email: string): boolean {
  return DEV_TEST_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Log de desarrollo (solo se muestra si ENABLE_DEBUG_LOGS = true)
 */
export function devLog(message: string, ...args: any[]) {
  if (ENABLE_DEBUG_LOGS) {
    console.log(`[DEV] ${message}`, ...args);
  }
}

/**
 * Obtener configuración actual
 */
export function getEnvironmentConfig() {
  return {
    isDevelopment: IS_DEVELOPMENT,
    authMode: AUTH_MODE,
    debugLogs: ENABLE_DEBUG_LOGS,
    rateLimitCooldown: getRateLimitCooldown()
  };
}

// ==========================================
// MENSAJES DE INFORMACIÓN
// ==========================================

if (IS_DEVELOPMENT) {
  console.log('🔧 MODO DESARROLLO ACTIVADO');
  console.log('━'.repeat(50));
  console.log(`📋 Auth Mode: ${AUTH_MODE}`);
  console.log(`⏱️  Rate Limit: ${getRateLimitCooldown()}s`);
  console.log(`🔑 Código OTP Desarrollo: ${DEV_OTP_CODE}`);
  console.log(`📧 Emails de Prueba:`, DEV_TEST_EMAILS);
  console.log('━'.repeat(50));
  console.log('💡 Para producción: Cambia IS_DEVELOPMENT = false en /config/environment.ts');
  console.log('');
}
