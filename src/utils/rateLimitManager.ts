/**
 * Rate Limit Manager
 * Gestiona los límites de tasa y proporciona funciones de limpieza
 */

const RATE_LIMIT_KEY = 'passwordResetRateLimitExpiry';
const LAST_REQUEST_KEY = 'passwordResetLastRequest';
const REQUEST_COUNT_KEY = 'passwordResetRequestCount';

export interface RateLimitStatus {
  isBlocked: boolean;
  remainingTime: number; // en milisegundos
  canRetry: boolean;
  message: string;
}

/**
 * Verifica si hay un rate limit activo
 */
export function checkRateLimit(): RateLimitStatus {
  if (typeof window === 'undefined') {
    return { isBlocked: false, remainingTime: 0, canRetry: true, message: '' };
  }

  const rateLimitExpiry = localStorage.getItem(RATE_LIMIT_KEY);
  
  if (!rateLimitExpiry) {
    return { isBlocked: false, remainingTime: 0, canRetry: true, message: '' };
  }

  const expiryTime = parseInt(rateLimitExpiry, 10);
  const now = Date.now();
  const remainingTime = expiryTime - now;

  if (remainingTime <= 0) {
    // Expiró, limpiar
    clearRateLimit();
    return { isBlocked: false, remainingTime: 0, canRetry: true, message: '' };
  }

  const minutesRemaining = Math.ceil(remainingTime / (60 * 1000));
  
  return {
    isBlocked: true,
    remainingTime,
    canRetry: false,
    message: `Debes esperar ${minutesRemaining} minuto${minutesRemaining > 1 ? 's' : ''} antes de intentar de nuevo`
  };
}

/**
 * Establece un bloqueo de rate limit
 */
export function setRateLimit(durationMinutes: number = 15): void {
  if (typeof window === 'undefined') return;

  const expiryTime = Date.now() + (durationMinutes * 60 * 1000);
  localStorage.setItem(RATE_LIMIT_KEY, expiryTime.toString());
}

/**
 * Limpia el rate limit (permite al usuario reintentar)
 */
export function clearRateLimit(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(RATE_LIMIT_KEY);
  localStorage.removeItem(LAST_REQUEST_KEY);
  localStorage.removeItem(REQUEST_COUNT_KEY);
  
  console.log('✅ Rate limit limpiado exitosamente');
}

/**
 * Registra un intento de solicitud
 * Retorna true si se puede continuar, false si se debe bloquear
 */
export function recordRequest(): boolean {
  if (typeof window === 'undefined') return true;

  const now = Date.now();
  const lastRequest = localStorage.getItem(LAST_REQUEST_KEY);
  const requestCount = parseInt(localStorage.getItem(REQUEST_COUNT_KEY) || '0', 10);

  // Si la última solicitud fue hace más de 1 hora, resetear contador
  if (lastRequest) {
    const lastRequestTime = parseInt(lastRequest, 10);
    const hourInMs = 60 * 60 * 1000;
    
    if (now - lastRequestTime > hourInMs) {
      localStorage.setItem(REQUEST_COUNT_KEY, '1');
      localStorage.setItem(LAST_REQUEST_KEY, now.toString());
      return true;
    }
  }

  // Incrementar contador
  const newCount = requestCount + 1;
  localStorage.setItem(REQUEST_COUNT_KEY, newCount.toString());
  localStorage.setItem(LAST_REQUEST_KEY, now.toString());

  // Si se han hecho más de 3 intentos en la última hora, bloquear
  if (newCount > 3) {
    setRateLimit(15);
    return false;
  }

  return true;
}

/**
 * Obtiene información sobre cuántas solicitudes quedan
 */
export function getRemainingAttempts(): number {
  if (typeof window === 'undefined') return 3;

  const requestCount = parseInt(localStorage.getItem(REQUEST_COUNT_KEY) || '0', 10);
  return Math.max(0, 3 - requestCount);
}

/**
 * Limpia todo el estado relacionado con rate limiting
 * (Útil para debugging o cuando el usuario tiene problemas)
 */
export function resetAllRateLimits(): void {
  clearRateLimit();
  console.log('🔄 Todos los límites de tasa han sido reseteados');
}
