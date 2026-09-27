import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

/**
 * Estado de conexión del dispositivo.
 * Android: plugin nativo (detecta cambios de Wi-Fi/datos al instante).
 * Web: eventos online/offline del navegador.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    let quitar: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      Network.getStatus().then(s => setOnline(s.connected)).catch(() => undefined);
      Network.addListener('networkStatusChange', s => setOnline(s.connected))
        .then(h => { quitar = () => { h.remove(); }; })
        .catch(() => undefined);
    }

    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      quitar?.();
    };
  }, []);

  return online;
}
