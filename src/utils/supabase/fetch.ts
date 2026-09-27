import { OfflineError, TimeoutError, isOnline } from '../errors';

/** Tiempo máximo por solicitud. Las subidas de archivos tienen más margen. */
const TIMEOUT_MS        = 30_000;
const TIMEOUT_UPLOAD_MS = 180_000;

const ERROR_DE_RED = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected|err_network/i;

/**
 * `fetch` que usa el cliente de Supabase.
 *
 * - Sin red: falla de inmediato con OfflineError ("Sin conexión a internet…")
 *   en lugar de esperar y mostrar "Failed to fetch".
 * - Solicitudes colgadas: se cancelan con TimeoutError.
 * - Respeta la cancelación pedida por quien llama (AbortSignal propio).
 */
export const fetchConControlDeRed: typeof fetch = async (input, init = {}) => {
  if (!isOnline()) throw new OfflineError();

  const url    = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const esSubida = /\/storage\/v1\/object\//.test(url) && (method === 'POST' || method === 'PUT');

  const controller = new AbortController();
  const externo = init.signal;
  const alAbortarExterno = () => controller.abort(externo?.reason);
  if (externo) {
    if (externo.aborted) controller.abort(externo.reason);
    else externo.addEventListener('abort', alAbortarExterno, { once: true });
  }

  let porTiempo = false;
  const timer = setTimeout(() => { porTiempo = true; controller.abort(); }, esSubida ? TIMEOUT_UPLOAD_MS : TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (porTiempo) throw new TimeoutError(err);
    if (externo?.aborted) throw err; // cancelación intencional: se propaga tal cual
    if (!isOnline() || ERROR_DE_RED.test(String(err?.message ?? err))) throw new OfflineError(err);
    throw err;
  } finally {
    clearTimeout(timer);
    externo?.removeEventListener('abort', alAbortarExterno);
  }
};
