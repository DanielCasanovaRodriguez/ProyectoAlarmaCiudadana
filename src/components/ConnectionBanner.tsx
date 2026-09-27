import { useEffect, useRef } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineStatus } from '../platform/network';

/**
 * Aviso fijo cuando el dispositivo pierde la conexión, y aviso breve
 * cuando la recupera. Se muestra en todas las pantallas (web y Android).
 */
export function ConnectionBanner() {
  const online = useOnlineStatus();
  const estuvoSinConexion = useRef(false);

  useEffect(() => {
    if (!online) {
      estuvoSinConexion.current = true;
    } else if (estuvoSinConexion.current) {
      estuvoSinConexion.current = false;
      toast.success('Conexión restablecida');
    }
  }, [online]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-x-0 top-0 z-[100] bg-gray-900 text-white text-sm px-4 flex items-center justify-center gap-2 shadow-lg"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)', paddingBottom: '8px' }}
    >
      <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden />
      <span>Sin conexión a internet. Algunas funciones no están disponibles.</span>
    </div>
  );
}
