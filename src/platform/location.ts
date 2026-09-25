import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position } from '@capacitor/geolocation';

export interface Coords {
  lat:       number;
  lng:       number;
  accuracy?: number;
}

/**
 * Motivos por los que no se pudo obtener la ubicación.
 * - denied:       el usuario negó el permiso (se puede volver a pedir).
 * - blocked:      el permiso quedó denegado de forma permanente; solo se
 *                 puede activar desde los ajustes del sistema.
 * - disabled:     el GPS / servicios de ubicación del dispositivo están apagados.
 * - timeout:      no se obtuvo una posición a tiempo.
 * - unavailable:  otro error (sin señal, navegador sin soporte, etc.).
 */
export type LocationErrorReason = 'denied' | 'blocked' | 'disabled' | 'timeout' | 'unavailable';

export class LocationError extends Error {
  constructor(public reason: LocationErrorReason, message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

const MESSAGES: Record<LocationErrorReason, string> = {
  denied:      'Necesitamos tu ubicación para enviar la alerta al lugar correcto.',
  blocked:     'El permiso de ubicación está bloqueado. Actívalo en Ajustes > Apps > Alerta Ciudadana > Permisos.',
  disabled:    'La ubicación del dispositivo está desactivada. Actívala e intenta de nuevo.',
  timeout:     'No se pudo obtener tu ubicación a tiempo. Intenta de nuevo en un lugar con mejor señal.',
  unavailable: 'No se pudo obtener tu ubicación.',
};

function toLocationError(err: unknown): LocationError {
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  const code = (err as any)?.code;

  if (code === 1 || msg.includes('denied') || msg.includes('permission')) {
    return new LocationError('denied', MESSAGES.denied);
  }
  if (msg.includes('not enabled') || msg.includes('disabled') || msg.includes('location services')) {
    return new LocationError('disabled', MESSAGES.disabled);
  }
  if (code === 3 || msg.includes('timeout')) {
    return new LocationError('timeout', MESSAGES.timeout);
  }
  return new LocationError('unavailable', MESSAGES.unavailable);
}

/**
 * Asegura el permiso de ubicación en primer plano.
 * En Android pide ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION en tiempo de
 * ejecución. No se solicita ubicación en segundo plano: el sistema solo la
 * necesita en el momento de reportar o ver el mapa.
 */
export async function ensureLocationPermission(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return; // el navegador pregunta al pedir la posición

  let status = await Geolocation.checkPermissions().catch(() => null);
  if (status?.location === 'granted' || status?.coarseLocation === 'granted') return;

  status = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] })
    .catch((err) => { throw toLocationError(err); });

  if (status.location === 'granted' || status.coarseLocation === 'granted') return;

  // En Android, tras una segunda negativa el sistema deja de mostrar el
  // diálogo y requestPermissions devuelve 'denied' inmediatamente.
  throw new LocationError('blocked', MESSAGES.blocked);
}

/**
 * Obtiene una posición fresca y precisa (para enviar una alerta).
 */
export async function getCurrentLocation(options?: {
  highAccuracy?: boolean;
  timeoutMs?:    number;
  maxAgeMs?:     number;
}): Promise<Coords> {
  await ensureLocationPermission();

  try {
    const pos: Position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: options?.highAccuracy ?? true,
      timeout:            options?.timeoutMs ?? 15_000,
      maximumAge:         options?.maxAgeMs ?? 0,
    });
    return {
      lat:      pos.coords.latitude,
      lng:      pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch (err) {
    if (err instanceof LocationError) throw err;
    throw toLocationError(err);
  }
}

/**
 * Sigue la posición mientras una pantalla está visible (mapa).
 * Devuelve una función para detener el seguimiento (ahorro de batería).
 */
export async function watchLocation(
  onChange: (coords: Coords) => void,
  onError?: (err: LocationError) => void,
): Promise<() => void> {
  await ensureLocationPermission();

  const id = await Geolocation.watchPosition(
    { enableHighAccuracy: false, maximumAge: 30_000, timeout: 30_000 },
    (pos, err) => {
      if (err) { onError?.(toLocationError(err)); return; }
      if (pos) onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
    },
  );

  return () => { Geolocation.clearWatch({ id }).catch(() => undefined); };
}
